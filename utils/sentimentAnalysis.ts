import { prisma } from "@/utils/prisma";

// const HF_API = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment";
const HF_API = "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment";

interface HfSentimentResult {
  label: string;
  score: number;
}

/**
 * Analyzes a single piece of text using Hugging Face Inference API
 */
async function analyzeText(text: string): Promise<string> {
  try {
    const res = await fetch(HF_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    const data = await res.json();

    // Handle model loading/cold start
    if (data.error && data.estimated_time) {
      console.warn("HF Model loading, skipping this post analysis...");
      return "neutral";
    }

    if (!Array.isArray(data) || !data[0] || !data[0][0]) {
      return "neutral";
    }

    const topResult: HfSentimentResult = data[0][0];
    const label = topResult.label.toLowerCase();

    if (label === "label_0") {
      return "negative";
    } else if (label === "label_2") {
      return "positive";
    } else {
      return "neutral";
    }
  } catch (error) {
    console.error("Sentiment analysis failed:", error);
    return "neutral";
  }
}

/**
 * Calculates the dominant sentiment from an array
 */
function aggregate(sentiments: string[]): string {
  if (sentiments.length === 0) return "neutral";

  const counts: Record<string, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };

  for (const s of sentiments) {
    if (counts[s] !== undefined) {
      counts[s]++;
    }
  }

  const { positive, negative, neutral } = counts;

  if (positive === 0 && negative == 0) return "neutral";
  if (positive/(positive + negative + neutral) >= 2/3) return "positive";
  if (negative/(positive + negative + neutral) >= 2/3) return "negative";
  return "mixed";
}

interface SentimentResults {
  homeTeamSentiment: string;
  awayTeamSentiment: string;
  totalSentiment: string;
}

/**
 * Analyzes an entire thread and updates the database
 */
export async function analyzeThreadSentiment(threadId: number): Promise<SentimentResults | undefined> {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      posts: {
        where: { visibility: true }
      },
      matchDiscussionFor: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
    },
  });

  if (!thread || !thread.matchDiscussionFor) return;

  // --- DEBUG LOG ---
  console.log(`📊 Analyzing Thread ${threadId}: Found ${thread.posts.length} visible posts.`);
  for (const post of thread.posts) {
    console.log(`- Post ${post.id}: "${post.content.slice(0, 50)}..."`);
    console.log('post visibility: ', post.visibility);
  }
  // -----------------
  const homeTeamName = thread.matchDiscussionFor.homeTeam.name.toLowerCase();
  const awayTeamName = thread.matchDiscussionFor.awayTeam.name.toLowerCase();

  const totalSentiments: string[] = [];
  const homeSentiments: string[] = [];
  const awaySentiments: string[] = [];

  // Use for...of to handle async/await sequentially (safer for rate limits)
  for (const post of thread.posts) {
    const sentiment = await analyzeText(post.content);
    const lowerContent = post.content.toLowerCase();

    if (lowerContent.includes(homeTeamName)) {
      homeSentiments.push(sentiment);
    }

    if (lowerContent.includes(awayTeamName)) {
      awaySentiments.push(sentiment);
    }
    
    totalSentiments.push(sentiment);
  }

  const homeResult = aggregate(homeSentiments);
  const awayResult = aggregate(awaySentiments);
  const totalResult = aggregate(totalSentiments);

  // Update the thread with the new data
  await prisma.thread.update({
    where: { id: threadId },
    data: {
      homeTeamSentiment: homeResult,
      awayTeamSentiment: awayResult,
    },
  });

  return {
    homeTeamSentiment: homeResult,
    awayTeamSentiment: awayResult,
    totalSentiment: totalResult,
  };
}
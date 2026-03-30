// Code source: Gemini

import { prisma } from "../prisma/db";
import { translateToEnglish } from "./translate";

// Check if a given text contains inappropriate content, returning an object 
// with a boolean "aiFlagged", an array of "reasons" and an array of "scores" if flagged. 
export async function checkInappropriate(text: string, retries = 3) {

  // First translate text to English.
  const translatedText = await translateToEnglish(text);
  console.log("Translated text:", translatedText);

  // This function uses the Hugging Face Inference API with the "unitary/toxic-bert" 
  // model to analyze the text for toxicity. 
  for (let i = 0; i < retries; i++) {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert",
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: translatedText }),
      }
    );

    const result = await response.json();

    // If the model times out, wait 5 seconds and try again
    if (response.status === 503 || result.error?.includes("loading")) {
      console.log(`Model is warming up... attempt ${i + 1}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      continue;
    }

    if (!response.ok) throw new Error("API Error: Response code " + response.status);

    const THRESHOLD = 0.7;
    const violations = result[0].filter((item: { score: number }) => item.score > THRESHOLD);
    const violationScores = result[0].map((item: { score: number }) => item.score);
    let aiMaxScore = 100 * Math.max(...violationScores); // mult by 100 to get a 0-100 score

    return {
      aiFlagged: violations.length > 0,
      reasons: violations.map((v: { label: string }) => v.label),
      scores: violationScores,
      aiMaxScore };
  }

  throw new Error("API Error: Model failed to load after multiple retries");
}

export async function createReport(userId: number, reason: string, targetType: string, targetId: number) {
  // Create a report
  // Set target id based on type, increment count and create report
  let isThread = targetType === "THREAD";
  let isPost = targetType === "POST";
  let isPoll = targetType === "POLL";
  let data = { userId, reason,
    ...(isThread && { threadId: targetId }),
    ...(isPost && { postId: targetId }),
    ...(isPoll && { pollId: targetId })
  };
  if (isThread) {
    await prisma.thread.update({
      where: { id: targetId },
      data: { reportCount: { increment: 1 } },
    });
  }
  if (isPost) {
    await prisma.post.update({
      where: { id: targetId },
      data: { reportCount: { increment: 1 } },
    });
  }
  if (isPoll) {
    await prisma.poll.update({
      where: { id: targetId },
      data: { reportCount: { increment: 1 } },
    });
  }

  const report = await prisma.report.create({
    data,
  });
}

export async function recalculateThreadAiAverageScore(threadId: number) {
  const targetThread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      posts: { select: { aiMaxScore: true } },
      polls: { select: { aiMaxScore: true } },
    },
  });

  if (!targetThread) return;

  const posts = targetThread.posts || [];
  const polls = targetThread.polls || [];
  let aiAvgScore = 0;

  posts.forEach((p) => { aiAvgScore += (p.aiMaxScore || 0); });
  polls.forEach((p) => { aiAvgScore += (p.aiMaxScore || 0); });
  aiAvgScore /= (posts.length + polls.length || 1);

  await prisma.thread.update({
    where: { id: threadId },
    data: { aiAvgScore },
  });
}
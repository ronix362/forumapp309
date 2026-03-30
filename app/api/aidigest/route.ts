// Code source: Gemini
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import redisClient from "@/utils/redis"; // Import the Redis client!

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type QueryRequest = {
  messages: ChatMessage[];
  model: string;
};

type QueryResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

export async function GET(request: Request) {
  try {
    const cacheKey = 'daily_global_ai_digest';

    // 1. CHECK REDIS FIRST (Replaces the slow Postgres date-check)
    const cachedDigest = await redisClient.get(cacheKey);

    if (cachedDigest) {
      console.log("🚀 Cache HIT! Returning digest instantly from Redis.");
      return NextResponse.json({
        digest: cachedDigest,
        cached: true,
      });
    }

    console.log("🐌 Cache MISS! Fetching data and asking AI to generate a new digest...");

    // 2. Fetch recent posts
    const recentPosts = await prisma.post.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });

    // 3. Fetch recent matches
    const matches = await prisma.match.findMany({
      take: 10,
      where: { completed: true },
      orderBy: [{ date: "desc" }],
    });

    // 4. Get standings
    const standings = await prisma.sportsData.findUnique({
      where: { id: 1 },
    });

    const standingsData = standings?.jsonData;

    // Prompt
    const prompt = `Given the following football league standings, recent match data, and 
    recent dicussion posts in JSON format, 
    generate a concise summary of the current league situation, such as the top 3 teams, 
    any surprising underperformers, and key trends to watch for in the upcoming matches. 
    Use less than 200 words.
    Standings data: ${JSON.stringify(standingsData)}
    Matches data: ${JSON.stringify(matches)}
    Posts data: ${JSON.stringify(recentPosts)}`;
    
    // console.log("AI Digest prompt:", prompt);

    const result = await query({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "Qwen/Qwen2.5-7B-Instruct:together",
    });

    const digest = result.choices[0].message.content;

    console.log("AI Digest result generated successfully.");

    // 5. Save a permanent record to Postgres (Optional, but good for historical logging)
    await prisma.aiDigest.create({
      data: { digest },
    });

    // 6. SAVE TO REDIS CACHE
    // 86400 seconds = 24 hours. The AI won't be called again until this expires!
    await redisClient.setEx(cacheKey, 86400, digest);

    return NextResponse.json({ digest, cached: false });
    
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.startsWith("Unauthorized")) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
      console.error("Error generating digest:", error.message);
    }

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

async function query(data: QueryRequest): Promise<QueryResponse> {
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  const result: QueryResponse = await response.json();
  return result;
}
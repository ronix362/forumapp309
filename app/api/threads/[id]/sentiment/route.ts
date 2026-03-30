import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { analyzeThreadSentiment } from "@/utils/sentimentAnalysis";
import redisClient from "@/utils/redis";

// --- CRITICAL FIX ---
// This forces Next.js to treat this route as dynamic. 
// It prevents the browser and Next.js from serving a stale "Disk Cache" version.
export const revalidate = 0; 
export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const threadId = Number(id);

        if (!id || isNaN(threadId)) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        // 1. Define the unique Cache Key for this specific thread
        const cacheKey = `thread_sentiment_${threadId}`;

        // 2. Check Redis FIRST
        // This is extremely fast (approx 1-2ms)
        const cachedSentiment = await redisClient.get(cacheKey);
        
        if (cachedSentiment) {
            console.log(`🚀 Cache HIT! Returning sentiment for thread ${threadId}`);
            // Headers added to ensure the browser knows not to cache this response either
            return NextResponse.json(
                { sentiment: JSON.parse(cachedSentiment), cached: true },
                { 
                    headers: { 'Cache-Control': 'no-store, max-age=0' } 
                }
            );
        }

        // 3. Cache Miss Logic
        console.log(`🐌 Cache MISS! Analyzing sentiment for thread ${threadId}...`);

        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            include: {
                matchDiscussionFor: true,
            },
        });

        if (!thread) {
            return NextResponse.json({ error: "Parent thread not found" }, { status: 404 });
        }

        if (!thread.matchDiscussionFor) {
            return NextResponse.json(
                { error: "Sentiment is only available for match threads." },
                { status: 400 },
            );
        }

        // 4. Perform the expensive analysis (The slow part with Hugging Face)
        const sentiment = await analyzeThreadSentiment(threadId);

        if (!sentiment) {
            return NextResponse.json({ error: "Sentiment unavailable." }, { status: 404 });
        }

        // 5. SAVE TO REDIS CACHE
        // Store the object as a string. TTL is 24 hours (86400 seconds).
        // This cache stays until it expires OR until we manually call redisClient.del()
        // in our POST/PATCH/DELETE routes.
        await redisClient.setEx(cacheKey, 86400, JSON.stringify(sentiment));

        return NextResponse.json(
            { sentiment, cached: false },
            { 
                headers: { 'Cache-Control': 'no-store, max-age=0' } 
            }
        );

    } catch (err: any) {
        console.error("Sentiment Route Error:", err);
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
        }
        return NextResponse.json({ error: "Request failed: " + err.message }, { status: 400 });
    }
}
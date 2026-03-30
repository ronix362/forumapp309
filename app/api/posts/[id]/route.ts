import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";
import { verifyAccessToken } from "@/utils/auth";
import { checkInappropriate, createReport } from "@/utils/moderation";
import redisClient from "@/utils/redis";
import { analyzeThreadSentiment } from "@/utils/sentimentAnalysis"; // <-- 2. For the eager calculation

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
            where: { id: Number(id) },
            include: {
                author: { select: { id: true, username: true } },
                thread: { select: { id: true, title: true, mainPostId: true } },
                replies: {
                    where: { nextVersionId: null, visibility: true },
                    orderBy: { createdAt: "asc" },
                    include: { author: { select: { id: true, username: true } } },
                },
            },
        });

        if (!post) {
            return NextResponse.json({ error: "Post not found." }, { status: 404 });
        }

        return NextResponse.json(post);
    } catch (err: any) {
        return NextResponse.json({ error: "Something broke in GET api/posts/[id]: " + err.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authPayload = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };
        const { userId, role } = authPayload;

        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
        if (user.banned) return NextResponse.json({ error: "You are banned and cannot edit posts." }, { status: 403 });

        const oldPost = await prisma.post.findUnique({ where: { id: Number(id) } });
        if (!oldPost) return NextResponse.json({ error: "Post not found." }, { status: 404 });

        if (!oldPost.visibility && role !== "ADMIN") {
            return NextResponse.json({ error: "This post has been removed and cannot be edited." }, { status: 410 });
        }

        if (oldPost.authorId !== userId && role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized: You cannot edit this post." }, { status: 403 });
        }

        if (oldPost.nextVersionId != null && role !== "ADMIN") {
            return NextResponse.json(
                { error: "This post has already been edited. Further edits are not allowed to maintain history." },
                { status: 400 }
            );
        }

        const { content }: { content: string } = await request.json();
        if (!content) return NextResponse.json({ error: "Post content cannot be empty." }, { status: 400 });

        let aiFlagged = null, aiMaxScore = null, aiScores = null;
        try {
            const result = await checkInappropriate(content);
            aiFlagged = result.aiFlagged;
            aiMaxScore = result.aiMaxScore;
            aiScores = result.scores;
        } catch (error) {
            console.error("Toxicity API error:", error);
        }

        const { 
            id: _, 
            createdAt, 
            updatedAt, 
            content: __, 
            nextVersionId,
            aiFlagged: oldAiFlagged,
            aiMaxScore: oldAiMaxScore,
            aiScores: oldAiScores,
            ...copiedData 
        } = oldPost as any;

        const newPost = await prisma.post.create({
            data: {
                ...copiedData,
                previousVersionId: oldPost.id,
                content: content,
                aiFlagged: aiFlagged,
                aiMaxScore: aiMaxScore,
                aiScores: aiScores as any
            }
        });

        // --- 2. CACHE INVALIDATION (PATCH) ---
        // Content has changed, so sentiment must be cleared.
        try {
            await redisClient.del(`thread_sentiment_${oldPost.threadId}`);
            console.log(`🗑️ Sentiment cache cleared for thread ${oldPost.threadId} (Post Edited)`);
        } catch (e) { console.error("Redis error:", e); }

        if (aiFlagged) {
            await createReport(1, "Automatic AI flag", "POST", newPost.id);
        }

        await prisma.post.update({
            where: { id: oldPost.id },
            data: { nextVersionId: newPost.id }
        });

        await prisma.post.updateMany({
            where: { replyingToId: oldPost.id },
            data: { replyingToId: newPost.id }
        });

        await prisma.report.updateMany({
            where: { postId: oldPost.id },
            data: { postId: newPost.id }
        });

        const thread = await prisma.thread.findUnique({ where: { id: oldPost.threadId } });
        if (thread && thread.mainPostId === oldPost.id) {
            await prisma.thread.update({
                where: { id: oldPost.threadId },
                data: { mainPostId: newPost.id }
            });
        }

        return NextResponse.json(newPost);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
        }
        return NextResponse.json({ error: "An error occurred: " + err.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authPayload = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };
        const { userId, role } = authPayload;

        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
            where: { id: Number(id) }
        });

        if (!post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        if(!post.visibility) {
            return NextResponse.json({ error: "This post is already deleted." }, { status: 409 });
        }

        if (post.authorId !== userId && role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized: You cannot delete this post." }, { status: 403 });
        }

        // 1. Mark as deleted in DB
        const deletedPost = await prisma.post.update({
            where: { id: Number(id) },
            data: { visibility: false }
        });

        // --- 3. EAGER CACHE REFRESH (DELETE) ---
        // Instead of just deleting, we recalculate RIGHT NOW so the next user has a "HIT"
        try {
            console.log(`🔄 Post deleted. Re-calculating sentiment for thread ${post.threadId}...`);
            
            // Run the actual analysis utility
            const newSentiment = await analyzeThreadSentiment(post.threadId);
            
            if (newSentiment) {
                const cacheKey = `thread_sentiment_${post.threadId}`;
                // Update Redis with the brand new data immediately
                await redisClient.setEx(cacheKey, 86400, JSON.stringify(newSentiment));
                console.log(`✅ Sentiment eagerly updated in Redis for thread ${post.threadId}`);
            }
        } catch (e) { 
            console.error("Eager sentiment refresh failed:", e); 
            // We still delete the old cache as a fallback so we don't show stale data
            await redisClient.del(`thread_sentiment_${post.threadId}`);
        }

        return NextResponse.json(deletedPost);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized")) {
            return NextResponse.json({ error: err.message }, { status: 401 });
        }
        return NextResponse.json({ error: "Something broke in DELETE api/posts: " + err.message }, { status: 500 });
    }
}
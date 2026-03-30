import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";
import { checkInappropriate, createReport, recalculateThreadAiAverageScore } from "@/utils/moderation";
import { verifyAccessToken } from "@/utils/auth";
import redisClient from "@/utils/redis";

// Define the RouteContext to satisfy Next.js 15+ requirements
type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
        const postsPerPage = searchParams.get("postsPerPage") ? Number(searchParams.get("postsPerPage")) : 10;

        if (Number.isNaN(page) || page < 1) {
            return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
        }
        if (Number.isNaN(postsPerPage) || postsPerPage < 1) {
            return NextResponse.json({ error: "Invalid number of posts per page." }, { status: 400 });
        }

        const thread = await prisma.thread.findUnique({
            where: { id: Number(id) },
        });

        if (!thread) {
            return NextResponse.json({ error: "Parent thread not found" }, { status: 404 });
        }

        const posts = await prisma.post.findMany({
            where: { threadId: Number(id), nextVersionId: null, visibility: true }, // Only current, visible posts
            orderBy: { createdAt: "asc" },
            skip: (page - 1) * postsPerPage,
            take: postsPerPage,
            include: { author: { select: { id: true, username: true } } },
        });

        return NextResponse.json(posts);
    } catch (err: any) {
        return NextResponse.json({ error: "Something broke in GET: " + err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const authHeader = request.headers.get("authorization");
        const { userId, role } = verifyAccessToken(authHeader) as { userId: number, role: string };

        const { id } = await params;
        const threadId = Number(id);

        if (!id || isNaN(threadId)) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const { content, mainPostFor, replyingToId } = await request.json();
        
        if (!content) {
            return NextResponse.json({ error: "Post content cannot be empty." }, { status: 400 });
        }

        const author = await prisma.user.findUnique({ where: { id: userId } });
        if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });
        if (author.banned) return NextResponse.json({ error: "User is banned from posting." }, { status: 403 });

        const thread = await prisma.thread.findUnique({ where: { id: threadId } });
        if (!thread) return NextResponse.json({ error: "Parent thread not found" }, { status: 404 });

        if (!thread.visibility && role !== "ADMIN") {
            return NextResponse.json({ 
                error: "This thread has been closed or removed and no longer accepts posts." 
            }, { status: 410 });
        }

        // --- Prepare Data ---
        const data: any = {
            content,
            authorId: author.id,
            threadId: threadId
        };

        if (replyingToId) { 
            if (isNaN(Number(replyingToId))) {
                return NextResponse.json({ error: "Invalid replying to id." }, { status: 400 });
            }
            const parentPost = await prisma.post.findUnique({ where: { id: Number(replyingToId) } });
            if (!parentPost) return NextResponse.json({ error: "Post being replied to not found" }, { status: 404 });
            if (!parentPost.visibility && role !== "ADMIN") {
                return NextResponse.json({ error: "Cannot reply to a removed post." }, { status: 410 });
            }
            data.replyingToId = Number(replyingToId);
        }

        // --- AI Moderation ---
        let aiFlagged = false, aiMaxScore = 0, aiScores = null;
        try {
            const result = await checkInappropriate(content);
            aiFlagged = result.aiFlagged;
            aiMaxScore = result.aiMaxScore;
            aiScores = result.scores;
        } catch (error) {
            console.error("Toxicity API error:", error);
        }
        
        Object.assign(data, { aiFlagged, aiMaxScore, aiScores });

        // --- Create Post ---
        const post = await prisma.post.create({ data: data });

        // --- 2. CACHE INVALIDATION ---
        // Since a new post is added, the old sentiment analysis is now outdated.
        // We delete the cache so the next GET request triggers a fresh analysis.
        try {
            await redisClient.del(`thread_sentiment_${threadId}`);
            console.log(`🗑️ Cache Purged: thread_sentiment_${threadId}`);
        } catch (redisErr) {
            console.error("Redis deletion failed:", redisErr);
            // We don't return an error to the user if Redis fails; 
            // the post was still created successfully.
        }

        if (aiFlagged) {
            await createReport(1, "Automatic AI flag", "POST", post.id);
        }

        await recalculateThreadAiAverageScore(post.threadId);

        if (mainPostFor) {
            await prisma.thread.update({
                where: { id: threadId },
                data: { mainPostId: post.id }
            });
        }

        return NextResponse.json(post);
        
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
        }
        return NextResponse.json({ error: "Something broke in POST: " + err.message }, { status: 400 });
    }
}
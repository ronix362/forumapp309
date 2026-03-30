import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/utils/auth";
import { checkInappropriate, createReport, recalculateThreadAiAverageScore } from "@/utils/moderation";

// 1. Define the RouteContext with a Promise for params
type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
    try {
        // 2. Await the params promise
        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const thread = await prisma.thread.findUnique({
            where: { id: Number(id) },
            include: {
                polls: {
                    include: {
                        author: {
                            select: { id: true, username: true }
                        }
                    }
                }
            }
        });

        if (!thread) {
            return NextResponse.json({ error: "Parent thread not found" }, { status: 404 });
        }

        return NextResponse.json(thread.polls);
    } catch (err: any) {
        return NextResponse.json({ error: "Something broke in GET: " + err.message }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteContext) {
    try {
        const authHeader = request.headers.get("authorization");
        const { userId } = verifyAccessToken(authHeader) as { userId: number };

        // 3. Await the params promise here as well
        const { id: threadId } = await params;
        if (!threadId || isNaN(Number(threadId))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const { pollDescription, options, deadline } = await request.json();

        // --- Validation ---
        if (!pollDescription) {
            return NextResponse.json({ error: "Poll description cannot be empty." }, { status: 400 });
        }

        if (!deadline || isNaN(Date.parse(deadline))) {
            return NextResponse.json({ error: "Invalid deadline format." }, { status: 400 });
        }

        if (new Date(deadline) <= new Date()) {
            return NextResponse.json({ error: "Deadline must be in the future." }, { status: 400 });
        }

        if (!options || !Array.isArray(options) || options.length < 2) {
            return NextResponse.json({ error: "Poll must have at least 2 options." }, { status: 400 });
        }

        const author = await prisma.user.findUnique({ where: { id: userId } });
        if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });
        if (author.banned) return NextResponse.json({ error: "User is banned from posting." }, { status: 403 });

        const thread = await prisma.thread.findUnique({ where: { id: Number(threadId) } });
        if (!thread) return NextResponse.json({ error: "Parent thread not found" }, { status: 404 });

        // --- AI Moderation Logic ---
        let aiFlagged = false, aiMaxScore = 0, aiScores = null;
        try {
            const result = await checkInappropriate(pollDescription);
            aiFlagged = result.aiFlagged;
            aiMaxScore = result.aiMaxScore;
            aiScores = result.scores;
        } catch (error) {
            console.error("Toxicity API error:", error);
        }
        
        const poll = await prisma.poll.create({
            data: {
                pollDescription,
                deadline: new Date(deadline),
                authorId: author.id,
                threadId: Number(threadId),
                options: {
                    create: options.map((option: any) => {
                        if (typeof option !== "string" || !option.trim()) {
                            throw new Error("Invalid poll option content.");
                        }
                        return { text: option };
                    })
                },
                aiFlagged,
                aiMaxScore,
                aiScores,
            },
            include: { options: true }
        });

        await recalculateThreadAiAverageScore(Number(threadId));

        if (aiFlagged) {
            await createReport(1, "Automatic AI flag", "POLL", poll.id);
        }

        return NextResponse.json(poll);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized")) {
            return NextResponse.json({ error: err.message }, { status: 401 });
        }
        return NextResponse.json({ error: "Error in POST: " + err.message }, { status: 400 });
    }
}
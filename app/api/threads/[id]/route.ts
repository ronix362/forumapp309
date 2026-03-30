import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/utils/auth";

// Define the context type to include the Promise for params
type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }
        const thread = await prisma.thread.findUnique({
            where: { id: Number(id) },
            include: {
                mainPost: true,
                polls: true,
                tags: true,
                author: { select: { id: true, username: true } },
                forum: {
                    select: {
                        id: true,
                        type: true,
                        teamName: true,
                        teamId: true,
                        team: { select: { id: true, name: true } },
                    }
                },
                matchDiscussionFor: {
                    include: {
                        homeTeam: { select: { id: true, name: true } },
                        awayTeam: { select: { id: true, name: true } },
                    }
                }
            }
        });

        if (!thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        return NextResponse.json(thread);
    } catch (err: any) {
        return NextResponse.json({ error: "Something broke in GET api/threads/[id]: " + err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteContext) {
    try {
        const authHeader = request.headers.get("authorization");
        const { userId, role } = verifyAccessToken(authHeader) as { userId: number, role: string };

        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: "User account not found." }, { status: 404 });
        if (user.banned) return NextResponse.json({ error: "You are banned and cannot edit content." }, { status: 403 });

        const thread = await prisma.thread.findUnique({
            where: { id: Number(id) },
            include: { tags: true }
        });

        if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

        const isAuthor = thread.authorId === userId;
        const isAdmin = role === "ADMIN";

        if (!thread.visibility && !isAdmin) {
            return NextResponse.json({ error: "This thread has been removed and cannot be edited." }, { status: 410 });
        }

        if (!isAuthor && !isAdmin) {
            return NextResponse.json({ error: "Unauthorized: You cannot edit this thread." }, { status: 403 });
        }

        const { title, tags: tagsString, replace = false } = await request.json();
        const data: any = {};
        
        if (title) data.title = title;

        const tagsProvided = typeof tagsString === "string";
        if (tagsProvided) {
            const rawTags = (tagsString as string).split(",");
            const uniqueTags = [...new Set(rawTags.map(t => t.trim().toLowerCase()).filter(Boolean))];

            if (!replace) {
                if (uniqueTags.length > 0) {
                    const existingNames = thread.tags.map(t => t.name);
                    const tagsToAdd = uniqueTags.filter(t => !existingNames.includes(t));
                    data.tags = { create: tagsToAdd.map(name => ({ name })) };
                }
            } else {
                data.tags = {
                    deleteMany: {},
                    create: uniqueTags.map(name => ({ name })),
                };
            }
        }
        
        const updatedThread = await prisma.thread.update({
            where: { id: Number(id) },
            data: data
        });

        return NextResponse.json(updatedThread);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
        }
        return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: RouteContext) {
    try {
        const authHeader = request.headers.get("authorization");
        const { userId, role } = verifyAccessToken(authHeader) as { userId: number, role: string };

        const { id } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid thread id." }, { status: 400 });
        }

        const thread = await prisma.thread.findUnique({ where: { id: Number(id) } });
        if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        if (!thread.visibility) return NextResponse.json({ error: "This thread is already deleted." }, { status: 409 });

        if (thread.authorId !== userId && role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized: You cannot delete this thread." }, { status: 403 });
        }

        const deletedThread = await prisma.thread.update({
            where: { id: Number(id) },
            data: { visibility: false },
            include: { posts: true, polls: true}
        });
        for(const post of deletedThread.posts) {
            await prisma.post.update({
                where: { id: Number(post.id) },
                data: { visibility: false },
            });
        }
        for(const poll of deletedThread.polls) {
            await prisma.poll.update({
                where: { id: Number(poll.id) },
                data: { visibility: false },
            });
        }
        

        return NextResponse.json(deletedThread);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized")) {
            return NextResponse.json({ error: err.message }, { status: 401 });
        }
        return NextResponse.json({ error: "Something broke in DELETE api/threads: " + err.message }, { status: 500 });
    }
}

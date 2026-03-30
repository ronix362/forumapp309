import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
    request: NextRequest, 
    { params }: { params: Promise<{ id: string; version: string }> }
) {
    try {
        const { id, version } = await params;
        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
        }
        if (!version || (version !== "latest" && isNaN(Number(version)))) {
            return NextResponse.json({ error: "Invalid post version." }, { status: 400 });
        }

        const post = await prisma.post.findUnique({
            where: { id: Number(id) },
        });

        if (!post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        if (version === "latest") {
            let latestPost: any = post;
            while (latestPost.nextVersionId) {
                latestPost = await prisma.post.findUnique({
                    where: { id: latestPost.nextVersionId },
                });
            }
            return NextResponse.json(latestPost);
        }

        let oldestPost: any = post;
        while (oldestPost.previousVersionId) {
            oldestPost = await prisma.post.findUnique({
                where: { id: oldestPost.previousVersionId },
            });
        }

        let i = 1;
        let currentPost: any = oldestPost;
        while (currentPost && i < Number(version)) {
            if (!currentPost.nextVersionId) {
                return NextResponse.json({ error: "Post version not found." }, { status: 404 });
            }
            currentPost = await prisma.post.findUnique({
                where: { id: currentPost.nextVersionId },
            });
            i++;
        }
        return NextResponse.json(currentPost);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed. Please log in again." }, { status: 401 });
        }
        return NextResponse.json({ error: "Something wrong with your request: " + err.message }, { status: 400 });
    }
}
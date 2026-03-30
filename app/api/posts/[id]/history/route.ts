import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";

// Code Source: ChatGPT

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
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Step 1: find oldest version
    let oldestPost: any = post;
    while (oldestPost.previousVersionId) {
      oldestPost = await prisma.post.findUnique({
        where: { id: oldestPost.previousVersionId },
      });

      if (!oldestPost) break;
    }

    // Step 2: collect all versions
    const versions: any[] = [];
    let currentPost: any = oldestPost;

    while (currentPost) {
      versions.push(currentPost);

      if (!currentPost.nextVersionId) break;

      currentPost = await prisma.post.findUnique({
        where: { id: currentPost.nextVersionId },
      });
    }

    return NextResponse.json(versions);
  } catch (err: any) {
    if (
      err.message?.startsWith("Unauthorized") ||
      err.name === "JsonWebTokenError"
    ) {
      return NextResponse.json(
        { error: "Authentication failed. Please log in again." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Something wrong with your request: " + err.message },
      { status: 400 }
    );
  }
}
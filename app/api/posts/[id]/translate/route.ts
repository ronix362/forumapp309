import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";
import { translateToEnglish } from "@/utils/translate";

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
            return NextResponse.json({ error: "Parent post not found" }, { status: 404 });
        }

        const translatedContent = await translateToEnglish(post.content);

        return NextResponse.json({ translatedContent });
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed. Please log in again." }, { status: 401 });
        }
        return NextResponse.json({ error: "Something broke in GET api/posts/[id]/translate: " + err.message }, { status: 400 });
    }
}
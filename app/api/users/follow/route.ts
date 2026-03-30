import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    // Verify user access
    const authHeader = request.headers.get("authorization");
    const { userId, role } = verifyAccessToken(authHeader);

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: Users only" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user || user.banned) {
      return NextResponse.json({ error: "User is banned or not found." }, { status: 403 });
    }

    // Validate followingId from request body
    const { toFollowId }: { toFollowId: string | number } = await request.json();
    
    if (Number(userId) === Number(toFollowId)) {
      return NextResponse.json({ error: "You cannot follow yourself." }, { status: 400 });
    }

    if (!toFollowId) {
      return NextResponse.json({ error: "Incomplete request" }, { status: 400 });
    }

    if (isNaN(Number(toFollowId))) {
      return NextResponse.json({ error: "toFollowId must be a number" },{ status: 400 });
    }

    // Check user to follow exists
    const userToFollow = await prisma.user.findUnique({
      where: { id: Number(toFollowId) },
    });

    if (!userToFollow) {
      return NextResponse.json({ error: "User to follow not found" }, { status: 404 });
    }

    // Create the follow
    const follow = await prisma.follow.create({
      data: { 
        followerId: Number(userId), 
        followingId: Number(toFollowId) 
      },
    });

    return NextResponse.json({ follow });
  }
  catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    // Catch unique constraint violation (already following)
    if (error.code === 'P2002') { 
      return NextResponse.json(
        { error: "User already followed" }, 
        { status: 409 });
    }
    console.error(error.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
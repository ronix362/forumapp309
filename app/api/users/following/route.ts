import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function GET(request: NextRequest) {
  try {
    // Verify user access
    const { userId, role } = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: Users only" }, { status: 403 });
    }
    
    // Get query params for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const limit = 10; 
    const skip = (page - 1) * limit;

    // Run both queries at once for better performance
    const [following, totalCount] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: { id: true, 
              username: true,
              avatarId: true,
            }
          }
        },
        orderBy: { date: "desc" as const },
        take: limit,
        skip: skip,
      }),
      prisma.follow.count({ where: { followerId: userId } })
    ]);

    return NextResponse.json({
      following,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    });

  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error fetching following list:", error);
    return NextResponse.json({ error: "Error fetching following list" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify user access
    const { userId, role } = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: Users only" }, { status: 403 });
    }

    // Validate followingId from request body
    const { followingId }: { followingId: string | number } = await request.json();

    // 1. Basic Validation
    if (!followingId || isNaN(Number(followingId))) {
      return NextResponse.json({ error: "Missing or invalid following ID" }, { status: 400 });
    }

    // 2. Delete the specific follow record
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: Number(followingId),
        },
      },
    });

    return NextResponse.json({ message: "User unfollowed successfully" });

  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    // Check if the record didn't exist in the first place
    if (error.code === "P2025") {
      return NextResponse.json({ error: "You aren't following this user." }, { status: 404 });
    }
    console.error("Error unfollowing user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
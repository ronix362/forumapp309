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

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Run both queries at once for better performance
    const [followers, totalCount] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
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
      prisma.follow.count({ where: { followingId: userId } })
    ]);

    return NextResponse.json({
      followers,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    });
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error fetching followers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify user access
    const { userId, role } = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: Users only" }, { status: 403 });
    }

    // Validate followerId from request body
    const { followerId }: { followerId: string | number } = await request.json();

    if (!followerId || isNaN(Number(followerId))) {
      return NextResponse.json({ error: "Missing or invalid follower ID" }, { status: 400 });
    }

    // Delete the follow record
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: Number(followerId), 
          followingId: userId,    
        },
      },
    });

    return NextResponse.json({ message: "Follower removed successfully" });
    
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    // Catch case where the follow record doesn't exist
    if (error.code === "P2025") {
      return NextResponse.json({ error: "This user is not following you." }, { status: 404 });
    }
    console.error("Remove follower error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
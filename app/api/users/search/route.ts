import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";

// This route allows searching for users by username with pagination.
export async function GET(request: NextRequest) {
  try {
    // 1. Get query params from the URL (e.g., /api/users/search?q=john&page=1)
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const limit = 12; // Number of users per page
    const skip = (page - 1) * limit;

    // 2. Build the search logic
    // If there is a search query, look for partial matches (case-insensitive)
    const whereClause = searchQuery ? {
      username: { 
        contains: searchQuery, 
        mode: "insensitive" as const // Ensures "John" matches "john"
      }
    } : {};

    // 3. Run the search and get the total count simultaneously
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        // SECURITY ALERT: ONLY select the fields you want the public to see!
        select: {
          id: true,
          username: true,
          role: true,
          avatarId: true,
        },
        orderBy: { username: "asc" },
        take: limit,
        skip: skip,
      }),
      prisma.user.count({ where: whereClause })
    ]);

    // 4. Return the paginated results
    return NextResponse.json({
      users,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    });

  } catch (error: any) {
    console.error("User search error:", error);
    return NextResponse.json(
      { error: "Internal server error during search" }, 
      { status: 500 }
    );
  }
}
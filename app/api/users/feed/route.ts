import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

const TAKE = 10;
const MATCH_TAKE = 5;

// Helper function to calculate total pages
const getTotalPages = (total: number, take: number) => Math.ceil(total / take) || 1;

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const section = searchParams.get("section") || "recent";

    if (page <= 0 || isNaN(page)) {
      return NextResponse.json({ error: "page must be a positive number" }, { status: 400 });
    }

    // Common filter: only show visible items and the latest version of posts
    const postFilter = {
      visibility: true,
      nextVersionId: null
    };

    const threadFilter = {
      visibility: true
    };

    // Include block needed by our frontend RecentPosts/RecentReplies components
    const postIncludes = {
      author: { select: { id: true, username: true, avatarId: true } },
      thread: { 
        select: { 
          id: true, 
          title: true, 
          forum: { select: { type: true, teamName: true } } 
        } 
      }
    };

    // For visitors, just return recent posts.
    if (!token) {
      const [recentPosts, total] = await Promise.all([
        prisma.post.findMany({
          where: postFilter,
          take: TAKE, 
          skip: (page - 1) * TAKE,
          orderBy: { createdAt: "desc" },
          include: postIncludes,
        }),
        prisma.post.count({ where: postFilter })
      ]);
      return NextResponse.json({ recentPosts, totalPages: getTotalPages(total, TAKE) });
    }

    const { userId } = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const favTeamId = user?.favoriteTeamId;

    switch (section) {
      case "matches": {
        if (!favTeamId) return NextResponse.json({ favTeamUpcomingMatches: [], favTeamRecentResults: [], totalPages: 1 });

        const upcomingWhere = {
          AND: [{ OR: [{ homeTeamId: favTeamId }, { awayTeamId: favTeamId }] }, { date: { gte: new Date() } }],
        };
        const recentWhere = {
          AND: [{ OR: [{ homeTeamId: favTeamId }, { awayTeamId: favTeamId }] }, { date: { lt: new Date() } }, { homeScore: { not: null } }, { awayScore: { not: null } }],
        };

        const [favTeamUpcomingMatches, upTotal, favTeamRecentResults, recTotal] = await Promise.all([
          prisma.match.findMany({ take: MATCH_TAKE, skip: (page - 1) * MATCH_TAKE, where: upcomingWhere, include: { homeTeam: true, awayTeam: true }, orderBy: { date: "asc" } }),
          prisma.match.count({ where: upcomingWhere }),
          prisma.match.findMany({ take: MATCH_TAKE, skip: (page - 1) * MATCH_TAKE, where: recentWhere, include: { homeTeam: true, awayTeam: true }, orderBy: { date: "desc" } }),
          prisma.match.count({ where: recentWhere }),
        ]);

        const totalPages = Math.max(getTotalPages(upTotal, MATCH_TAKE), getTotalPages(recTotal, MATCH_TAKE));
        return NextResponse.json({ favTeamUpcomingMatches, favTeamRecentResults, totalPages });
      }

      case "threads": {
        if (!favTeamId) return NextResponse.json({ favTeamThreads: { threads: [] }, totalPages: 1 });

        const whereClause = { 
            forum: { teamId: favTeamId },
            ...threadFilter 
        };
        const [threads, total] = await Promise.all([
          prisma.thread.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            take: TAKE, skip: (page - 1) * TAKE,
            include: { 
                _count: { select: { posts: { where: postFilter } } }, // Count only visible posts
                forum: true 
            },
          }),
          prisma.thread.count({ where: whereClause })
        ]);

        return NextResponse.json({ favTeamThreads: { threads }, totalPages: getTotalPages(total, TAKE) });
      }

      case "following": {
        const whereClause = { 
            author: { followers: { some: { followerId: userId } } },
            ...postFilter 
        };
        const [followedPosts, total] = await Promise.all([
          prisma.post.findMany({
            take: TAKE, skip: (page - 1) * TAKE, where: whereClause, orderBy: { createdAt: "desc" }, include: postIncludes,
          }),
          prisma.post.count({ where: whereClause })
        ]);
        return NextResponse.json({ followedPosts, totalPages: getTotalPages(total, TAKE) });
      }

      case "replies": {
        const whereClause = {
          ...postFilter,
          authorId: { not: userId },
          OR: [{ replyingTo: { authorId: userId } }, { thread: { authorId: userId } }]
        };
        const [replyingPosts, total] = await Promise.all([
          prisma.post.findMany({
            take: TAKE, skip: (page - 1) * TAKE, where: whereClause, orderBy: { createdAt: "desc" }, include: postIncludes,
          }),
          prisma.post.count({ where: whereClause })
        ]);
        return NextResponse.json({ replyingPosts, totalPages: getTotalPages(total, TAKE) });
      }

      case "recent":
      default: {
        const [recentPosts, total] = await Promise.all([
          prisma.post.findMany({
            where: postFilter,
            take: TAKE, skip: (page - 1) * TAKE, orderBy: { createdAt: "desc" }, include: postIncludes,
          }),
          prisma.post.count({ where: postFilter })
        ]);
        return NextResponse.json({ recentPosts, totalPages: getTotalPages(total, TAKE) });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("Unauthorized")) return NextResponse.json({ error: error.message }, { status: 401 });
      console.error("Error fetching feed:", error.message);
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
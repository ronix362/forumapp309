import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    // Verify user access 
    const { userId, role } = verifyAccessToken(request.headers.get("authorization")) as { userId: number, role: string };

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: Users only" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.banned) {
      return NextResponse.json({ error: "User is banned or not found." }, { status: 403 });
    }

    // Validate body
    const { reason, targetId, targetType }: { reason: string, targetId: number, targetType: string } = await request.json();

    if (!reason || typeof reason !== "string") {
      return NextResponse.json({ error: "Invalid reason." }, { status: 400 });
    }
    if (!targetId || typeof targetId !== "number") {
      return NextResponse.json({ error: "Invalid targetId." }, { status: 400 });
    }
    if (!["THREAD", "POST", "POLL"].includes(targetType)) {
      return NextResponse.json({ error: "Invalid targetType." }, { status: 400 });
    }

    let target: any = null;
    if (targetType === "THREAD") {
      target = await prisma.thread.findUnique({
        where: { id: targetId },
        include: { posts: true, polls: true },
      });
      if (!target) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    } else if (targetType === "POST") {
      target = await prisma.post.findUnique({ where: { id: targetId } });
      if (!target) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    } else if (targetType === "POLL") {
      target = await prisma.poll.findUnique({ where: { id: targetId } });
      if (!target) return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    // Prepare data object with index signature for dynamic keys
    let data: any = { userId, reason };
    
    if (targetType === "THREAD") {
      data.threadId = targetId;
      await prisma.thread.update({
        where: { id: targetId },
        data: { reportCount: { increment: 1 } },
      });

      // Calculate AI Avg
      const posts = target.posts || [];
      const polls = target.polls || [];
      let aiAvgScore = 0;
      posts.forEach((p: any) => aiAvgScore += (p.aiMaxScore || 0));
      polls.forEach((p: any) => aiAvgScore += (p.aiMaxScore || 0));
      aiAvgScore /= (posts.length + polls.length || 1);

      await prisma.thread.update({
        where: { id: targetId },
        data: { aiAvgScore },
      });
    }

    if (targetType === "POST") {
      data.postId = targetId;
      await prisma.post.update({
        where: { id: targetId },
        data: { reportCount: { increment: 1 } },
      });
    }

    if (targetType === "POLL") {
      data.pollId = targetId;
      await prisma.poll.update({
        where: { id: targetId },
        data: { reportCount: { increment: 1 } },
      });
    }

    const report = await prisma.report.create({ data });
    return NextResponse.json({ report });

  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error creating report:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { role } = verifyAccessToken(request.headers.get("authorization")) as { role: string };

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const postPage = Math.max(1, Number(searchParams.get("postPage")) || 1);
    const threadPage = Math.max(1, Number(searchParams.get("threadPage")) || 1);
    const pollPage = Math.max(1, Number(searchParams.get("pollPage")) || 1);
    const pageSize = 10;

    const [
      topPostReports,
      topThreadReports,
      topPollReports,
      postTotalCount,
      threadTotalCount,
      pollTotalCount,
    ] = await Promise.all([
      prisma.report.findMany({
        take: pageSize, skip: (postPage - 1) * pageSize,
        where: { status: "PENDING", postId: { not: null } },
        include: {
          post: {
            include: {
              thread: {
                include: {
                  forum: { select: { type: true } },
                },
              },
            },
          },
        },
        orderBy: [{ post: { reportCount: "desc" } }, { post: { aiMaxScore: "desc" } }]
      }),
      prisma.report.findMany({
        take: pageSize, skip: (threadPage - 1) * pageSize,
        where: { status: "PENDING", threadId: { not: null } },
        include: {
          thread: {
            include: {
              forum: { select: { type: true } },
            },
          },
        },
        orderBy: [{ thread: { reportCount: "desc" } }, { thread: { aiAvgScore: "desc" } }]
      }),
      prisma.report.findMany({
        take: pageSize, skip: (pollPage - 1) * pageSize,
        where: { status: "PENDING", pollId: { not: null } },
        include: {
          poll: {
            include: {
              thread: {
                include: {
                  forum: { select: { type: true } },
                },
              },
            },
          },
        },
        orderBy: [{ poll: { reportCount: "desc" } }, { poll: { aiMaxScore: "desc" } }]
      }),
      prisma.report.count({ where: { status: "PENDING", postId: { not: null } } }),
      prisma.report.count({ where: { status: "PENDING", threadId: { not: null } } }),
      prisma.report.count({ where: { status: "PENDING", pollId: { not: null } } }),
    ]);

    return NextResponse.json({
      topPostReports,
      topThreadReports,
      topPollReports,
      postTotalCount,
      threadTotalCount,
      pollTotalCount,
      pageSize,
    });
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
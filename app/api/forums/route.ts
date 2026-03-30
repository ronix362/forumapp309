import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { ForumType, Prisma } from "@/prisma/generated";

const forumTypes = Object.values(ForumType);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const teamName = searchParams.get("teamName");
    const teamIdParam = searchParams.get("teamId");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    if (!type) {
      return NextResponse.json(
        { error: "Please provide a forum type." },
        { status: 400 },
      );
    }

    if (!forumTypes.includes(type as ForumType)) {
      return NextResponse.json(
        { error: `Invalid forum type. Must be one of ${forumTypes.join(", ")}.` },
        { status: 400 },
      );
    }

    if ((teamName || teamIdParam) && type !== ForumType.TEAM) {
      return NextResponse.json(
        { error: "Team filtering is only supported for TEAM forums." },
        { status: 400 },
      );
    }

    if (teamIdParam) {
      const teamId = Number(teamIdParam);
      if (!Number.isFinite(teamId)) {
        return NextResponse.json(
          { error: "teamId must be a number." },
          { status: 400 },
        );
      }

      const forum = await prisma.forum.findUnique({
        where: { teamId },
        include: { team: true, _count: { select: { threads: true } } },
      });

      if (!forum) {
        return NextResponse.json(
          { error: "Team forum not found." },
          { status: 404 },
        );
      }

      return NextResponse.json(forum);
    }

    const where: Prisma.ForumWhereInput = { type: type as ForumType };

    if (teamName) {
      where.OR = [
        { teamName: { contains: teamName, mode: "insensitive" } },
        { team: { name: { contains: teamName, mode: "insensitive" } } },
      ];
    }

    const include = { team: true, _count: { select: { threads: true } } };
    const orderBy: Prisma.ForumOrderByWithRelationInput[] =
      type === ForumType.TEAM
        ? [{ teamName: "asc" }, { id: "asc" }]
        : [{ id: "asc" }];

    const paginationRequested = pageParam !== null || pageSizeParam !== null;
    if (paginationRequested) {
      const page = pageParam ? Number(pageParam) : 1;
      const pageSize = pageSizeParam ? Number(pageSizeParam) : 20;

      if (!Number.isFinite(page) || page <= 0) {
        return NextResponse.json(
          { error: "page must be a positive number." },
          { status: 400 },
        );
      }

      if (!Number.isFinite(pageSize) || pageSize <= 0) {
        return NextResponse.json(
          { error: "pageSize must be a positive number." },
          { status: 400 },
        );
      }

      const [totalCount, items] = await prisma.$transaction([
        prisma.forum.count({ where }),
        prisma.forum.findMany({
          where,
          include,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return NextResponse.json({ items, totalCount, page, pageSize });
    }

    const forums = await prisma.forum.findMany({
      where,
      include,
      orderBy,
    });

    return NextResponse.json(forums);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching forums:", error.message);
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

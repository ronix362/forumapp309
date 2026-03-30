import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";
import { verifyAccessToken } from "@/utils/auth";
import { ForumType } from "@/prisma/generated";
const forumTypes = Object.values(ForumType);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const title = searchParams.get("title");
        const author = searchParams.get("author");
        const type = searchParams.get("type");
        const teamName = searchParams.get("teamName");
        const matchId = searchParams.get("matchId");
        const tags = searchParams.get("tags");

        const where: any = {};
        where.visibility = true;

        if (title) {
            where.title = { contains: title, mode: 'insensitive' };
        }
        
        if (author) {
            where.author = { username: { contains: author, mode: 'insensitive' } };
        }

        if (type) {
            if (!forumTypes.includes(type as ForumType)) {
                return NextResponse.json({ 
                    error: `Invalid forum type. Must be one of ${forumTypes.join(", ")}.` 
                }, { status: 400 });
            }
            where.forum = where.forum || {};
            where.forum.type = type;
        }

        if (teamName && type !== ForumType.MATCH) {
            where.forum = where.forum || {};
            where.forum.teamName = teamName;
        }

        if (matchId) {
            const parsedMatchId = Number(matchId);
            if (Number.isNaN(parsedMatchId)) {
                return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
            }
            where.matchId = parsedMatchId;
        }

        if (tags) {
            const splitTags = tags.split(",");
            where.AND = splitTags.map(tag => ({
                tags: { some: { name: tag.trim() } }
            }));
        }

        const include: any = {
            tags: true,
            _count: { select: { posts: true } },
            author: { select: { id: true, username: true } },
            forum: { select: { teamId: true } },
        };

        if (type === ForumType.MATCH && teamName) {
            include.matchDiscussionFor = { include: { homeTeam: true, awayTeam: true } };
        }

        const threads = await prisma.thread.findMany({
            where: where,
            orderBy: { createdAt: 'desc' },
            include
        });

        if (type === ForumType.MATCH && teamName) {
            const normalizedTeam = teamName.toLowerCase();
            const filtered = threads.filter((thread: any) => {
                const match = thread.matchDiscussionFor;
                if (!match) return false;
                const home = match.homeTeam?.name?.toLowerCase();
                const away = match.awayTeam?.name?.toLowerCase();
                return home?.includes(normalizedTeam) || away?.includes(normalizedTeam);
            });
            return NextResponse.json(filtered);
        }

        return NextResponse.json(threads);
    } catch (err: any) {
        return NextResponse.json({ error: "Something broke in GET: " + err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const { userId } = verifyAccessToken(authHeader) as { userId: number };
        
        const { title, type, teamName, matchId } = await request.json();

        if (!title) return NextResponse.json({ error: "Please choose a title." }, { status: 400 });
        if (!type) return NextResponse.json({ error: "Please choose a forum type." }, { status: 400 });

        const data: any = { title };

        // 1. Forum Selection
        let forum;
        if (type === ForumType.TEAM) {
            if (!teamName) return NextResponse.json({ error: "Team name required." }, { status: 400 });
            // Include the team so we can get the ID if needed
            forum = await prisma.forum.findFirst({ 
                where: { teamName },
                include: { team: true } 
            });
        } else {
            forum = await prisma.forum.findFirst({ where: { type: type as ForumType } });
        }

        if (!forum) return NextResponse.json({ error: "Forum not found." }, { status: 404 });

        // 2. User Verification
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: "Author not found." }, { status: 404 });
        if (user.banned) return NextResponse.json({ error: "User is banned." }, { status: 403 });

        // 3. Create Thread with Relations
        // We use nested connects here to handle everything in ONE transaction
        const thread = await prisma.thread.create({
            data: {
                title,
                forum: { connect: { id: forum.id } },
                author: { connect: { id: user.id } },
                // If your Thread model has a matchId field:
                ...(type === ForumType.MATCH && matchId ? { matchId: Number(matchId) } : {})
            }
        });

        // 4. Handle Match relation if it's a specific field on the Match model
        if (type === ForumType.MATCH && matchId) {
            await prisma.match.update({
                where: { id: Number(matchId) },
                data: { discussionThreadId: thread.id } // Use the actual field name in your Match model
            });
        }

        // NOTE: If your Team model doesn't have a 'threads' field in schema.prisma, 
        // you should NOT try to update it here. The relation is already handled 
        // via the Forum connection.

        return NextResponse.json(thread);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
        }
        return NextResponse.json({ error: "Request failed: " + err.message }, { status: 400 });
    }
}

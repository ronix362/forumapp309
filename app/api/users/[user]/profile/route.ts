import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ user: string }> }) {
  try {
    const { user: userParam } = await params;
    const userId = parseInt(userParam);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    let viewerId: number | null = null;
    try {
      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        const decoded = verifyAccessToken(token) as any;
        if (decoded && decoded.userId) {
           viewerId = decoded.userId;
        } else if (decoded && decoded.id) {
           viewerId = decoded.id;
        }
      }
    } catch (e) {}

    const profile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        favoriteTeam: true,
        _count: {
          select: {
            followers: true,
            following: true,
            // UPDATED: Only count posts that are visible AND are the latest version
            posts: { where: { visibility: true, nextVersionId: null } },
            threads: { where: { visibility: true } },
          },
        },
        posts: {
          // UPDATED: Filter for latest version (nextVersionId: null)
          where: { visibility: true, nextVersionId: null }, 
          orderBy: { createdAt: 'desc' },
          include: {
            thread: {
              include: {
                forum: {
                  select: { type: true, teamName: true }
                }
              }
            }
          }
        },
        threads: {
          where: { visibility: true },
          orderBy: { createdAt: 'desc' },
          include: {
            forum: {
              select: { type: true, teamName: true }
            },
            _count: {
              // Ensure thread post count only includes latest versions
              select: { posts: { where: { visibility: true, nextVersionId: null } } } 
            }
          }
        }
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Fetch Replies
    const replies = await prisma.post.findMany({
      where: {
        visibility: true,
        nextVersionId: null, // UPDATED: Only fetch latest version of replies
        authorId: { not: userId }, 
        OR: [
          { replyingTo: { authorId: userId } },
          { thread: { authorId: userId } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, username: true, avatarId: true }
        },
        thread: {
          select: {
            id: true,
            title: true,
            forum: {
              select: { type: true, teamName: true }
            }
          }
        }
      }
    });

    let isFollowing = false;
    if (viewerId && viewerId !== userId) {
      const followDoc = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!followDoc;
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role,     
        banned: profile.banned, 
        avatarId: profile.avatarId, 
        favoriteTeam: profile.favoriteTeam,
      },
      stats: {
        followers: profile._count.followers,
        following: profile._count.following,
        postCount: profile._count.posts,
        threadCount: profile._count.threads,
      },
      isFollowing, 
      posts: profile.posts,
      threads: profile.threads,
      replies: replies, 
    });

  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
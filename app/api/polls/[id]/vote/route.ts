import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/utils/auth";

// Fix: params must be a Promise to satisfy Next.js 15+ constraints
type RouteContext = {
  params: Promise<{ id: string }>;
};

type VoteRequestBody = {
  optionIndex: number;
};

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    // 1. Infer identity from token
    const authHeader = request.headers.get("authorization");
    const { userId: authorizedUserId, role } = verifyAccessToken(authHeader);

    // FIX: Await the params promise before using 'id'
    const { id } = await params;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: "Invalid poll id." },
        { status: 400 }
      );
    }

    const body: VoteRequestBody = await request.json();
    const { optionIndex } = body;

    if (optionIndex === undefined || isNaN(Number(optionIndex))) {
      return NextResponse.json(
        { error: "Invalid option index." },
        { status: 400 }
      );
    }

    // 2. Fetch User and check Banned status
    const user = await prisma.user.findUnique({
      where: { id: authorizedUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.banned) {
      return NextResponse.json(
        { error: "User is banned from voting." },
        { status: 403 }
      );
    }

    // 3. Fetch Poll and check Visibility & Deadline
    const poll = await prisma.poll.findUnique({
      where: { id: Number(id) },
      include: { options: true }, 
    });

    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    if (!poll.visibility && role !== "ADMIN") {
      return NextResponse.json(
        { error: "This poll is no longer available for voting." },
        { status: 410 }
      );
    }

    const now = new Date();
    if (poll.deadline && now > new Date(poll.deadline)) {
      return NextResponse.json(
        { error: "Voting is disabled. The deadline has passed." },
        { status: 400 }
      );
    }

    if (optionIndex < 1 || optionIndex > poll.options.length) {
      return NextResponse.json(
        { error: "Option index out of range." },
        { status: 400 }
      );
    }

    // 4. Prevent double-voting
    const existingVote = await prisma.pollVote.findUnique({
      where: {
        pollId_userId: {
          pollId: Number(id),
          userId: user.id,
        },
      },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: "User has already voted in this poll." },
        { status: 400 }
      );
    }

    // 5. Create the vote
    const pollVote = await prisma.pollVote.create({
      data: {
        pollId: Number(id),
        userId: user.id,
        optionIndex: Number(optionIndex),
      },
    });

    return NextResponse.json(pollVote);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (
        err.message.startsWith("Unauthorized") ||
        err.name === "JsonWebTokenError"
      ) {
        return NextResponse.json(
          { error: "Authentication failed. Please log in again." },
          { status: 401 }
        );
      }

      console.error("Error in POST api/polls/[id]/vote:", err.message);
      return NextResponse.json(
        { error: "An unexpected error occurred: " + err.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
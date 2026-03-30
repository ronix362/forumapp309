import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/utils/auth";
import { checkInappropriate, createReport } from "@/utils/moderation";

// Fix: params must be a Promise in Next.js 15+
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext // TypeScript now sees this matches Next.js requirements
) {
  try {
    // Correctly await the params promise
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: "Invalid id." },
        { status: 400 }
      );
    }

    const poll = await prisma.poll.findUnique({
      where: { id: Number(id) },
      include: {
        options: true,
        author: { select: { id: true, username: true } },
        thread: { select: { id: true, title: true } },
      },
    });

    if (!poll) {
      // Note: Usually a 404 is better here than 500 if the ID just doesn't exist
      return NextResponse.json(
        { error: "Poll not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(poll);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json(
        { error: "Something broke in GET api/polls/[id]: " + err.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Something broke in GET api/polls/[id]." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    // 1. Authorize user from token
    const authResult = verifyAccessToken(
      request.headers.get("authorization")
    );
    const { userId, role } = authResult;

    // Correctly await the params promise
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: "Invalid poll id." },
        { status: 400 }
      );
    }

    // 2. Fetch the poll to verify ownership
    const poll = await prisma.poll.findUnique({
      where: { id: Number(id) },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    // 3. Permission Check: Only the Creator or an Admin can delete
    if (poll.authorId !== userId && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to delete this poll." },
        { status: 403 }
      );
    }

    // Already deleted (Soft delete check)
    if (!poll.visibility) {
      return NextResponse.json(
        { error: "This poll is already deleted." },
        { status: 409 }
      );
    }

    // 4. Soft Delete (Update visibility)
    const updatedPoll = await prisma.poll.update({
      where: { id: Number(id) },
      data: { visibility: false },
    });

    return NextResponse.json(updatedPoll);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.startsWith("Unauthorized")) {
        return NextResponse.json(
          { error: err.message },
          { status: 401 }
        );
      }

      console.error("Error in DELETE api/polls/[id]:", err.message);
      return NextResponse.json(
        { error: "Something broke in DELETE api/polls: " + err.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Something broke in DELETE api/polls." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const authResult = verifyAccessToken(
      request.headers.get("authorization")
    );
    const { userId, role } = authResult;

    const { id } = await params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: "Invalid poll id." },
        { status: 400 }
      );
    }

    const poll = await prisma.poll.findUnique({
      where: { id: Number(id) },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found." },
        { status: 404 }
      );
    }

    if (!poll.visibility && role !== "ADMIN") {
      return NextResponse.json(
        { error: "This poll has been removed and cannot be edited." },
        { status: 410 }
      );
    }

    if (poll.authorId !== userId && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: You cannot edit this poll." },
        { status: 403 }
      );
    }

    const { pollDescription, deadline } = await request.json();
    const data: any = {};

    if (typeof pollDescription === "string") {
      if (!pollDescription.trim()) {
        return NextResponse.json(
          { error: "Poll description cannot be empty." },
          { status: 400 }
        );
      }
      data.pollDescription = pollDescription.trim();

      // Re-run moderation when the description changes
      try {
        const result = await checkInappropriate(data.pollDescription);
        data.aiFlagged = result.aiFlagged;
        data.aiMaxScore = result.aiMaxScore;
        data.aiScores = result.scores;

        if (result.aiFlagged) {
          await createReport(1, "Automatic AI flag", "POLL", poll.id);
        }
      } catch (error) {
        console.error("Toxicity API error:", error);
      }
    }

    if (deadline !== undefined) {
      const parsed = new Date(deadline);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid deadline format." },
          { status: 400 }
        );
      }
      if (parsed <= new Date()) {
        return NextResponse.json(
          { error: "Deadline must be in the future." },
          { status: 400 }
        );
      }
      data.deadline = parsed;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No changes provided." },
        { status: 400 }
      );
    }

    const updatedPoll = await prisma.poll.update({
      where: { id: Number(id) },
      data,
      include: { options: true, author: { select: { id: true, username: true } }, thread: { select: { id: true, title: true } } },
    });

    return NextResponse.json(updatedPoll);
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message.startsWith("Unauthorized")) {
        return NextResponse.json(
          { error: err.message },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Something broke in PATCH api/polls/[id]: " + err.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Something broke in PATCH api/polls/[id]." },
      { status: 500 }
    );
  }
}

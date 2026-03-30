import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ id: string }> } // Use this exact structure
) {
  try {
    // 1. Await the params directly
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    
    const poll = await prisma.poll.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        options: true,
      },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Failed to retrieve poll." },
        { status: 500 }
      );
    }

    const options: typeof poll.options = [];
    const counts: number[] = [];

    for (let i = 1; i <= poll.options.length; i++) {
      options.push(poll.options[i - 1]);

      const count = await prisma.pollVote.count({
        where: {
          pollId: Number(id),
          optionIndex: i,
        },
      });

      counts.push(count);
    }

    return NextResponse.json({ options, counts });
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

      return NextResponse.json(
        { error: "Something wrong with your request: " + err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Something wrong with your request." },
      { status: 400 }
    );
  }
}
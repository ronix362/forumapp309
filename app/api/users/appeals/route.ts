import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify identity from token
    const authHeader = request.headers.get("authorization");
    const { userId } = verifyAccessToken(authHeader);
    
    const { content }: { content: string } = await request.json();

    // Basic validation
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Appeal content is required and must be a string." }, { status: 400 });
    }

    // 2. Fetch the user to check their current status
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Logic Revision: ONLY banned users can appeal
    if (!user.banned) {
      return NextResponse.json({ 
        error: "Forbidden: Only banned users can submit an appeal." 
      }, { status: 403 });
    }

    // 4. Check if an appeal is already in progress to prevent spam
    const existingAppeal = await prisma.appeal.findFirst({
      where: { 
        userId: user.id,
        status: "IN_PROGRESS" 
      }
    });

    if (existingAppeal) {
      return NextResponse.json({ error: "You already have an appeal in progress." }, { status: 400 });
    }

    // 5. Create the appeal
    const appeal = await prisma.appeal.create({
      data: { 
        userId: user.id, 
        content,
        status: "IN_PROGRESS" 
      },
    });

    return NextResponse.json({ message: "Appeal submitted successfully.", appeal }, { status: 201 });
  }
  catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    console.error("Error creating appeal:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// Return 10 appeals per page, only in progress appeals, with pagination
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader);

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }
    
    // Validate page query parameter
    const { searchParams } = new URL(request.url);
    const pageStr = searchParams.get("page");
    const page = Number(pageStr);
    
    if (!page || isNaN(page) || page <= 0) {
      return NextResponse.json(
        { error: "page must be a positive number" },
        { status: 400 },
      );
    }

    const appeals = await prisma.appeal.findMany({
      take: 10,
      skip: (page - 1) * 10,
      where: { status: "IN_PROGRESS" }
    });
    
    return NextResponse.json({ appeals });
  }
  catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    // unknown error
    console.error("Error fetching appeals:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
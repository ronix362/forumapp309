import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth"; // Adjust this path if needed

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    // 1. Verify token
    // FIX: Pass the raw authHeader directly into your utility function!
    let decoded;
    try {
      decoded = verifyAccessToken(authHeader) as any;
    } catch (err) {
      console.error("Token verification failed:", err);
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Handle token format (userId or id depending on your auth implementation)
    const requesterId = decoded.userId || decoded.id;
    const requesterRole = decoded.role;

    // 2. Security Check: Only ADMINs can promote others
    if (requesterRole !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized: Only administrators can promote users." }, { status: 403 });
    }

    // 3. Parse target user ID
    const body = await req.json();
    const { userId } = body;

    if (!userId || isNaN(Number(userId))) {
      return NextResponse.json({ error: "Invalid or missing user ID" }, { status: 400 });
    }

    // 4. Validate Target User exists
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === 'ADMIN') {
      return NextResponse.json({ error: "User is already an administrator." }, { status: 400 });
    }

    // 5. Update Role
    const promotedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        username: true,
        role: true,
      }
    });

    return NextResponse.json({ 
      message: "User successfully promoted.",
      user: promotedUser 
    });

  } catch (error) {
    console.error("Error promoting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
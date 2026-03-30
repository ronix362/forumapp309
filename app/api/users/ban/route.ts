import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader);

    // 1. Check for admin privileges of the caller
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { userId: userToBan }: { userId: string | number } = await request.json(); 

    if (!userToBan || Number.isNaN(Number(userToBan))) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // 2. Fetch the target user to check their role
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(userToBan) },
      select: { role: true } // Only fetch the role for efficiency
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Prevent banning an admin
    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ 
        error: "Action denied: Admins cannot be banned." 
      }, { status: 403 });
    }

    // 4. Proceed with the ban
    await prisma.user.update({
      where: { id: Number(userToBan) },
      data: { banned: true },
    });

    return NextResponse.json({ message: `User with ID ${userToBan} has been banned.` }, { status: 200 });
    
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Error banning user:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader) as { role: string };

    // Check for admin privileges
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }
    
    // Get the ID of the user to unban, provided in the request body
    const { userId: userToUnban }: { userId: string | number } = await request.json(); 

    if (!userToUnban || isNaN(Number(userToUnban))) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: Number(userToUnban) },
      data: { banned: false },
    });
    return NextResponse.json({ message: `User with ID ${userToUnban} has been unbanned.` }, { status: 200 });
  }
  catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    // Catch user not found    
    if (error.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // unknown error
    console.error("Error unbanning user:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
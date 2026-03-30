import { prisma } from "@/prisma/db";
import { verifyToken, hashPassword } from "@/utils/auth";
import { NextResponse, NextRequest } from "next/server";
import jwt from "jsonwebtoken"; // 1. Import JWT

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }
    const accessToken = authHeader.split(" ")[1];
    const body = await request.json();
    
    // CHANGED: Extract avatarId instead of avatarId
    const { email, username, password, avatarId, favoriteTeamId } = body;

    // Authorization Check
    const decoded = verifyToken(accessToken, process.env.ACCESS_TOKEN_SECRET!) as any;
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // INPUT VALIDATION
    const errors: string[] = [];
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) errors.push("Invalid email format");
    }
    
    // CHANGED: Validate avatarId as a non-negative number
    if (avatarId !== undefined) {
      if (typeof avatarId !== 'number' || avatarId < 0) {
        errors.push("Invalid avatar selection");
      }
    }

    if (favoriteTeamId) {
      const team = await prisma.team.findUnique({ where: { id: favoriteTeamId } });
      if (!team) errors.push("Favorite team does not exist");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Prepare Update Object
    const updateData: any = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    
    // Assuming hashPassword handles hashing logic asynchronously
    if (password) updateData.password = await hashPassword(password);
    
    // CHANGED: Add avatarId to the update payload
    if (avatarId !== undefined) updateData.avatarId = avatarId;
    if (favoriteTeamId) updateData.favoriteTeamId = favoriteTeamId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields provided for update" }, { status: 400 });
    }

    // Execute Update
    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true, 
        avatarId: true, // CHANGED: Select the new integer field
        favoriteTeamId: true,
      },
    });

    // 2. GENERATE NEW TOKENS
    const newAccessToken = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { id: updatedUser.id },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "7d" }
    );

    // 3. RETURN TOKENS TO FRONTEND
    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }, { status: 200 });

  } catch (error: any) {
    console.error("Update User Error:", error);
    if (error.code === 'P2002') {
      const field = error.meta?.target || "Field";
      return NextResponse.json({ error: `${field} is already taken` }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
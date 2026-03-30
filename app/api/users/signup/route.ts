import { prisma } from "@/prisma/db";
import { hashPassword } from "@/utils/auth";
import { NextResponse, NextRequest } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;

export async function POST(request: NextRequest) {
  try {
    const { email, username, password, role, favoriteTeamId } =
      await request.json();

    // 1. Basic Presence Validation
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    // 2. RegEx Email Validation
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Favorite team validation
    if (favoriteTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: favoriteTeamId },
      });

      if (!team) {
        return NextResponse.json(
          { error: "Favorite team does not exist" },
          { status: 400 }
        );
      }
    }

    // 3. Check for existing user (Email or Username)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: username }
        ]
      },
    });

    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return NextResponse.json(
        { error: `${field} is already taken` },
        { status: 400 }
      );
    }

    // 4. Role Validation (USER/ADMIN)
    if (role && !["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // 5. Create User
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: await hashPassword(password),
        role: (role || "USER") as any, // Cast to any to avoid strict Prisma Enum check
        avatarId: 0,
        favoriteTeamId: favoriteTeamId || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarId: true,
        favoriteTeamId: true,
      }
    });

    return NextResponse.json({
      message: "User created successfully!",
      user
    }, { status: 201 });

  } catch (error: any) {
    console.error("Signup processing error:", error);
    return NextResponse.json(
      { error: "Failed to create account" }, 
      { status: 500 }
    );
  }
}
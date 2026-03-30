import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { generateToken, comparePassword } from "@/utils/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });
  
  if(!user) {
    return NextResponse.json(
      { error: "Invalid username." },
      { status: 401 },
    );
  }

  if (!user.password) {
    console.error("User record found but password is null for username:", username);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 },
    );
  }

  if (!(await comparePassword(password, user.password))) {
    console.log("actual received password:", password);
    console.log("Password mismatch for user:", user.username, "Expected:" , user.password);
    return NextResponse.json(
      { error: "Invalid password."},
      { status: 401 },
    );
  }

  const accessToken = generateToken(
    { 
      role: user.role, 
      id: user.id, 
      username: user.username, // <--- ADD THIS LINE TO INCLUDE USERNAME IN THE TOKEN PAYLOAD
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 
    },
    process.env.ACCESS_TOKEN_SECRET!,
    "7d"
  );

  const refreshToken = generateToken(
    { role: user.role, id: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 },
    process.env.REFRESH_TOKEN_SECRET!,
    "7d"
  );

  try {
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      },
    });
  } catch (error: any) {
    console.error("Failed to save refresh token:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  return NextResponse.json({ accessToken, refreshToken }, { status: 200 });
}
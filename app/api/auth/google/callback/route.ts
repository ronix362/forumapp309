import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No authorization code provided" }, { status: 400 });
  }

  try {
    // 1. Exchange the code for an Access Token from Google
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    
    // 2. Use the Google Access Token to get the user's profile info
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const googleUser = await userResponse.json();

    // 3. Check if user exists in your Prisma DB
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    // 4. If they don't exist, create them!
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          // Generate a random username for them
          username: `user_${Math.random().toString(36).substring(2, 9)}`,
          // Notice we do NOT pass a password here!
        },
      });
    } else if (user.banned) {
      // Prevent banned users from logging in via Google
      return NextResponse.redirect(new URL("/login?error=banned", req.url));
    }

    // 5. Generate YOUR custom JWTs (Just like your normal login route!)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "7d" }
    );

    // 6. Redirect the user back to the frontend and pass the tokens in the URL
    // The frontend will grab these, put them in localStorage, and clean up the URL.
    const redirectUrl = new URL("/auth/success", req.url);
    redirectUrl.searchParams.set("accessToken", accessToken);
    redirectUrl.searchParams.set("refreshToken", refreshToken);

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error("Google Auth Error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
}
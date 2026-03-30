import { NextResponse, NextRequest } from "next/server";
import { verifyToken, generateToken } from "@/utils/auth";
import prisma from "@/utils/prisma"; 

export async function POST(request: NextRequest) {
    try {
        let refreshToken = "";

        // --- 1. Try fetching from the Header first ---
        const authHeader = request.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            refreshToken = authHeader.split(" ")[1];
        } 
        // --- 2. Fallback: Try fetching from the JSON Body ---
        else {
            try {
                // Safely attempt to parse the body
                const body = await request.json();
                if (body && body.refreshToken) {
                    refreshToken = body.refreshToken;
                }
            } catch (e) {
                // If the body is empty or not JSON, we just ignore this error
            }
        }

        // --- 3. Final Check: Did we get a token from anywhere? ---
        if (!refreshToken) {
            return NextResponse.json(
                { error: "Unauthorized: Missing refresh token in header or body" },
                { status: 401 }
            );
        }

        // --- 4. Validation & Expiration ---
        const decoded = verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as any;
        
        if (!decoded) {
            return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
        }
        
        // --- 5. Database Sync Check ---
        const tokenExists = await prisma.refreshToken.findFirst({
            where: { token: refreshToken }
        });
        
        if (!tokenExists) {
            return NextResponse.json({ error: "Session expired or logged out" }, { status: 401 });
        }
        
        // --- 6. Generate New Access Token ---
        const newAccessToken = generateToken(
            { role: decoded.role, id: decoded.id, expiresAt: Date.now() + 15 * 60 * 1000 },
            process.env.ACCESS_TOKEN_SECRET!,
            "15m"
        );

        return NextResponse.json({ accessToken: newAccessToken }, { status: 200 });

    } catch (error: any) {
        console.error("Refresh Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
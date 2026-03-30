import { NextResponse, NextRequest } from "next/server";
import { verifyToken } from "@/utils/auth";
import prisma from "@/utils/prisma"; 

export async function POST(request: NextRequest) {
    try {
        // --- 1. Fetch Refresh Token from Header ---
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized: Missing or invalid token" },
                { status: 401 }
            );
        }
        const refreshToken = authHeader.split(" ")[1];

        // --- 2. Verify Token signature ---
        // Cast to 'any' to quickly access .id without a custom interface
        const decoded = verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as any;
        
        if (!decoded || !decoded.id) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        // --- 3. Invalidate/Wipe from Database ---
        await prisma.refreshToken.deleteMany({
            where: {
                token: refreshToken,
                userId: decoded.id 
            },
        });

        return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });

    } catch (error: any) {
        console.error("Logout Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
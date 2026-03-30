import { prisma } from "@/prisma/db";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
    request: NextRequest, 
    { params }: { params: Promise<{ user: string }> }
) {
    try {
        const { user: userId } = await params;
        
        if (!userId || isNaN(Number(userId))) {
            return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
        }

        const userAccount = await prisma.user.findUnique({
            where: {
                id: Number(userId)
            },
            include: {
                polls: true
            }
        });
        
        if (!userAccount) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const polls = userAccount.polls;

        return NextResponse.json(polls);
    } catch (err: any) {
        if (err.message?.startsWith("Unauthorized") || err.name === "JsonWebTokenError") {
            return NextResponse.json({ error: "Authentication failed. Please log in again." }, { status: 401 });
        }
        return NextResponse.json({ error: "Something wrong with your request: " + err.message }, { status: 400 });
    }
}
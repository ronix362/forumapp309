import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader);

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // Validate appeal ID and status
    const { id } = await params;
    const appealId = Number(id);
    const { status }: { status: string } = await request.json();

    if (Number.isNaN(appealId)) {
      return NextResponse.json(
        { error: "Invalid Appeal ID. It must be a number." },
        { status: 400 }
      );
    }

    if (!["APPROVED", "DENIED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // 1. Find the appeal
    const appeal = await prisma.appeal.findUnique({
      where: { id: appealId },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    // 2. Use a transaction to update both the Appeal and the User
    const result = await prisma.$transaction(async (tx) => {
      // Update the appeal status
      const updatedAppeal = await tx.appeal.update({
        where: { id: appealId },
        data: { status: status as any }, // 'as any' or your specific Prisma Enum type
      });

      // 3. If APPROVED, unban the user
      if (status === "APPROVED") {
        await tx.user.update({
          where: { id: appeal.userId },
          data: { banned: false },
        });
      }

      return updatedAppeal;
    });

    return NextResponse.json({ 
      message: "Appeal updated successfully",
      appeal: result
    }, { status: 200 });
    
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error updating appeal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
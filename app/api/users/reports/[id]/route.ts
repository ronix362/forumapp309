import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/prisma/db";
import { verifyAccessToken } from "@/utils/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader) as { role: string };

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { id } = await params;
    const reportId = Number(id);

    if (Number.isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid Report ID. It must be a number." },
        { status: 400 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        post: true,
        thread: true,
        poll: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ report }, { status: 200 });
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error fetching report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    const { role } = verifyAccessToken(authHeader) as { role: string };

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // Validate report ID and status
    const { id } = await params;
    const reportId = Number(id);
    const { status }: { status: string } = await request.json();

    if (Number.isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid Report ID. It must be a number." },
        { status: 400 }
      );
    }

    if (!["APPROVED", "DISMISSED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // 1. Find the report first to see what content it's linked to
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 2. Use a transaction to update both the Report and the Content
    const result = await prisma.$transaction(async (tx) => {
      // Update the report status
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: { status: status as any }, // Cast to any to bypass strict Prisma Enum checks
      });

      // 3. If APPROVED, hide the corresponding content
      if (status === "APPROVED") {
        if (report.postId) {
          await tx.post.update({
            where: { id: report.postId },
            data: { visibility: false },
          });
        } else if (report.threadId) {
          await tx.thread.update({
            where: { id: report.threadId },
            data: { visibility: false },
          });
          await tx.post.updateMany({
            where: { threadId: report.threadId },
            data: { visibility: false },
          });
          await tx.poll.updateMany({
            where: { threadId: report.threadId },
            data: { visibility: false },
          });
        } else if (report.pollId) {
          await tx.poll.update({
            where: { id: report.pollId },
            data: { visibility: false },
          });
        }
      }

      return updatedReport;
    });

    return NextResponse.json({ 
      message: "Report updated successfully", 
      report: result }, { status: 200 });
      
  } catch (error: any) {
    if (error.message?.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Error updating report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
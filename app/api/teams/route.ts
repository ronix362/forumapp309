// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' } // Alphabetical order makes the dropdown nicer!
    });
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
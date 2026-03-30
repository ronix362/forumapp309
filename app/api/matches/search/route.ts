// Code Source: Gemini
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { syncMatches } from "@/utils/sync-matches";
import { Prisma } from "@/prisma/generated";

export async function GET(request: Request) {
  try {
    // 1. TIMING & SYNC LOGIC
    const syncRecord = await prisma.sportsData.findUnique({
      where: { id: 2 },
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (!syncRecord || syncRecord.updatedAt < oneHourAgo) {
      try {
        console.log("🔄 Syncing matches with external API...");
        await syncMatches();

        await prisma.sportsData.upsert({
          where: { id: 2, updatedAt: new Date() },
          update: { updatedAt: new Date() },
          create: { id: 2, jsonData: { type: "match_sync_log" } },
        });
      } catch (syncError: unknown) {
        console.error("⚠️ Sync failed, proceeding with cached data");
      }
    }

    // 2. SEARCH & VALIDATION LOGIC
    const { searchParams } = new URL(request.url);
    const matchday = searchParams.get("matchday");
    const status = searchParams.get("status");
    const teamId = searchParams.get("teamId");
    const now = new Date(); // Use actual current time for filtering

    const errors: string[] = [];
    if (matchday) {
      const mdInt = parseInt(matchday);
      if (isNaN(mdInt) || mdInt < 1 || mdInt > 38) errors.push("matchday must be 1-38");
    }
    if (status && !["upcoming", "past"].includes(status)) {
      errors.push("status must be 'upcoming' or 'past'");
    }

    if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });

    // 3. DYNAMIC DATE-BASED WHERE CLAUSE
    // This solves the "March 20" bug by checking the current date
    const whereClause: Prisma.MatchWhereInput = {
      ...(matchday && { matchday: parseInt(matchday) }),
      ...(teamId && {
        OR: [{ homeTeamId: parseInt(teamId) }, { awayTeamId: parseInt(teamId) }],
      }),
      ...(status === "upcoming" && {
        date: { gt: now }, // Match must be in the future
        // Optional: keep completed: false as a secondary guard
      }),
      ...(status === "past" && {
        OR: [
          { date: { lt: now } }, // Match is in the past
          { completed: true }
        ]
      }),
    };

    const matches = await prisma.match.findMany({
      where: whereClause,
      include: { homeTeam: true, awayTeam: true },
      // Closest upcoming matches first; most recent past matches first
      orderBy: { date: status === "upcoming" ? "asc" : "desc" },
    });

    // 4. DYNAMIC LOCATION INJECTION
    const results = matches.map((match) => ({
      ...match,
      location: match.homeTeam?.venue || "TBD",
    }));

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error("Critical Search Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
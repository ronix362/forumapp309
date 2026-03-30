// Code Source: Gemini

/**
 * CACHING STRATEGY:
 * 1. Next.js Cache (Memory): Serves fast, memoized data to minimize external traffic.
 * 2. API Sync (Stale-While-Revalidate): Refreshes every hour to update SQLite with fresh scores/standings.
 * 3. Database Safety Net (Persistence): If the API fails or rate limits (429), the system falls
 *    back to the last known good snapshot in the DB to ensure 100% uptime.
 */

/* As a visitor, I want to see the league standings/tables with all relevant details. */

import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";

type StandingsRow = {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

type FootballApiResponse = {
  standings: {
    table: {
      position: number;
      team: {
        id: number;
        name: string;
        shortName: string;
        crest: string;
      };
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    }[];
  }[];
};

export async function GET(): Promise<Response> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch fresh standings from the External API
    const response = await fetch(
      "https://api.football-data.org/v4/competitions/PL/standings",
      {
        headers: { "X-Auth-Token": apiKey },
        next: { revalidate: 3600 }, // Next.js cache (1 hour)
      }
    );

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data: FootballApiResponse = await response.json();

    // 2. Extract only the "TOTAL" table (index 0)
    const tableData: StandingsRow[] = data.standings[0].table.map((row) => ({
      position: row.position,
      team: {
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName,
        crest: row.team.crest,
      },
      playedGames: row.playedGames,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
    }));

    // 3. Cache result in SportsData
    await prisma.sportsData.upsert({
      where: { id: 1 },
      update: {
        jsonData: tableData,
        updatedAt: new Date(),
      },
      create: {
        id: 1,
        jsonData: tableData,
      },
    });

    // 4. Return filtered table data
    return NextResponse.json(tableData);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching/caching standings:", error.message);
    } else {
      console.error("Error fetching/caching standings:", error);
    }

    // Fallback: return cached DB version
    const cachedData = await prisma.sportsData.findUnique({
      where: { id: 1 },
    });

    if (cachedData) {
      return NextResponse.json(cachedData.jsonData);
    }

    return NextResponse.json(
      { error: "Failed to load standings" },
      { status: 500 }
    );
  }
}
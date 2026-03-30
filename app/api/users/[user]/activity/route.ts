//Code source: Gemini
import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";

interface ActivityResult {
  day: Date;
  count: number; // Postgres COUNT(*) returns a BigInt, but we cast it to int in the query
}

/**
 * Return a list of objects with 2 fields: day and count. 
 * "day" is a string in the format "YYYY-MM-DD" representing a day in the past 30 days, 
 * and "count" is the number of posts the user made on that day.
 * The list includes an entry for every day in the past 30 days, even if the count is 0.
 * The list is sorted by day in ascending order (oldest to newest).
 */
export async function GET(req: Request, {params}: { params: Promise<{ user: string }>}) {
//   const { searchParams } = new URL(req.url); // Uncomment if we want to use query params instead of route params
//   const userId = searchParams.get('userId');
  const {user} = await params;
  const userId = parseInt(user);

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {

    const activity = await prisma.$queryRaw<ActivityResult[]>`
      SELECT 
        DATE_TRUNC('day', "createdAt") as day, 
        COUNT(*)::int as count
      FROM "Post"
      WHERE "authorId" = ${userId}
        AND "createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `;

    const filledData = fillGaps(activity, 30); // Fill in any missing days with count = 0

    return NextResponse.json(filledData);

  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}

// function fillGaps(data: {day: string, count: number}[], daysBack: number) {
function fillGaps(data: ActivityResult[], daysBack: number) {
  const activityMap = new Map(data.map(d => [d.day.toISOString().split('T')[0], d.count]));
  const result = [];
  
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const isoDate = date.toISOString().split('T')[0]; // Result: "2026-02-24"

    result.push({
      day: isoDate,
      count: activityMap.get(isoDate) || 0
    });
  }
  return result;
}
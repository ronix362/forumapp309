import { prisma } from "@/utils/prisma";

// Define the shape of the Football-Data.org API response
interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    winner: string | null;
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export async function syncMatches(): Promise<void> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const leagueCode = 'PL';

  if (!apiKey) {
    console.error("Error: FOOTBALL_DATA_API_KEY is missing from .env");
    return;
  }

  try {
    console.log("Fetching full season schedule...");
    const matchRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueCode}/matches`, {
      headers: { 'X-Auth-Token': apiKey },
      // Vercel/Next.js caching: revalidate once per hour
      next: { revalidate: 3600 } 
    });
    
    if (!matchRes.ok) {
      console.error(`API Error: ${matchRes.status} ${matchRes.statusText}`);
      return;
    }

    const matchData = await matchRes.json();
    const matches: FootballDataMatch[] = matchData.matches;

    // Use a loop to upsert data
    for (const m of matches) {
      const matchDetails = {
        date: new Date(m.utcDate),
        // Use nullish coalescing or explicit nulls for the DB
        homeScore: m.score.fullTime.home ?? null, 
        awayScore: m.score.fullTime.away ?? null,
        matchday: m.matchday,
        stage: m.stage,
        completed: m.status === "FINISHED",
        winnerName: m.score.winner ?? null,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
      };

      await prisma.match.upsert({
        where: { id: m.id },
        update: matchDetails,
        create: {
          id: m.id,
          ...matchDetails,
        },
      });
    }
    
    console.log(`✅ Successfully synced ${matches.length} matches.`);
  } catch (error) {
    console.error("Failed to sync matches:", error);
  }
}
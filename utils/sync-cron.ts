import { ForumType } from "../prisma/generated";
import { prisma } from "../prisma/db";

const LEAGUE_CODE = "PL";
const THREAD_VISIBILITY_WINDOW_DAYS = 14; // Change this for testing.
const THREAD_VISIBILITY_WINDOW_MS = THREAD_VISIBILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

type MatchesApiResponse = {
  matches: Array<{
    id: number;
    utcDate: string;
    matchday: number;
    stage: string;
    status: string;
    score: {
      fullTime: {
        home: number | null;
        away: number | null;
      };
      winner: string | null;
    };
    homeTeam: {
      id: number;
      name: string;
    };
    awayTeam: {
      id: number;
      name: string;
    };
  }>;
};

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

type StandingsApiResponse = {
  standings: Array<{
    table: Array<{
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
    }>;
  }>;
};

export type SyncSummary = {
  matchesProcessed: number;
  threadsCreated: number;
  threadsHidden: number;
  standingsRows: number;
};

type SyncOptions = {
  updateStandings?: boolean;
  manageThreads?: boolean;
};

async function ensureSystemAuthor() {
  return prisma.user.upsert({
    where: { username: "LeagueBot" },
    update: {},
    create: {
      username: "LeagueBot",
      email: "bot@league.com",
      role: "ADMIN",
      password: "",
      avatarId: 0,
    },
  });
}

async function ensureMatchForum() {
  return prisma.forum.upsert({
    where: { type_teamName: { type: ForumType.MATCH, teamName: "Premier League" } },
    update: {},
    create: {
      type: ForumType.MATCH,
      teamName: "Premier League",
    },
  });
}

async function ensureTeamsExist(homeTeam: { id: number; name: string }, awayTeam: { id: number; name: string }) {
  await prisma.team.upsert({
    where: { id: homeTeam.id },
    update: { name: homeTeam.name },
    create: {
      id: homeTeam.id,
      name: homeTeam.name,
      logoUrl: "",
      venue: null,
      seasonYear: 2025,
    },
  });

  await prisma.team.upsert({
    where: { id: awayTeam.id },
    update: { name: awayTeam.name },
    create: {
      id: awayTeam.id,
      name: awayTeam.name,
      logoUrl: "",
      venue: null,
      seasonYear: 2025,
    },
  });
}

async function fetchLeagueMatches(apiKey: string) {
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${LEAGUE_CODE}/matches`,
    {
      headers: { "X-Auth-Token": apiKey },
      method: "GET",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`football-data matches fetch failed (${response.status}): ${body}`);
  }

  return (await response.json()) as MatchesApiResponse;
}

async function updateStandingsSnapshot(apiKey: string) {
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${LEAGUE_CODE}/standings`,
    {
      headers: { "X-Auth-Token": apiKey },
      method: "GET",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`football-data standings fetch failed (${response.status}): ${body}`);
  }

  const standingsData = (await response.json()) as StandingsApiResponse;
  const totalTable = standingsData.standings?.[0]?.table ?? [];

  const tableRows: StandingsRow[] = totalTable.map((row) => ({
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

  await prisma.sportsData.upsert({
    where: { id: 1 },
    update: {
      jsonData: tableRows,
      updatedAt: new Date(),
    },
    create: {
      id: 1,
      jsonData: tableRows,
    },
  });

  return tableRows.length;
}

export async function syncMatchesAndThreads(options: SyncOptions = {}): Promise<SyncSummary> {
  const { updateStandings = true, manageThreads = true } = options;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is missing");
  }

  const now = new Date();
  const [systemAuthor, matchForum, matchData] = await Promise.all([
    ensureSystemAuthor(),
    ensureMatchForum(),
    fetchLeagueMatches(apiKey),
  ]);

  let standingsRows = 0;
  if (updateStandings) {
    standingsRows = await updateStandingsSnapshot(apiKey);
  }

  let threadsCreated = 0;
  let threadsHidden = 0;

  for (const m of matchData.matches) {
    const matchDate = new Date(m.utcDate);

    await ensureTeamsExist(m.homeTeam, m.awayTeam);

    const match = await prisma.match.upsert({
      where: { id: m.id },
      update: {
        date: matchDate,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        matchday: m.matchday,
        stage: m.stage,
        completed: m.status === "FINISHED",
        winnerName: m.score.winner,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
      },
      create: {
        id: m.id,
        date: matchDate,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        matchday: m.matchday,
        stage: m.stage,
        completed: m.status === "FINISHED",
        winnerName: m.score.winner,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
      },
    });

    if (!manageThreads) {
      continue;
    }

    const threadOpenTime = matchDate.getTime() - THREAD_VISIBILITY_WINDOW_MS;
    const threadCloseTime = matchDate.getTime() + THREAD_VISIBILITY_WINDOW_MS;
    const isWithinActiveWindow =
      now.getTime() >= threadOpenTime && now.getTime() <= threadCloseTime;

    if (!match.discussionThreadId && isWithinActiveWindow) {
      const threadTitle = `${m.homeTeam.name} vs ${m.awayTeam.name} - Matchday ${m.matchday}`;

      const newThread = await prisma.thread.create({
        data: {
          title: threadTitle,
          authorId: systemAuthor.id,
          forumId: matchForum.id,
          visibility: true,
          posts: {
            create: {
              content: `Welcome to the official discussion for ${threadTitle}! This thread is open for live commentary and analysis.`,
              authorId: systemAuthor.id,
              aiFlagged: false,
              aiMaxScore: 0,
              aiScores: [0],
            },
          },
        },
      });

      await prisma.match.update({
        where: { id: match.id },
        data: { discussionThreadId: newThread.id },
      });

      threadsCreated += 1;
      continue;
    }

    if (match.discussionThreadId) {
      const shouldBeVisible = isWithinActiveWindow;
      await prisma.thread.update({
        where: { id: match.discussionThreadId },
        data: { visibility: shouldBeVisible },
      });

      if (!shouldBeVisible) {
        threadsHidden += 1;
      }
    }
  }

  return {
    matchesProcessed: matchData.matches.length,
    threadsCreated,
    threadsHidden,
    standingsRows,
  };
}

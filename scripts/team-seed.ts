import bcrypt from 'bcryptjs';
import { PrismaClient, ForumType } from '../prisma/generated/index.js'; // Ensure .js if using ESM

const prisma = new PrismaClient();

// Helper for safe AI scores
const defaultSafeAiScores = {
  aiFlagged: false,
  aiMaxScore: 1.0,
  aiScores: [1.0],
};

const defaultSafeThreadAiScores = {
  aiAvgScore: 1.0,
};

// Constant for 24 hours ago to ensure all seeded data is backdated
const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function main(): Promise<void> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const leagueCode = 'PL';

  if (!apiKey) {
    console.error("Error: FOOTBALL_DATA_API_KEY is missing from .env");
    return;
  }

  const saltRounds = 10;
  const hashedAdminPassword = await bcrypt.hash("1234", saltRounds);

  // 1. GET OR CREATE A SYSTEM AUTHOR
  const systemAuthor = await prisma.user.upsert({
    where: { username: "LeagueBot" },
    update: { password: hashedAdminPassword },
    create: {
      username: "LeagueBot",
      email: "bot@league.com",
      role: "ADMIN",
      password: hashedAdminPassword,
      avatarId: 0,
    }
  });

  // 2. ENSURE THE GLOBAL MATCH FORUM EXISTS
  const matchForum = await prisma.forum.upsert({
    where: { type_teamName: { type: ForumType.MATCH, teamName: "Premier League" } },
    update: {},
    create: {
      type: ForumType.MATCH,
      teamName: "Premier League"
    }
  });

  console.log("🚀 Starting Premier League data seed (Backdated by 1 day)...");

  // 3. LOAD TEAMS & CREATE TEAM FORUMS
  const teamRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueCode}/teams`, {
    headers: { 'X-Auth-Token': apiKey }
  });
  const teamData = await teamRes.json();

  for (const team of teamData.teams) {
    const upsertedTeam = await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name, logoUrl: team.crest, venue: team.venue },
      create: { id: team.id, name: team.name, logoUrl: team.crest, venue: team.venue, seasonYear: 2025 }
    });

    await prisma.forum.upsert({
      where: { type_teamName: { type: ForumType.TEAM, teamName: upsertedTeam.name } },
      update: { teamId: upsertedTeam.id },
      create: {
        type: ForumType.TEAM,
        teamName: upsertedTeam.name,
        teamId: upsertedTeam.id
      }
    });
  }

  // 4. LOAD MATCHES & AUTO-CREATE THREADS
  const matchRes = await fetch(`https://api.football-data.org/v4/competitions/${leagueCode}/matches`, {
    headers: { 'X-Auth-Token': apiKey }
  });
  const matchData = await matchRes.json();

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  for (const m of matchData.matches) {
    const matchDate = new Date(m.utcDate);
    
    const matchFields = {
      date: matchDate,
      homeScore: m.score.fullTime.home, 
      awayScore: m.score.fullTime.away, 
      matchday: m.matchday,
      stage: m.stage,
      completed: m.status === "FINISHED",
      winnerName: m.score.winner,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
    };
  
    const match = await prisma.match.upsert({
      where: { id: m.id },
      update: {
        date: matchFields.date,
        homeScore: matchFields.homeScore,
        awayScore: matchFields.awayScore,
        completed: matchFields.completed,
        winnerName: matchFields.winnerName,
      },
      create: {
        id: m.id,
        ...matchFields,
      },
    });

    // Use ONE_DAY_AGO to determine active windows so the data acts like it was seeded yesterday
    const threadOpenTime = matchDate.getTime() - TWO_WEEKS_MS;
    const threadCloseTime = matchDate.getTime() + TWO_WEEKS_MS;
    const isWithinActiveWindow = ONE_DAY_AGO.getTime() >= threadOpenTime && ONE_DAY_AGO.getTime() <= threadCloseTime;

    if (!match.discussionThreadId && isWithinActiveWindow) {
      const threadTitle = `${m.homeTeam.name} vs ${m.awayTeam.name} - Matchday ${m.matchday}`;
      
      // Thread creation with AI Avg Score and randomized createdAt ensuring it is at least 24 hours old
      const threadCreationDate = new Date(Math.max(threadOpenTime, ONE_DAY_AGO.getTime() - (Math.random() * 1000000000)));

      const newThread = await prisma.thread.create({
        data: {
          title: threadTitle,
          authorId: systemAuthor.id,
          forumId: matchForum.id,
          createdAt: threadCreationDate,
          ...defaultSafeThreadAiScores,
          posts: {
            create: {
              // ✨ EXPLICITLY state this is the main post and provide important context
              content: `Welcome to the official discussion for ${threadTitle}! This is the main post for this thread. Please use this space for live commentary, tactical analysis, and post-match reactions. Ensure all discussions adhere to the community guidelines.`,
              authorId: systemAuthor.id,
              createdAt: threadCreationDate,
              ...defaultSafeAiScores
            }
          }
        },
        include: {
          posts: true
        }
      });

      // ✨ LINK MAIN POST: Safely grab the newly created post and attach its ID to the thread
      if (newThread.posts.length > 0) {
        await prisma.thread.update({
          where: { id: newThread.id },
          data: { mainPostId: newThread.posts[0].id }
        });
      }

      await prisma.match.update({
        where: { id: match.id },
        data: { discussionThreadId: newThread.id }
      });
      
      console.log(`🧵 Created active thread with AI scores & linked Main Post: ${threadTitle}`);

    } else if (match.discussionThreadId && !isWithinActiveWindow) {
      await prisma.thread.update({
        where: { id: match.discussionThreadId },
        data: { visibility: false } 
      });

      console.log(`🧵 Hid expired thread for Match ID: ${match.id}`);
    }
  }

  console.log(`✅ Premier League Seed complete. All data is correctly backdated and linked!`);
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
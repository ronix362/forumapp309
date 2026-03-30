import bcrypt from 'bcryptjs';
import { PrismaClient, ForumType } from '../prisma/generated/index.js';
// Adjust the path to your moderation utilities based on your folder structure
import { checkInappropriate, createReport } from '../utils/moderation.js';

const prisma = new PrismaClient();

/**
 * UPDATED HELPER:
 * Generates a date between (days + 1) ago and 1 day ago.
 * This ensures even the "newest" seeded data is at least 24 hours old.
 */
const getRandomDateWithin = (days: number) => {
  const date = new Date();
  // Set to 1 day ago as the absolute baseline
  date.setDate(date.getDate() - 1);
  // Subtract additional random days
  date.setDate(date.getDate() - Math.floor(Math.random() * days));
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return date;
};

// Constant for 24 hours ago to use for "current" seed events
const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);

// Default safe AI scores
const defaultSafePostAiScores = {
  aiFlagged: false,
  aiMaxScore: 1,
  aiScores: [1.0],
};

// Default safe AI average score for threads
const defaultSafeThreadAiScores = {
  aiAvgScore: 1,
};

async function main(): Promise<void> {
  console.log("🚀 Starting Ultimate Stress-Test Seed (Backdated by 1 day)...");

  const saltRounds = 10;
  const defaultPassword = await bcrypt.hash("1234", saltRounds);

  // ==========================================
  // 1. FETCH FORUMS & TEAMS
  // ==========================================
  const generalForum = await prisma.forum.findFirst({ where: { type: ForumType.GENERAL } });
  const teamForums = await prisma.forum.findMany({ where: { type: ForumType.TEAM } });
  const allTeams = await prisma.team.findMany();

  if (!generalForum || teamForums.length === 0 || allTeams.length === 0) {
    throw new Error("❌ Missing forums or teams! Please run team-seed.ts and forum-seed.ts first.");
  }

  // ==========================================
  // 2. CREATE 40 USERS
  // ==========================================
  console.log("👤 Creating 40 users...");
  const users = [];
  for (let i = 1; i <= 40; i++) {
    const username = `user${i}`;
    const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];

    const user = await prisma.user.upsert({
      where: { username },
      update: { favoriteTeamId: randomTeam.id },
      create: {
        username,
        email: `${username}@example.com`,
        password: defaultPassword,
        role: "USER",
        avatarId: i % 12,
        favoriteTeamId: randomTeam.id,
      },
    });
    users.push(user);
  }
  const user1 = users[0];

  // ==========================================
  // 3. SOCIAL GRAPH
  // ==========================================
  console.log("🤝 Generating random follows...");
  for (const currentUser of users) {
    const candidates = users
      .filter(u => u.id !== currentUser.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);

    for (const targetUser of candidates) {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: currentUser.id, followingId: targetUser.id } },
        update: {},
        create: { followerId: currentUser.id, followingId: targetUser.id }
      });
    }
  }

  // ==========================================
  // 4. CREATE THREADS & POSTS
  // ==========================================
  console.log("📝 Creating standard threads and posts...");
  const allThreads = [];
  const topLevelPosts = [];

  for (let i = 0; i < 40; i++) {
    const user = users[i];
    const assignedTeamForum = teamForums[i % teamForums.length];

    const gThread = await prisma.thread.create({
      data: {
        title: `${user.username}'s General Discussion`,
        authorId: user.id,
        forumId: generalForum.id,
        createdAt: getRandomDateWithin(14),
        ...defaultSafeThreadAiScores
      }
    });
    const tThread = await prisma.thread.create({
      data: {
        title: `${user.username}'s thoughts on ${assignedTeamForum.teamName}`,
        authorId: user.id,
        forumId: assignedTeamForum.id,
        createdAt: getRandomDateWithin(14),
        ...defaultSafeThreadAiScores
      }
    });

    allThreads.push(gThread, tThread);

    for (const thread of [gThread, tThread]) {
      const post = await prisma.post.create({
        data: {
          content: `Welcome to my thread! I wanted to start a discussion about ${thread.title}.`,
          authorId: user.id,
          threadId: thread.id,
          createdAt: thread.createdAt,
          ...defaultSafePostAiScores
        }
      });

      await prisma.thread.update({
        where: { id: thread.id },
        data: { mainPostId: post.id }
      });

      topLevelPosts.push({ post, user });
    }
  }

  const user1FirstPost = topLevelPosts[0].post;

  // ==========================================
  // 5. USER 1 TEAM STRESS TEST
  // ==========================================
  console.log(`🏟️ User 1 team threads...`);
  for (const teamForum of teamForums) {
    const threadDate = getRandomDateWithin(14);
    const teamThread = await prisma.thread.create({
      data: {
        title: `Comprehensive Analysis: Why ${teamForum.teamName} will win the league`,
        authorId: user1.id,
        forumId: teamForum.id,
        createdAt: threadDate,
        ...defaultSafeThreadAiScores
      }
    });
    allThreads.push(teamThread);

    const post = await prisma.post.create({
      data: {
        content: `I've been looking at the stats for ${teamForum.teamName}. Thoughts?`,
        authorId: user1.id,
        threadId: teamThread.id,
        createdAt: threadDate,
        ...defaultSafePostAiScores
      }
    });

    await prisma.thread.update({
      where: { id: teamThread.id },
      data: { mainPostId: post.id }
    });
  }

  // ==========================================
  // 6. USER 1 GLOBAL POSTING SPREE
  // ==========================================
  for (const thread of allThreads) {
    await prisma.post.create({
      data: {
        content: `User 1 checking in! Just dropped by.`,
        authorId: user1.id,
        threadId: thread.id,
        createdAt: getRandomDateWithin(14),
        ...defaultSafePostAiScores
      }
    });
  }

  // ==========================================
  // 7. MEGA-THREAD & REPLIES
  // ==========================================
  for (const user of users) {
    await prisma.post.create({
      data: {
        content: `Mega-thread post from ${user.username}.`,
        authorId: user.id,
        threadId: 1, // Assumes thread 1 exists, which it does from step 4
        createdAt: getRandomDateWithin(14),
        ...defaultSafePostAiScores
      }
    });

    await prisma.post.create({
      data: {
        content: `Replying to your first post, @user1!`,
        authorId: user.id,
        threadId: user1FirstPost.threadId,
        replyingToId: user1FirstPost.id,
        createdAt: getRandomDateWithin(14),
        ...defaultSafePostAiScores
      }
    });
  }

  // ==========================================
  // 8. ROUND-ROBIN REPLY CHAIN
  // ==========================================
  for (let i = 0; i < 40; i++) {
    const currentUser = users[i];
    const prevIdx = i === 0 ? 39 : i - 1;
    const target = topLevelPosts[prevIdx * 3];

    if (target && target.post) {
      await prisma.post.create({
        data: {
          content: `I totally agree with your opening thoughts, @${target.user.username}!`,
          authorId: currentUser.id,
          threadId: target.post.threadId,
          replyingToId: target.post.id,
          createdAt: getRandomDateWithin(14),
          ...defaultSafePostAiScores
        },
      });
    }
  }

  // ==========================================
  // 9. BAN & APPEALS
  // ==========================================
  const last5Users = users.slice(-5);
  for (const user of last5Users) {
    await prisma.user.update({ where: { id: user.id }, data: { banned: true } });
    await prisma.appeal.create({
      data: {
        userId: user.id,
        content: `Hello, my name is ${user.username}. Please reinstate me.`
      }
    });
  }

  // ==========================================
  // 10. GENERATE REPORTS
  // ==========================================
  const postsToReport = topLevelPosts.slice(-5).map(p => p.post);
  for (let i = 0; i < 5; i++) {
    const targetPostId = postsToReport[i].id;
    await prisma.report.create({
      data: {
        userId: user1.id,
        postId: targetPostId,
        reason: `Spam detected by ${user1.username}.`,
        createdAt: ONE_DAY_AGO
      }
    });
    await prisma.post.update({
      where: { id: targetPostId },
      data: { reportCount: { increment: 1 } }
    });
  }

  for (let i = 1; i <= 5; i++) {
    await prisma.report.create({
      data: {
        userId: user1.id,
        threadId: i,
        reason: `Community guideline violation.`,
        createdAt: ONE_DAY_AGO
      }
    });
    await prisma.thread.update({
      where: { id: i },
      data: { reportCount: { increment: 1 } }
    });
  }

  // ==========================================
  // 11. GENERATE 5 EXPLICITLY TOXIC POSTS
  // ==========================================
  console.log("☠️ Toxic posts (Backdated to 1 day ago)...");
  const toxicMessages = [
    "You are a complete idiot and a worthless moron.",
    "Go jump off a cliff, you stupid piece of trash.",
    "I hate you, you are an absolute disgrace.",
    "You are the dumbest person alive, absolute garbage.",
    "Shut up you pathetic loser, nobody cares about your stupid opinion."
  ];

  for (let i = 0; i < toxicMessages.length; i++) {
    const content = toxicMessages[i];
    let aiFlagged = false;
    let aiMaxScore = 0;
    let aiScores: number[] = [];

    try {
      const result = await checkInappropriate(content);
      aiFlagged = result.aiFlagged;
      aiMaxScore = result.aiMaxScore;
      aiScores = result.scores;
    } catch (err) { }

    const badPost = await prisma.post.create({
      data: {
        content: content,
        authorId: user1.id,
        threadId: 1,
        createdAt: ONE_DAY_AGO,
        aiFlagged,
        aiMaxScore,
        aiScores: aiScores as any
      }
    });

    if (aiFlagged) {
      await createReport(1, "Automatic AI flag", "POST", badPost.id);
    }
  }

  // ==========================================
  // 12. GENERATE ENGAGING POLLS & VOTES
  // ==========================================
  console.log("📊 Polls (Backdated to 1 day ago)...");

  const pollThread = await prisma.thread.create({
    data: {
      title: "Hot Takes & Predictions: Community Polls",
      authorId: user1.id,
      forumId: generalForum.id,
      createdAt: ONE_DAY_AGO,
      ...defaultSafeThreadAiScores
    }
  });

  // ✨ NEW: Create a main post for the poll thread so it isn't orphaned/null
  const pollMainPost = await prisma.post.create({
    data: {
      content: "Welcome to the official hot takes and predictions poll thread! Cast your votes below and let us know your thoughts.",
      authorId: user1.id,
      threadId: pollThread.id,
      createdAt: ONE_DAY_AGO,
      ...defaultSafePostAiScores
    }
  });

  await prisma.thread.update({
    where: { id: pollThread.id },
    data: { mainPostId: pollMainPost.id }
  });

  const engagingPolls = [
    { question: "Who will win the Premier League this season?", options: ["Arsenal", "Manchester City", "Liverpool", "Aston Villa", "Chelsea"] },
    { question: "Which proposed football rule change would you support?", options: ["Scrapping VAR", "Blue cards", "Wenger's Offside Rule", "Stop-clock", "Kick-ins"] },
    { question: "What is the most crucial position?", options: ["Striker", "Playmaker", "Defensive Mid", "Center Back", "Goalkeeper"] },
    { question: "Best stadium atmosphere?", options: ["Anfield", "Signal Iduna Park", "San Siro", "Bernabéu", "Celtic Park"] },
    { question: "Bring back one legend?", options: ["Pele", "Maradona", "Cruyff", "Zidane", "Ronaldinho"] }
  ];

  for (let j = 0; j < engagingPolls.length; j++) {
    const pollData = engagingPolls[j];
    // Deadline is still in the future, but creation is 1 day ago
    const deadline = new Date(Date.now() + (j + 1) * 30 * 60 * 1000);

    const poll = await prisma.poll.create({
      data: {
        pollDescription: pollData.question,
        deadline: deadline,
        authorId: user1.id,
        threadId: pollThread.id,
        createdAt: ONE_DAY_AGO,
        aiFlagged: false,
        aiMaxScore: 1,
        aiScores: [1.0],
        options: {
          create: pollData.options.map(text => ({ text }))
        }
      },
      include: { options: true }
    });

    for (let u = 0; u < 10; u++) {
      try {
        await prisma.pollVote.create({
          data: {
            userId: users[u].id,
            pollId: poll.id,
            optionIndex: Math.floor(Math.random() * 5) + 1,
            createdAt: ONE_DAY_AGO
          }
        });
      } catch (err) { }
    }
  }

  console.log("✅ Seed complete! All data is at least 24 hours old and main threads are linked.");
}

main()
  .catch((e: Error) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
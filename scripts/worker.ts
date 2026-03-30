import cron from "node-cron";
import { prisma } from "../prisma/db";
import { syncMatchesAndThreads } from "../utils/sync-cron";

let isRunning = false;

async function runSyncWithLock() {
  if (isRunning) {
    console.log("[worker] Previous run still in progress, skipping this tick.");
    return;
  }

  isRunning = true;

  try {
    const summary = await syncMatchesAndThreads({
      updateStandings: true,
      manageThreads: true,
    });

    console.log(
      `[worker] Sync complete. Matches: ${summary.matchesProcessed}, created threads: ${summary.threadsCreated}, hidden threads: ${summary.threadsHidden}, standings rows: ${summary.standingsRows}`
    );
  } catch (error) {
    console.error("[worker] Sync failed:", error);
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log("[worker] Match-thread cron worker starting...");

  //Testing: Run immediately
    // await runSyncWithLock();

  // Do not run immediately at startup; wait for the first cron tick.
  cron.schedule("*/10 * * * *", async () => {
    await runSyncWithLock();
  });

  console.log("[worker] Scheduler armed: every 10 minutes.");
}

void main();

process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM received, shutting down.");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[worker] SIGINT received, shutting down.");
  await prisma.$disconnect();
  process.exit(0);
});

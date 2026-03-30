import { NextRequest, NextResponse } from "next/server";
import { syncMatchesAndThreads } from "@/utils/sync-cron";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // In local/dev environments where CRON_SECRET is not set,
  // allow manual invocation.
  if (!cronSecret) return true;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.replace("Bearer ", "").trim();

  return bearer === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncMatchesAndThreads({
      updateStandings: true,
      manageThreads: true,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to sync matches" },
      { status: 500 }
    );
  }
}

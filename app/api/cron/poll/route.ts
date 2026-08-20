import { NextResponse } from "next/server";
import { runPoll } from "../../../../lib/poll";
import { summarizePending } from "../../../../lib/summarize";

// How many newest un-summarized bills to analyze per daily run. Kept small so
// the poll + summarize work stays within the serverless time budget below; any
// larger backlog is worked down over subsequent days (or via the CLI script).
const SUMMARIZE_PER_RUN = 10;

// Always run on demand; never cache.
export const dynamic = "force-dynamic";
// Allow the poll enough time to fetch any changed bills.
export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify the request came from Vercel Cron. Vercel sends the CRON_SECRET as
  // an Authorization: Bearer <secret> header on scheduled invocations.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updated, skipped, failed } = await runPoll();

    // After ingesting new/changed bills, generate AI analysis for the newest
    // bills that still lack it, so summaries appear without a manual script run.
    // Isolated in its own try/catch: a summarize failure must not fail the poll.
    let summarized: Awaited<ReturnType<typeof summarizePending>> | { error: string };
    try {
      summarized = await summarizePending(SUMMARIZE_PER_RUN);
    } catch (err) {
      summarized = { error: (err as Error).message };
    }

    return NextResponse.json({ updated, skipped, failed, summarized });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

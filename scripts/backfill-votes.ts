import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { bills, legislators, votes, voteDetail } from "../db/schema";
import { getBill, getRollCall } from "../lib/legiscan";

// Neon's HTTP driver issues each query as an independent HTTPS request, which
// holds up better than a long-lived pooled socket across a multi-thousand-call
// backfill — same reasoning as scripts/backfill.ts.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, {
  schema: { bills, legislators, votes, voteDetail },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Resumability: this backfill is long and rate-limited, so we record the last
// fully-processed bill_id to a checkpoint file. On a fresh run we resume right
// after it instead of re-fetching every bill. Bills are processed in ascending
// bill_id order so the checkpoint is a single monotonic high-water mark.
//
// The checkpoint lives in the OS temp dir (not the project folder) so OneDrive
// sync can't lock it mid-write, which has bitten us before. Delete this file to
// force a full run from scratch.
const CHECKPOINT_FILE = join(tmpdir(), "ncpolisearch-votes-checkpoint");

function readCheckpoint(): number {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const n = parseInt(readFileSync(CHECKPOINT_FILE, "utf8").trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // A missing/corrupt checkpoint just means start from the beginning.
  }
  return -1;
}

function writeCheckpoint(billId: number) {
  try {
    writeFileSync(CHECKPOINT_FILE, String(billId));
  } catch {
    // Losing a checkpoint write only costs us re-processing that bill on
    // resume, which is idempotent — never worth crashing the run over.
  }
}

// Optional manual start position (1-based), via `--start N` or START_AT=N.
// Returns 1 (start from the beginning) when not provided or invalid.
function readStartPosition(): number {
  const flagIndex = process.argv.indexOf("--start");
  const raw =
    flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.START_AT;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 1 ? n : 1;
}

async function main() {
  // A roll call only gives us people_id + vote_text per voter, so we look up
  // each voter's name/party from the legislators table we already populated.
  const legRows = await db
    .select({
      peopleId: legislators.peopleId,
      name: legislators.name,
      party: legislators.party,
    })
    .from(legislators);
  const legMap = new Map(
    legRows.map((l) => [l.peopleId, { name: l.name, party: l.party }])
  );

  // 1. Every bill_id currently stored, ascending so the checkpoint is monotonic.
  const billRows = await db
    .select({ billId: bills.billId })
    .from(bills)
    .orderBy(asc(bills.billId));
  console.log(`Found ${billRows.length} bills to check for roll calls`);

  const checkpoint = readCheckpoint();
  if (checkpoint >= 0) {
    console.log(
      `Resuming from checkpoint: skipping bills already processed up to bill_id ${checkpoint}`
    );
  }

  // Manual override: `--start N` (or START_AT=N) begins at the Nth bill in the
  // run, matching the "Progress: N/2324" position shown in the log. Useful for
  // jumping straight to where a previous run left off.
  const startAt = readStartPosition();
  if (startAt > 1) {
    console.log(`Manual start: beginning at bill position ${startAt}/${billRows.length}`);
  }

  let position = 0;
  let processed = 0;
  let resumeSkipped = 0;
  let billsWithVotes = 0;
  let votesStored = 0;
  let voteDetailsStored = 0;
  let failed = 0;

  // 2. Walk every bill, pulling its roll call summaries from getBill.
  for (const { billId } of billRows) {
    position++;

    // Manual start position takes precedence — skip everything before it.
    if (position < startAt) {
      resumeSkipped++;
      continue;
    }

    // Already handled in a prior run — skip without spending an API call.
    if (billId <= checkpoint) {
      resumeSkipped++;
      continue;
    }
    processed++;
    try {
      const bill = await getBill(billId);
      // 6. Be polite to the LegiScan API between calls.
      await sleep(200);

      const rollCalls = bill.votes ?? [];

      // 5. Bills with no roll calls store nothing, but still count as processed
      //    so the checkpoint advances past them and we never re-check them.
      if (rollCalls.length > 0) {
        billsWithVotes++;

        // 3. For each roll call, fetch the full vote breakdown.
        for (const summary of rollCalls) {
          const rc = await getRollCall(summary.roll_call_id);
          await sleep(200);

          // 4. Store the roll call totals. Upsert keeps reruns idempotent.
          const voteRow = {
            billId,
            date: rc.date ?? summary.date ?? null,
            description: rc.desc ?? summary.desc ?? null,
            chamber: rc.chamber ?? summary.chamber ?? null,
            yea: rc.yea ?? summary.yea ?? null,
            nay: rc.nay ?? summary.nay ?? null,
            nv: rc.nv ?? summary.nv ?? null,
            absent: rc.absent ?? summary.absent ?? null,
            passed: (rc.passed ?? summary.passed) === 1,
          };

          await db
            .insert(votes)
            .values({ rollCallId: rc.roll_call_id, ...voteRow })
            .onConflictDoUpdate({ target: votes.rollCallId, set: voteRow });
          votesStored++;

          // Replace this roll call's individual votes so reruns stay idempotent.
          await db
            .delete(voteDetail)
            .where(eq(voteDetail.rollCallId, rc.roll_call_id));

          for (const v of rc.votes ?? []) {
            const leg = legMap.get(v.people_id);
            await db.insert(voteDetail).values({
              rollCallId: rc.roll_call_id,
              // Only reference legislators we actually have, otherwise the FK
              // would reject voters who never sponsored a bill. The name/party
              // still come from the lookup when available.
              peopleId: leg ? v.people_id : null,
              name: leg?.name ?? null,
              party: leg?.party ?? null,
              vote: v.vote_text,
            });
            voteDetailsStored++;
          }
        }
      }

      // This bill is fully done — advance the checkpoint so a resumed run skips
      // it. Only written on success; a thrown error leaves the checkpoint where
      // it was so the bill is retried next time.
      writeCheckpoint(billId);
    } catch (err) {
      // One failed bill must not stop the whole backfill.
      failed++;
      console.error(`Bill ${billId} failed: ${(err as Error).message}`);
    }

    // 7. Progress every 20 bills.
    if (processed % 20 === 0) {
      console.log(
        `Progress: ${processed}/${billRows.length} — ${votesStored} votes stored`
      );
    }
  }

  // A run that reaches the end with no failures has covered every bill, so the
  // checkpoint is no longer needed — clear it so the next run starts fresh.
  if (failed === 0) {
    try {
      if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
    } catch {
      // Non-fatal: a stale checkpoint only causes harmless re-skipping.
    }
  }

  // 8. Final summary.
  console.log("");
  if (resumeSkipped > 0) {
    console.log(`Bills skipped (already done before this run): ${resumeSkipped}`);
  }
  console.log(`Bills checked this run: ${processed}`);
  console.log(`Bills with roll calls: ${billsWithVotes}`);
  console.log(`Total votes stored: ${votesStored}`);
  console.log(`Total individual vote records stored: ${voteDetailsStored}`);
  console.log(`Failed bills: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

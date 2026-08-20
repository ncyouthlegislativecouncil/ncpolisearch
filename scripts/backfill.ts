import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { bills, legislators, billSponsors } from "../db/schema";

// Neon's HTTP driver issues each query as an independent HTTPS request, so
// there's no long-lived pooled socket to drop mid-run — which is what made a
// persistent postgres-js connection fail after a few hundred queries here.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { bills, legislators, billSponsors } });
import {
  getSessionList,
  getMasterListRaw,
  getBill,
  type MasterListRawBill,
} from "../lib/legiscan";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry briefly transient failures. Note: once this long-lived process starts
// failing in a sustained way (Neon's HTTP gateway degrades for a given client
// after a few minutes of steady load), retries don't recover it — only a fresh
// process does. So keep retries short and let the outer restart loop take over.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await sleep(500 * i);
    }
  }
  throw lastErr;
}

// When failures cluster, this process has gone bad — exit so a fresh one (via
// the runup loop in package.json) can resume from the database.
const MAX_CONSECUTIVE_FAILURES = 15;

async function main() {
  // 1. Find the NC 2025-2026 session.
  const sessions = await getSessionList("NC");
  const session = sessions.find(
    (s) => s.year_start === 2025 && s.year_end === 2026
  );
  if (!session) {
    throw new Error("No 2025-2026 NC session found");
  }
  console.log(
    `Using session_id ${session.session_id} (${session.session_name})`
  );

  // 2. One call returns every bill_id + change_hash for the session.
  const masterlist = await getMasterListRaw(session.session_id);
  const billList = Object.entries(masterlist)
    .filter(([key]) => key !== "session")
    .map(([, value]) => value as MasterListRawBill);
  console.log(`Master list contains ${billList.length} bills`);

  // Wake the database first — Neon's free tier suspends compute when idle and
  // refuses connections for a few seconds while booting. Warming it here keeps
  // the first bills from burning their retries against a cold instance.
  await withRetry(() => db.select({ id: bills.billId }).from(bills).limit(1), 8);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;
  let consecutiveFailures = 0;
  let bailed = false;

  // 3. Loop through every bill.
  for (const entry of billList) {
    processed++;
    try {
      // Resumability: skip bills already stored with the same change_hash.
      const existing = await withRetry(() =>
        db
          .select({ changeHash: bills.changeHash })
          .from(bills)
          .where(eq(bills.billId, entry.bill_id))
          .limit(1)
      );

      if (existing.length > 0 && existing[0].changeHash === entry.change_hash) {
        skipped++;
        consecutiveFailures = 0;
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${billList.length}`);
        }
        continue;
      }

      await withRetry(async () => {
        const bill = await getBill(entry.bill_id);
        await sleep(200);

        const lastAction =
          bill.history && bill.history.length > 0
            ? bill.history[bill.history.length - 1]
            : null;

        const billRow = {
          billNumber: bill.bill_number ?? entry.number,
          title: bill.title ?? entry.title,
          status: String(bill.status ?? entry.status),
          chamber: bill.body ?? bill.current_body ?? null,
          changeHash: bill.change_hash ?? entry.change_hash,
          lastAction: lastAction?.action ?? entry.last_action,
          lastActionDate: lastAction?.date ?? entry.last_action_date,
          url: bill.url ?? entry.url,
        };

        await db
          .insert(bills)
          .values({ billId: bill.bill_id, ...billRow })
          .onConflictDoUpdate({ target: bills.billId, set: billRow });

        // Refresh sponsors for this bill so reruns stay idempotent.
        await db
          .delete(billSponsors)
          .where(eq(billSponsors.billId, bill.bill_id));

        for (const sp of bill.sponsors ?? []) {
          // Committee sponsors (e.g. "Appropriations", "Rules") are not people —
          // skip them so they never get ingested as legislators.
          if (sp.committee_sponsor || sp.committee_id) continue;

          const legislatorRow = {
            name: sp.name,
            party: sp.party,
            role: sp.role,
            district: sp.district,
          };

          await db
            .insert(legislators)
            .values({ peopleId: sp.people_id, ...legislatorRow })
            .onConflictDoUpdate({
              target: legislators.peopleId,
              set: legislatorRow,
            });

          await db
            .insert(billSponsors)
            .values({
              billId: bill.bill_id,
              peopleId: sp.people_id,
              name: sp.name,
              party: sp.party,
              isPrimary: sp.sponsor_type_id === 1,
            })
            .onConflictDoNothing({
              target: [billSponsors.billId, billSponsors.peopleId],
            });
        }
      });

      inserted++;
      consecutiveFailures = 0;
    } catch (err) {
      // 5. One failed bill must not crash the whole run.
      failed++;
      consecutiveFailures++;
      console.error(
        `Bill ${entry.bill_id} (${entry.number}) failed: ${(err as Error).message}`
      );

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `\n${consecutiveFailures} consecutive failures — this process has degraded. ` +
            `Exiting so a fresh run can resume from the database.`
        );
        bailed = true;
        break;
      }
    }

    // 4. Progress every 10 bills.
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${billList.length}`);
    }
  }

  // 6. Final summary.
  console.log("");
  console.log(`Total inserted/updated: ${inserted}`);
  console.log(`Total skipped (unchanged): ${skipped}`);
  console.log(`Total failed: ${failed}`);

  // Exit 0 only when a full pass completed with nothing left to retry. Any
  // failures (or an early bail) exit non-zero so the restart loop runs again.
  process.exit(bailed || failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

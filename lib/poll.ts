import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { bills, legislators, billSponsors, votes, voteDetail } from "../db/schema";
import {
  getSessionList,
  getMasterListRaw,
  getBill,
  getRollCall,
  type MasterListRawBill,
} from "./legiscan";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PollResult {
  updated: number;
  skipped: number;
  failed: number;
}

// Shared poll logic used by both the CLI script (scripts/poll.ts) and the
// Vercel cron route (app/api/cron/poll/route.ts). Uses Neon's HTTP driver so
// it works the same in a long-lived process and a short-lived serverless
// function.
export async function runPoll(): Promise<PollResult> {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, {
    schema: { bills, legislators, billSponsors, votes, voteDetail },
  });

  // 1. Find the NC 2025-2026 session.
  const sessions = await getSessionList("NC");
  const session = sessions.find(
    (s) => s.year_start === 2025 && s.year_end === 2026
  );
  if (!session) {
    throw new Error("No 2025-2026 NC session found");
  }

  // 2. One call returns every bill_id + change_hash for the session.
  const masterlist = await getMasterListRaw(session.session_id);
  const billList = Object.entries(masterlist)
    .filter(([key]) => key !== "session")
    .map(([, value]) => value as MasterListRawBill);

  // Load every stored change_hash in a single query, then compare in memory.
  // This avoids one DB round-trip per bill, which matters in the serverless
  // cron route where ~2,300 sequential HTTP queries would exceed the time limit.
  const stored = await db
    .select({ billId: bills.billId, changeHash: bills.changeHash })
    .from(bills);
  const storedHashes = new Map(stored.map((r) => [r.billId, r.changeHash]));

  // A roll call only carries people_id + vote_text per voter, so we resolve
  // each voter's name/party from the legislators we already track. Loaded once
  // up front; voters we don't have a record for store null name/party (same as
  // the backfill), which is harmless for display.
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

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // 3. Only fetch full bill detail for bills that are new or changed.
  for (const entry of billList) {
    if (storedHashes.get(entry.bill_id) === entry.change_hash) {
      skipped++;
      continue;
    }

    try {
      const bill = await getBill(entry.bill_id);
      // 5. Be polite to the LegiScan API between detail calls.
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

      // 4. Upsert the bill, then refresh its sponsors so reruns stay idempotent.
      await db
        .insert(bills)
        .values({ billId: bill.bill_id, ...billRow })
        .onConflictDoUpdate({ target: bills.billId, set: billRow });

      await db.delete(billSponsors).where(eq(billSponsors.billId, bill.bill_id));

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

      // 6. Refresh this bill's roll calls so votes stay current going forward —
      //    this is what makes new/changed votes (e.g. a veto override) appear on
      //    the daily cron without a manual backfill. Only changed bills reach
      //    here, so the extra LegiScan calls stay well within the time budget.
      const summaries = bill.votes ?? [];

      // Replace the bill's existing roll calls wholesale so removed ones drop
      // out. vote_detail FK-references votes, so clear the details first.
      const existing = await db
        .select({ rollCallId: votes.rollCallId })
        .from(votes)
        .where(eq(votes.billId, bill.bill_id));
      if (existing.length > 0) {
        await db.delete(voteDetail).where(
          inArray(
            voteDetail.rollCallId,
            existing.map((r) => r.rollCallId)
          )
        );
        await db.delete(votes).where(eq(votes.billId, bill.bill_id));
      }

      for (const summary of summaries) {
        const rc = await getRollCall(summary.roll_call_id);
        await sleep(200);

        await db.insert(votes).values({
          rollCallId: rc.roll_call_id,
          billId: bill.bill_id,
          date: rc.date ?? summary.date ?? null,
          description: rc.desc ?? summary.desc ?? null,
          chamber: rc.chamber ?? summary.chamber ?? null,
          yea: rc.yea ?? summary.yea ?? null,
          nay: rc.nay ?? summary.nay ?? null,
          nv: rc.nv ?? summary.nv ?? null,
          absent: rc.absent ?? summary.absent ?? null,
          passed: (rc.passed ?? summary.passed) === 1,
        });

        for (const v of rc.votes ?? []) {
          const leg = legMap.get(v.people_id);
          await db.insert(voteDetail).values({
            rollCallId: rc.roll_call_id,
            peopleId: leg ? v.people_id : null,
            name: leg?.name ?? null,
            party: leg?.party ?? null,
            vote: v.vote_text,
          });
        }
      }

      updated++;
    } catch (err) {
      // One failed bill must not stop the whole poll.
      failed++;
      console.error(
        `Bill ${entry.bill_id} (${entry.number}) failed: ${(err as Error).message}`
      );
    }
  }

  return { updated, skipped, failed };
}

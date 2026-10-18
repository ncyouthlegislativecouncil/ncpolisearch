// Daily data update (run by .github/workflows/update-data.yml). Replaces the
// old Vercel cron + database:
//   1. Ask LegiScan which bills changed (one masterlist call, compared against
//      each data file's changeHash).
//   2. For each new/changed bill, fetch its details and roll calls and rewrite
//      data/bills/<billId>.json — keeping its existing AI analysis.
//   3. Write AI analysis for up to SUMMARIZE_LIMIT bills that still lack it.
//   4. Update data/legislators.json with any new or changed sponsors.
// The workflow then commits data/ and pushes, which redeploys the site.
//
// Local usage:
//   npx tsx scripts/update-data.ts                 full run
//   npx tsx scripts/update-data.ts --no-summarize  skip the Claude step
//   npx tsx scripts/update-data.ts --max-bills 3   cap changed bills (testing)
//   npx tsx scripts/update-data.ts --summarize-limit 1
//   npx tsx scripts/update-data.ts --refresh 2021662,1965031   force-refresh bills
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); // no-op in CI, where env vars are set directly

import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { getBill, getMasterListRaw, getRollCall, getSessionList, type MasterListRawBill } from "../lib/legiscan";
import { analyzeBill, fetchBillTextFromLegiScan } from "../lib/summarize";
import { formatDataFile } from "../lib/data/format";
import type { BillFile, Legislator, MemberVote, RollCall, Sponsor } from "../lib/data/types";

const BILLS_DIR = join("data", "bills");
const LEGISLATORS_FILE = join("data", "legislators.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function flag(name: string): boolean {
  return process.argv.includes(name);
}
function numberArg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const SUMMARIZE = !flag("--no-summarize");
const SUMMARIZE_LIMIT = numberArg("--summarize-limit", 10);
const MAX_BILLS = numberArg("--max-bills", Infinity);
const REFRESH = new Set(
  (process.argv[process.argv.indexOf("--refresh") + 1] ?? "")
    .split(",")
    .filter((x) => process.argv.includes("--refresh") && x)
    .map(Number)
);

function readBill(billId: number): BillFile | null {
  const file = join(BILLS_DIR, `${billId}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as BillFile) : null;
}

function writeBill(bill: BillFile) {
  writeFileSync(join(BILLS_DIR, `${bill.billId}.json`), formatDataFile(bill));
}

async function main() {
  const startedAt = new Date().toISOString();
  const legislators: Legislator[] = JSON.parse(readFileSync(LEGISLATORS_FILE, "utf8"));
  const legMap = new Map(legislators.map((l) => [l.peopleId, l]));
  let legislatorsChanged = false;

  const storedHashes = new Map<number, string | null>();
  for (const f of readdirSync(BILLS_DIR)) {
    const b = JSON.parse(readFileSync(join(BILLS_DIR, f), "utf8")) as BillFile;
    storedHashes.set(b.billId, b.changeHash);
  }

  // 1. Which bills changed?
  const sessions = await getSessionList("NC");
  const session = sessions.find((s) => s.year_start === 2025 && s.year_end === 2026);
  if (!session) throw new Error("No 2025-2026 NC session found");
  const masterlist = await getMasterListRaw(session.session_id);
  const entries = Object.entries(masterlist)
    .filter(([key]) => key !== "session")
    .map(([, value]) => value as MasterListRawBill);
  const changed = entries
    .filter((e) => REFRESH.has(e.bill_id) || storedHashes.get(e.bill_id) !== e.change_hash)
    .slice(0, MAX_BILLS);
  console.log(`${entries.length} bills in session; ${changed.length} new or changed`);

  // 2. Refresh each changed bill.
  let updated = 0;
  let added = 0;
  let failed = 0;
  for (const entry of changed) {
    try {
      const detail = await getBill(entry.bill_id);
      await sleep(200);
      const existing = readBill(entry.bill_id);
      const lastAction = detail.history?.length ? detail.history[detail.history.length - 1] : null;

      // Sponsors in LegiScan's official order. Committee sponsors ("Rules",
      // "Appropriations") aren't people, so they're skipped.
      const sponsors: Sponsor[] = [];
      for (const sp of [...(detail.sponsors ?? [])].sort((a, b) => a.sponsor_order - b.sponsor_order)) {
        if (sp.committee_sponsor || sp.committee_id) continue;
        if (sponsors.some((s) => s.peopleId === sp.people_id)) continue;
        sponsors.push({ peopleId: sp.people_id, name: sp.name, party: sp.party, isPrimary: sp.sponsor_type_id === 1 });

        const prev = legMap.get(sp.people_id);
        const fields = { name: sp.name, party: sp.party, role: sp.role, district: sp.district };
        if (!prev) {
          const leg: Legislator = {
            peopleId: sp.people_id,
            ...fields,
            imageUrl: null,
            runningForReelection: null,
            createdAt: new Date().toISOString(),
          };
          legislators.push(leg);
          legMap.set(sp.people_id, leg);
          legislatorsChanged = true;
        } else if (
          prev.name !== fields.name ||
          prev.party !== fields.party ||
          prev.role !== fields.role ||
          prev.district !== fields.district
        ) {
          Object.assign(prev, fields);
          legislatorsChanged = true;
        }
      }

      // Roll calls are replaced wholesale so removed ones drop out. Each
      // voter's name/party comes from the legislators on file; voters we
      // don't track are kept with a null id/name/party.
      const rollCalls: RollCall[] = [];
      for (const summary of detail.votes ?? []) {
        const rc = await getRollCall(summary.roll_call_id);
        await sleep(200);
        const votes: MemberVote[] = (rc.votes ?? []).map((v) => {
          const leg = legMap.get(v.people_id);
          return { peopleId: leg ? v.people_id : null, name: leg?.name ?? null, party: leg?.party ?? null, vote: v.vote_text };
        });
        rollCalls.push({
          rollCallId: rc.roll_call_id,
          date: rc.date ?? summary.date ?? null,
          description: rc.desc ?? summary.desc ?? null,
          chamber: rc.chamber ?? summary.chamber ?? null,
          yea: rc.yea ?? summary.yea ?? null,
          nay: rc.nay ?? summary.nay ?? null,
          nv: rc.nv ?? summary.nv ?? null,
          absent: rc.absent ?? summary.absent ?? null,
          passed: (rc.passed ?? summary.passed) === 1,
          votes,
        });
      }
      rollCalls.sort((a, b) => a.rollCallId - b.rollCallId);

      writeBill({
        billId: detail.bill_id,
        billNumber: detail.bill_number ?? entry.number,
        title: detail.title ?? entry.title,
        status: String(detail.status ?? entry.status),
        chamber: detail.body ?? detail.current_body ?? null,
        changeHash: detail.change_hash ?? entry.change_hash,
        lastAction: lastAction?.action ?? entry.last_action,
        lastActionDate: lastAction?.date ?? entry.last_action_date,
        url: detail.url ?? entry.url,
        aiSummary: existing?.aiSummary ?? null,
        aiProArguments: existing?.aiProArguments ?? null,
        aiConArguments: existing?.aiConArguments ?? null,
        topic: existing?.topic ?? null,
        textLength: existing?.textLength ?? 0,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        sponsors,
        rollCalls,
      });
      if (existing) updated++;
      else added++;
    } catch (err) {
      failed++;
      console.error(`  ! ${entry.number} (${entry.bill_id}): ${(err as Error).message}`);
    }
  }

  // 3. AI analysis for the newest bills that still lack it.
  let analyzed = 0;
  let noText = 0;
  let analyzeFailed = 0;
  if (SUMMARIZE && SUMMARIZE_LIMIT > 0) {
    const anthropic = new Anthropic();
    const pending = readdirSync(BILLS_DIR)
      .map((f) => Number(f.replace(/\.json$/, "")))
      .sort((a, b) => b - a)
      .map((id) => readBill(id)!)
      .filter((b) => b.aiSummary == null)
      .slice(0, SUMMARIZE_LIMIT);
    for (const bill of pending) {
      const text = await fetchBillTextFromLegiScan(bill.billId);
      if (!text) {
        noText++;
        continue;
      }
      try {
        const analysis = await analyzeBill(anthropic, bill.title ?? "Untitled", text);
        if (!analysis) {
          analyzeFailed++;
          continue;
        }
        writeBill({
          ...bill,
          aiSummary: analysis.summary,
          aiProArguments: analysis.pro_arguments,
          aiConArguments: analysis.con_arguments,
          topic: analysis.topic,
          // Characters, matching how the old database measured bill_text.
          textLength: Array.from(text).length,
        });
        analyzed++;
      } catch (err) {
        analyzeFailed++;
        console.error(`  ! analyze ${bill.billNumber}: ${(err as Error).message}`);
      }
      await sleep(300);
    }
  }

  // 4. Legislators.
  if (legislatorsChanged) {
    legislators.sort((a, b) => a.peopleId - b.peopleId);
    writeFileSync(LEGISLATORS_FILE, formatDataFile(legislators));
  }

  const summary =
    `Data update ${startedAt}: ${added} new bills, ${updated} updated, ${failed} failed; ` +
    `${analyzed} analyzed, ${noText} without text yet, ${analyzeFailed} analysis failures; ` +
    `legislators ${legislatorsChanged ? "updated" : "unchanged"}.`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");

  // Fail the run (so GitHub flags it) only if every changed bill failed —
  // usually a LegiScan outage or an expired key. Partial failures retry
  // tomorrow automatically since their changeHash wasn't updated.
  if (changed.length > 0 && failed === changed.length) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

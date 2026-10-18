// One-time conversion of the raw Neon backup (backup/neon-<date>/) into the
// committed data files: data/legislators.json and data/bills/<billId>.json.
// Reads only the local backup — no database access.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { formatDataFile } from "../../lib/data/format";
import type { BillFile, Legislator, MemberVote, RollCall, Sponsor } from "../../lib/data/types";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const backupDir = join("backup", readdirSync("backup").filter((d) => d.startsWith("neon-")).sort().pop()!);
const load = (t: string): Row[] => JSON.parse(readFileSync(join(backupDir, `${t}.json`), "utf8"));

function main() {
  const billsRaw = load("bills").sort((a, b) => a.bill_id - b.bill_id);
  const legsRaw = load("legislators").sort((a, b) => a.people_id - b.people_id);
  const sponsorsRaw = load("bill_sponsors").sort((a, b) => a.id - b.id);
  const votesRaw = load("votes").sort((a, b) => a.roll_call_id - b.roll_call_id);
  const detailRaw = load("vote_detail").sort((a, b) => a.id - b.id);

  const sponsorsByBill = new Map<number, Sponsor[]>();
  for (const s of sponsorsRaw) {
    const list = sponsorsByBill.get(s.bill_id) ?? [];
    list.push({ peopleId: s.people_id, name: s.name, party: s.party, isPrimary: s.is_primary });
    sponsorsByBill.set(s.bill_id, list);
  }

  const membersByRollCall = new Map<number, MemberVote[]>();
  for (const d of detailRaw) {
    const list = membersByRollCall.get(d.roll_call_id) ?? [];
    list.push({ peopleId: d.people_id, name: d.name, party: d.party, vote: d.vote });
    membersByRollCall.set(d.roll_call_id, list);
  }

  const rollCallsByBill = new Map<number, RollCall[]>();
  for (const v of votesRaw) {
    const list = rollCallsByBill.get(v.bill_id) ?? [];
    list.push({
      rollCallId: v.roll_call_id,
      date: v.date,
      description: v.vote_desc,
      chamber: v.chamber,
      yea: v.yea,
      nay: v.nay,
      nv: v.nv,
      absent: v.absent,
      passed: v.passed,
      votes: membersByRollCall.get(v.roll_call_id) ?? [],
    });
    rollCallsByBill.set(v.bill_id, list);
  }

  rmSync("data", { recursive: true, force: true });
  mkdirSync(join("data", "bills"), { recursive: true });

  const legislators: Legislator[] = legsRaw.map((l) => ({
    peopleId: l.people_id,
    name: l.name,
    party: l.party,
    role: l.role,
    district: l.district,
    imageUrl: l.image_url,
    runningForReelection: l.running_for_reelection,
    createdAt: l.created_at,
  }));
  writeFileSync(join("data", "legislators.json"), formatDataFile(legislators));

  let sponsorCount = 0;
  let rollCallCount = 0;
  let memberVoteCount = 0;
  for (const b of billsRaw) {
    const bill: BillFile = {
      billId: b.bill_id,
      billNumber: b.bill_number,
      title: b.title,
      status: b.status,
      chamber: b.chamber,
      changeHash: b.change_hash,
      lastAction: b.last_action,
      lastActionDate: b.last_action_date,
      url: b.url,
      aiSummary: b.ai_summary,
      aiProArguments: b.ai_pro_arguments,
      aiConArguments: b.ai_con_arguments,
      topic: b.topic,
      // Postgres length() counts characters (code points), so match that.
      textLength: Array.from((b.bill_text as string | null) ?? "").length,
      createdAt: b.created_at,
      sponsors: sponsorsByBill.get(b.bill_id) ?? [],
      rollCalls: rollCallsByBill.get(b.bill_id) ?? [],
    };
    sponsorCount += bill.sponsors.length;
    rollCallCount += bill.rollCalls.length;
    memberVoteCount += bill.rollCalls.reduce((n, rc) => n + rc.votes.length, 0);
    writeFileSync(join("data", "bills", `${b.bill_id}.json`), formatDataFile(bill));
  }

  const expected = JSON.parse(readFileSync(join(backupDir, "_counts.json"), "utf8"));
  const actual = {
    bills: billsRaw.length,
    legislators: legislators.length,
    bill_sponsors: sponsorCount,
    votes: rollCallCount,
    vote_detail: memberVoteCount,
  };
  console.log("expected:", expected);
  console.log("written: ", actual);
  const ok = Object.keys(expected).every((k) => expected[k] === actual[k as keyof typeof actual]);
  if (!ok) {
    console.error("COUNT MISMATCH");
    process.exit(1);
  }
  console.log("All counts match.");
}

main();

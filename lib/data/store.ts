import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { BillFile, Legislator, RollCall } from "./types";

// Read-only access to the site's data. Request-time code reads the prebuilt
// lookup files in .data-index/ (see scripts/build-data-index.ts), loaded once
// per server instance and kept in memory. Only the build reads full per-bill
// files from data/bills/ (for the statically generated bill pages).

export type BillSummary = Omit<BillFile, "rollCalls">;
export type RollCallMeta = Omit<RollCall, "votes"> & { billId: number };
export type LegislatorStats = {
  summary: {
    total: number;
    yea: number;
    nay: number;
    notVoting: number;
    absent: number;
    participation: number;
  };
  partyUnity: number | null;
};

const INDEX_DIR = join(process.cwd(), ".data-index");
const DATA_DIR = join(process.cwd(), "data");

function readIndex<T>(name: string): T {
  return JSON.parse(readFileSync(join(INDEX_DIR, name), "utf8")) as T;
}

let billsCache: BillSummary[] | null = null;
let billMap: Map<number, BillSummary> | null = null;
let legislatorsCache: Legislator[] | null = null;
let legislatorMap: Map<number, Legislator> | null = null;
let rollCallsCache: RollCallMeta[] | null = null;
let rollCallMap: Map<number, RollCallMeta> | null = null;
let rollCallsByBill: Map<number, RollCallMeta[]> | null = null;
let statsCache: Record<string, LegislatorStats> | null = null;
const legislatorVotesCache = new Map<number, [number, string | null][]>();

export function allBills(): BillSummary[] {
  return (billsCache ??= readIndex<BillSummary[]>("bills.json"));
}

export function billById(billId: number): BillSummary | undefined {
  billMap ??= new Map(allBills().map((b) => [b.billId, b]));
  return billMap.get(billId);
}

export function allLegislators(): Legislator[] {
  return (legislatorsCache ??= readIndex<Legislator[]>("legislators.json"));
}

export function legislatorById(peopleId: number): Legislator | undefined {
  legislatorMap ??= new Map(allLegislators().map((l) => [l.peopleId, l]));
  return legislatorMap.get(peopleId);
}

export function allRollCalls(): RollCallMeta[] {
  return (rollCallsCache ??= readIndex<RollCallMeta[]>("rollcalls.json"));
}

export function rollCallById(rollCallId: number): RollCallMeta | undefined {
  rollCallMap ??= new Map(allRollCalls().map((rc) => [rc.rollCallId, rc]));
  return rollCallMap.get(rollCallId);
}

export function rollCallsForBill(billId: number): RollCallMeta[] {
  if (!rollCallsByBill) {
    rollCallsByBill = new Map();
    for (const rc of allRollCalls()) {
      const list = rollCallsByBill.get(rc.billId) ?? [];
      list.push(rc);
      rollCallsByBill.set(rc.billId, list);
    }
  }
  return rollCallsByBill.get(billId) ?? [];
}

export function legislatorStats(peopleId: number): LegislatorStats | undefined {
  statsCache ??= readIndex<Record<string, LegislatorStats>>("legislator-stats.json");
  return statsCache[String(peopleId)];
}

// [rollCallId, vote] for every roll call this legislator voted on.
export function legislatorVotes(peopleId: number): [number, string | null][] {
  const cached = legislatorVotesCache.get(peopleId);
  if (cached) return cached;
  const file = join(INDEX_DIR, "legislator-votes", `${peopleId}.json`);
  const rows = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as [number, string | null][])
    : [];
  legislatorVotesCache.set(peopleId, rows);
  return rows;
}

// Full bill including every member's vote on every roll call. Only used while
// building the static bill pages.
export function readBillFile(billId: number): BillFile | null {
  const file = join(DATA_DIR, "bills", `${billId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as BillFile;
}

// ---------------------------------------------------------------------------
// Ordering helpers that mirror the old Postgres ORDER BY clauses. The database
// used the "C" collation, which compares strings by character code.
// ---------------------------------------------------------------------------

export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ORDER BY x DESC NULLS LAST
export function descNullsLast(a: string | null, b: string | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return compareText(b, a);
}

// ORDER BY x ASC NULLS LAST (Postgres' default for ASC)
export function ascNullsLast(a: string | null, b: string | null): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return compareText(a, b);
}

// Case-insensitive substring match, like SQL ILIKE '%term%'.
export function containsInsensitive(haystack: string | null, needle: string): boolean {
  return haystack != null && haystack.toLowerCase().includes(needle.toLowerCase());
}

import { eq, inArray, sql } from "drizzle-orm";
import { db, execRows } from "../db";
import { bills, votes, voteDetail } from "../db/schema";
import { chamberLabel } from "./status";

// ---------------------------------------------------------------------------
// Legislator voting record
// ---------------------------------------------------------------------------

export type LegislatorVoteRow = {
  rollCallId: number;
  billId: number | null;
  billNumber: string | null;
  billTitle: string | null;
  date: string | null;
  chamber: string | null;
  passed: boolean | null;
  vote: string | null;
};

export type LegislatorVoteSummary = {
  total: number;
  yea: number;
  nay: number;
  notVoting: number;
  absent: number;
  // (yea + nay) / total, as a 0..1 fraction.
  participation: number;
};

// Aggregate counts for the summary strip at the top of the voting record.
export async function getLegislatorVoteSummary(
  peopleId: number
): Promise<LegislatorVoteSummary> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      yea: sql<number>`(count(*) filter (where ${voteDetail.vote} = 'Yea'))::int`,
      nay: sql<number>`(count(*) filter (where ${voteDetail.vote} = 'Nay'))::int`,
      notVoting: sql<number>`(count(*) filter (where ${voteDetail.vote} = 'NV'))::int`,
      absent: sql<number>`(count(*) filter (where ${voteDetail.vote} = 'Absent'))::int`,
    })
    .from(voteDetail)
    .where(eq(voteDetail.peopleId, peopleId));

  const r = rows[0];
  const total = r?.total ?? 0;
  const yea = r?.yea ?? 0;
  const nay = r?.nay ?? 0;
  return {
    total,
    yea,
    nay,
    notVoting: r?.notVoting ?? 0,
    absent: r?.absent ?? 0,
    participation: total > 0 ? (yea + nay) / total : 0,
  };
}

// A page of this legislator's votes, most recent first.
export async function getLegislatorVotes(
  peopleId: number,
  page = 1,
  pageSize = 20
): Promise<{
  rows: LegislatorVoteRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        rollCallId: votes.rollCallId,
        billId: votes.billId,
        billNumber: bills.billNumber,
        billTitle: bills.title,
        date: votes.date,
        chamber: votes.chamber,
        passed: votes.passed,
        vote: voteDetail.vote,
      })
      .from(voteDetail)
      .innerJoin(votes, eq(voteDetail.rollCallId, votes.rollCallId))
      .leftJoin(bills, eq(votes.billId, bills.billId))
      .where(eq(voteDetail.peopleId, peopleId))
      .orderBy(sql`${votes.date} DESC NULLS LAST`)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(voteDetail)
      .where(eq(voteDetail.peopleId, peopleId)),
  ]);

  return { rows, total: countRows[0]?.n ?? 0, page, pageSize };
}

// Party unity: the share of this legislator's decisive (Yea/Nay) votes that
// side with the majority of their own party on each roll call. Returns a 0..1
// fraction, or null when there are no decisive party-line votes on record.
export async function getPartyUnity(peopleId: number): Promise<number | null> {
  const rows = await execRows<{ party_line: number; total_cast: number }>(sql`
    WITH party_majority AS (
      SELECT roll_call_id, party,
        CASE
          WHEN count(*) FILTER (WHERE vote = 'Yea') >= count(*) FILTER (WHERE vote = 'Nay')
          THEN 'Yea' ELSE 'Nay'
        END AS majority
      FROM vote_detail
      WHERE party IN ('R', 'D') AND vote IN ('Yea', 'Nay')
      GROUP BY roll_call_id, party
    )
    SELECT
      (count(*) FILTER (WHERE vd.vote = pm.majority))::int AS party_line,
      count(*)::int AS total_cast
    FROM vote_detail vd
    JOIN party_majority pm
      ON pm.roll_call_id = vd.roll_call_id AND pm.party = vd.party
    WHERE vd.people_id = ${peopleId}
      AND vd.vote IN ('Yea', 'Nay')
      AND vd.party IN ('R', 'D')
  `);

  const r = rows[0];
  if (!r || r.total_cast === 0) return null;
  return r.party_line / r.total_cast;
}

// Compact yea/nay summary for the compare page. Uses the most recent roll
// call as the representative vote, since that's the bill's latest standing.
export type BillVoteSummary = {
  yea: number;
  nay: number;
  passed: boolean | null;
  date: string | null;
  rollCalls: number;
};

export async function getBillVoteSummary(
  billId: number
): Promise<BillVoteSummary | null> {
  const rows = await db
    .select({
      yea: votes.yea,
      nay: votes.nay,
      passed: votes.passed,
      date: votes.date,
    })
    .from(votes)
    .where(eq(votes.billId, billId))
    .orderBy(sql`${votes.date} DESC NULLS LAST`);

  if (rows.length === 0) return null;
  const latest = rows[0];
  return {
    yea: latest.yea ?? 0,
    nay: latest.nay ?? 0,
    passed: latest.passed,
    date: latest.date,
    rollCalls: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Bill vote breakdown
// ---------------------------------------------------------------------------

export type BillVoteMember = {
  peopleId: number | null;
  name: string | null;
  party: string | null;
  vote: string | null;
};

export type PartyTally = { yea: number; nay: number; other: number };

export type BillRollCall = {
  rollCallId: number;
  date: string | null;
  // What the roll call was on, from LegiScan ("Amendment 3", "Second Reading").
  description: string | null;
  chamber: string | null;
  passed: boolean | null;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  republican: PartyTally;
  democrat: PartyTally;
  members: BillVoteMember[];
};

function emptyTally(): PartyTally {
  return { yea: 0, nay: 0, other: 0 };
}

function addToTally(tally: PartyTally, vote: string | null) {
  if (vote === "Yea") tally.yea++;
  else if (vote === "Nay") tally.nay++;
  else tally.other++;
}

// Every roll call for a bill, each with totals, a party breakdown, and the
// individual member votes. Returns [] for bills with no recorded votes.
export async function getBillVotes(billId: number): Promise<BillRollCall[]> {
  const rollCalls = await db
    .select()
    .from(votes)
    .where(eq(votes.billId, billId))
    .orderBy(sql`${votes.date} DESC NULLS LAST`);

  if (rollCalls.length === 0) return [];

  const ids = rollCalls.map((r) => r.rollCallId);
  const details = await db
    .select({
      rollCallId: voteDetail.rollCallId,
      peopleId: voteDetail.peopleId,
      name: voteDetail.name,
      party: voteDetail.party,
      vote: voteDetail.vote,
    })
    .from(voteDetail)
    .where(inArray(voteDetail.rollCallId, ids));

  // Group member rows by roll call.
  const byRollCall = new Map<number, BillVoteMember[]>();
  for (const d of details) {
    if (d.rollCallId == null) continue;
    const list = byRollCall.get(d.rollCallId) ?? [];
    list.push({
      peopleId: d.peopleId,
      name: d.name,
      party: d.party,
      vote: d.vote,
    });
    byRollCall.set(d.rollCallId, list);
  }

  // Last name = final whitespace-delimited token of a "First Last" name.
  const lastName = (name: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/);
    return parts[parts.length - 1] ?? "";
  };

  // Order each roll call's members: Yea, then Nay, then others; then by last
  // name within each group (full name breaks ties).
  const voteOrder: Record<string, number> = { Yea: 0, Nay: 1, NV: 2, Absent: 3 };
  return rollCalls.map((rc) => {
    const members = (byRollCall.get(rc.rollCallId) ?? []).sort((a, b) => {
      const ao = voteOrder[a.vote ?? ""] ?? 9;
      const bo = voteOrder[b.vote ?? ""] ?? 9;
      if (ao !== bo) return ao - bo;
      const byLast = lastName(a.name).localeCompare(lastName(b.name));
      return byLast !== 0 ? byLast : (a.name ?? "").localeCompare(b.name ?? "");
    });

    const republican = emptyTally();
    const democrat = emptyTally();
    for (const m of members) {
      if (m.party === "R") addToTally(republican, m.vote);
      else if (m.party === "D") addToTally(democrat, m.vote);
    }

    return {
      rollCallId: rc.rollCallId,
      date: rc.date,
      description: rc.description,
      chamber: rc.chamber,
      passed: rc.passed,
      yea: rc.yea ?? 0,
      nay: rc.nay ?? 0,
      nv: rc.nv ?? 0,
      absent: rc.absent ?? 0,
      republican,
      democrat,
      members,
    };
  });
}

// ---------------------------------------------------------------------------
// Roll-call labeling + outcome banner
// ---------------------------------------------------------------------------

// The chamber a bill originated in, read from its number prefix ("H198" -> "H",
// "S445" -> "S"). More reliable than bills.chamber, which tracks the *current*
// body and changes as a bill crosses over.
export function originChamber(billNumber: string | null): "H" | "S" | null {
  if (!billNumber) return null;
  const c = billNumber.trim()[0]?.toUpperCase();
  return c === "H" ? "H" : c === "S" ? "S" : null;
}

export type LabeledRollCall = BillRollCall & {
  // A context-aware name for this roll call (e.g. "House Initial Passage").
  label: string;
  // A short, plain-English note on what the roll call was on, derived from the
  // LegiScan description ("Amendment 3", "Second Reading"). null when the raw
  // description is empty or already fully captured by the label.
  detail: string | null;
  // yea + nay + nv + absent — how many members the roll call drew, used to pick
  // the single most significant ("Final") vote.
  participants: number;
  isFinal: boolean;
};

export type VoteOutcomeBanner = {
  tone: "vetoed" | "enacted" | "passed";
  text: string;
  note?: string;
};

export type VoteBreakdown = {
  final: LabeledRollCall | null;
  others: LabeledRollCall[]; // most recent first, excludes `final`
  all: LabeledRollCall[]; // most recent first, includes `final`
  banner: VoteOutcomeBanner | null;
  overrideDetected: boolean;
};

function participantCount(rc: BillRollCall): number {
  return rc.yea + rc.nay + rc.nv + rc.absent;
}

// The display subtitle for a roll call: LegiScan's raw description ("Amendment
// 3", "Second Reading", "M11 Concur"), trimmed. Suppressed (null) when it's
// empty or already captured by the derived label, to avoid redundant lines like
// "Veto Override Attempt" / "Veto Override".
function rollCallDetail(description: string | null, label: string): string | null {
  const d = (description ?? "").trim();
  if (!d) return null;
  const dl = d.toLowerCase();
  const ll = label.toLowerCase();
  if (ll.includes(dl) || dl.includes(ll)) return null;
  return d;
}

// Turn a bill's raw roll calls into labeled, display-ready data: a single most
// significant "Final Vote", the remaining roll calls, and a plain-English
// outcome banner driven by the bill's status.
//
// `rollCalls` is expected most-recent-first (as getBillVotes returns it).
// Labeling needs chronological order, so we sort a copy ascending internally.
export function buildVoteBreakdown(
  rollCalls: BillRollCall[],
  opts: { billNumber: string | null; status: string | null }
): VoteBreakdown {
  if (rollCalls.length === 0) {
    return { final: null, others: [], all: [], banner: null, overrideDetected: false };
  }

  const origin = originChamber(opts.billNumber);
  const vetoed = opts.status === "5";

  const asc = [...rollCalls].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const labelById = new Map<number, string>();
  let overrideDetected = false;
  let seenHouse = false;
  let seenSenate = false;

  for (const rc of asc) {
    const ch = rc.chamber; // "H" | "S" | null
    const desc = rc.description ?? "";
    const otherSeenBefore = ch === "H" ? seenSenate : ch === "S" ? seenHouse : false;
    const firstInChamber = ch === "H" ? !seenHouse : ch === "S" ? !seenSenate : true;
    const unanimous = rc.nay === 0 && rc.yea > 0;

    // Prefer LegiScan's own description for the high-signal moments — it states
    // a veto override or concurrence outright, which is far more reliable than
    // inferring from chamber order and dates.
    let label: string;
    if (/veto\s*override/i.test(desc)) {
      label = "Veto Override Attempt";
      overrideDetected = true;
    } else if (/concur/i.test(desc)) {
      label = ch ? `${chamberLabel(ch)} Concurrence Vote` : "Concurrence Vote";
    } else if (ch && ch === origin && otherSeenBefore) {
      // Came back to its origin chamber after the other chamber acted.
      label = `${chamberLabel(ch)} Concurrence Vote`;
    } else if (!firstInChamber && unanimous) {
      // A later, lopsided unanimous vote in a chamber that already voted.
      label = "Procedural Vote";
    } else if (firstInChamber && ch === origin) {
      // First recorded vote in the chamber the bill started in.
      label = `${chamberLabel(ch)} Initial Passage`;
    } else if (firstInChamber && ch) {
      // First vote in the chamber the bill crossed over into.
      label = `${chamberLabel(ch)} Vote`;
    } else {
      label = chamberLabel(ch) ? `${chamberLabel(ch)} Vote` : "Roll Call";
    }

    labelById.set(rc.rollCallId, label);
    if (ch === "H") seenHouse = true;
    if (ch === "S") seenSenate = true;
  }

  // Most significant = most participants; ties broken toward the more recent.
  let final: BillRollCall | null = null;
  let finalCount = -1;
  for (const rc of asc) {
    const n = participantCount(rc);
    if (n >= finalCount) {
      finalCount = n;
      final = rc;
    }
  }

  // Preserve the input (most-recent-first) order for display.
  const all: LabeledRollCall[] = rollCalls.map((rc) => {
    const label = labelById.get(rc.rollCallId) ?? "Roll Call";
    return {
      ...rc,
      label,
      detail: rollCallDetail(rc.description, label),
      participants: participantCount(rc),
      isFinal: final != null && rc.rollCallId === final.rollCallId,
    };
  });

  const finalLabeled = all.find((rc) => rc.isFinal) ?? null;
  const others = all.filter((rc) => !rc.isFinal);

  let banner: VoteOutcomeBanner | null = null;
  if (vetoed) {
    banner = {
      tone: "vetoed",
      text: "This bill passed both chambers but was vetoed by the Governor.",
      note: overrideDetected ? "A veto override vote has been attempted." : undefined,
    };
  } else if (opts.status === "4") {
    banner = { tone: "enacted", text: "This bill was signed into law." };
  } else if (opts.status === "3") {
    banner = {
      tone: "passed",
      text: "This bill passed and is awaiting the Governor's signature.",
    };
  }

  return { final: finalLabeled, others, all, banner, overrideDetected };
}

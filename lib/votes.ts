import {
  billById,
  descNullsLast,
  legislatorStats,
  legislatorVotes,
  readBillFile,
  rollCallById,
  rollCallsForBill,
  type RollCallMeta,
} from "./data/store";
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
// Precomputed when the data index is built.
export async function getLegislatorVoteSummary(peopleId: number): Promise<LegislatorVoteSummary> {
  return (
    legislatorStats(peopleId)?.summary ?? {
      total: 0,
      yea: 0,
      nay: 0,
      notVoting: 0,
      absent: 0,
      participation: 0,
    }
  );
}

// Every roll call this legislator voted on, most recent first.
function votesNewestFirst(peopleId: number): { rc: RollCallMeta; vote: string | null }[] {
  const rows: { rc: RollCallMeta; vote: string | null }[] = [];
  for (const [rollCallId, vote] of legislatorVotes(peopleId)) {
    const rc = rollCallById(rollCallId);
    if (rc) rows.push({ rc, vote });
  }
  return rows.sort((a, b) => descNullsLast(a.rc.date, b.rc.date) || b.rc.rollCallId - a.rc.rollCallId);
}

// A page of this legislator's votes, most recent first.
export async function getLegislatorVotes(
  peopleId: number,
  page = 1,
  pageSize = 20
): Promise<{ rows: LegislatorVoteRow[]; total: number; page: number; pageSize: number }> {
  const all = votesNewestFirst(peopleId);
  const rows = all.slice((page - 1) * pageSize, page * pageSize).map(({ rc, vote }) => {
    const bill = billById(rc.billId);
    return {
      rollCallId: rc.rollCallId,
      billId: rc.billId,
      billNumber: bill?.billNumber ?? null,
      billTitle: bill?.title ?? null,
      date: rc.date,
      chamber: rc.chamber,
      passed: rc.passed,
      vote,
    };
  });
  return { rows, total: all.length, page, pageSize };
}

// The last N decisive (Yea/Nay) votes this legislator cast, newest first.
export function getRecentDecisiveVotes(peopleId: number, limit = 2) {
  return votesNewestFirst(peopleId)
    .filter(({ vote }) => vote === "Yea" || vote === "Nay")
    .slice(0, limit)
    .map(({ rc, vote }) => {
      const bill = billById(rc.billId);
      return {
        rollCallId: rc.rollCallId,
        billId: rc.billId as number | null,
        billNumber: bill?.billNumber ?? null,
        title: bill?.title ?? null,
        vote,
        date: rc.date,
      };
    });
}

// Party unity: the share of this legislator's decisive (Yea/Nay) votes that
// side with the majority of their own party on each roll call. Returns a 0..1
// fraction, or null when there are no decisive party-line votes on record.
// Precomputed when the data index is built.
export async function getPartyUnity(peopleId: number): Promise<number | null> {
  return legislatorStats(peopleId)?.partyUnity ?? null;
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

export async function getBillVoteSummary(billId: number): Promise<BillVoteSummary | null> {
  const rows = [...rollCallsForBill(billId)].sort(
    (a, b) => descNullsLast(a.date, b.date) || b.rollCallId - a.rollCallId
  );
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
// individual member votes. Returns [] for bills with no recorded votes. Reads
// the full bill file, so it's only used by the statically built bill pages.
export async function getBillVotes(billId: number): Promise<BillRollCall[]> {
  const bill = readBillFile(billId);
  const rollCalls = [...(bill?.rollCalls ?? [])].sort(
    (a, b) => descNullsLast(a.date, b.date) || b.rollCallId - a.rollCallId
  );
  if (rollCalls.length === 0) return [];

  // Last name = final whitespace-delimited token of a "First Last" name.
  const lastName = (name: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/);
    return parts[parts.length - 1] ?? "";
  };

  // Order each roll call's members: Yea, then Nay, then others; then by last
  // name within each group (full name breaks ties).
  const voteOrder: Record<string, number> = { Yea: 0, Nay: 1, NV: 2, Absent: 3 };
  return rollCalls.map((rc) => {
    const members: BillVoteMember[] = rc.votes
      .map((v) => ({ peopleId: v.peopleId, name: v.name, party: v.party, vote: v.vote }))
      .sort((a, b) => {
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

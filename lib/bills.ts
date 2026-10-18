import {
  allBills,
  ascNullsLast,
  billById,
  compareText,
  containsInsensitive,
  descNullsLast,
  legislatorById,
  type BillSummary,
} from "./data/store";
import { getBillVoteSummary, type BillVoteSummary } from "./votes";
import { currentMemberCount } from "./legislators";

// All bill data comes from the committed data files (see lib/data/store.ts).
// Functions stay async with the same return shapes the database version had, so
// pages didn't need to change.

// Newest activity first; ties broken by newer bill id so results are stable.
function byNewest(a: BillSummary, b: BillSummary): number {
  return descNullsLast(a.lastActionDate, b.lastActionDate) || b.billId - a.billId;
}

// The first primary sponsor's name for each of the given bills.
function primarySponsorNames(billIds: number[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const id of billIds) {
    const s = billById(id)?.sponsors.find((sp) => sp.isPrimary === true && sp.name);
    if (s?.name) map[id] = s.name;
  }
  return map;
}

// Every bill id, for pre-building all /bills/[id] pages as static HTML.
export async function getAllBillIds(): Promise<number[]> {
  return allBills().map((b) => b.billId);
}

// Homepage "What's Moving in Raleigh" feed with a deliberate featured pick.
// The large featured slot should hold the BIGGEST and NEWEST bill: among the
// most recently active bills, the one with the most substantial text (a proxy
// for major legislation over short procedural resolutions) that already has an
// AI summary, so the featured card reads richly. The remaining cards are simply
// the newest bills, minus whichever one we featured (no duplicate).
export async function getHomeFeed(gridSize = 5) {
  // RECENT_WINDOW bounds "newest" so we never feature a stale giant bill that
  // hasn't moved in months.
  const RECENT_WINDOW = 40;
  const window = [...allBills()]
    .sort(byNewest)
    .slice(0, RECENT_WINDOW)
    .map((b) => ({
      billId: b.billId,
      billNumber: b.billNumber,
      title: b.title,
      status: b.status,
      chamber: b.chamber,
      lastAction: b.lastAction,
      lastActionDate: b.lastActionDate,
      aiSummary: b.aiSummary,
      textLen: b.textLength,
    }));

  // Prefer already-analyzed bills for the featured slot; fall back to the whole
  // window if none in it have a summary yet.
  const analyzed = window.filter((b) => b.aiSummary && b.aiSummary.trim() !== "");
  const pool = analyzed.length ? analyzed : window;
  const featured =
    [...pool].sort((a, b) => {
      if (b.textLen !== a.textLen) return b.textLen - a.textLen; // biggest first
      return (b.lastActionDate ?? "").localeCompare(a.lastActionDate ?? ""); // then newest
    })[0] ?? null;

  // Grid: the newest bills, excluding whatever we featured.
  const rest = window
    .filter((b) => !featured || b.billId !== featured.billId)
    .slice(0, gridSize);

  const shown = featured ? [featured, ...rest] : rest;
  const sponsorMap = primarySponsorNames(shown.map((r) => r.billId));
  const withSponsor = <T extends { billId: number }>(b: T) => ({
    ...b,
    sponsor: sponsorMap[b.billId] ?? null,
  });

  return {
    featured: featured ? withSponsor(featured) : null,
    recent: rest.map(withSponsor),
  };
}

// Homepage stats bar. Statuses are stored as LegiScan numeric codes:
// "1" = Introduced, "4" = Passed (i.e. enacted/chaptered into law).
export type HomeStats = {
  totalBills: number;
  introduced: number;
  enacted: number;
  legislators: number;
};

export async function getHomeStats(): Promise<HomeStats> {
  const bills = allBills();
  return {
    totalBills: bills.length,
    introduced: bills.filter((b) => b.status === "1").length,
    enacted: bills.filter((b) => b.status === "4").length,
    // Only the CURRENT member per district (120 House + 50 Senate = 170),
    // matching the /legislators roster — departed members from mid-session
    // turnover are still on file and would otherwise overcount.
    legislators: currentMemberCount(),
  };
}

// Most recently updated bills for the homepage activity ticker.
export async function getTickerBills(limit = 20) {
  return [...allBills()]
    .sort(byNewest)
    .slice(0, limit)
    .map((b) => ({
      billId: b.billId,
      billNumber: b.billNumber,
      title: b.title,
      lastAction: b.lastAction,
      lastActionDate: b.lastActionDate,
    }));
}

export async function getBill(billId: number) {
  const b = billById(billId);
  if (!b) return null;
  const { sponsors: _sponsors, ...bill } = b; // eslint-disable-line @typescript-eslint/no-unused-vars
  return bill;
}

export async function getBillSponsors(billId: number) {
  const rows = (billById(billId)?.sponsors ?? []).map((s) => {
    // Joined from the roster so sponsor cards can show a photo + role/district.
    const leg = s.peopleId != null ? legislatorById(s.peopleId) : undefined;
    return {
      peopleId: s.peopleId,
      name: s.name,
      party: s.party,
      isPrimary: s.isPrimary,
      imageUrl: leg?.imageUrl ?? null,
      role: leg?.role ?? null,
      district: leg?.district ?? null,
    };
  });

  return {
    sponsors: rows.filter((r) => r.isPrimary),
    cosponsors: rows.filter((r) => !r.isPrimary),
  };
}

// Lightweight typeahead search for the compare-page panels. Matches bill
// number or title, newest first.
export type BillSearchResult = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  chamber: string | null;
  status: string | null;
};

export async function searchBillsLite(q: string, limit = 8): Promise<BillSearchResult[]> {
  const term = q.trim();
  if (!term) return [];

  return allBills()
    .filter((b) => containsInsensitive(b.title, term) || containsInsensitive(b.billNumber, term))
    .sort(byNewest)
    .slice(0, limit)
    .map((b) => ({
      billId: b.billId,
      billNumber: b.billNumber,
      title: b.title,
      chamber: b.chamber,
      status: b.status,
    }));
}

// Everything one side of the comparison view needs about a bill.
export type CompareBill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  url: string | null;
  aiSummary: string | null;
  aiProArguments: string | null;
  aiConArguments: string | null;
  primarySponsor: { peopleId: number | null; name: string | null; party: string | null } | null;
  vote: BillVoteSummary | null;
};

export async function getBillForCompare(billId: number): Promise<CompareBill | null> {
  const bill = await getBill(billId);
  if (!bill) return null;

  const [{ sponsors }, vote] = await Promise.all([
    getBillSponsors(billId),
    getBillVoteSummary(billId),
  ]);

  const primary = sponsors.find((s) => s.isPrimary) ?? sponsors[0] ?? null;

  return {
    billId: bill.billId,
    billNumber: bill.billNumber,
    title: bill.title,
    status: bill.status,
    chamber: bill.chamber,
    lastAction: bill.lastAction,
    lastActionDate: bill.lastActionDate,
    url: bill.url,
    aiSummary: bill.aiSummary,
    aiProArguments: bill.aiProArguments,
    aiConArguments: bill.aiConArguments,
    primarySponsor: primary
      ? { peopleId: primary.peopleId, name: primary.name, party: primary.party }
      : null,
    vote,
  };
}

export type BillFilters = {
  search?: string;
  chamber?: string;
  status?: string;
  party?: string; // "Republican" | "Democrat" | "Bipartisan"
  topic?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

// Bipartisan requires REAL cross-party support, not just one token sponsor from
// the minority side: at least this many sponsors from each party (calibrated
// against H1104, 7 Democrat / 16 Republican sponsors, and H1200, 18 Democrat /
// 15 Republican — both comfortably clear this bar).
const MIN_BIPARTISAN_SPONSORS = 5;

export async function getBills(filters: BillFilters) {
  const { search, chamber, status, party, topic, sort = "newest", page = 1, pageSize = 24 } = filters;

  let matches = allBills().filter((b) => {
    if (search && !(containsInsensitive(b.title, search) || containsInsensitive(b.billNumber, search))) return false;
    if ((chamber === "H" || chamber === "S") && b.chamber !== chamber) return false;
    if (status && b.status !== status) return false;
    if (topic && b.topic !== topic) return false;
    // "Republican"/"Democrat" match the bill's primary sponsor's party — the
    // same party BillCard displays as "Introduced by".
    if (party === "Republican" || party === "Democrat") {
      const code = party === "Republican" ? "R" : "D";
      if (!b.sponsors.some((s) => s.isPrimary === true && s.party === code)) return false;
    } else if (party === "Bipartisan") {
      const dems = b.sponsors.filter((s) => s.party === "D").length;
      const reps = b.sponsors.filter((s) => s.party === "R").length;
      if (dems < MIN_BIPARTISAN_SPONSORS || reps < MIN_BIPARTISAN_SPONSORS) return false;
    }
    return true;
  });

  matches = [...matches].sort(
    sort === "oldest"
      ? (a, b) => ascNullsLast(a.lastActionDate, b.lastActionDate) || a.billId - b.billId
      : sort === "title"
        ? (a, b) => compareText(a.title ?? "", b.title ?? "") || a.billId - b.billId
        : byNewest
  );

  const total = matches.length;
  const rows = matches.slice((page - 1) * pageSize, page * pageSize).map((b) => ({
    // Only what the result cards display — the old database version sent every
    // column (including full bill text) to the browser on each page view.
    billId: b.billId,
    billNumber: b.billNumber,
    title: b.title,
    status: b.status,
    chamber: b.chamber,
    lastAction: b.lastAction,
    lastActionDate: b.lastActionDate,
    aiSummary: b.aiSummary,
    topic: b.topic,
  }));
  const sponsorMap = primarySponsorNames(rows.map((r) => r.billId));

  return { bills: rows, total, sponsorMap, page, pageSize };
}

// For the /write page's pickers: every bill, newest first.
export function getBillsForPicker(): { id: number; n: string; t: string }[] {
  return [...allBills()].sort(byNewest).map((b) => ({ id: b.billId, n: b.billNumber ?? "", t: b.title ?? "" }));
}


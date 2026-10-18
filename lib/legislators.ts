import {
  allBills,
  allLegislators,
  compareText,
  containsInsensitive,
  descNullsLast,
  legislatorById,
} from "./data/store";
import type { Legislator } from "./data/types";

export type LegislatorFilters = {
  chamber?: string; // "House" | "Senate"
  party?: string; // "Republican" | "Democrat"
  search?: string; // matches name
};

// ---------------------------------------------------------------------------
// "Current member" resolution. Mid-session turnover leaves more than 170
// legislators on file: a handful of districts hold both a departed member and
// their replacement. The current member is the one with the most recent
// legislative activity (latest last-action date among bills they sponsored),
// then the most sponsorships.
// ---------------------------------------------------------------------------

type Activity = { lastActive: string | null; sponsorships: number };
let activityCache: Map<number, Activity> | null = null;

function activity(peopleId: number): Activity {
  if (!activityCache) {
    activityCache = new Map();
    for (const b of allBills()) {
      for (const s of b.sponsors) {
        if (s.peopleId == null) continue;
        const a = activityCache.get(s.peopleId) ?? { lastActive: null, sponsorships: 0 };
        a.sponsorships++;
        if (b.lastActionDate != null && (a.lastActive == null || b.lastActionDate > a.lastActive)) {
          a.lastActive = b.lastActionDate;
        }
        activityCache.set(s.peopleId, a);
      }
    }
  }
  return activityCache.get(peopleId) ?? { lastActive: null, sponsorships: 0 };
}

// Most recently active first, then most sponsorships, then lowest id (stable).
export function compareByActivity(a: Legislator, b: Legislator, useSponsorships = true): number {
  const aa = activity(a.peopleId);
  const ab = activity(b.peopleId);
  return (
    descNullsLast(aa.lastActive, ab.lastActive) ||
    (useSponsorships ? ab.sponsorships - aa.sponsorships : 0) ||
    a.peopleId - b.peopleId
  );
}

const hasValue = (v: string | null) => v != null && v !== "";

// The current member for every (chamber, district) seat, among legislators
// passing `include`.
export function currentMembers(
  include: (l: Legislator) => boolean,
  useSponsorships = true
): Legislator[] {
  const bySeat = new Map<string, Legislator>();
  for (const l of allLegislators()) {
    if ((l.role !== "Rep" && l.role !== "Sen") || !hasValue(l.district) || !include(l)) continue;
    const seat = `${l.role}|${l.district}`;
    const best = bySeat.get(seat);
    if (!best || compareByActivity(l, best, useSponsorships) < 0) bySeat.set(seat, l);
  }
  return Array.from(bySeat.values());
}

// 120 House + 50 Senate seats, counting only members with a party on file.
export function currentMemberCount(): number {
  return currentMembers((l) => hasValue(l.party)).length;
}

// Last name for sorting: everything after the final whitespace, lowercased.
function lastNameKey(name: string | null): string {
  return (name ?? "").replace(/^[\s\S]*[ \t\n\r\f\v]/, "").toLowerCase();
}

export async function getLegislators(filters: LegislatorFilters = {}) {
  const roster = currentMembers(() => true);
  const search = filters.search?.trim();

  return roster
    .filter((l) => {
      // Committee "sponsors" from LegiScan (e.g. "Appropriations") carry an
      // empty party; real legislators always have one.
      if (!hasValue(l.party)) return false;
      if (filters.chamber === "House" && l.role !== "Rep") return false;
      if (filters.chamber === "Senate" && l.role !== "Sen") return false;
      if (filters.party === "Republican" && l.party !== "R") return false;
      if (filters.party === "Democrat" && l.party !== "D") return false;
      if (search && !containsInsensitive(l.name, search)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        compareText(lastNameKey(a.name), lastNameKey(b.name)) ||
        compareText((a.name ?? "").toLowerCase(), (b.name ?? "").toLowerCase()) ||
        a.peopleId - b.peopleId
    );
}

export type TopSponsor = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  billCount: number;
};

// Count of bills each legislator is the primary sponsor of.
function primarySponsorCounts(): Map<number, number> {
  const counts = new Map<number, number>();
  for (const b of allBills()) {
    for (const s of b.sponsors) {
      if (s.isPrimary !== true || s.peopleId == null) continue;
      counts.set(s.peopleId, (counts.get(s.peopleId) ?? 0) + 1);
    }
  }
  return counts;
}

function rankSponsors(include: (l: Legislator) => boolean, limit: number) {
  const ranked: { leg: Legislator; billCount: number }[] = [];
  for (const [peopleId, billCount] of Array.from(primarySponsorCounts())) {
    const leg = legislatorById(peopleId);
    if (leg && include(leg)) ranked.push({ leg, billCount });
  }
  return ranked
    .sort((a, b) => b.billCount - a.billCount || a.leg.peopleId - b.leg.peopleId)
    .slice(0, limit);
}

// Leaderboard of legislators who have introduced (primary-sponsored) the most
// bills, scoped to one chamber ("Rep" = House, "Sen" = Senate).
export async function getTopSponsors(role: "Rep" | "Sen", limit = 10): Promise<TopSponsor[]> {
  return rankSponsors((l) => l.role === role, limit).map(({ leg, billCount }) => ({
    peopleId: leg.peopleId,
    name: leg.name,
    party: leg.party,
    role: leg.role,
    district: leg.district,
    billCount,
  }));
}

export type TopSponsorWithPhoto = TopSponsor & { imageUrl: string | null };

// Homepage "NC Legislators at a Glance": the most active primary sponsors
// across BOTH chambers, with their profile photo. Excludes committee/empty-party
// pseudo-sponsors the same way the roster page does.
export async function getTopSponsorsOverall(limit = 3): Promise<TopSponsorWithPhoto[]> {
  return rankSponsors((l) => hasValue(l.party), limit).map(({ leg, billCount }) => ({
    peopleId: leg.peopleId,
    name: leg.name,
    party: leg.party,
    role: leg.role,
    district: leg.district,
    imageUrl: leg.imageUrl,
    billCount,
  }));
}

export async function getLegislator(peopleId: number) {
  return legislatorById(peopleId) ?? null;
}

export async function getLegislatorBills(peopleId: number) {
  const rows: {
    billId: number;
    billNumber: string | null;
    title: string | null;
    status: string | null;
    chamber: string | null;
    lastAction: string | null;
    lastActionDate: string | null;
    aiSummary: string | null;
    isPrimary: boolean | null;
  }[] = [];
  for (const b of allBills()) {
    for (const s of b.sponsors) {
      if (s.peopleId !== peopleId) continue;
      rows.push({
        billId: b.billId,
        billNumber: b.billNumber,
        title: b.title,
        status: b.status,
        chamber: b.chamber,
        lastAction: b.lastAction,
        lastActionDate: b.lastActionDate,
        aiSummary: b.aiSummary,
        isPrimary: s.isPrimary,
      });
    }
  }
  rows.sort((a, b) => descNullsLast(a.lastActionDate, b.lastActionDate) || b.billId - a.billId);

  return {
    sponsored: rows.filter((r) => r.isPrimary),
    cosponsored: rows.filter((r) => !r.isPrimary),
  };
}


import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../db";
import { legislators, billSponsors, bills } from "../db/schema";

export type LegislatorFilters = {
  chamber?: string; // "House" | "Senate"
  party?: string; // "Republican" | "Democrat"
  search?: string; // matches name
};

async function getLegislatorsUncached(filters: LegislatorFilters = {}) {
  const conditions = [];
  // Defensive guard: committee "sponsors" from LegiScan (e.g. "Appropriations")
  // carry an empty party. Real legislators always have a party, so exclude the
  // empty-party rows even if one slips back into the table.
  conditions.push(sql`${legislators.party} IS NOT NULL AND ${legislators.party} <> ''`);
  // Mid-session turnover leaves the table with more than 170 rows: a handful of
  // districts hold both the departed member and their replacement. Restrict the
  // roster to the CURRENT member per district — the one with the most recent
  // legislative activity — so the count matches the 120 House + 50 Senate = 170
  // seats and stays consistent with the district map's "current member" logic.
  conditions.push(sql`${legislators.peopleId} IN (
    SELECT people_id FROM (
      SELECT l.people_id, row_number() OVER (
        PARTITION BY l.role, l.district
        ORDER BY max(b.last_action_date) DESC NULLS LAST, count(bs.id) DESC
      ) AS rn
      FROM legislators l
      LEFT JOIN bill_sponsors bs ON bs.people_id = l.people_id
      LEFT JOIN bills b ON b.bill_id = bs.bill_id
      WHERE l.role IN ('Rep','Sen') AND l.district IS NOT NULL AND l.district <> ''
      GROUP BY l.people_id, l.role, l.district
    ) t WHERE rn = 1
  )`);
  if (filters.chamber === "House") conditions.push(eq(legislators.role, "Rep"));
  if (filters.chamber === "Senate") conditions.push(eq(legislators.role, "Sen"));
  if (filters.party === "Republican") conditions.push(eq(legislators.party, "R"));
  if (filters.party === "Democrat") conditions.push(eq(legislators.party, "D"));
  if (filters.search?.trim()) {
    conditions.push(ilike(legislators.name, `%${filters.search.trim()}%`));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  // Order alphabetically by last name. Names are stored "First Last", so the
  // sort key is the final whitespace-delimited token; full name breaks ties
  // between members who share a last name.
  return db
    .select()
    .from(legislators)
    .where(where)
    .orderBy(
      sql`lower(regexp_replace(${legislators.name}, '^.*[[:space:]]', '')) ASC, lower(${legislators.name}) ASC`
    );
}

// Same reasoning as getBills in lib/bills.ts: /legislators reads searchParams
// so the page itself can never be statically cached, but caching the query
// result means repeat requests for the same filters within the window skip
// the database entirely — this one in particular is worth caching since it
// runs a window-function dedup subquery on every call.
export const getLegislators = unstable_cache(getLegislatorsUncached, ["legislators-list"], {
  revalidate: 60,
});

export type TopSponsor = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  billCount: number;
};

// Leaderboard of legislators who have introduced (primary-sponsored) the most
// bills, scoped to one chamber ("Rep" = House, "Sen" = Senate).
export async function getTopSponsors(
  role: "Rep" | "Sen",
  limit = 10
): Promise<TopSponsor[]> {
  return db
    .select({
      peopleId: legislators.peopleId,
      name: legislators.name,
      party: legislators.party,
      role: legislators.role,
      district: legislators.district,
      billCount: count(billSponsors.id),
    })
    .from(billSponsors)
    .innerJoin(legislators, eq(billSponsors.peopleId, legislators.peopleId))
    .where(and(eq(billSponsors.isPrimary, true), eq(legislators.role, role)))
    .groupBy(
      legislators.peopleId,
      legislators.name,
      legislators.party,
      legislators.role,
      legislators.district
    )
    .orderBy(desc(count(billSponsors.id)))
    .limit(limit);
}

export type TopSponsorWithPhoto = TopSponsor & { imageUrl: string | null };

// Homepage "NC Legislators at a Glance": the most active primary sponsors
// across BOTH chambers, with their profile photo. Excludes committee/empty-party
// pseudo-sponsors the same way the roster page does.
export async function getTopSponsorsOverall(
  limit = 3
): Promise<TopSponsorWithPhoto[]> {
  return db
    .select({
      peopleId: legislators.peopleId,
      name: legislators.name,
      party: legislators.party,
      role: legislators.role,
      district: legislators.district,
      imageUrl: legislators.imageUrl,
      billCount: count(billSponsors.id),
    })
    .from(billSponsors)
    .innerJoin(legislators, eq(billSponsors.peopleId, legislators.peopleId))
    .where(
      and(
        eq(billSponsors.isPrimary, true),
        sql`${legislators.party} IS NOT NULL AND ${legislators.party} <> ''`
      )
    )
    .groupBy(
      legislators.peopleId,
      legislators.name,
      legislators.party,
      legislators.role,
      legislators.district,
      legislators.imageUrl
    )
    .orderBy(desc(count(billSponsors.id)))
    .limit(limit);
}

export async function getLegislator(peopleId: number) {
  const rows = await db
    .select()
    .from(legislators)
    .where(eq(legislators.peopleId, peopleId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLegislatorBills(peopleId: number) {
  const rows = await db
    .select({
      billId: bills.billId,
      billNumber: bills.billNumber,
      title: bills.title,
      status: bills.status,
      chamber: bills.chamber,
      lastAction: bills.lastAction,
      lastActionDate: bills.lastActionDate,
      aiSummary: bills.aiSummary,
      isPrimary: billSponsors.isPrimary,
    })
    .from(billSponsors)
    .innerJoin(bills, eq(billSponsors.billId, bills.billId))
    .where(eq(billSponsors.peopleId, peopleId))
    .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`);

  return {
    sponsored: rows.filter((r) => r.isPrimary),
    cosponsored: rows.filter((r) => !r.isPrimary),
  };
}

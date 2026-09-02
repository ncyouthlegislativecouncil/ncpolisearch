import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, execRows } from "../db";
import { bills, billSponsors, legislators } from "../db/schema";
import { getBillVoteSummary, type BillVoteSummary } from "./votes";

export async function getBillCount(): Promise<number> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(bills);
  return rows[0]?.n ?? 0;
}

export async function getRecentBills(limit = 6) {
  return db
    .select()
    .from(bills)
    .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`)
    .limit(limit);
}

// Homepage "What's Moving in Raleigh" feed with a deliberate featured pick.
// The large featured slot should hold the BIGGEST and NEWEST bill: among the
// most recently active bills, the one with the most substantial text (a proxy
// for major legislation over short procedural resolutions) that already has an
// AI summary, so the featured card reads richly. The remaining cards are simply
// the newest bills, minus whichever one we featured (no duplicate).
export async function getHomeFeed(gridSize = 5) {
  // Recent window: newest-active bills. Pull text length (not the full text) so
  // ranking is cheap. RECENT_WINDOW bounds "newest" so we never feature a stale
  // giant bill that hasn't moved in months.
  const RECENT_WINDOW = 40;
  const window = await db
    .select({
      billId: bills.billId,
      billNumber: bills.billNumber,
      title: bills.title,
      status: bills.status,
      chamber: bills.chamber,
      lastAction: bills.lastAction,
      lastActionDate: bills.lastActionDate,
      aiSummary: bills.aiSummary,
      textLen: sql<number>`length(coalesce(${bills.billText}, ''))::int`,
    })
    .from(bills)
    .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`)
    .limit(RECENT_WINDOW);

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

  // Attach primary-sponsor names for the featured bill + grid in one query.
  const shown = featured ? [featured, ...rest] : rest;
  const billIds = shown.map((r) => r.billId);
  const sponsorMap: Record<number, string> = {};
  if (billIds.length) {
    const sp = await db
      .select({ billId: billSponsors.billId, name: billSponsors.name })
      .from(billSponsors)
      .where(
        and(inArray(billSponsors.billId, billIds), eq(billSponsors.isPrimary, true))
      );
    for (const s of sp) {
      if (s.billId != null && s.name && !sponsorMap[s.billId]) sponsorMap[s.billId] = s.name;
    }
  }

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
  const [billRows, legRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        introduced: sql<number>`(count(*) filter (where ${bills.status} = '1'))::int`,
        enacted: sql<number>`(count(*) filter (where ${bills.status} = '4'))::int`,
      })
      .from(bills),
    // Count only the CURRENT member per district (120 House + 50 Senate = 170),
    // matching the /legislators roster. A raw count(*) would include departed
    // members still on file from mid-session turnover and overcount (e.g. 176).
    execRows<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM (
        SELECT l.people_id, row_number() OVER (
          PARTITION BY l.role, l.district
          ORDER BY max(b.last_action_date) DESC NULLS LAST, count(bs.id) DESC
        ) AS rn
        FROM legislators l
        LEFT JOIN bill_sponsors bs ON bs.people_id = l.people_id
        LEFT JOIN bills b ON b.bill_id = bs.bill_id
        WHERE l.party IS NOT NULL AND l.party <> ''
          AND l.role IN ('Rep','Sen') AND l.district IS NOT NULL AND l.district <> ''
        GROUP BY l.people_id, l.role, l.district
      ) t WHERE rn = 1
    `),
  ]);

  return {
    totalBills: billRows[0]?.total ?? 0,
    introduced: billRows[0]?.introduced ?? 0,
    enacted: billRows[0]?.enacted ?? 0,
    legislators: Number(legRows[0]?.n ?? 0),
  };
}

// Most recently updated bills for the homepage activity ticker.
export async function getTickerBills(limit = 20) {
  return db
    .select({
      billId: bills.billId,
      billNumber: bills.billNumber,
      title: bills.title,
      lastAction: bills.lastAction,
      lastActionDate: bills.lastActionDate,
    })
    .from(bills)
    .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`)
    .limit(limit);
}

export async function getBill(billId: number) {
  const rows = await db
    .select()
    .from(bills)
    .where(eq(bills.billId, billId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBillSponsors(billId: number) {
  const rows = await db
    .select({
      peopleId: billSponsors.peopleId,
      name: billSponsors.name,
      party: billSponsors.party,
      isPrimary: billSponsors.isPrimary,
      // Joined from the roster so sponsor cards can show a photo + role/district.
      imageUrl: legislators.imageUrl,
      role: legislators.role,
      district: legislators.district,
    })
    .from(billSponsors)
    .leftJoin(legislators, eq(billSponsors.peopleId, legislators.peopleId))
    .where(eq(billSponsors.billId, billId));

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

export async function searchBillsLite(
  q: string,
  limit = 8
): Promise<BillSearchResult[]> {
  const term = q.trim();
  if (!term) return [];

  return db
    .select({
      billId: bills.billId,
      billNumber: bills.billNumber,
      title: bills.title,
      chamber: bills.chamber,
      status: bills.status,
    })
    .from(bills)
    .where(
      or(ilike(bills.title, `%${term}%`), ilike(bills.billNumber, `%${term}%`))
    )
    .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`)
    .limit(limit);
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

async function getBillsUncached(filters: BillFilters) {
  const {
    search,
    chamber,
    status,
    party,
    topic,
    sort = "newest",
    page = 1,
    pageSize = 24,
  } = filters;

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(bills.title, `%${search}%`), ilike(bills.billNumber, `%${search}%`))
    );
  }
  if (chamber === "H" || chamber === "S") conditions.push(eq(bills.chamber, chamber));
  if (status) conditions.push(eq(bills.status, status));
  if (topic) conditions.push(eq(bills.topic, topic));
  // "Republican"/"Democrat" match the bill's primary sponsor's party — the same
  // party BillCard displays as "Introduced by". "Bipartisan" requires REAL
  // cross-party support, not just one token sponsor from the minority side: at
  // least MIN_BIPARTISAN_SPONSORS from each party (calibrated against H1104,
  // 7 Democrat / 16 Republican sponsors, and H1200, 18 Democrat / 15 Republican
  // — both comfortably clear this bar).
  if (party === "Republican" || party === "Democrat") {
    const code = party === "Republican" ? "R" : "D";
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${billSponsors} bs
      WHERE bs.bill_id = ${bills.billId} AND bs.is_primary = true AND bs.party = ${code}
    )`);
  } else if (party === "Bipartisan") {
    const MIN_BIPARTISAN_SPONSORS = 5;
    conditions.push(sql`(
      SELECT count(*) FILTER (WHERE bs.party = 'D') >= ${MIN_BIPARTISAN_SPONSORS}
        AND count(*) FILTER (WHERE bs.party = 'R') >= ${MIN_BIPARTISAN_SPONSORS}
      FROM ${billSponsors} bs WHERE bs.bill_id = ${bills.billId}
    )`);
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy =
    sort === "oldest"
      ? sql`${bills.lastActionDate} ASC NULLS LAST`
      : sort === "title"
        ? asc(bills.title)
        : sql`${bills.lastActionDate} DESC NULLS LAST`;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(bills)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(bills).where(where),
  ]);

  const total = countRows[0]?.n ?? 0;

  // Attach the primary sponsor name for each bill on this page.
  const billIds = rows.map((r) => r.billId);
  const sponsorMap: Record<number, string> = {};
  if (billIds.length) {
    const sp = await db
      .select({ billId: billSponsors.billId, name: billSponsors.name })
      .from(billSponsors)
      .where(
        and(inArray(billSponsors.billId, billIds), eq(billSponsors.isPrimary, true))
      );
    for (const s of sp) {
      if (s.billId != null && s.name && !sponsorMap[s.billId]) sponsorMap[s.billId] = s.name;
    }
  }

  return { bills: rows, total, sponsorMap, page, pageSize };
}

// /bills is always dynamically rendered (it reads searchParams, which forces
// that for the whole route in the App Router — even the plain unfiltered
// view can't be statically cached at the PAGE level). Caching the underlying
// query result instead means repeat requests for the same filters within the
// window reuse one result instead of each hitting the database fresh —
// directly cutting how often Neon's compute endpoint gets woken, independent
// of the page's own render being dynamic. 60s is short enough that a newly
// polled bill shows up well within a minute, long enough to absorb bursts of
// near-simultaneous visitors browsing the same (often unfiltered) view.
export const getBills = unstable_cache(getBillsUncached, ["bills-list"], {
  revalidate: 60,
});

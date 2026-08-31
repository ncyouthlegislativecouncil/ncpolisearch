import { and, eq, inArray, sql } from "drizzle-orm";
import { db, execRows } from "../db";
import { legislators, bills, votes, voteDetail } from "../db/schema";
import { getLegislatorBills } from "./legislators";
import { getPartyUnity } from "./votes";

// ---------------------------------------------------------------------------
// District ↔ legislator plumbing
//
// GeoJSON features carry a bare district number ("DISTRICT": "42"). The
// legislators table stores zero-padded codes ("HD-042" / "SD-042"). These
// helpers translate between the two and resolve the *current* member of a
// district (turnover means a handful of districts have more than one row, so we
// pick whoever has the most recent legislative activity).
// ---------------------------------------------------------------------------

export type Chamber = "house" | "senate";

function roleFor(chamber: Chamber): "Rep" | "Sen" {
  return chamber === "house" ? "Rep" : "Sen";
}

// 42 -> "HD-042" / "SD-042".
function districtCode(chamber: Chamber, district: number): string {
  const prefix = chamber === "house" ? "HD" : "SD";
  return `${prefix}-${String(district).padStart(3, "0")}`;
}

// "HD-042" -> 42.
function districtNum(code: string | null): number | null {
  if (!code) return null;
  const m = code.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export type DistrictPartyMap = {
  house: Record<number, string>;
  senate: Record<number, string>;
};

// One party letter ("R"/"D") per district, used to tint the map on load. When a
// district has had multiple members, the most recently active one's party wins.
export async function getDistrictPartyMap(): Promise<DistrictPartyMap> {
  const rows = await execRows<{ role: string; district: string; party: string }>(sql`
    SELECT role, district, party FROM (
      SELECT l.role, l.district, l.party,
        row_number() OVER (
          PARTITION BY l.role, l.district
          ORDER BY max(b.last_action_date) DESC NULLS LAST
        ) AS rn
      FROM legislators l
      LEFT JOIN bill_sponsors bs ON bs.people_id = l.people_id
      LEFT JOIN bills b ON b.bill_id = bs.bill_id
      WHERE l.role IN ('Rep','Sen')
        AND l.district IS NOT NULL AND l.district <> ''
        AND l.party IS NOT NULL AND l.party <> ''
      GROUP BY l.people_id, l.role, l.district, l.party
    ) t
    WHERE rn = 1
  `);

  const map: DistrictPartyMap = { house: {}, senate: {} };
  for (const r of rows) {
    const n = districtNum(r.district);
    if (n == null) continue;
    if (r.role === "Rep") map.house[n] = r.party;
    else if (r.role === "Sen") map.senate[n] = r.party;
  }
  return map;
}

export type DistrictBill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
};

export type DistrictVote = {
  rollCallId: number;
  billId: number | null;
  billNumber: string | null;
  title: string | null;
  vote: string | null;
  date: string | null;
};

export type DistrictLegislator = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  districtNumber: number | null;
  imageUrl: string | null;
  runningForReelection: boolean | null;
  chamber: Chamber;
  sponsoredCount: number;
  cosponsoredCount: number;
  partyUnity: number | null;
  recentBills: DistrictBill[];
  recentVotes: DistrictVote[];
};

// Resolve which legislator currently represents a district. Among the (usually
// one) candidates, pick whoever has the most recent bill activity.
async function resolveCurrentMember(
  chamber: Chamber,
  district: number
): Promise<number | null> {
  const code = districtCode(chamber, district);
  const ranked = await execRows<{ people_id: number }>(sql`
    SELECT l.people_id AS people_id
    FROM legislators l
    LEFT JOIN bill_sponsors bs ON bs.people_id = l.people_id
    LEFT JOIN bills b ON b.bill_id = bs.bill_id
    WHERE l.role = ${roleFor(chamber)} AND l.district = ${code}
    GROUP BY l.people_id
    ORDER BY max(b.last_action_date) DESC NULLS LAST, count(bs.id) DESC
    LIMIT 1
  `);
  return ranked[0]?.people_id ?? null;
}

// The last two decisive (Yea/Nay) votes this legislator cast, newest first.
async function getRecentDecisiveVotes(peopleId: number): Promise<DistrictVote[]> {
  return db
    .select({
      rollCallId: votes.rollCallId,
      billId: votes.billId,
      billNumber: bills.billNumber,
      title: bills.title,
      vote: voteDetail.vote,
      date: votes.date,
    })
    .from(voteDetail)
    .innerJoin(votes, eq(voteDetail.rollCallId, votes.rollCallId))
    .leftJoin(bills, eq(votes.billId, bills.billId))
    .where(
      and(
        eq(voteDetail.peopleId, peopleId),
        inArray(voteDetail.vote, ["Yea", "Nay"])
      )
    )
    .orderBy(sql`${votes.date} DESC NULLS LAST`)
    .limit(2);
}

// Full payload for the right-hand info panel, fetched on demand when a district
// is clicked. Returns null when no legislator maps to the district.
export async function getDistrictLegislator(
  chamber: Chamber,
  district: number
): Promise<DistrictLegislator | null> {
  const peopleId = await resolveCurrentMember(chamber, district);
  if (peopleId == null) return null;

  const [leg, billGroups, partyUnity, recentVotes] = await Promise.all([
    db.select().from(legislators).where(eq(legislators.peopleId, peopleId)).limit(1),
    getLegislatorBills(peopleId),
    getPartyUnity(peopleId),
    getRecentDecisiveVotes(peopleId),
  ]);

  const l = leg[0];
  if (!l) return null;

  const recentBills: DistrictBill[] = billGroups.sponsored.slice(0, 3).map((b) => ({
    billId: b.billId,
    billNumber: b.billNumber,
    title: b.title,
    status: b.status,
  }));

  return {
    peopleId: l.peopleId,
    name: l.name,
    party: l.party,
    role: l.role,
    district: l.district,
    districtNumber: districtNum(l.district),
    imageUrl: l.imageUrl,
    runningForReelection: l.runningForReelection,
    chamber,
    sponsoredCount: billGroups.sponsored.length,
    cosponsoredCount: billGroups.cosponsored.length,
    partyUnity,
    recentBills,
    recentVotes,
  };
}

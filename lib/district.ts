import { allLegislators, legislatorById } from "./data/store";
import type { Legislator } from "./data/types";
import { compareByActivity, currentMembers, getLegislatorBills } from "./legislators";
import { getPartyUnity, getRecentDecisiveVotes } from "./votes";

// ---------------------------------------------------------------------------
// District ↔ legislator plumbing
//
// GeoJSON features carry a bare district number ("DISTRICT": "42"). The
// legislator data stores zero-padded codes ("HD-042" / "SD-042"). These
// helpers translate between the two and resolve the *current* member of a
// district (turnover means a handful of districts have more than one
// legislator on file, so we pick whoever has the most recent legislative
// activity).
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
  const members = currentMembers((l) => l.party != null && l.party !== "", false);
  const map: DistrictPartyMap = { house: {}, senate: {} };
  for (const l of members) {
    const n = districtNum(l.district);
    if (n == null || l.party == null) continue;
    if (l.role === "Rep") map.house[n] = l.party;
    else if (l.role === "Sen") map.senate[n] = l.party;
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
function resolveCurrentMember(chamber: Chamber, district: number): Legislator | null {
  const code = districtCode(chamber, district);
  const candidates = allLegislators().filter((l) => l.role === roleFor(chamber) && l.district === code);
  candidates.sort((a, b) => compareByActivity(a, b));
  return candidates[0] ?? null;
}

// Full payload for the right-hand info panel, fetched on demand when a district
// is clicked. Returns null when no legislator maps to the district.
export async function getDistrictLegislator(
  chamber: Chamber,
  district: number
): Promise<DistrictLegislator | null> {
  const member = resolveCurrentMember(chamber, district);
  if (!member) return null;
  const l = legislatorById(member.peopleId);
  if (!l) return null;

  const [billGroups, partyUnity] = await Promise.all([
    getLegislatorBills(l.peopleId),
    getPartyUnity(l.peopleId),
  ]);

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
    recentVotes: getRecentDecisiveVotes(l.peopleId),
  };
}

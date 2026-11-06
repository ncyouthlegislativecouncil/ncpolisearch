import { electionResults } from "./data/store";
import type { ElectionCandidate, ElectionResults, Legislator, Race, RaceCategory } from "./data/types";
import { currentMembers } from "./legislators";
import emails from "./legislator-emails.json";
import { sameLastName } from "./names";

export const CURRENT_ELECTION = "2026-general";

// ---------------------------------------------------------------------------
// Matching ballot names to legislators
// ---------------------------------------------------------------------------

// Find the legislator on their district's ballot. Ballot names are full legal
// names ("Edward C. Goodwin") while our roster may use a nickname or a
// different hyphenation, so last names are compared loosely (lib/names.ts).
export function findOnBallot(
  legislatorName: string,
  party: string | null,
  candidates: ElectionCandidate[]
): ElectionCandidate | null {
  const hits = candidates.filter((c) => sameLastName(legislatorName, c.name));
  if (hits.length <= 1) return hits[0] ?? null;
  return hits.find((c) => c.party === party) ?? null;
}

// Sitting members, one per seat. Our roster can't yet tell when someone
// resigned mid-session (their replacement isn't in LegiScan's data until they
// sponsor or vote on something), but ncleg.gov drops a member's official email
// when they leave — so no email on file means they've already left office.
let seatHolders: Map<string, Legislator> | null = null;
function seatHolder(category: RaceCategory, district: number | null): Legislator | null {
  if (!seatHolders) {
    seatHolders = new Map();
    for (const l of currentMembers((x) => x.party != null && x.party !== "")) {
      if (!(emails as Record<string, string>)[String(l.peopleId)]) continue;
      const d = parseInt(l.district?.match(/\d+/)?.[0] ?? "", 10);
      seatHolders.set(`${l.role === "Rep" ? "nc-house" : "nc-senate"}|${d}`, l);
    }
  }
  return seatHolders.get(`${category}|${district}`) ?? null;
}

function legislativeRace(results: ElectionResults, leg: Legislator): Race | undefined {
  const category = leg.role === "Rep" ? "nc-house" : leg.role === "Sen" ? "nc-senate" : null;
  const district = parseInt(leg.district?.match(/\d+/)?.[0] ?? "", 10);
  return results.races.find((r) => r.category === category && r.district === district);
}

// ---------------------------------------------------------------------------
// Legislator profile badge
// ---------------------------------------------------------------------------

// How a sitting legislator fared in the most recent general election.
export type ElectionOutcome = {
  kind: "won" | "lost" | "leaving"; // "leaving" = wasn't on the ballot for their seat
  pct: number | null; // their share of the vote, 0..1 (won/lost only)
  unopposed: boolean;
  certified: boolean;
};

export function getElectionOutcome(leg: Legislator): ElectionOutcome | null {
  const results = electionResults(CURRENT_ELECTION);
  if (!results) return null;

  const race = legislativeRace(results, leg);
  if (!race || race.candidates.length === 0) return null;
  // Only the sitting member for this seat (see seatHolder above).
  if (seatHolder(race.category, race.district)?.peopleId !== leg.peopleId) return null;

  const total = race.candidates.reduce((n, c) => n + c.votes, 0);
  const me = findOnBallot(leg.name ?? "", leg.party, race.candidates);
  if (!me) return { kind: "leaving", pct: null, unopposed: false, certified: results.certified };

  return {
    kind: me === race.candidates[0] ? "won" : "lost",
    pct: total > 0 ? me.votes / total : null,
    unopposed: race.candidates.length === 1,
    certified: results.certified,
  };
}

// ---------------------------------------------------------------------------
// Results page
// ---------------------------------------------------------------------------

export type RaceStatus = "winner" | "recount" | "unopposed" | "passed" | "failed" | "no-votes";

export type CandidateView = ElectionCandidate & {
  pct: number; // 0..1
  leader: boolean;
  incumbent: boolean;
  profileId: number | null; // legislator profile to link, for sitting members
};

export type RaceView = {
  id: string;
  category: RaceCategory;
  title: string;
  area: string;
  status: RaceStatus;
  marginPts: number | null; // leader's margin over second place, in percentage points
  openSeat: boolean; // the sitting member isn't on the ballot
  // The leader's party differs from the party that held the seat before.
  flip: { from: string; to: string } | null;
  candidates: CandidateView[];
};

// Close enough that the trailing candidate can request a recount under NC law
// (G.S. 163-182.7): within 1% of the votes cast, or for statewide races within
// 0.5% or 10,000 votes, whichever is less.
function withinRecountMargin(race: Race, total: number, margin: number): boolean {
  if (race.statewide) return margin <= Math.min(0.005 * total, 10000);
  return margin <= 0.01 * total;
}

export function raceView(race: Race): RaceView {
  const total = race.candidates.reduce((n, c) => n + c.votes, 0);
  const [first, second] = race.candidates;
  const margin = first && second ? first.votes - second.votes : null;

  let status: RaceStatus;
  if (total === 0) status = "no-votes";
  else if (race.category === "amendments") {
    const forVotes = race.candidates.find((c) => c.name === "For")?.votes ?? 0;
    status = forVotes > total - forVotes ? "passed" : "failed";
  } else if (race.candidates.length === 1) status = "unopposed";
  else status = margin != null && withinRecountMargin(race, total, margin) ? "recount" : "winner";

  const holder =
    race.category === "nc-house" || race.category === "nc-senate" ? seatHolder(race.category, race.district) : null;
  const incumbentOnBallot = holder ? findOnBallot(holder.name ?? "", holder.party, race.candidates) : null;
  const leaderParty = total > 0 ? first?.party ?? null : null;
  const flip =
    race.previousParty && leaderParty && race.category !== "amendments" && leaderParty !== race.previousParty
      ? { from: race.previousParty, to: leaderParty }
      : null;

  return {
    id: race.id,
    category: race.category,
    title: race.title,
    area: race.area,
    status,
    marginPts: margin != null && total > 0 ? (100 * margin) / total : null,
    openSeat: Boolean(holder && !incumbentOnBallot),
    flip,
    candidates: race.candidates.map((c, i) => ({
      ...c,
      pct: total > 0 ? c.votes / total : 0,
      leader: i === 0 && total > 0 && race.category !== "amendments",
      incumbent: c === incumbentOnBallot,
      profileId: c === incumbentOnBallot && holder ? holder.peopleId : null,
    })),
  };
}

// Seats each party is leading in, for one chamber.
export type ChamberTally = { r: number; d: number; other: number; seats: number };

export function chamberTally(races: Race[], category: "nc-house" | "nc-senate"): ChamberTally {
  const tally: ChamberTally = { r: 0, d: 0, other: 0, seats: 0 };
  for (const race of races.filter((r) => r.category === category)) {
    tally.seats++;
    const leader = race.candidates[0];
    if (leader?.party === "R") tally.r++;
    else if (leader?.party === "D") tally.d++;
    else tally.other++;
  }
  return tally;
}

// The amendment totals in the shape the interactive ballot expects.
export function amendmentVotes(results: ElectionResults | null) {
  return (results?.races ?? [])
    .filter((r) => r.category === "amendments")
    .map((r) => ({
      contest: r.contest,
      for: r.candidates.find((c) => c.name === "For")?.votes ?? 0,
      against: r.candidates.find((c) => c.name === "Against")?.votes ?? 0,
    }));
}

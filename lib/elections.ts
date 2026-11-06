import { electionResults } from "./data/store";
import type { ElectionCandidate, Legislator } from "./data/types";
import { currentMembers } from "./legislators";
import emails from "./legislator-emails.json";
import { sameLastName } from "./names";

export const CURRENT_ELECTION = "2026-general";

// How a sitting legislator fared in the most recent general election.
export type ElectionOutcome = {
  kind: "won" | "lost" | "leaving"; // "leaving" = wasn't on the ballot for their seat
  pct: number | null; // their share of the vote, 0..1 (won/lost only)
  unopposed: boolean;
  certified: boolean;
};

// Find the legislator on their district's ballot. Ballot names are full legal
// names ("Edward C. Goodwin") while our roster may use a nickname ("Ed
// Goodwin") or a different hyphenation, so compare last names loosely: the
// legislator's last name appears in the candidate's name, or the candidate's
// last name appears among the legislator's non-first names.
export function findOnBallot(
  legislatorName: string,
  party: string | null,
  candidates: ElectionCandidate[]
): ElectionCandidate | null {
  const hits = candidates.filter((c) => sameLastName(legislatorName, c.name));
  if (hits.length <= 1) return hits[0] ?? null;
  return hits.find((c) => c.party === party) ?? null;
}

let currentIds: Set<number> | null = null;

export function getElectionOutcome(leg: Legislator): ElectionOutcome | null {
  const results = electionResults(CURRENT_ELECTION);
  if (!results) return null;

  // Only sitting members. Our roster can't yet tell when someone resigned
  // mid-session (their replacement isn't in LegiScan's data until they sponsor
  // or vote on something), but ncleg.gov drops a member's official email when
  // they leave — so no email on file means they've already left office.
  currentIds ??= new Set(
    currentMembers((l) => l.party != null && l.party !== "")
      .map((l) => l.peopleId)
      .filter((id) => (emails as Record<string, string>)[String(id)])
  );
  if (!currentIds.has(leg.peopleId)) return null;

  const district = parseInt(leg.district?.match(/\d+/)?.[0] ?? "", 10);
  const contests = leg.role === "Rep" ? results.house : leg.role === "Sen" ? results.senate : [];
  const contest = contests.find((c) => c.district === district);
  if (!contest || contest.candidates.length === 0) return null;

  const total = contest.candidates.reduce((n, c) => n + c.votes, 0);
  const me = findOnBallot(leg.name ?? "", leg.party, contest.candidates);
  if (!me) return { kind: "leaving", pct: null, unopposed: false, certified: results.certified };

  const winner = contest.candidates[0];
  return {
    kind: me === winner ? "won" : "lost",
    pct: total > 0 ? me.votes / total : null,
    unopposed: contest.candidates.length === 1,
    certified: results.certified,
  };
}

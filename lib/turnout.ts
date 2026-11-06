import turnoutData from "../data/elections/2026-general-turnout.json";

// Turnout = votes cast in a race / registered voters on Election Day. Built
// once by scripts/build-turnout.ts; 2026 vote counts come from the live
// results so they follow updates until certification.

export type PastTurnout = { year: number; votes: number; registered: number; unopposed: boolean };
export type RaceTurnout = { registered: number; prev: PastTurnout | null };
export type StatewideTurnout = { year: number; kind: string; top: string; registered: number; votes: number | null };

const data = turnoutData as unknown as {
  statewide: StatewideTurnout[];
  races: Record<string, RaceTurnout>;
};

export function raceTurnout(raceId: string): RaceTurnout | null {
  return data.races[raceId] ?? null;
}

// Statewide turnout by year, with 2026's votes filled in from the live
// top-of-ticket (US Senate) total.
export function statewideTurnout(senateVotes2026: number): (StatewideTurnout & { votes: number; pct: number })[] {
  return data.statewide.map((s) => {
    const votes = s.votes ?? senateVotes2026;
    return { ...s, votes, pct: s.registered > 0 ? (100 * votes) / s.registered : 0 };
  });
}

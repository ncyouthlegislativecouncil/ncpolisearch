// Precinct identifiers shared by the results files and the precinct map files.
// The State Board's results use codes like "07" or "10S1" while its precinct
// shapefile pads them ("0007"), so keys drop leading zeros: "AVERY|7".
export function precinctKey(county: string, precinct: string): string {
  return `${county.trim().toUpperCase()}|${precinct.trim().toUpperCase().replace(/^0+(?=\w)/, "")}`;
}

// Votes for one candidate in one precinct, by how they were cast:
// [Election Day, early voting, absentee by mail, provisional].
export type MethodVotes = [number, number, number, number];

export const METHODS = ["Election Day", "Early voting", "Mail", "Provisional"] as const;

// Per-race precinct detail, written by scripts/update-election-results.ts to
// public/elections/2026-general/<raceId>.json.
export type RacePrecincts = {
  raceId: string;
  candidates: { name: string; party: string | null }[];
  // Real precincts, mappable. votes[i] is candidates[i]'s MethodVotes.
  precincts: { key: string; county: string; precinct: string; votes: MethodVotes[] }[];
  // Rows the State Board doesn't tie to a precinct: early-voting sites,
  // absentee, provisional, and transfer tallies.
  other: { county: string; label: string; votes: MethodVotes[] }[];
};

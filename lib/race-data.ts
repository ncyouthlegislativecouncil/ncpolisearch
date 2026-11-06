import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { CURRENT_ELECTION, raceView } from "./elections";
import { electionResults } from "./data/store";
import { METHODS, type MethodVotes, type RacePrecincts } from "./precincts";
import { raceTurnout, statewideTurnout } from "./turnout";

// Everything the NC House/Senate race page and its printable report show,
// read from the committed results, precinct, map, and turnout files at
// build time.

export type PrecinctRow = {
  key: string;
  name: string;
  county: string;
  onMap: boolean;
  votes: MethodVotes[]; // per candidate
};

const sum4 = (v: MethodVotes) => v[0] + v[1] + v[2] + v[3];
export const lastName = (name: string) => name.split(" ").slice(-1)[0];

export function legislativeRaceIds(): string[] {
  return (electionResults(CURRENT_ELECTION)?.races ?? [])
    .filter((r) => r.category === "nc-house" || r.category === "nc-senate")
    .map((r) => r.id);
}

export function loadRaceData(raceId: string) {
  const results = electionResults(CURRENT_ELECTION);
  const race = results?.races.find((r) => r.id === raceId);
  if (!results || !race || (race.category !== "nc-house" && race.category !== "nc-senate")) return null;
  const votesFile = join(process.cwd(), "public", "elections", "2026-general", `${raceId}.json`);
  const mapFile = join(process.cwd(), "public", "maps", "precincts", `${raceId}.geojson`);
  if (!existsSync(votesFile)) return null;
  const precincts = JSON.parse(readFileSync(votesFile, "utf8")) as RacePrecincts;
  const names = new Map<string, string>();
  if (existsSync(mapFile)) {
    const map = JSON.parse(readFileSync(mapFile, "utf8"));
    for (const f of Array.isArray(map.features) ? map.features : []) names.set(f.properties.key, f.properties.name);
  }

  const view = raceView(race);
  const cands = precincts.candidates;

  // Votes by method across every row (precincts plus early-voting sites,
  // absentee, provisional, and transfer tallies), per candidate.
  const allRows = [...precincts.precincts, ...precincts.other];
  const byMethod = METHODS.map((label, m) => {
    const votes = cands.map((_, i) => allRows.reduce((n, r) => n + r.votes[i][m], 0));
    return { label, votes, total: votes.reduce((a, b) => a + b, 0) };
  }).filter((m) => m.total > 0);
  const grandTotal = byMethod.reduce((n, m) => n + m.total, 0);

  const rows: PrecinctRow[] = precincts.precincts.map((p) => ({
    key: p.key,
    name: names.get(p.key) ?? `Precinct ${p.precinct}`,
    county: p.county.charAt(0) + p.county.slice(1).toLowerCase(),
    onMap: names.has(p.key),
    votes: p.votes,
  }));
  const offMapVotes =
    precincts.other.reduce((n, r) => n + r.votes.reduce((a, v) => a + sum4(v), 0), 0) +
    precincts.precincts.filter((p) => !names.has(p.key)).reduce((n, r) => n + r.votes.reduce((a, v) => a + sum4(v), 0), 0);
  const offMapPct = grandTotal > 0 ? (100 * offMapVotes) / grandTotal : 0;

  const senate = results.races.find((r) => r.id === "us-senate");
  const statewide = statewideTurnout(senate ? senate.candidates.reduce((n, c) => n + c.votes, 0) : 0);
  const raceVotes = race.candidates.reduce((n, c) => n + c.votes, 0);

  // "Baltutis led early voting by 9.0 pts; Moffitt led election day by 7.2 pts."
  const methodSummary = byMethod
    .filter((m) => m.label !== "Provisional")
    .map((m) => {
      const order = m.votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      const margin = order.length > 1 ? (100 * (order[0].v - order[1].v)) / m.total : 100;
      return `${lastName(cands[order[0].i].name)} led ${m.label.toLowerCase()} by ${margin.toFixed(1)} pts`;
    })
    .join("; ");

  return {
    race,
    view,
    cands,
    byMethod,
    grandTotal,
    rows,
    offMapPct,
    statewide,
    raceVotes,
    turnout: raceTurnout(race.id),
    methodSummary,
    certified: results.certified,
    sourceUpdated: results.sourceUpdated,
  };
}

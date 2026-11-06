import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import RaceCard, { partyColor } from "../../../components/results/RaceCard";
import PrecinctExplorer, { type PrecinctRow } from "../../../components/results/PrecinctExplorer";
import TurnoutCard from "../../../components/results/TurnoutCard";
import { raceTurnout, statewideTurnout } from "../../../lib/turnout";
import { CURRENT_ELECTION, raceView } from "../../../lib/elections";
import { electionResults } from "../../../lib/data/store";
import { METHODS, type MethodVotes, type RacePrecincts } from "../../../lib/precincts";

// One page per NC House / NC Senate race, pre-built at deploy time.
export function generateStaticParams() {
  const results = electionResults(CURRENT_ELECTION);
  return (results?.races ?? [])
    .filter((r) => r.category === "nc-house" || r.category === "nc-senate")
    .map((r) => ({ raceId: r.id }));
}

export const dynamicParams = false;

function loadRace(raceId: string) {
  const race = electionResults(CURRENT_ELECTION)?.races.find((r) => r.id === raceId);
  if (!race || (race.category !== "nc-house" && race.category !== "nc-senate")) return null;
  const votesFile = join(process.cwd(), "public", "elections", "2026-general", `${raceId}.json`);
  const mapFile = join(process.cwd(), "public", "maps", "precincts", `${raceId}.geojson`);
  if (!existsSync(votesFile)) return null;
  const precincts = JSON.parse(readFileSync(votesFile, "utf8")) as RacePrecincts;
  const names = new Map<string, string>();
  if (existsSync(mapFile)) {
    const map = JSON.parse(readFileSync(mapFile, "utf8"));
    for (const f of Array.isArray(map.features) ? map.features : []) names.set(f.properties.key, f.properties.name);
  }
  return { race, precincts, names };
}

export function generateMetadata({ params }: { params: { raceId: string } }): Metadata {
  const loaded = loadRace(params.raceId);
  if (!loaded) return { title: "Race not found — NCPoliSearch" };
  return {
    title: `${loaded.race.title} precinct results — NCPoliSearch`,
    description: `Precinct-by-precinct 2026 general election results for ${loaded.race.title}, with early voting, Election Day, and mail breakdowns.`,
  };
}

const sum4 = (v: MethodVotes) => v[0] + v[1] + v[2] + v[3];

export default function RacePrecinctPage({ params }: { params: { raceId: string } }) {
  const loaded = loadRace(params.raceId);
  if (!loaded) notFound();
  const { race, precincts, names } = loaded;
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

  const senate = electionResults(CURRENT_ELECTION)?.races.find((r) => r.id === "us-senate");
  const statewide = statewideTurnout(senate ? senate.candidates.reduce((n, c) => n + c.votes, 0) : 0);
  const raceVotes = race.candidates.reduce((n, c) => n + c.votes, 0);

  // "Baltutis led early voting by 9.0 pts; Moffitt led Election Day by 7.2 pts."
  const methodSummary = byMethod
    .filter((m) => m.label !== "Provisional")
    .map((m) => {
      const order = m.votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      const margin = order.length > 1 ? (100 * (order[0].v - order[1].v)) / m.total : 100;
      return `${cands[order[0].i].name.split(" ").slice(-1)[0]} led ${m.label.toLowerCase()} by ${margin.toFixed(1)} pts`;
    })
    .join("; ");

  return (
    <main className="bg-pagebg">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <Link href="/results" className="text-sm text-navylight hover:text-skyblue">
          ← All results
        </Link>

        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <RaceCard race={view} showPrecinctLink={false} />
          </div>

          <TurnoutCard
            votes={raceVotes}
            turnout={raceTurnout(race.id)}
            statewide={statewide}
            unopposed={view.status === "unopposed"}
          />

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-1">
            <h2 className="section-label">How people voted</h2>
            <p className="mt-2 text-sm text-navy">{methodSummary}.</p>
            <div className="mt-4 space-y-3">
              {byMethod.map((m) => (
                <div key={m.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-navy">{m.label}</span>
                    <span className="text-xs text-navymuted">
                      {((100 * m.total) / grandTotal).toFixed(1)}% of votes · {m.total.toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-gray-100">
                    {m.votes.map((v, i) => (
                      <div
                        key={i}
                        className={`h-full ${partyColor(cands[i]).bar}`}
                        style={{ width: `${(100 * v) / m.total}%` }}
                        title={`${cands[i].name}: ${v.toLocaleString("en-US")}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs">
                    {m.votes.map((v, i) => (
                      <span key={i} className={partyColor(cands[i]).text}>
                        {cands[i].name.split(" ").slice(-1)[0]} {((100 * v) / m.total).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6">
          <h2 className="font-serif text-2xl font-bold text-navy">Precinct results</h2>
          {offMapPct >= 0.5 && (
            <p className="mt-1 text-xs text-navymuted">
              {offMapPct.toFixed(0)}% of this race&apos;s votes were counted at early-voting sites, by mail, or
              otherwise without a precinct, so they&apos;re in the totals above but not on the map.
            </p>
          )}
          <div className="mt-3">
            <Suspense fallback={<div className="h-[600px] animate-pulse rounded-lg bg-gray-100" />}>
              <PrecinctExplorer raceId={race.id} candidates={cands} rows={rows} />
            </Suspense>
          </div>
        </section>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs italic leading-relaxed text-gray-500">
          Precinct results from the NC State Board of Elections
          {electionResults(CURRENT_ELECTION)?.certified ? "" : ", unofficial until certified"}. Precinct boundaries
          from the State Board&apos;s July 2024 precinct file, trimmed to the district line where a precinct is split
          between districts. Shading shows who led each precinct and by how many points. Registered voters from
          the State Board&apos;s Election Day voter counts; for a precinct split between districts, they&apos;re shared
          out by each district&apos;s share of the votes cast there.
        </p>
      </div>
    </main>
  );
}

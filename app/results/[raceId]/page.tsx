import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import RaceCard, { partyColor } from "../../../components/results/RaceCard";
import PrecinctExplorer from "../../../components/results/PrecinctExplorer";
import TurnoutCard from "../../../components/results/TurnoutCard";
import { legislativeRaceIds, loadRaceData } from "../../../lib/race-data";

// One page per NC House / NC Senate race, pre-built at deploy time.
export function generateStaticParams() {
  return legislativeRaceIds().map((raceId) => ({ raceId }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: { params: { raceId: string } }): Metadata {
  const d = loadRaceData(params.raceId);
  if (!d) return { title: "Race not found — NCPoliSearch" };
  return {
    title: `${d.race.title} precinct results — NCPoliSearch`,
    description: `Precinct-by-precinct 2026 general election results for ${d.race.title}, with early voting, Election Day, and mail breakdowns.`,
  };
}

export default function RacePrecinctPage({ params }: { params: { raceId: string } }) {
  const d = loadRaceData(params.raceId);
  if (!d) notFound();
  const { race, view, cands, byMethod, grandTotal, rows, offMapPct, statewide, raceVotes, turnout, methodSummary, certified } = d;

  return (
    <main className="bg-pagebg">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/results" className="text-sm text-navylight hover:text-skyblue">
            ← All results
          </Link>
          <a
            href={`/results/${race.id}/report?print=1`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-navy bg-white px-4 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
            </svg>
            Download PDF report
          </a>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <RaceCard race={view} showPrecinctLink={false} />
          </div>

          <TurnoutCard
            votes={raceVotes}
            turnout={turnout}
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
          {certified ? "" : ", unofficial until certified"}. Precinct boundaries
          from the State Board&apos;s July 2024 precinct file, trimmed to the district line where a precinct is split
          between districts. Shading shows who led each precinct and by how many points. Registered voters from
          the State Board&apos;s Election Day voter counts; for a precinct split between districts, they&apos;re shared
          out by each district&apos;s share of the votes cast there.
        </p>
      </div>
    </main>
  );
}

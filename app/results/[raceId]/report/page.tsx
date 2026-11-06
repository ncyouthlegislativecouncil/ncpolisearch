import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReportMap, { PrintButton } from "../../../../components/results/ReportMap";
import { lastName, legislativeRaceIds, loadRaceData } from "../../../../lib/race-data";
import { SHADES, shadeOf, tallyVotes } from "../../../../lib/precinct-shade";
import type { MethodVotes } from "../../../../lib/precincts";

// Printable one-race report (letter paper), pre-built for every NC House and
// Senate race. The race page's "Download PDF report" button opens it with
// ?print=1, which brings up the browser's print dialog ("Save as PDF").
// Nothing runs on a server per download.
export function generateStaticParams() {
  return legislativeRaceIds().map((raceId) => ({ raceId }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: { params: { raceId: string } }): Metadata {
  const d = loadRaceData(params.raceId);
  if (!d) return { title: "Race not found — NCPoliSearch" };
  return {
    title: `${d.race.title} — 2026 results report — NCPoliSearch`,
    robots: { index: false },
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : "—");
const sum4 = (v: MethodVotes) => v[0] + v[1] + v[2] + v[3];
const PARTY_TEXT: Record<string, string> = { D: "text-democrat", R: "text-republican" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-gray-200 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-navymuted">{label}</p>
      <p className="font-serif text-xl font-bold leading-tight text-navy">{value}</p>
      {sub && <p className="text-[10px] leading-tight text-navymuted">{sub}</p>}
    </div>
  );
}

export default function RaceReportPage({ params }: { params: { raceId: string } }) {
  const d = loadRaceData(params.raceId);
  if (!d) notFound();
  const { race, view, cands, byMethod, grandTotal, rows, offMapPct, statewide, raceVotes, turnout, methodSummary } = d;

  const asOf = new Date(d.sourceUpdated).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  const leader = view.candidates.find((c) => c.leader);
  const statusLine = [
    view.status === "unopposed" && leader
      ? `${leader.name} ran unopposed`
      : leader && `${leader.name} (${leader.party}) ${view.status === "recount" ? "leads" : "won"}`,
    view.marginPts != null && view.status !== "unopposed" && `by ${view.marginPts.toFixed(2)} pts`,
    view.status === "recount" && "within the margin for a recount request",
    view.flip && `seat flipped ${view.flip.from} → ${view.flip.to}`,
    view.openSeat && "open seat",
  ]
    .filter(Boolean)
    .join(" · ");

  const regd = turnout?.registered ?? 0;
  const turnoutPct = regd > 0 ? (100 * raceVotes) / regd : null;
  const prev = turnout?.prev ?? null;
  const prevPct = prev && prev.registered > 0 ? (100 * prev.votes) / prev.registered : null;
  const state2026 = statewide.find((s) => s.year === 2026);
  const state2022 = statewide.find((s) => s.year === 2022);

  // All-votes shading for the map, and each precinct's tally for the table.
  const tallies = rows.map((r) => ({ r, t: tallyVotes(r.votes.map(sum4)) }));
  const shades = Object.fromEntries(tallies.map(({ r, t }) => [r.key, shadeOf(t, cands)]));
  const sorted = [...tallies].sort((a, b) => `${a.r.county} ${a.r.name}`.localeCompare(`${b.r.county} ${b.r.name}`));
  const counties = Array.from(new Set(rows.map((r) => r.county)));
  const won = tallies.map(({ t }) => t.leader);

  return (
    <main className="bg-pagebg py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[7.5in] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/results/${race.id}`} className="text-sm text-navylight hover:text-skyblue">
          ← Back to the race page
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-navymuted">In the print window, choose &ldquo;Save as PDF&rdquo;.</span>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-[7.5in] bg-white p-[0.4in] text-[11px] text-navy shadow-md print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <header className="flex items-end justify-between gap-4 border-b-2 border-navy pb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-navymuted">
              NCPoliSearch · 2026 NC General Election
            </p>
            <h1 className="font-serif text-[26px] font-bold leading-tight">{race.title}</h1>
            <p className="text-[11px] text-navymuted">
              {counties.length === 1 ? `${counties[0]} County` : `${counties.join(", ")} counties`}
            </p>
          </div>
          <div className="shrink-0 text-right text-[10px] text-navymuted">
            <p className="font-semibold text-navy">{d.certified ? "Certified results" : "Unofficial results"}</p>
            <p>State Board of Elections data as of</p>
            <p>{asOf} ET</p>
          </div>
        </header>

        <p className="mt-2 text-[12px] font-semibold">{statusLine}</p>

        {/* Candidates */}
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left text-[9px] uppercase tracking-wider text-navymuted">
              <th className="py-1 font-bold">Candidate</th>
              <th className="py-1 text-right font-bold">Votes</th>
              <th className="py-1 text-right font-bold">Share</th>
            </tr>
          </thead>
          <tbody>
            {view.candidates.map((c) => (
              <tr key={c.name} className="border-b border-gray-100">
                <td className="py-1 text-[12px]">
                  <span className={c.leader ? "font-bold" : ""}>{c.name}</span>{" "}
                  <span className={`font-semibold ${PARTY_TEXT[c.party ?? ""] ?? "text-navymuted"}`}>({c.party})</span>
                  {c.leader && (view.status === "winner" || view.status === "unopposed") && " ✓"}
                  {c.incumbent && <span className="ml-2 text-[9px] uppercase text-navymuted">Incumbent</span>}
                </td>
                <td className="py-1 text-right font-mono">{fmt(c.votes)}</td>
                <td className="py-1 text-right font-mono font-semibold">{(c.pct * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Key numbers */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat label="Votes cast" value={fmt(raceVotes)} sub={`${rows.length} precincts`} />
          <Stat
            label="Margin"
            value={view.marginPts != null && view.status !== "unopposed" ? `${view.marginPts.toFixed(2)} pts` : "—"}
            sub={
              view.candidates.length > 1 && view.status !== "unopposed"
                ? `${fmt(view.candidates[0].votes - view.candidates[1].votes)} votes`
                : undefined
            }
          />
          <Stat
            label="Turnout"
            value={turnoutPct != null ? `${turnoutPct.toFixed(1)}%` : "—"}
            sub={regd > 0 ? `of ${fmt(regd)} registered` : undefined}
          />
          <Stat
            label="2024, same district"
            value={prevPct != null ? `${prevPct.toFixed(1)}%` : "—"}
            sub={
              prev
                ? `${fmt(prev.votes)} votes${prev.unopposed ? " · unopposed" : ""}`
                : "precincts changed since 2024"
            }
          />
        </div>
        <p className="mt-1 text-[9px] text-navymuted">
          Turnout = votes cast in this race ÷ registered voters. Statewide: {state2026?.pct.toFixed(1)}% in 2026,{" "}
          {state2022?.pct.toFixed(1)}% in 2022 (last midterm). Presidential years like 2024 always draw more voters.
        </p>

        {/* Voting methods */}
        <h2 className="mt-3 text-[9px] font-bold uppercase tracking-wider text-navymuted">How people voted</h2>
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left text-[9px] uppercase tracking-wider text-navymuted">
              <th className="py-1 font-bold">Method</th>
              {cands.map((c) => (
                <th key={c.name} className={`py-1 text-right font-bold ${PARTY_TEXT[c.party ?? ""] ?? ""}`}>
                  {lastName(c.name)}
                </th>
              ))}
              <th className="py-1 text-right font-bold">Total</th>
              <th className="py-1 text-right font-bold">Share of votes</th>
            </tr>
          </thead>
          <tbody>
            {byMethod.map((m) => (
              <tr key={m.label} className="border-b border-gray-100">
                <td className="py-1 font-semibold">{m.label}</td>
                {m.votes.map((v, i) => (
                  <td key={i} className="py-1 text-right font-mono">
                    {fmt(v)} <span className="text-navymuted">({pct(v, m.total)})</span>
                  </td>
                ))}
                <td className="py-1 text-right font-mono">{fmt(m.total)}</td>
                <td className="py-1 text-right font-mono">{pct(m.total, grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[10px]">{methodSummary}.</p>

        {/* Map */}
        <section className="mt-3 break-inside-avoid">
          <div className="flex items-end justify-between">
            <h2 className="text-[9px] font-bold uppercase tracking-wider text-navymuted">Precinct map · all votes</h2>
            <div className="flex items-center gap-1 text-[9px] text-navymuted">
              <span>Close</span>
              {[0, 1, 2, 3].map((b) => (
                <span key={b} className="flex">
                  <span className="h-2 w-2.5" style={{ background: SHADES.D[b] }} />
                  <span className="h-2 w-2.5" style={{ background: SHADES.R[b] }} />
                </span>
              ))}
              <span>Landslide</span>
            </div>
          </div>
          <div className="mt-1 h-[3.5in] rounded border border-gray-200">
            <ReportMap raceId={race.id} shades={shades} />
          </div>
          {offMapPct >= 0.5 && (
            <p className="mt-1 text-[9px] text-navymuted">
              {offMapPct.toFixed(0)}% of votes were counted at early-voting sites, by mail, or otherwise without a
              precinct; they&apos;re in the totals above but not on the map or in the precinct table.
            </p>
          )}
        </section>

        {/* Precinct table, starting on its own page when printed */}
        <section className="mt-5 print:mt-0 print:break-before-page">
          <h2 className="text-[9px] font-bold uppercase tracking-wider text-navymuted">
            {race.title} · results by precinct
          </h2>
          <table className="mt-1 w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-gray-300 text-left text-[9px] uppercase tracking-wider text-navymuted">
                <th className="py-1 font-bold">Precinct</th>
                {counties.length > 1 && <th className="py-1 font-bold">County</th>}
                {cands.map((c) => (
                  <th key={c.name} className={`py-1 text-right font-bold ${PARTY_TEXT[c.party ?? ""] ?? ""}`}>
                    {lastName(c.name)}
                  </th>
                ))}
                <th className="py-1 text-right font-bold">Total</th>
                <th className="py-1 text-right font-bold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ r, t }, idx) => (
                <tr key={r.key} className={`break-inside-avoid border-b border-gray-100 ${idx % 2 ? "bg-gray-50" : ""}`}>
                  <td className="py-0.5">
                    {r.name}
                    {!r.onMap && <span className="text-navymuted"> *</span>}
                  </td>
                  {counties.length > 1 && <td className="py-0.5 text-navymuted">{r.county}</td>}
                  {t.votes.map((v, i) => (
                    <td key={i} className="py-0.5 text-right font-mono">
                      {fmt(v)}
                    </td>
                  ))}
                  <td className="py-0.5 text-right font-mono">{fmt(t.total)}</td>
                  <td className={`py-0.5 text-right font-mono font-semibold ${PARTY_TEXT[cands[t.leader]?.party ?? ""] ?? ""}`}>
                    {t.leader >= 0 ? `${cands[t.leader].party ?? ""} +${t.margin.toFixed(1)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[9px] text-navymuted">
            Precincts won:{" "}
            {cands
              .map((c, i) => `${lastName(c.name)} ${won.filter((w) => w === i).length}`)
              .join(" · ")}
            {rows.some((r) => !r.onMap) && " · * redrawn after the State Board's latest boundary file, so not on the map"}
          </p>
        </section>

        <footer className="mt-4 border-t border-gray-200 pt-2 text-[9px] leading-snug text-navymuted">
          Results from the NC State Board of Elections{d.certified ? "" : ", unofficial until certified"}. Precinct
          boundaries from the State Board&apos;s July 2024 precinct file. Registered voters from the State Board&apos;s
          Election Day voter counts; for a precinct split between districts, they&apos;re shared out by each
          district&apos;s share of the votes cast there. Interactive version: ncpolisearch.com/results/{race.id}
        </footer>
      </article>
    </main>
  );
}

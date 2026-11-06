import type { Metadata } from "next";
import ResultsExplorer from "../../components/results/ResultsExplorer";
import FindMyPrecinct from "../../components/results/FindMyPrecinct";
import { statewideTurnout } from "../../lib/turnout";
import { partyColor } from "../../components/results/RaceCard";
import { CURRENT_ELECTION, chamberTally, raceView, type ChamberTally, type RaceView } from "../../lib/elections";
import { electionResults } from "../../lib/data/store";

export const metadata: Metadata = {
  title: "2026 NC Election Results — NCPoliSearch",
  description:
    "Results for every 2026 North Carolina general election race: US Senate and House, statewide courts, the constitutional amendments, and all 170 NC House and Senate seats.",
};

function TopTwoCard({ label, race }: { label: string; race: RaceView | undefined }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-navy">{label}</p>
        {race?.flip && (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
              race.flip.to === "D" ? "bg-democrat" : race.flip.to === "R" ? "bg-republican" : "bg-navymuted"
            }`}
          >
            Flip {race.flip.from} → {race.flip.to}
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {(race?.candidates ?? []).slice(0, 2).map((c) => (
          <li key={c.name} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-navy">
              {c.name} <span className={`text-xs font-semibold ${partyColor(c).text}`}>({c.party})</span>
              {c.leader && <span className="ml-1 text-gold">✓</span>}
            </span>
            <span className={`font-mono text-lg font-bold ${partyColor(c).text}`}>{(c.pct * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Seats each party is leading in, as a split bar with tick marks at the
// simple-majority and three-fifths (veto-override) thresholds.
function ChamberCard({
  label,
  tally,
  majority,
  threeFifths,
  recountSeats,
  flips,
}: {
  label: string;
  tally: ChamberTally;
  majority: number;
  threeFifths: number;
  recountSeats: number;
  flips: string | null;
}) {
  const pct = (n: number) => `${(100 * n) / tally.seats}%`;
  const control =
    tally.r >= threeFifths
      ? "R three-fifths"
      : tally.d >= threeFifths
        ? "D three-fifths"
        : tally.r >= majority
          ? "R majority"
          : tally.d >= majority
            ? "D majority"
            : "No majority";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-navy">{label}</p>
        <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">{control}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-bold">
        <span className="text-democrat">D {tally.d}</span>{" "}
        <span className="text-republican">R {tally.r}</span>
        {tally.other > 0 && <span className="text-base text-navymuted"> · {tally.other} other</span>}
      </p>
      <div className="relative mt-2 flex h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full bg-democrat" style={{ width: pct(tally.d) }} />
        <div className="h-full bg-navymuted" style={{ width: pct(tally.other) }} />
        <div className="ml-auto h-full bg-republican" style={{ width: pct(tally.r) }} />
        {[majority, threeFifths].flatMap((n) => [n, tally.seats - n]).map((n, i) => (
          <span key={i} className="absolute top-0 h-full w-px bg-navy" style={{ left: pct(n) }} aria-hidden />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-navymuted">
        {majority} for a majority · {threeFifths} for three-fifths (veto-proof)
      </p>
      {recountSeats > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-medrisk">
          {recountSeats} seat{recountSeats === 1 ? "" : "s"} within recount margin
        </p>
      )}
      {flips && <p className="mt-1 text-[11px] font-semibold text-navy">{flips}</p>}
    </div>
  );
}

function flipSummary(races: RaceView[], category: RaceView["category"]): string | null {
  const flipped = races.filter((r) => r.category === category && r.flip);
  if (flipped.length === 0) return null;
  const byParty = new Map<string, number>();
  for (const r of flipped) byParty.set(r.flip!.to, (byParty.get(r.flip!.to) ?? 0) + 1);
  const parts = Array.from(byParty.entries()).map(([party, n]) => `${n} to ${party}`);
  return `${flipped.length} seat${flipped.length === 1 ? "" : "s"} flipped (${parts.join(", ")})`;
}

export default function ResultsPage() {
  const results = electionResults(CURRENT_ELECTION);
  if (!results) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center text-navymuted">
        Election results aren&apos;t available yet.
      </main>
    );
  }

  const races = results.races.map(raceView);
  const senateRace = results.races.find((r) => r.id === "us-senate");
  const turnout = statewideTurnout(senateRace ? senateRace.candidates.reduce((n, c) => n + c.votes, 0) : 0);
  const updated = new Date(results.sourceUpdated).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  return (
    <main className="bg-pagebg">
      <section className="border-b-4 border-[#c9a84c] bg-navy">
        <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-6 sm:py-14">
          <h1 className="font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
            2026 NC General Election Results
          </h1>
          <p className="mt-3 text-lg text-skyblue">November 3, 2026</p>
          <span className="mt-5 inline-block rounded-full bg-[#c9a84c] px-4 py-1.5 text-sm font-bold text-navy">
            {results.certified
              ? "Certified results · NC State Board of Elections"
              : `Unofficial results · State Board of Elections file updated ${updated}`}
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TopTwoCard label="US Senate" race={races.find((r) => r.id === "us-senate")} />
          <TopTwoCard label="NC Supreme Court" race={races.find((r) => r.id.startsWith("nc-supreme-court"))} />
          <ChamberCard
            label="NC House"
            tally={chamberTally(results.races, "nc-house")}
            majority={61}
            threeFifths={72}
            recountSeats={races.filter((r) => r.category === "nc-house" && r.status === "recount").length}
            flips={flipSummary(races, "nc-house")}
          />
          <ChamberCard
            label="NC Senate"
            tally={chamberTally(results.races, "nc-senate")}
            majority={26}
            threeFifths={30}
            recountSeats={races.filter((r) => r.category === "nc-senate" && r.status === "recount").length}
            flips={flipSummary(races, "nc-senate")}
          />
        </div>

        {/* Statewide turnout next to the last two general elections. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm shadow-sm">
          <span className="section-label">Turnout</span>
          {turnout
            .slice()
            .reverse()
            .map((t) => (
              <span key={t.year} className={t.year === 2026 ? "font-semibold text-navy" : "text-navymuted"}>
                <span className={t.year === 2026 ? "font-serif text-xl font-bold" : "font-mono"}>{t.pct.toFixed(1)}%</span>{" "}
                {t.year} <span className="text-xs font-normal">({t.kind.toLowerCase()})</span>
              </span>
            ))}
          <span className="w-full text-xs text-navymuted lg:ml-auto lg:w-auto">
            Share of registered voters who voted in the top race ({turnout.map((t) => `${t.year}: ${t.top}`).join(", ")}).
          </span>
        </div>

        <div className="mt-8">
          <FindMyPrecinct />
        </div>

        <div className="mt-8">
          <ResultsExplorer races={races} />
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs italic leading-relaxed text-gray-500">
          Vote totals from the NC State Board of Elections
          {results.certified ? "" : ", unofficial until the State Board certifies them"}. NCPoliSearch
          doesn&apos;t call races: &ldquo;Won&rdquo; marks the candidate with the most votes in the
          State Board&apos;s count. &ldquo;Recount margin&rdquo; means the race is close enough that
          the trailing candidate may request a recount under NC law (within 1% of votes cast, or for
          statewide races 0.5% or 10,000 votes, whichever is less). Seat counts are based on who
          leads each race. &ldquo;Battleground&rdquo; races are legislative races decided by fewer
          than 10 points. A &ldquo;flip&rdquo; is a seat where the leading candidate&apos;s party
          differs from the party that held it before the election (for NC House and Senate, the
          member serving on Election Day; for Congress, the 2024 results). U = unaffiliated.
        </p>
      </div>
    </main>
  );
}

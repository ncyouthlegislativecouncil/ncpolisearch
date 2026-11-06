import Link from "next/link";
import type { CandidateView, RaceView } from "../../lib/elections";

// Party colors used across the results page. Amendment choices reuse them:
// "For" reads green, "Against" red.
export function partyColor(c: Pick<CandidateView, "party" | "name">): { text: string; bar: string } {
  if (c.name === "For") return { text: "text-lowrisk", bar: "bg-lowrisk" };
  if (c.name === "Against") return { text: "text-ncred", bar: "bg-ncred" };
  switch (c.party) {
    case "R":
      return { text: "text-republican", bar: "bg-republican" };
    case "D":
      return { text: "text-democrat", bar: "bg-democrat" };
    case "L":
      return { text: "text-gold", bar: "bg-gold" };
    case "G":
      return { text: "text-lowrisk", bar: "bg-lowrisk" };
    default:
      return { text: "text-navymuted", bar: "bg-navymuted" };
  }
}

const STATUS_CHIP: Record<RaceView["status"], { label: string; className: string } | null> = {
  winner: { label: "✓ Won", className: "bg-navy text-white" },
  recount: { label: "Recount margin", className: "border border-medrisk bg-amber-50 text-medrisk" },
  unopposed: { label: "Unopposed", className: "bg-gray-100 text-navymuted" },
  passed: { label: "✓ Passed", className: "bg-lowrisk text-white" },
  failed: { label: "✗ Failed", className: "bg-ncred text-white" },
  "no-votes": null,
};

function CandidateRow({ c, showCheck }: { c: CandidateView; showCheck: boolean }) {
  const color = partyColor(c);
  const name = c.profileId ? (
    <Link href={`/legislators/${c.profileId}`} className="hover:underline">
      {c.name}
    </Link>
  ) : (
    c.name
  );
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 text-sm">
          <span className={`font-semibold text-navy ${c.leader ? "" : "font-medium"}`}>{name}</span>
          {c.party && <span className={`ml-1 text-xs font-semibold ${color.text}`}>({c.party})</span>}
          {showCheck && c.leader && <span className="ml-1 text-gold">✓</span>}
          {c.incumbent && (
            <span className="ml-1.5 rounded bg-badge px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-navylight">
              Incumbent
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          <span className={`font-mono text-lg font-bold ${color.text}`}>{(c.pct * 100).toFixed(1)}%</span>
          <span className="w-[4.5rem] text-right font-mono text-[11px] text-navymuted">
            {c.votes.toLocaleString("en-US")}
          </span>
        </div>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${(c.pct * 100).toFixed(2)}%` }} />
      </div>
    </li>
  );
}

export default function RaceCard({ race }: { race: RaceView }) {
  const chip = STATUS_CHIP[race.status];
  const showCheck = race.status === "winner" || race.status === "unopposed";

  let footer: React.ReactNode = null;
  if (race.category === "amendments") {
    footer = (
      <Link href="/ballot" className="font-semibold text-navy hover:text-skyblue">
        What this amendment does →
      </Link>
    );
  } else if (race.status === "recount" && race.marginPts != null) {
    footer = (
      <span className="text-medrisk">
        Margin {race.marginPts.toFixed(2)} pts — close enough for a recount request
      </span>
    );
  } else if (race.status === "winner" && race.marginPts != null) {
    footer = <span>Won by {race.marginPts.toFixed(1)} pts</span>;
  } else if (race.status === "unopposed") {
    footer = <span>No opponent on the ballot</span>;
  }

  return (
    <article className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-bold leading-tight text-navy">{race.title}</h3>
          <p className="mt-0.5 text-xs text-navymuted">{race.area}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {chip && (
            <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${chip.className}`}>
              {chip.label}
            </span>
          )}
          {race.openSeat && (
            <span className="rounded bg-badge px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navylight">
              Open seat
            </span>
          )}
        </div>
      </header>

      <ul className="flex-1 divide-y divide-gray-50 px-4 py-1">
        {race.candidates.map((c) => (
          <CandidateRow key={c.name} c={c} showCheck={showCheck} />
        ))}
      </ul>

      {footer && <footer className="border-t border-gray-100 px-4 py-2.5 text-xs text-navymuted">{footer}</footer>}
    </article>
  );
}

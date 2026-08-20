import Link from "next/link";
import type { TopSponsor } from "../lib/legislators";
import { partyInfo } from "../lib/legislator-display";

function partyAbbrev(party: string | null): string {
  if (party === "R") return "R";
  if (party === "D") return "D";
  return party ?? "·";
}

function Column({ title, rows }: { title: string; rows: TopSponsor[] }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-label">{title}</p>
        <span className="font-mono text-[10px] text-navymuted">
          {rows.length} shown · scroll
        </span>
      </div>
      <ol className="max-h-96 divide-y divide-gray-100 overflow-y-auto pr-1">
        {rows.map((r, i) => {
          const party = partyInfo(r.party);
          return (
            <li key={r.peopleId} className="flex items-center gap-3 py-2">
              <span className="w-5 flex-none text-center font-mono text-sm font-bold text-navymuted">
                {i + 1}
              </span>
              <Link
                href={`/legislators/${r.peopleId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-navy hover:underline"
              >
                {r.name}
              </Link>
              <span
                className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold ${party.className}`}
                title={party.label}
              >
                {partyAbbrev(r.party)}
              </span>
              <span className="w-10 flex-none text-right font-mono text-sm font-bold text-navy">
                {r.billCount}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function SponsorLeaderboard({
  house,
  senate,
}: {
  house: TopSponsor[];
  senate: TopSponsor[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Column title="House · Most Bills Introduced" rows={house} />
      <Column title="Senate · Most Bills Introduced" rows={senate} />
    </div>
  );
}

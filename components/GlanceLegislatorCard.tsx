import Link from "next/link";
import LegislatorAvatar from "./LegislatorAvatar";
import { partyInfo, roleLabel, districtNumber } from "../lib/legislator-display";
import type { TopSponsorWithPhoto } from "../lib/legislators";

// Horizontal legislator card for the homepage "NC Legislators at a Glance"
// section: photo, name, party badge, district, and bills-sponsored count.
export default function GlanceLegislatorCard({
  leg,
  rank,
}: {
  leg: TopSponsorWithPhoto;
  rank: number;
}) {
  const party = partyInfo(leg.party);
  const dist = districtNumber(leg.district);

  return (
    <Link
      href={`/legislators/${leg.peopleId}`}
      className="group flex items-center gap-4 rounded-lg border border-gray-200 border-l-4 border-l-gold bg-white p-4 shadow-sm transition-all hover:border-skyblue hover:border-l-gold hover:shadow-md"
    >
      <div className="relative flex-none">
        <LegislatorAvatar name={leg.name} imageUrl={leg.imageUrl} size={60} />
        <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-navy font-mono text-[10px] font-bold text-white ring-2 ring-white">
          {rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold text-navy group-hover:text-navylight">
            {leg.name}
          </span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${party.className}`}>
            {party.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-navylight">
          {roleLabel(leg.role)}
          {dist ? ` · District ${dist}` : ""}
        </p>
      </div>

      <div className="flex-none text-right">
        <div className="font-mono text-2xl font-bold text-ncred">{leg.billCount}</div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-navymuted">
          Bills Sponsored
        </div>
      </div>
    </Link>
  );
}

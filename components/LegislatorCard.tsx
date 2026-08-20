import Link from "next/link";
import { partyInfo, roleLabel, districtNumber } from "../lib/legislator-display";
import LegislatorAvatar from "./LegislatorAvatar";

type Legislator = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  imageUrl: string | null;
};

export default function LegislatorCard({ leg }: { leg: Legislator }) {
  const party = partyInfo(leg.party);
  const dist = districtNumber(leg.district);

  return (
    <Link
      href={`/legislators/${leg.peopleId}`}
      className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 transition-all hover:border-skyblue hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <LegislatorAvatar name={leg.name} imageUrl={leg.imageUrl} size={64} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-navy">{leg.name}</span>
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${party.className}`}>
              {party.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-navylight">
            {roleLabel(leg.role)}
            {dist ? ` · District ${dist}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

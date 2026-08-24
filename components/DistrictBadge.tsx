import type { DistrictBadge as DistrictBadgeData } from "../lib/district-shape";

// Small static silhouette — the whole state very faint, this legislator's
// district filled in solid — so a profile page can show "where" without
// spending real layout space on an interactive map. Pure SVG, no client JS.
export default function DistrictBadge({
  data,
  className = "",
}: {
  data: DistrictBadgeData;
  className?: string;
}) {
  return (
    <svg
      viewBox={data.viewBox}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        {/* Soft halo around the district shape so it reads immediately against
            the banner, not just on close inspection — small districts in
            particular can otherwise disappear into the background. */}
        <filter id="district-badge-glow" x="-75%" y="-75%" width="250%" height="250%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={data.outlineD} fill="currentColor" opacity="0.3" />
      <path d={data.districtD} fill="currentColor" filter="url(#district-badge-glow)" />
    </svg>
  );
}

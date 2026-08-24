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
      <path
        d={data.districtD}
        fill="currentColor"
        stroke="white"
        strokeWidth="0.8"
        strokeOpacity="0.9"
        filter="url(#district-badge-glow)"
      />
      {/* Dense urban districts can shrink to a couple pixels at this scale —
          a real fact about their geography, not a bug (see lib/district-shape).
          A small marker dot guarantees every district reads as something. */}
      {data.marker && (
        <circle
          cx={data.marker.cx}
          cy={data.marker.cy}
          r="3"
          fill="currentColor"
          stroke="white"
          strokeWidth="0.8"
          filter="url(#district-badge-glow)"
        />
      )}
    </svg>
  );
}

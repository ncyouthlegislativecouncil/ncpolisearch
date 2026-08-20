import type { HomeStats } from "../lib/bills";
import CountUp from "./CountUp";

// Small line-icons sitting above each stat number.
function StatIcon({ name }: { name: "bills" | "introduced" | "enacted" | "people" }) {
  const common = {
    className: "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "bills")
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    );
  if (name === "introduced")
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  if (name === "enacted")
    return (
      <svg {...common}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function StatCell({
  value,
  label,
  icon,
  accent,
}: {
  value: number;
  label: string;
  icon: "bills" | "introduced" | "enacted" | "people";
  accent: string;
}) {
  return (
    <div className="flex-1 px-4 py-5 text-center">
      <div className={`mx-auto mb-1.5 flex justify-center ${accent}`}>
        <StatIcon name={icon} />
      </div>
      <CountUp
        value={value}
        className="font-mono text-2xl font-bold text-navy sm:text-3xl"
      />
      <div className="mt-1 text-xs font-medium text-navymuted">{label}</div>
    </div>
  );
}

export default function StatsBar({ stats }: { stats: HomeStats }) {
  return (
    <section className="relative z-10 mx-auto -mt-8 max-w-[1600px] px-6">
      <div className="grid grid-cols-2 divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200 border-t-4 border-t-skyblue bg-white shadow-sm sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <StatCell value={stats.totalBills} label="Bills Tracked" icon="bills" accent="text-navy" />
        <StatCell value={stats.introduced} label="Introduced This Session" icon="introduced" accent="text-gold" />
        <StatCell value={stats.enacted} label="Bills Enacted" icon="enacted" accent="text-lowrisk" />
        <StatCell value={stats.legislators} label="Legislators Tracked" icon="people" accent="text-ncred" />
      </div>
    </section>
  );
}

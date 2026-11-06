"use client";

import { useMemo, useState } from "react";
import RaceCard from "./RaceCard";
import type { RaceView } from "../../lib/elections";

type TabKey = "federal" | "courts" | "amendments" | "nc-senate" | "nc-house" | "close";

const TABS: { key: TabKey; label: string }[] = [
  { key: "federal", label: "Federal" },
  { key: "courts", label: "Courts" },
  { key: "amendments", label: "Amendments" },
  { key: "nc-senate", label: "NC Senate" },
  { key: "nc-house", label: "NC House" },
  { key: "close", label: "Close races" },
];

// "Close" = decided by under 5 points (amendments excluded — they weren't close).
const CLOSE_MARGIN_PTS = 5;
const isClose = (r: RaceView) =>
  r.category !== "amendments" && r.marginPts != null && r.marginPts < CLOSE_MARGIN_PTS;

function matches(race: RaceView, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // A bare number matches that district in any chamber ("67", "District 67").
  const num = q.match(/^(?:district\s*)?(\d+)$/)?.[1];
  if (num) return new RegExp(`\\bDistrict ${parseInt(num, 10)}\\b`).test(race.title);
  const hay = `${race.title} ${race.area} ${race.candidates.map((c) => c.name).join(" ")}`.toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}

export default function ResultsExplorer({ races }: { races: RaceView[] }) {
  const [tab, setTab] = useState<TabKey>("federal");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = races.filter((r) => (t.key === "close" ? isClose(r) : r.category === t.key)).length;
    return c;
  }, [races]);

  // Searching looks across every race, regardless of the selected tab.
  const shown = query.trim()
    ? races.filter((r) => matches(r, query))
    : tab === "close"
      ? races.filter(isClose).sort((a, b) => (a.marginPts ?? 0) - (b.marginPts ?? 0))
      : races.filter((r) => r.category === tab);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Race categories">
        {TABS.map((t) => {
          const active = !query.trim() && tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.key);
                setQuery("");
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-gray-300 bg-white text-navy hover:border-navy"
              }`}
            >
              {t.label} <span className={active ? "text-skyblue" : "text-navymuted"}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label htmlFor="race-search" className="sr-only">
          Search races
        </label>
        <input
          id="race-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a district number or candidate…"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <p className="mt-2 text-xs text-navymuted">
          {query.trim()
            ? `${shown.length} race${shown.length === 1 ? "" : "s"} matching “${query.trim()}”`
            : tab === "close"
              ? `Races decided by fewer than ${CLOSE_MARGIN_PTS} points, closest first.`
              : "Incumbent names link to their legislator profile."}
        </p>
      </div>

      {shown.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((r) => (
            <RaceCard key={r.id} race={r} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-sm text-navymuted">No races match that search.</p>
      )}
    </div>
  );
}

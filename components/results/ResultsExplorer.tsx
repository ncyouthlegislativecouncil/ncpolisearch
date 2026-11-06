"use client";

import { useMemo, useState } from "react";
import RaceCard from "./RaceCard";
import type { RaceView } from "../../lib/elections";

type TabKey = "federal" | "courts" | "amendments" | "nc-senate" | "nc-house" | "flips";

const TABS: { key: TabKey; label: string }[] = [
  { key: "federal", label: "Federal" },
  { key: "courts", label: "Courts" },
  { key: "amendments", label: "Amendments" },
  { key: "nc-senate", label: "NC Senate" },
  { key: "nc-house", label: "NC House" },
  { key: "flips", label: "Flips" },
];

// Battleground = legislative races decided by fewer than this many points,
// based on the actual result rather than anyone's pre-election ratings.
const BATTLEGROUND_MARGIN_PTS = 10;

const isBattleground = (r: RaceView) => r.marginPts != null && r.marginPts < BATTLEGROUND_MARGIN_PTS;

function inTab(r: RaceView, key: TabKey): boolean {
  return key === "flips" ? r.flip != null : r.category === key;
}

const TAB_NOTES: Partial<Record<TabKey, string>> = {
  flips: "Seats where the leading candidate's party differs from the party that held the seat before the election.",
};

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
  const [battlegroundOnly, setBattlegroundOnly] = useState(false);
  const chamberTab = tab === "nc-senate" || tab === "nc-house";

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = races.filter((r) => inTab(r, t.key)).length;
    return c;
  }, [races]);

  // Searching looks across every race, regardless of the selected tab.
  let shown = query.trim() ? races.filter((r) => matches(r, query)) : races.filter((r) => inTab(r, tab));
  if (!query.trim() && chamberTab && battlegroundOnly) {
    shown = shown.filter(isBattleground).sort((a, b) => (a.marginPts ?? 0) - (b.marginPts ?? 0));
  }

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

      {chamberTab && !query.trim() && (
        <div className="relative mt-4 inline-flex">
          {battlegroundOnly && (
            <span
              aria-hidden
              className="absolute -inset-1 rounded-lg bg-gradient-to-r from-republican to-democrat opacity-70 blur-md"
            />
          )}
          <button
            type="button"
            onClick={() => setBattlegroundOnly((v) => !v)}
            aria-pressed={battlegroundOnly}
            className={`relative rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              battlegroundOnly
                ? "bg-white text-navy ring-2 ring-navy"
                : "border border-gray-300 bg-white text-gray-700 hover:border-navy hover:text-navy"
            }`}
          >
            Battleground only ({races.filter((r) => r.category === tab && isBattleground(r)).length})
          </button>
        </div>
      )}

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
            : chamberTab && battlegroundOnly
              ? `Races decided by fewer than ${BATTLEGROUND_MARGIN_PTS} points, closest first.`
              : TAB_NOTES[tab] ?? "Incumbent names link to their legislator profile."}
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

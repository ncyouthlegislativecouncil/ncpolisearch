"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { MethodVotes } from "../../lib/precincts";
import { partyColor } from "./RaceCard";
import { NO_VOTES, SHADES, shadeOf, tallyVotes } from "../../lib/precinct-shade";

const PrecinctMap = dynamic(() => import("./PrecinctMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-gray-100" />,
});

export type PrecinctRow = {
  key: string;
  name: string;
  county: string;
  onMap: boolean;
  votes: MethodVotes[]; // per candidate
};

type Mode = "all" | "ed";
type SortKey = "name" | "margin" | "total";

const sumVotes = (v: MethodVotes) => v[0] + v[1] + v[2] + v[3];
const lastName = (name: string) => name.split(" ").slice(-1)[0];

// Map and precinct table side by side on wide screens (each its own height,
// the table scrolling inside its box), stacked on phones. Hovering or tapping
// a precinct shows its numbers in a box over the map; tapping one scrolls the
// table to it, and clicking a table row finds it on the map.
export default function PrecinctExplorer({
  raceId,
  candidates,
  rows,
}: {
  raceId: string;
  candidates: { name: string; party: string | null }[];
  rows: PrecinctRow[];
}) {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("all");
  const [picked, setPicked] = useState<string | null>(params.get("precinct"));
  const [sort, setSort] = useState<SortKey>("name");
  const tableBox = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());

  const tally = useCallback(
    (row: PrecinctRow) => tallyVotes(row.votes.map((v) => (mode === "all" ? sumVotes(v) : v[0]))),
    [mode]
  );

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const shadeFor = useCallback(
    (key: string) => {
      const row = byKey.get(key);
      return row ? shadeOf(tally(row), candidates) : NO_VOTES;
    },
    [byKey, tally, candidates]
  );

  const sorted = useMemo(() => {
    const list = rows.map((r) => ({ r, t: tally(r) }));
    if (sort === "name") list.sort((a, b) => `${a.r.county} ${a.r.name}`.localeCompare(`${b.r.county} ${b.r.name}`));
    if (sort === "margin") list.sort((a, b) => a.t.margin - b.t.margin);
    if (sort === "total") list.sort((a, b) => b.t.total - a.t.total);
    return list;
  }, [rows, tally, sort]);

  // Scroll only the table's own box (never the page) to bring a row into view.
  const onPick = useCallback((key: string, how: "hover" | "click") => {
    setPicked(key);
    if (how !== "click") return;
    const box = tableBox.current;
    const row = rowEls.current.get(key);
    if (box && row) box.scrollTo({ top: row.offsetTop - box.clientHeight / 2, behavior: "smooth" });
  }, []);

  const pickedRow = picked ? byKey.get(picked) ?? null : null;
  const pickedTally = pickedRow ? tally(pickedRow) : null;
  const unmapped = rows.filter((r) => !r.onMap).length;

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-gray-300 bg-white text-navy hover:border-navy"
    }`;
  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      className={`font-semibold ${sort === key ? "text-navy underline decoration-2 underline-offset-4" : "hover:text-navy"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-navymuted">Shade by</span>
          <button type="button" className={pill(mode === "all")} onClick={() => setMode("all")}>
            All votes
          </button>
          <button type="button" className={pill(mode === "ed")} onClick={() => setMode("ed")}>
            Election Day only
          </button>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-navymuted">
          <span>Close</span>
          {[0, 1, 2, 3].map((b) => (
            <span key={b} className="flex">
              <span className="h-2.5 w-3" style={{ background: SHADES.D[b] }} />
              <span className="h-2.5 w-3" style={{ background: SHADES.R[b] }} />
            </span>
          ))}
          <span>Landslide</span>
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:h-[600px] lg:grid-cols-12">
        {/* Map, with the precinct details floating over its corner on wide screens. */}
        {/* `isolate` keeps Leaflet's high z-indexes from drawing over the site header. */}
        <div className="relative isolate lg:col-span-7 lg:h-full">
          <div className="h-[380px] rounded-lg border border-gray-200 bg-white p-2 lg:h-full">
            <PrecinctMap
              url={`/maps/precincts/${raceId}.geojson`}
              shadeFor={shadeFor}
              selectedKey={picked}
              onPick={onPick}
              version={mode}
            />
          </div>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm lg:absolute lg:right-3 lg:top-3 lg:z-[1000] lg:mt-0 lg:w-64 lg:bg-white/95 lg:shadow-md lg:backdrop-blur">
            {pickedRow && pickedTally ? (
              <>
                <p className="text-xs text-navymuted">{pickedRow.county} County</p>
                <p className="font-serif text-lg font-bold leading-tight text-navy">{pickedRow.name}</p>
                <ul className="mt-2 space-y-1">
                  {candidates.map((c, i) => (
                    <li key={c.name} className="flex justify-between gap-2">
                      <span className="truncate text-navy">
                        {lastName(c.name)} <span className={`text-xs font-semibold ${partyColor(c).text}`}>({c.party})</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs leading-5">
                        {pickedTally.votes[i].toLocaleString("en-US")}
                        {pickedTally.total > 0 && ` · ${((100 * pickedTally.votes[i]) / pickedTally.total).toFixed(1)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-navymuted">
                  {pickedTally.leader >= 0
                    ? `${candidates[pickedTally.leader].party ?? ""} +${pickedTally.margin.toFixed(1)} pts · ${pickedTally.total.toLocaleString("en-US")} votes`
                    : "No votes counted here"}
                  {mode === "ed" ? " (Election Day)" : ""}
                  {!pickedRow.onMap && " · not on the map"}
                </p>
              </>
            ) : (
              <p className="text-navymuted">Hover over or tap a precinct to see its results.</p>
            )}
          </div>
        </div>

        {/* Precinct table: scrolls inside its own box. */}
        <div className="flex h-[480px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white lg:col-span-5 lg:h-full">
          <div ref={tableBox} className="relative flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-pagebg text-left text-xs text-navymuted shadow-[0_1px_0_#e5e7eb]">
                <tr>
                  <th className="px-3 py-2">{sortBtn("name", "Precinct")}</th>
                  {candidates.map((c) => (
                    <th key={c.name} className={`px-2 py-2 text-right font-semibold ${partyColor(c).text}`}>
                      {lastName(c.name)}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right">{sortBtn("total", "Votes")}</th>
                  <th className="px-3 py-2 text-right">{sortBtn("margin", "Margin")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ r, t }) => (
                  <tr
                    key={r.key}
                    ref={(el) => {
                      if (el) rowEls.current.set(r.key, el);
                      else rowEls.current.delete(r.key);
                    }}
                    onClick={() => setPicked(r.key)}
                    onMouseEnter={() => setPicked(r.key)}
                    className={`cursor-pointer border-t border-gray-100 hover:bg-badge ${picked === r.key ? "bg-badge" : ""}`}
                  >
                    <td className="px-3 py-1.5 text-navy">
                      <span className="block leading-tight">{r.name}</span>
                      <span className="text-[11px] text-navymuted">
                        {r.county}
                        {!r.onMap && " · not mapped"}
                      </span>
                    </td>
                    {t.votes.map((v, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono text-xs">
                        {v.toLocaleString("en-US")}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{t.total.toLocaleString("en-US")}</td>
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right font-mono text-xs font-semibold ${
                        t.leader >= 0 ? partyColor(candidates[t.leader]).text : ""
                      }`}
                    >
                      {t.leader >= 0 ? `${candidates[t.leader].party ?? ""} +${t.margin.toFixed(1)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-navymuted">
            {rows.length} precincts · sort with the column headings
            {unmapped > 0 &&
              ` · ${unmapped} redrawn after the State Board's latest boundary file, so they're listed but not mapped`}
          </p>
        </div>
      </div>
    </div>
  );
}

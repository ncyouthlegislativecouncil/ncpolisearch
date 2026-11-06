"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { MethodVotes } from "../../lib/precincts";
import { partyColor } from "./RaceCard";

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

// Shades by who leads the precinct and by how much (percentage points).
const SHADES: Record<string, string[]> = {
  D: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"],
  R: ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c"],
  other: ["#e5e7eb", "#c4c6d8", "#9a9dc4", "#7a7eb8"],
};
const BIN_EDGES = [5, 15, 30]; // < 5, 5–15, 15–30, 30+

const sumVotes = (v: MethodVotes) => v[0] + v[1] + v[2] + v[3];

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

  const tally = useCallback(
    (row: PrecinctRow) => {
      const votes = row.votes.map((v) => (mode === "all" ? sumVotes(v) : v[0]));
      const total = votes.reduce((a, b) => a + b, 0);
      const order = votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      const lead = order[0];
      const margin = total > 0 && order.length > 1 ? (100 * (order[0].v - order[1].v)) / total : total > 0 ? 100 : 0;
      return { votes, total, leader: total > 0 ? lead.i : -1, margin };
    },
    [mode]
  );

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const shadeFor = useCallback(
    (key: string) => {
      const row = byKey.get(key);
      if (!row) return "#f3f4f6";
      const t = tally(row);
      if (t.leader < 0) return "#f3f4f6";
      const party = candidates[t.leader].party;
      const ramp = SHADES[party === "D" || party === "R" ? party : "other"];
      const bin = BIN_EDGES.filter((e) => t.margin >= e).length;
      return ramp[bin];
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

  const pickedRow = picked ? byKey.get(picked) ?? null : null;
  const pickedTally = pickedRow ? tally(pickedRow) : null;
  const unmapped = rows.filter((r) => !r.onMap).length;

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-gray-300 bg-white text-navy hover:border-navy"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-navymuted">Shade by</span>
        <button type="button" className={pill(mode === "all")} onClick={() => setMode("all")}>
          All votes
        </button>
        <button type="button" className={pill(mode === "ed")} onClick={() => setMode("ed")}>
          Election Day only
        </button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="h-[420px] rounded-lg border border-gray-200 bg-white p-2 lg:col-span-2">
          <PrecinctMap
            url={`/maps/precincts/${raceId}.geojson`}
            shadeFor={shadeFor}
            selectedKey={picked}
            onPick={setPicked}
            version={`${mode}|${picked ?? ""}`}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          {pickedRow && pickedTally ? (
            <>
              <p className="text-xs text-navymuted">{pickedRow.county} County</p>
              <p className="font-serif text-lg font-bold text-navy">{pickedRow.name}</p>
              <ul className="mt-3 space-y-1.5">
                {candidates.map((c, i) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="text-navy">
                      {c.name} <span className={`text-xs font-semibold ${partyColor(c).text}`}>({c.party})</span>
                    </span>
                    <span className="font-mono">
                      {pickedTally.votes[i].toLocaleString("en-US")}
                      {pickedTally.total > 0 && ` · ${((100 * pickedTally.votes[i]) / pickedTally.total).toFixed(1)}%`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-navymuted">
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
          <div className="mt-4 flex items-center gap-1 text-[11px] text-navymuted">
            <span>Close</span>
            {[0, 1, 2, 3].map((b) => (
              <span key={b} className="flex">
                <span className="h-2.5 w-3" style={{ background: SHADES.D[b] }} />
                <span className="h-2.5 w-3" style={{ background: SHADES.R[b] }} />
              </span>
            ))}
            <span>Landslide</span>
          </div>
          {unmapped > 0 && (
            <p className="mt-2 text-[11px] text-navymuted">
              {unmapped} precinct{unmapped === 1 ? " was" : "s were"} redrawn after the State Board&apos;s latest
              boundary file, so {unmapped === 1 ? "it's" : "they're"} in the table but not on the map.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-pagebg text-left text-xs text-navymuted">
            <tr>
              <th className="px-3 py-2 font-semibold">
                <button type="button" onClick={() => setSort("name")} className={sort === "name" ? "text-navy" : ""}>
                  Precinct
                </button>
              </th>
              {candidates.map((c) => (
                <th key={c.name} className="px-3 py-2 text-right font-semibold">
                  {c.name.split(" ").slice(-1)[0]} ({c.party})
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">
                <button type="button" onClick={() => setSort("total")} className={sort === "total" ? "text-navy" : ""}>
                  Votes
                </button>
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                <button type="button" onClick={() => setSort("margin")} className={sort === "margin" ? "text-navy" : ""}>
                  Margin
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ r, t }) => (
              <tr
                key={r.key}
                onClick={() => setPicked(r.key)}
                className={`cursor-pointer border-t border-gray-100 hover:bg-badge ${picked === r.key ? "bg-badge" : ""}`}
              >
                <td className="px-3 py-2 text-navy">
                  {r.name}
                  <span className="ml-1 text-xs text-navymuted">{r.county}</span>
                  {!r.onMap && <span className="ml-1 text-[10px] text-navymuted">(not mapped)</span>}
                </td>
                {t.votes.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right font-mono">
                    {v.toLocaleString("en-US")}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono">{t.total.toLocaleString("en-US")}</td>
                <td className={`px-3 py-2 text-right font-mono ${t.leader >= 0 ? partyColor(candidates[t.leader]).text : ""}`}>
                  {t.leader >= 0 ? `${candidates[t.leader].party ?? ""} +${t.margin.toFixed(1)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-gray-100 px-3 py-2 text-xs text-navymuted">
          Sort by precinct, votes, or margin using the column headings. Click a row to find it on the map.
        </p>
      </div>
    </div>
  );
}

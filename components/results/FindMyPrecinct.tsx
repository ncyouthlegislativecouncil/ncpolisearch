"use client";

import { useState } from "react";
import Link from "next/link";
import type { RacePrecincts } from "../../lib/precincts";
import { partyColor } from "./RaceCard";

type Located = { district: number; raceId: string; precinct: { key: string; name: string } | null };
type Found = { matchedAddress: string; house: Located | null; senate: Located | null };

type Line = { name: string; party: string | null; votes: number };

// Totals for every row of a race, and for one precinct.
function summarize(data: RacePrecincts, key: string | null) {
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const all = [...data.precincts, ...data.other];
  const district: Line[] = data.candidates.map((c, i) => ({ ...c, votes: all.reduce((n, r) => n + sum(r.votes[i]), 0) }));
  const row = key ? data.precincts.find((p) => p.key === key) : undefined;
  const precinct: Line[] | null = row ? data.candidates.map((c, i) => ({ ...c, votes: sum(row.votes[i]) })) : null;
  return { district, precinct };
}

function Lines({ lines }: { lines: Line[] }) {
  const total = lines.reduce((n, l) => n + l.votes, 0);
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l.name} className="flex justify-between gap-2 text-sm">
          <span className="text-navy">
            {l.name} <span className={`text-xs font-semibold ${partyColor(l).text}`}>({l.party})</span>
          </span>
          <span className={`font-mono font-semibold ${partyColor(l).text}`}>
            {total > 0 ? `${((100 * l.votes) / total).toFixed(1)}%` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RaceResult({ label, loc, data }: { label: string; loc: Located; data: RacePrecincts | null }) {
  const s = data ? summarize(data, loc.precinct?.key ?? null) : null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="font-serif text-lg font-bold text-navy">
        {label} District {loc.district}
      </p>
      {s ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navymuted">Your precinct</p>
            {s.precinct ? <Lines lines={s.precinct} /> : <p className="text-sm text-navymuted">No precinct-level results for this address.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navymuted">Whole district</p>
            <Lines lines={s.district} />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-navymuted">Loading results…</p>
      )}
      <Link
        href={`/results/${loc.raceId}${loc.precinct ? `?precinct=${encodeURIComponent(loc.precinct.key)}` : ""}`}
        className="mt-3 inline-block text-sm font-semibold text-navy hover:text-skyblue"
      >
        See it on the precinct map →
      </Link>
    </div>
  );
}

export default function FindMyPrecinct() {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [races, setRaces] = useState<Record<string, RacePrecincts>>({});

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (address.trim().length < 5) {
      setError("Enter a full street address, city, and ZIP.");
      return;
    }
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      // POST so the address never ends up in a URL or server logs.
      const res = await fetch("/api/find-precinct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      setFound(data);
      for (const loc of [data.house, data.senate] as (Located | null)[]) {
        if (!loc) continue;
        fetch(`/elections/2026-general/${loc.raceId}.json`)
          .then((r) => r.json())
          .then((d: RacePrecincts) => setRaces((prev) => ({ ...prev, [loc.raceId]: d })))
          .catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl font-bold text-navy">Find my precinct</h2>
      <p className="mt-1 text-sm text-navymuted">
        Enter your address to see how your precinct voted for NC House and NC Senate.
      </p>
      <form onSubmit={lookup} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="precinct-address" className="sr-only">
          Street address
        </label>
        <input
          id="precinct-address"
          type="text"
          autoComplete="street-address"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
          }}
          placeholder="1 E Edenton St, Raleigh, NC 27601"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navylight disabled:opacity-60"
        >
          {busy ? "Looking up…" : "Find my precinct"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-ncred">{error}</p>}
      <p className="mt-2 text-[11px] text-navymuted">
        Your address is sent to the US Census Bureau&apos;s free address lookup to find its location. NCPoliSearch
        doesn&apos;t store it.
      </p>

      {found && (
        <div className="mt-4">
          <p className="text-sm text-navy">
            <span className="font-semibold">{found.matchedAddress}</span>
            {(found.house?.precinct ?? found.senate?.precinct) && (
              <span className="text-navymuted"> · Precinct: {(found.house?.precinct ?? found.senate?.precinct)!.name}</span>
            )}
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {found.house && <RaceResult label="NC House" loc={found.house} data={races[found.house.raceId] ?? null} />}
            {found.senate && <RaceResult label="NC Senate" loc={found.senate} data={races[found.senate.raceId] ?? null} />}
          </div>
        </div>
      )}
    </section>
  );
}

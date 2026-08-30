"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { STATUS_OPTIONS } from "../lib/status";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";

export default function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  function pushParams(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/bills?${qs}` : "/bills");
  }

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  }

  // Live search — updates the URL (and re-fetches results) shortly after the
  // user stops typing, so results filter as you go instead of waiting for
  // Enter/Search. The button and Enter key still work too, for anyone who
  // wants it to apply immediately.
  useDebouncedEffect(search, 350, (value) => update("search", value.trim()));

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update("search", search.trim());
  }

  const selectClass =
    "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

  const party = params.get("party") ?? "";
  const isBipartisan = party === "Bipartisan";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={submitSearch} className="flex flex-1 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by bill number or title…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <button
          type="submit"
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
        >
          Search
        </button>
      </form>

      <select
        value={params.get("chamber") ?? ""}
        onChange={(e) => update("chamber", e.target.value)}
        className={selectClass}
      >
        <option value="">All Chambers</option>
        <option value="H">House</option>
        <option value="S">Senate</option>
      </select>

      <select
        value={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className={selectClass}
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={isBipartisan ? "" : party}
        onChange={(e) => update("party", e.target.value)}
        className={selectClass}
      >
        <option value="">All Parties</option>
        <option value="Republican">Republican</option>
        <option value="Democrat">Democrat</option>
      </select>

      <select
        value={params.get("sort") ?? "newest"}
        onChange={(e) => update("sort", e.target.value)}
        className={selectClass}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="title">Title A–Z</option>
      </select>

      {/* Standalone toggle, not a dropdown option — bipartisan bills (real
          cross-party support, not just a token minority sponsor) get a red/blue
          glow behind the button so it visually reads as "both sides" at a glance. */}
      <div className="relative inline-flex">
        {isBipartisan && (
          <span
            aria-hidden
            className="absolute -inset-1 rounded-lg bg-gradient-to-r from-republican to-democrat opacity-70 blur-md"
          />
        )}
        <button
          type="button"
          onClick={() => update("party", isBipartisan ? "" : "Bipartisan")}
          aria-pressed={isBipartisan}
          className={`relative rounded-md px-4 py-2 text-sm font-semibold transition-all ${
            isBipartisan
              ? "bg-white text-navy ring-2 ring-navy"
              : "border border-gray-300 bg-white text-gray-700 hover:border-navy hover:text-navy"
          }`}
        >
          Bipartisan
        </button>
      </div>
    </div>
  );
}

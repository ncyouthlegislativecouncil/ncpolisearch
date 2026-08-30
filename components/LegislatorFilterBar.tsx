"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";

export default function LegislatorFilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/legislators?${qs}` : "/legislators");
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={submitSearch} className="flex flex-1 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search legislators by name…"
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
        <option value="House">House</option>
        <option value="Senate">Senate</option>
      </select>

      <select
        value={params.get("party") ?? ""}
        onChange={(e) => update("party", e.target.value)}
        className={selectClass}
      >
        <option value="">All Parties</option>
        <option value="Republican">Republican</option>
        <option value="Democrat">Democrat</option>
      </select>
    </div>
  );
}

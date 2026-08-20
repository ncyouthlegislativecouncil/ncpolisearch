"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function LegislatorFilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/legislators?${qs}` : "/legislators");
  }

  const selectClass =
    "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
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

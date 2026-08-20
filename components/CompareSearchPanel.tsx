"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BillSearchResult } from "../lib/bills";
import { chamberLabel, statusInfo } from "../lib/status";

// Empty-state search panel for one side of the compare view. Lets the user
// type a bill number/keyword, pick from live results, and updates the URL
// (?left= / ?right=) so the server can render the chosen bill.
export default function CompareSearchPanel({
  side,
  left,
  right,
}: {
  side: "left" | "right";
  left?: string;
  right?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BillSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search against the typeahead API.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bills/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // Aborted or failed — leave previous results untouched.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function select(billId: number) {
    const params = new URLSearchParams();
    // Preserve the other side's selection while setting this one.
    const nextLeft = side === "left" ? String(billId) : left;
    const nextRight = side === "right" ? String(billId) : right;
    if (nextLeft) params.set("left", nextLeft);
    if (nextRight) params.set("right", nextRight);
    router.push(`/compare?${params.toString()}`);
  }

  return (
    <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-white p-6">
      <p className="section-label mb-1">
        {side === "left" ? "First Bill" : "Second Bill"}
      </p>
      <p className="mb-4 text-sm text-navymuted">Search for a bill to compare</p>

      <div ref={boxRef} className="relative w-full max-w-sm">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Bill number or keyword…"
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm text-navy placeholder:text-gray-400 focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue"
        />

        {open && (loading || results.length > 0) && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {loading && results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-navymuted">Searching…</li>
            ) : (
              results.map((r) => {
                const status = statusInfo(r.status ?? "");
                return (
                  <li key={r.billId}>
                    <button
                      type="button"
                      onClick={() => select(r.billId)}
                      className="flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-2.5 text-left last:border-0 hover:bg-skyblue/10"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-navy">
                          {r.billNumber}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                        {chamberLabel(r.chamber) && (
                          <span className="font-mono text-[10px] text-navymuted">
                            {chamberLabel(r.chamber)}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs text-gray-600">
                        {r.title}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

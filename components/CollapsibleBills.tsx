"use client";

import { useState } from "react";
import BillCard from "./BillCard";

type BillRow = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  aiSummary?: string | null;
};

// Mobile gets a tighter collapse than desktop — 9 stacked full bill cards in a
// single mobile column was a lot of scrolling before finding "show more".
// Rather than detect viewport width in JS (which would either mismatch the
// server-rendered HTML or flash between counts on load), every card is
// rendered up front and per-card CSS classes decide what's visible at each
// breakpoint — this stays correct on the very first paint, no client-only
// state needed for it.
const MOBILE_VISIBLE = 3;
const DESKTOP_VISIBLE = 9;

export default function CollapsibleBills({
  title,
  bills,
}: {
  title: string;
  bills: BillRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = bills.length > MOBILE_VISIBLE;
  const mobileHiddenCount = bills.length - MOBILE_VISIBLE;
  const desktopHiddenCount = bills.length - DESKTOP_VISIBLE;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-bold text-navy">
        {title}{" "}
        <span className="text-base font-normal text-navymuted">({bills.length})</span>
      </h2>
      {bills.length > 0 ? (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bills.map((bill, i) => {
              // Below the mobile cutoff but within the desktop one: hidden on
              // mobile only, unless expanded. Below the desktop cutoff too:
              // hidden everywhere, unless expanded.
              const cls = expanded
                ? ""
                : i >= DESKTOP_VISIBLE
                  ? "hidden"
                  : i >= MOBILE_VISIBLE
                    ? "hidden sm:block"
                    : "";
              return (
                <div key={bill.billId} className={cls}>
                  <BillCard bill={bill} />
                </div>
              );
            })}
          </div>
          {canCollapse && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              // When there are 4-8 bills, mobile needs collapsing but desktop
              // doesn't (everything's already under DESKTOP_VISIBLE) — hide
              // the button on sm+ in that case rather than show a "more"
              // count of zero or negative.
              className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white py-2.5 text-sm font-medium text-navy transition-colors hover:border-skyblue hover:text-skyblue ${
                !expanded && desktopHiddenCount <= 0 ? "sm:hidden" : ""
              }`}
            >
              {expanded ? (
                <>
                  Show less
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Show {mobileHiddenCount} more</span>
                  <span className="hidden sm:inline">Show {desktopHiddenCount} more</span>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-navymuted">No bills in this category.</p>
      )}
    </section>
  );
}

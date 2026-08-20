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

const INITIAL_VISIBLE = 9;

export default function CollapsibleBills({
  title,
  bills,
}: {
  title: string;
  bills: BillRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = bills.length > INITIAL_VISIBLE;
  const visible = expanded || !canCollapse ? bills : bills.slice(0, INITIAL_VISIBLE);
  const hiddenCount = bills.length - INITIAL_VISIBLE;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl font-bold text-navy">
        {title}{" "}
        <span className="text-base font-normal text-navymuted">({bills.length})</span>
      </h2>
      {bills.length > 0 ? (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((bill) => (
              <BillCard key={bill.billId} bill={bill} />
            ))}
          </div>
          {canCollapse && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white py-2.5 text-sm font-medium text-navy transition-colors hover:border-skyblue hover:text-skyblue"
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
                  Show {hiddenCount} more
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

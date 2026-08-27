"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DistrictBadge from "./DistrictBadge";
import type { DistrictBadge as DistrictBadgeData } from "../lib/district-shape";

// The banner badge is deliberately small and whole-state (so it reads
// immediately as "North Carolina"), which means a small urban district can
// still be hard to make out at that size. Clicking it opens this modal —
// the SAME silhouette data, just rendered much bigger, so the district
// becomes easy to see without cropping the state down to an unrecognizable
// fragment (see lib/district-shape.ts for why that earlier approach was
// dropped).
export default function DistrictBadgeModal({
  data,
  chamberLabel,
  district,
  legislatorName,
  buttonClassName,
  idPrefix = "district-badge-glow",
}: {
  data: DistrictBadgeData;
  chamberLabel: string;
  district: number;
  legislatorName: string | null;
  buttonClassName: string;
  // The profile page renders a mobile AND a desktop copy of this component at
  // once (CSS hides whichever doesn't apply — it stays mounted), so their SVG
  // filter ids would collide unless each caller passes a distinct prefix.
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* buttonClassName carries the real sizing/positioning (e.g. "absolute
          right-4 top-1/2 h-32 ..."). It has to live on the button itself, not
          just the inner svg — a bare <button> has no defined height, so an
          h-full on a child resolves against that auto height and collapses
          to nothing, which is why the badge disappeared entirely. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Show ${chamberLabel} District ${district} on a larger map of North Carolina`}
        className={`cursor-pointer border-0 bg-transparent p-0 transition-opacity hover:opacity-80 ${buttonClassName}`}
      >
        <DistrictBadge data={data} className="h-full w-auto" filterId={idPrefix} />
      </button>

      {open &&
        createPortal(
          // Portaled straight to <body> — this component renders inside
          // PageTransition's motion.div, which Framer Motion gives an inline
          // `transform`. Any ancestor with a transform becomes a new CSS
          // containing block, which breaks `position: fixed` (it positions
          // relative to that ancestor instead of the viewport). Portaling
          // escapes that entirely so the overlay actually covers the screen.
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${chamberLabel} District ${district} map`}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative w-full max-w-3xl rounded-lg border border-white/10 bg-navy p-6 shadow-2xl sm:p-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <p className="text-center font-mono text-xs font-semibold uppercase tracking-widest text-gold">
                North Carolina {chamberLabel}
              </p>
              <h3 className="mt-1 text-center font-serif text-xl font-bold text-white">
                {legislatorName ? `${legislatorName} — ` : ""}District {district}
              </h3>

              <DistrictBadge
                data={data}
                filterId={`${idPrefix}-modal`}
                className="mx-auto mt-6 h-[46vh] w-full max-w-full text-gold"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

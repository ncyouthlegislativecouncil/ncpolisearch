"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "ncps-results-promo-closed";

// Small floating card on the home page pointing to the 2026 election results.
// Slides in after a moment; closing it hides it for this browser.
export default function ResultsPromo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let closed = false;
    try {
      closed = localStorage.getItem(KEY) === "1";
    } catch {
      // storage blocked: just show it
    }
    if (closed) return;
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-xs transition-all duration-500 ease-out print:hidden sm:bottom-6 sm:right-6 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
      aria-hidden={!show}
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#c9a84c] bg-navy p-4 pr-10 text-white shadow-[0_10px_30px_rgba(26,31,143,0.35)]">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#c9a84c]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9a84c] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c9a84c]" />
          </span>
          New
        </p>
        <p className="mt-1 font-serif text-lg font-bold leading-snug">2026 election results are out</p>
        <p className="mt-1 text-sm text-skyblue">
          Every race, precinct maps, turnout, and who flipped seats.
        </p>
        <Link
          href="/results"
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#c9a84c] px-4 py-1.5 text-sm font-bold text-navy transition-transform hover:translate-x-0.5"
        >
          See the results →
        </Link>
      </div>
    </div>
  );
}

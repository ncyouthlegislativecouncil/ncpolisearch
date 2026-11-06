"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const PrecinctMap = dynamic(() => import("./PrecinctMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded bg-gray-100" />,
});

// Still precinct map for the printable report. When the page was opened with
// ?print=1 (the "Download PDF report" button), the print dialog opens once the
// map has finished drawing, so "Save as PDF" captures it.
export default function ReportMap({ raceId, shades }: { raceId: string; shades: Record<string, string> }) {
  const printed = useRef(false);
  const shadeFor = useCallback((key: string) => shades[key] ?? "#f3f4f6", [shades]);
  const onReady = useCallback(() => {
    if (printed.current || !new URLSearchParams(window.location.search).has("print")) return;
    printed.current = true;
    setTimeout(() => window.print(), 400);
  }, []);
  return (
    <PrecinctMap
      url={`/maps/precincts/${raceId}.geojson`}
      shadeFor={shadeFor}
      selectedKey={null}
      version="report"
      still
      onReady={onReady}
    />
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-navylight"
    >
      Print / Save as PDF
    </button>
  );
}

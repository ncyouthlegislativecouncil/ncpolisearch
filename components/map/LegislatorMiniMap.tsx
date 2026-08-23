"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { FeatureCollection } from "geojson";

type Chamber = "house" | "senate";

// Leaflet touches `window`, so the map is client-only — never server-rendered.
// Reuses the same interactive DistrictMap that powers /map, just pinned to one
// district with nothing clickable, so a profile page can show "where is this
// person's district, relative to the rest of the state" at a glance.
const DistrictMap = dynamic(() => import("./DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f8fafc] text-sm text-navymuted">
      Loading map…
    </div>
  ),
});

export default function LegislatorMiniMap({
  chamber,
  district,
  partyMap,
}: {
  chamber: Chamber;
  district: number;
  partyMap: Record<number, string>;
}) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [outline, setOutline] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/maps/nc-${chamber}.geojson`)
      .then((r) => r.json())
      .then((j: FeatureCollection) => {
        if (active) setGeojson(j);
      })
      .catch(() => {
        /* a failed map load just leaves the card empty; not fatal. */
      });
    return () => {
      active = false;
    };
  }, [chamber]);

  useEffect(() => {
    let active = true;
    fetch("/maps/nc-outline.geojson")
      .then((r) => r.json())
      .then((j: FeatureCollection) => {
        if (active) setOutline(j);
      })
      .catch(() => {
        /* the outline is purely decorative; ignore failures. */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 className="font-serif text-lg font-bold text-navy">
          District {district} on the Map
        </h2>
        <Link
          href="/map"
          className="text-xs font-semibold text-navylight hover:text-skyblue"
        >
          Full interactive map →
        </Link>
      </div>
      <div className="relative h-72 w-full sm:h-96">
        <DistrictMap
          chamber={chamber}
          geojson={geojson}
          outline={outline}
          partyMap={partyMap}
          selectedDistrict={district}
          onSelect={() => {
            /* Read-only here — a single legislator's district is already
               selected. Exploring other districts happens on the full /map. */
          }}
        />
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { FeatureCollection } from "geojson";
import type { DistrictLegislator, DistrictPartyMap } from "../../lib/district";
import LegislatorPanel from "./LegislatorPanel";

type Chamber = "house" | "senate";

// Leaflet touches `window`, so the map is client-only — never server-rendered.
const DistrictMap = dynamic(() => import("./DistrictMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f8fafc] text-sm text-navymuted">
      Loading map…
    </div>
  ),
});

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[#c9a84c] text-navy"
          : "border border-navy bg-white text-navy hover:bg-[#c9a84c] hover:text-navy hover:border-[#c9a84c]"
      }`}
    >
      {children}
    </button>
  );
}

export default function MapExplorer({ partyMap }: { partyMap: DistrictPartyMap }) {
  const [chamber, setChamber] = useState<Chamber>("house");
  const [geo, setGeo] = useState<Record<Chamber, FeatureCollection | null>>({
    house: null,
    senate: null,
  });
  const [outline, setOutline] = useState<FeatureCollection | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [data, setData] = useState<DistrictLegislator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch each chamber's GeoJSON the first time it's shown, then cache it so
  // toggling back is instant.
  useEffect(() => {
    if (geo[chamber]) return;
    let active = true;
    fetch(`/maps/nc-${chamber}.geojson`)
      .then((r) => r.json())
      .then((j: FeatureCollection) => {
        if (active) setGeo((g) => ({ ...g, [chamber]: j }));
      })
      .catch(() => {
        /* a failed map load just leaves the panel empty; not fatal. */
      });
    return () => {
      active = false;
    };
  }, [chamber, geo]);

  // The dissolved state silhouette is shared by both chambers; load it once.
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

  // Fetch legislator data only when a district is clicked, not all upfront.
  const handleSelect = useCallback(
    async (district: number) => {
      setSelected(district);
      setData(null);
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/legislators/district?chamber=${chamber}&district=${district}`
        );
        if (!res.ok) {
          setError(
            res.status === 404
              ? "No legislator on record for this district."
              : "Couldn't load legislator data."
          );
        } else {
          const j = await res.json();
          setData(j.legislator as DistrictLegislator);
        }
      } catch {
        setError("Couldn't load legislator data.");
      } finally {
        setLoading(false);
      }
    },
    [chamber]
  );

  const closePanel = useCallback(() => {
    setSelected(null);
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  const switchChamber = (c: Chamber) => {
    if (c === chamber) return;
    setChamber(c);
    closePanel();
  };

  // The floating card is shown whenever a district is selected (loading, loaded,
  // or errored). No selection means no card — the map stands alone.
  const panelOpen = selected != null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 rounded-xl border-b-4 border-[#c9a84c] bg-navy px-6 py-5 shadow-sm">
        <h1 className="font-serif text-2xl font-bold text-white sm:text-3xl">
          NC Legislative District Map
        </h1>
        <p className="mt-1 text-sm text-skyblue">
          Click a district to see who represents it.
        </p>
      </div>

      {/* Chamber toggle. */}
      <div className="mb-4 flex gap-2">
        <ToggleButton active={chamber === "house"} onClick={() => switchChamber("house")}>
          House Districts
        </ToggleButton>
        <ToggleButton active={chamber === "senate"} onClick={() => switchChamber("senate")}>
          Senate Districts
        </ToggleButton>
      </div>

      {/* Full-width map. The legislator card floats over it (top-right on
          desktop, bottom sheet on mobile) and only appears once a district is
          clicked — there's no persistent placeholder column. */}
      <div className="relative z-0 h-[62vh] overflow-hidden rounded-xl border border-gray-200 border-t-[3px] border-t-[#c9a84c] shadow-lg lg:h-[78vh]">
        <DistrictMap
          chamber={chamber}
          geojson={geo[chamber]}
          outline={outline}
          partyMap={chamber === "house" ? partyMap.house : partyMap.senate}
          selectedDistrict={selected}
          onSelect={handleSelect}
        />

        {panelOpen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center p-3 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:justify-end sm:p-0">
            <div className="pointer-events-auto relative max-h-[55vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 border-l-4 border-l-[#c9a84c] bg-white/95 p-5 shadow-xl backdrop-blur-sm sm:max-h-[calc(78vh-2rem)] sm:w-[360px]">
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close legislator panel"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-navymuted transition-colors hover:bg-gray-200 hover:text-navy"
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
              <LegislatorPanel
                data={data}
                loading={loading}
                error={error}
                selectedDistrict={selected}
                chamber={chamber}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

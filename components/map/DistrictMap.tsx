"use client";

import { useEffect, useRef } from "react";
import { MapContainer, GeoJSON, Pane } from "react-leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Chamber = "house" | "senate";

// NC bounding box — fits the whole state on load. Padded slightly so the
// outline never sits flush against the frame.
const NC_BOUNDS: L.LatLngBoundsExpression = [
  [33.75, -84.45],
  [36.65, -75.4],
];

const SELECTED = "#8ec6e8";
const NAVY = "#1a1f8f";
const NCRED = "#8c1616";

// Very subtle partisan tint; the selected district overrides this with skyblue.
function fillColor(party: string | undefined, selected: boolean): string {
  if (selected) return SELECTED;
  if (party === "R") return "#fde8e8";
  if (party === "D") return "#dbeafe";
  return "#eef2f7";
}

// Republican districts get an NC-red border; everything else uses navy. The
// selected district is always navy.
function borderColor(party: string | undefined, selected: boolean): string {
  if (selected) return NAVY;
  if (party === "R") return NCRED;
  return NAVY;
}

function districtOf(feature: Feature | undefined): number | null {
  const raw = feature?.properties?.DISTRICT;
  if (raw == null) return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

const OUTLINE_STYLE: L.PathOptions = {
  fillColor: "#ffffff",
  fillOpacity: 1,
  color: "#cbd5e1",
  weight: 1,
  opacity: 1,
};

export default function DistrictMap({
  chamber,
  geojson,
  outline,
  partyMap,
  selectedDistrict,
  onSelect,
}: {
  chamber: Chamber;
  geojson: FeatureCollection | null;
  outline: FeatureCollection | null;
  partyMap: Record<number, string>;
  selectedDistrict: number | null;
  onSelect: (district: number) => void;
}) {
  const geoRef = useRef<L.GeoJSON | null>(null);
  // Event handlers are bound once per feature, so read live selection from a ref
  // rather than closing over a stale prop.
  const selectedRef = useRef<number | null>(selectedDistrict);
  selectedRef.current = selectedDistrict;
  // Tracks the district currently showing the hover highlight so we can clear it
  // even when its own mouseout event is missed (see onEachFeature).
  const hoveredRef = useRef<L.Path | null>(null);

  const styleFn = (feature?: Feature<Geometry, GeoJsonProperties>): L.PathOptions => {
    const d = districtOf(feature);
    const party = d != null ? partyMap[d] : undefined;
    const selected = d != null && d === selectedRef.current;
    return {
      fillColor: fillColor(party, selected),
      fillOpacity: selected ? 0.85 : 0.55,
      color: borderColor(party, selected),
      weight: selected ? 3 : 1.5,
      opacity: selected ? 1 : 0.85,
    };
  };

  // Re-apply styles whenever the selection (or chamber's party map) changes so
  // the previously-selected district reverts and the new one highlights.
  useEffect(() => {
    geoRef.current?.setStyle(styleFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrict, partyMap]);

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const d = districtOf(feature);
    if (d == null) return;
    const path = layer as L.Path;
    path.bindTooltip(`District ${d}`, {
      sticky: true,
      direction: "top",
      className: "district-tip",
      opacity: 1,
    });
    path.on({
      mouseover: () => {
        // Moving the mouse quickly between districts can drop the previous
        // layer's mouseout event (Leaflet reorders SVG paths on bringToFront),
        // leaving it stuck highlighted. Reset whatever was last hovered before
        // highlighting the new district. resetStyle re-applies styleFn, which
        // restores the selected look for the selected district.
        const prev = hoveredRef.current;
        if (prev && prev !== path) geoRef.current?.resetStyle(prev);
        hoveredRef.current = path;
        if (d === selectedRef.current) return;
        path.setStyle({
          fillColor: SELECTED,
          fillOpacity: 0.7,
          color: NAVY,
          weight: 2,
          opacity: 1,
        });
        path.bringToFront();
      },
      mouseout: () => {
        if (hoveredRef.current === path) hoveredRef.current = null;
        if (d === selectedRef.current) return;
        geoRef.current?.resetStyle(path);
      },
      click: () => onSelect(d),
    });
  };

  return (
    <MapContainer
      bounds={NC_BOUNDS}
      maxBounds={NC_BOUNDS}
      maxBoundsViscosity={0.9}
      minZoom={6}
      maxZoom={12}
      zoomControl
      scrollWheelZoom
      zoomSnap={0.25}
      className="h-full w-full"
      style={{ background: "#eef3f8" }}
    >
      {/* Dissolved state silhouette sits below the districts and casts a soft
          drop-shadow (see .leaflet-outline-pane in globals.css) so the map reads
          as a single floating shape rather than a flat grid. */}
      {outline && (
        <Pane name="outline" style={{ zIndex: 350 }}>
          <GeoJSON data={outline} style={() => OUTLINE_STYLE} interactive={false} />
        </Pane>
      )}
      {geojson && (
        <GeoJSON
          key={chamber}
          ref={(instance) => {
            geoRef.current = instance;
          }}
          data={geojson}
          style={styleFn}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Pane, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function FitBounds({ data, onReady }: { data: FeatureCollection; onReady?: () => void }) {
  const map = useMap();
  useEffect(() => {
    // Re-fit once the container has its final size (it can still be laying
    // out when the map first mounts).
    const fit = () => {
      map.invalidateSize();
      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
    };
    fit();
    const t = setTimeout(() => {
      fit();
      onReady?.();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, map]);
  return null;
}

// Outline for the selected precinct: a white halo under a navy line, so it
// stands out on both dark and light fills.
const HALO: L.PathOptions = { color: "#ffffff", weight: 6, opacity: 1, fill: false, lineJoin: "round" };
const LINE: L.PathOptions = { color: "#0b0b45", weight: 2.5, opacity: 1, fill: false, lineJoin: "round" };

// The district's precincts, each filled by `shadeFor(key)`. Hovering or
// tapping a precinct reports it through onPick. No basemap tiles — just the
// shapes. The selected precinct's outline is drawn on its own layer above all
// the precincts; drawn on the precinct itself, its neighbors would paint over
// half of the line on the sides they share.
export default function PrecinctMap({
  url,
  shadeFor,
  selectedKey,
  onPick,
  version,
  still = false,
  onReady,
}: {
  url: string;
  shadeFor: (key: string) => string;
  selectedKey: string | null;
  onPick?: (key: string, how: "hover" | "click") => void;
  version: string; // changes when the shading changes, to re-style
  // A still picture (no zooming, panning, or hovering), for the printable report.
  still?: boolean;
  // Called once the shapes are drawn and fitted, or there's nothing to draw.
  onReady?: () => void;
}) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [url]);

  const empty = data != null && (!Array.isArray(data.features) || data.features.length === 0);
  useEffect(() => {
    if (failed || empty) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, empty]);

  const style = useMemo(
    () => (feature?: Feature): L.PathOptions => ({
      fillColor: shadeFor(String(feature?.properties?.key ?? "")),
      fillOpacity: 1,
      color: "#ffffff",
      weight: 0.8,
      opacity: 1,
      lineJoin: "round",
    }),
    [shadeFor]
  );

  const selected = useMemo<FeatureCollection | null>(() => {
    if (!data || !selectedKey || !Array.isArray(data.features)) return null;
    const features = data.features.filter((f) => f.properties?.key === selectedKey);
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [data, selectedKey]);

  if (failed) return <p className="p-6 text-center text-sm text-navymuted">The precinct map couldn&apos;t load.</p>;
  if (!data) return <div className="h-full w-full animate-pulse rounded bg-gray-100" />;
  if (!Array.isArray(data.features) || data.features.length === 0) {
    return (
      <p className="flex h-full items-center justify-center p-6 text-center text-sm text-navymuted">
        This county redrew its precincts after the State Board&apos;s latest boundary file, so there&apos;s no map yet.
        The precinct table below has every precinct&apos;s results.
      </p>
    );
  }

  return (
    <MapContainer
      className="h-full w-full rounded"
      style={{ background: "transparent" }}
      bounds={L.geoJSON(data).getBounds()}
      zoomControl={!still}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      dragging={!still}
      touchZoom={!still}
      doubleClickZoom={!still}
      boxZoom={!still}
      keyboard={!still}
      attributionControl={false}
    >
      <FitBounds data={data} onReady={onReady} />
      {/* Precincts sit in their own pane with a soft drop-shadow (see
          .leaflet-precincts-pane in globals.css). */}
      <Pane name="precincts" style={{ zIndex: 400 }}>
        <GeoJSON
          key={version}
          data={data}
          style={style}
          interactive={!still}
          onEachFeature={(feature, layer) => {
            if (still || !onPick) return;
            const key = String(feature.properties?.key ?? "");
            layer.on({ mouseover: () => onPick(key, "hover"), click: () => onPick(key, "click") });
          }}
        />
      </Pane>
      <Pane name="precinct-highlight" style={{ zIndex: 450, pointerEvents: "none" }}>
        {selected && (
          <>
            <GeoJSON key={`halo-${selectedKey}`} data={selected} style={() => HALO} interactive={false} />
            <GeoJSON key={`line-${selectedKey}`} data={selected} style={() => LINE} interactive={false} />
          </>
        )}
      </Pane>
    </MapContainer>
  );
}

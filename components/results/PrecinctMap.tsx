"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PrecinctShade = { fill: string; label: string };

function FitBounds({ data }: { data: FeatureCollection }) {
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
    const t = setTimeout(fit, 150);
    return () => clearTimeout(t);
  }, [data, map]);
  return null;
}

// The district's precincts, each filled by `shadeFor(key)`. Hovering or
// tapping a precinct reports it through onPick; `selectedKey` gets a heavy
// outline. No basemap tiles — just the shapes.
export default function PrecinctMap({
  url,
  shadeFor,
  selectedKey,
  onPick,
  version,
}: {
  url: string;
  shadeFor: (key: string) => string;
  selectedKey: string | null;
  onPick: (key: string) => void;
  version: string; // changes when shading or selection changes, to re-style
}) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [url]);

  const style = useMemo(
    () => (feature?: Feature): L.PathOptions => {
      const key = String(feature?.properties?.key ?? "");
      const selected = key === selectedKey;
      return {
        fillColor: shadeFor(key),
        fillOpacity: 1,
        color: selected ? "#0b0b45" : "#ffffff",
        weight: selected ? 3 : 1,
      };
    },
    [shadeFor, selectedKey]
  );

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
      zoomControl
      zoomSnap={0.25}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <FitBounds data={data} />
      <GeoJSON
        key={version}
        data={data}
        style={style}
        onEachFeature={(feature, layer) => {
          const key = String(feature.properties?.key ?? "");
          layer.on({ mouseover: () => onPick(key), click: () => onPick(key) });
        }}
      />
    </MapContainer>
  );
}

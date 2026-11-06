import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

// Ray-casting point-in-ring test. Coordinates are [lng, lat].
function inRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Inside the outer ring and not inside any hole.
function inPolygon(lng: number, lat: number, rings: Position[][]): boolean {
  return rings.length > 0 && inRing(lng, lat, rings[0]) && !rings.slice(1).some((hole) => inRing(lng, lat, hole));
}

export function pointInGeometry(lng: number, lat: number, geometry: Geometry | null): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return inPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((poly) => inPolygon(lng, lat, poly));
  return false;
}

export function featureAt(lng: number, lat: number, collection: FeatureCollection): Feature | null {
  return collection.features.find((f) => pointInGeometry(lng, lat, f.geometry)) ?? null;
}

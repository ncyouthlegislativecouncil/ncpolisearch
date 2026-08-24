import { readFileSync } from "fs";
import { join } from "path";
import type { FeatureCollection, Polygon } from "geojson";

// ---------------------------------------------------------------------------
// Renders a district as a tiny static SVG silhouette (state outline + that
// one district filled in) for the legislator profile banner — NOT an
// interactive map. Everything here is plain math over the same GeoJSON files
// /map already uses; no Leaflet, no client JS, no map tiles.
// ---------------------------------------------------------------------------

type Chamber = "house" | "senate";
type LonLat = [number, number];

// Static assets never change at runtime, so each file is parsed once per
// server process (not once per request) and reused.
const cache = new Map<string, FeatureCollection>();
function loadGeojson(file: string): FeatureCollection {
  const cached = cache.get(file);
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "public", "maps", file), "utf8");
  const parsed = JSON.parse(raw) as FeatureCollection;
  cache.set(file, parsed);
  return parsed;
}

// District polygons carry far more precision than a ~100px badge can show.
// Decimating to a fixed point budget keeps the embedded SVG path small
// without visibly changing the shape at this size.
function decimate(ring: LonLat[], maxPoints: number): LonLat[] {
  if (ring.length <= maxPoints) return ring;
  const step = ring.length / maxPoints;
  const out: LonLat[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(ring[Math.floor(i * step)]);
  out.push(ring[ring.length - 1]);
  return out;
}

type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };

function boundsOf(ring: LonLat[]): Bounds {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

// Equirectangular projection is fine at NC's scale (a few degrees across) —
// distortion is imperceptible at badge size. Y is flipped since latitude
// increases northward but SVG y increases downward. Fit-to-box with uniform
// scale (not stretched) so the silhouette isn't visibly warped.
function project(ring: LonLat[], bounds: Bounds, width: number, height: number): [number, number][] {
  const lonSpan = bounds.maxLon - bounds.minLon || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  const scale = Math.min(width / lonSpan, height / latSpan);
  const xOffset = (width - lonSpan * scale) / 2;
  const yOffset = (height - latSpan * scale) / 2;
  return ring.map(([lon, lat]) => [
    (lon - bounds.minLon) * scale + xOffset,
    height - ((lat - bounds.minLat) * scale + yOffset),
  ]);
}

function pathD(points: [number, number][]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return (
    `M${first[0].toFixed(1)},${first[1].toFixed(1)}` +
    rest.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join("") +
    "Z"
  );
}

const VIEW_WIDTH = 140;
const VIEW_HEIGHT = 90;
const MAX_POINTS = 140;

// Dense urban districts (Wake, Mecklenburg, etc.) are genuinely a fraction of
// a percent of the state's area — real geography, not a rendering bug — so
// they can shrink to just a couple pixels at badge size. Below this size a
// marker dot is drawn at the district's centroid on top of the (still
// rendered, just hard to see) shape, so every district reads as *something*.
const MIN_VISIBLE_SIZE = 5;

export type DistrictBadge = {
  viewBox: string;
  outlineD: string;
  districtD: string;
  marker: { cx: number; cy: number } | null;
};

// Looks up one district's shape and returns ready-to-render SVG path data,
// both shapes projected into the SAME coordinate frame (the whole state's
// bounding box) so the district reads in its correct position relative to
// the rest of NC — not just an isolated blob.
export function getDistrictBadge(chamber: Chamber, district: number): DistrictBadge | null {
  const outlineFc = loadGeojson("nc-outline.geojson");
  const districtsFc = loadGeojson(`nc-${chamber}.geojson`);

  const outlineGeom = outlineFc.features[0]?.geometry as Polygon | undefined;
  const outlineRing = outlineGeom?.coordinates?.[0] as LonLat[] | undefined;
  if (!outlineRing) return null;

  const feature = districtsFc.features.find(
    (f) => String(f.properties?.DISTRICT) === String(district)
  );
  const districtGeom = feature?.geometry as Polygon | undefined;
  const districtRing = districtGeom?.coordinates?.[0] as LonLat[] | undefined;
  if (!districtRing) return null;

  const bounds = boundsOf(outlineRing);

  const outlinePts = project(decimate(outlineRing, MAX_POINTS), bounds, VIEW_WIDTH, VIEW_HEIGHT);
  const districtPts = project(decimate(districtRing, MAX_POINTS), bounds, VIEW_WIDTH, VIEW_HEIGHT);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of districtPts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const tooSmall = maxX - minX < MIN_VISIBLE_SIZE || maxY - minY < MIN_VISIBLE_SIZE;

  return {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    outlineD: pathD(outlinePts),
    districtD: pathD(districtPts),
    marker: tooSmall ? { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 } : null,
  };
}

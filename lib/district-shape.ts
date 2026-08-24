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
const TARGET_ASPECT = VIEW_WIDTH / VIEW_HEIGHT;

// How much context to show around a district: PAD_FACTOR x its own size, or
// MIN_WINDOW_LON degrees, whichever is bigger — the floor keeps tiny urban
// districts from zooming in so far that all surrounding context (and any
// sense of "where in NC") disappears.
const PAD_FACTOR = 3.2;
const MIN_WINDOW_LON = 1.3;

// A window centered on the state's own middle (the old approach) cuts off
// districts near the coast or borders once the badge is enlarged — a
// northeastern or southern legislator's district could fall partly or
// entirely outside that fixed frame. Instead, center the "camera" on THIS
// district's own centroid, sized to its own extent plus padding, then pan
// (never shrink) it back inside the state's bounds if it would spill past an
// edge — so every district ends up framed, wherever in NC it sits.
function districtWindow(districtBounds: Bounds, stateBounds: Bounds): Bounds {
  const districtLonSpan = districtBounds.maxLon - districtBounds.minLon;
  const districtLatSpan = districtBounds.maxLat - districtBounds.minLat;
  const centroidLon = (districtBounds.minLon + districtBounds.maxLon) / 2;
  const centroidLat = (districtBounds.minLat + districtBounds.maxLat) / 2;

  let winLon = Math.max(districtLonSpan * PAD_FACTOR, MIN_WINDOW_LON);
  let winLat = Math.max(districtLatSpan * PAD_FACTOR, MIN_WINDOW_LON / TARGET_ASPECT);
  if (winLon / winLat > TARGET_ASPECT) winLat = winLon / TARGET_ASPECT;
  else winLon = winLat * TARGET_ASPECT;

  let minLon = centroidLon - winLon / 2;
  let maxLon = centroidLon + winLon / 2;
  let minLat = centroidLat - winLat / 2;
  let maxLat = centroidLat + winLat / 2;

  if (minLon < stateBounds.minLon) {
    const d = stateBounds.minLon - minLon;
    minLon += d;
    maxLon += d;
  }
  if (maxLon > stateBounds.maxLon) {
    const d = maxLon - stateBounds.maxLon;
    minLon -= d;
    maxLon -= d;
  }
  if (minLat < stateBounds.minLat) {
    const d = stateBounds.minLat - minLat;
    minLat += d;
    maxLat += d;
  }
  if (maxLat > stateBounds.maxLat) {
    const d = maxLat - stateBounds.maxLat;
    minLat -= d;
    maxLat -= d;
  }

  return { minLon, maxLon, minLat, maxLat };
}

export type DistrictBadge = {
  viewBox: string;
  outlineD: string;
  districtD: string;
};

// Looks up one district's shape and returns ready-to-render SVG path data.
// Both the district and the full state outline are projected into the SAME
// district-centered camera window (see districtWindow above), so the badge
// always shows the district clearly with real surrounding context, correctly
// positioned relative to the rest of NC — not cut off at an edge and not
// just an isolated blob either.
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

  const stateBounds = boundsOf(outlineRing);
  const window = districtWindow(boundsOf(districtRing), stateBounds);

  const outlinePts = project(decimate(outlineRing, MAX_POINTS), window, VIEW_WIDTH, VIEW_HEIGHT);
  const districtPts = project(decimate(districtRing, MAX_POINTS), window, VIEW_WIDTH, VIEW_HEIGHT);

  return {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    outlineD: pathD(outlinePts),
    districtD: pathD(districtPts),
  };
}

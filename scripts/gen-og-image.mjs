// One-off generator for the homepage Open Graph image (public/og-image.png).
// Renders a 1200x630 navy card with the NCPoliSearch wordmark, tagline, NCYLC
// credit, and a subtle NC-state-outline watermark (traced from the real
// dissolved district geometry in public/maps/nc-outline.geojson).
//
// Run:  node scripts/gen-og-image.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const W = 1200;
const H = 630;

// --- Build the NC outline path from the dissolved GeoJSON -------------------
const geo = JSON.parse(
  readFileSync(join(root, "public/maps/nc-outline.geojson"), "utf8")
);

// Collect every ring (Polygon or MultiPolygon) as arrays of [lng, lat].
const rings = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (g.type === "Polygon") {
    for (const ring of g.coordinates) rings.push(ring);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) for (const ring of poly.coordinates ?? poly) rings.push(ring);
  }
}

// Equirectangular projection with longitude corrected for latitude so the state
// keeps its true proportions instead of stretching horizontally.
const all = rings.flat();
const lats = all.map((p) => p[1]);
const lngs = all.map((p) => p[0]);
const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
const k = Math.cos((midLat * Math.PI) / 180);

const proj = (lng, lat) => [lng * k, lat];
const pts = all.map((p) => proj(p[0], p[1]));
const minX = Math.min(...pts.map((p) => p[0]));
const maxX = Math.max(...pts.map((p) => p[0]));
const minY = Math.min(...pts.map((p) => p[1]));
const maxY = Math.max(...pts.map((p) => p[1]));

// Fit the outline into a watermark box centered on the canvas.
const boxW = 980;
const boxH = 540;
const boxCx = 600;
const boxCy = 340;
const scale = Math.min(boxW / (maxX - minX), boxH / (maxY - minY));
const drawW = (maxX - minX) * scale;
const drawH = (maxY - minY) * scale;
const offX = boxCx - drawW / 2;
const offY = boxCy - drawH / 2;

const toSvg = (lng, lat) => {
  const [x, y] = proj(lng, lat);
  return [
    offX + (x - minX) * scale,
    // Flip Y: latitude increases upward, SVG y increases downward.
    offY + (maxY - y) * scale,
  ];
};

const pathD = rings
  .map((ring) =>
    ring
      .map(([lng, lat], i) => {
        const [x, y] = toSvg(lng, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  )
  .join(" ");

// --- Compose the SVG --------------------------------------------------------
const font =
  "Segoe UI, Arial, Helvetica, sans-serif";

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#1a1f8f"/>
  <!-- NC state outline watermark -->
  <path d="${pathD}" fill="#ffffff" fill-rule="evenodd" opacity="0.07"/>
  <!-- Brand badge -->
  <rect x="545" y="86" width="110" height="110" rx="22" fill="#eaebf8"/>
  <text x="600" y="162" text-anchor="middle" font-family="${font}" font-weight="700" font-size="56" fill="#1a1f8f">NC</text>
  <!-- Wordmark -->
  <text x="600" y="318" text-anchor="middle" font-family="${font}" font-weight="700" font-size="104" fill="#ffffff" letter-spacing="-1">NCPoliSearch</text>
  <!-- Tagline -->
  <text x="600" y="388" text-anchor="middle" font-family="${font}" font-weight="400" font-size="40" fill="#dbe6f5">North Carolina legislation, made simple.</text>
  <!-- Gold divider -->
  <rect x="540" y="424" width="120" height="5" rx="2.5" fill="#c9a84c"/>
  <!-- NCYLC credit -->
  <text x="600" y="566" text-anchor="middle" font-family="${font}" font-weight="500" font-size="30" fill="#8ec6e8">A project of NC Youth Legislative Council</text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { loadSystemFonts: true },
  background: "#1a1f8f",
});
const png = resvg.render().asPng();
const out = join(root, "public/og-image.png");
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes, ${W}x${H})`);

// One-time build of the precinct map files used by the race pages
// (/results/<raceId>) and "Find my precinct":
//   public/maps/precincts/<raceId>.geojson
// Each holds the precincts that reported votes in that NC House/Senate race,
// clipped to the district boundary (some precincts are split between
// districts), with properties { key, name }.
//
// Input: the State Board's statewide precinct shapefile, converted to WGS84
// GeoJSON first:
//   npx mapshaper -i backup/precincts/SBE_PRECINCTS_20240723.zip -proj wgs84 \
//     -simplify 12% keep-shapes -filter-fields county_nam,prec_id,enr_desc \
//     -o backup/precincts/statewide.json format=geojson precision=0.00001
// Then: npx tsx scripts/build-precinct-maps.ts
// Re-run only if precinct boundaries change; the per-race vote files come from
// scripts/update-election-results.ts.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { Feature, FeatureCollection } from "geojson";
// mapshaper ships without types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mapshaper = require("mapshaper");
import { precinctKey, type RacePrecincts } from "../lib/precincts";

const STATEWIDE = "backup/precincts/statewide.json";
const VOTES_DIR = "public/elections/2026-general";
const OUT_DIR = "public/maps/precincts";

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

async function main() {
  const statewide = JSON.parse(readFileSync(STATEWIDE, "utf8")) as FeatureCollection;
  const byKey = new Map<string, Feature>();
  for (const f of statewide.features) {
    const p = f.properties as { county_nam: string; prec_id: string; enr_desc: string };
    const key = precinctKey(p.county_nam, p.prec_id);
    byKey.set(key, { type: "Feature", geometry: f.geometry, properties: { key, name: titleCase(p.enr_desc || p.prec_id) } });
  }

  const districts = {
    "nc-house": JSON.parse(readFileSync("public/maps/nc-house.geojson", "utf8")) as FeatureCollection,
    "nc-senate": JSON.parse(readFileSync("public/maps/nc-senate.geojson", "utf8")) as FeatureCollection,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  let mapped = 0;
  let unmapped = 0;
  for (const file of readdirSync(VOTES_DIR).filter((f) => f.endsWith(".json"))) {
    const race = JSON.parse(readFileSync(join(VOTES_DIR, file), "utf8")) as RacePrecincts;
    const [, chamber, num] = race.raceId.match(/^(nc-house|nc-senate)-0*(\d+)$/) ?? [];
    if (!chamber) continue;

    const precincts = race.precincts.map((p) => byKey.get(p.key)).filter((f): f is Feature => Boolean(f));
    mapped += precincts.length;
    unmapped += race.precincts.length - precincts.length;

    const district = districts[chamber as "nc-house" | "nc-senate"].features.find(
      (f) => String((f.properties as { DISTRICT: string }).DISTRICT) === num
    );
    if (!district) throw new Error(`No district shape for ${race.raceId}`);

    // Nothing to draw when every precinct was redrawn after the boundary file
    // (e.g. Gaston County); write an empty collection so readers stay simple.
    if (precincts.length === 0) {
      writeFileSync(join(OUT_DIR, `${race.raceId}.geojson`), JSON.stringify({ type: "FeatureCollection", features: [] }) + "\n");
      continue;
    }

    // Clip to the district so split precincts don't spill past its border.
    const out = await mapshaper.applyCommands(
      "-i precincts.json district.json combine-files -clip district target=precincts -o out.json format=geojson precision=0.00001",
      {
        "precincts.json": { type: "FeatureCollection", features: precincts },
        "district.json": { type: "FeatureCollection", features: [district] },
      }
    );
    writeFileSync(join(OUT_DIR, `${race.raceId}.geojson`), out["out.json"]);
  }
  console.log(`Wrote precinct maps: ${mapped} precincts mapped, ${unmapped} without a shape (redrawn since 2024).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

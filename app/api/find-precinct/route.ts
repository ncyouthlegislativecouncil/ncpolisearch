import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { FeatureCollection } from "geojson";
import { featureAt } from "../../../lib/geo";

// "Find my precinct": turns an NC street address into its NC House district,
// NC Senate district, and voting precinct. The address is sent to the US
// Census Bureau's free geocoder to get coordinates and is not stored or
// logged; the district and precinct come from the map files in public/maps.
export const dynamic = "force-dynamic";

const MAPS = join(process.cwd(), "public", "maps");
const cache = new Map<string, FeatureCollection>();
function loadMap(file: string): FeatureCollection | null {
  if (!cache.has(file)) {
    const path = join(MAPS, file);
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    cache.set(file, { type: "FeatureCollection", features: Array.isArray(parsed.features) ? parsed.features : [] });
  }
  return cache.get(file)!;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function locate(lng: number, lat: number, chamber: "house" | "senate") {
  const districts = loadMap(`nc-${chamber}.geojson`);
  const district = districts ? featureAt(lng, lat, districts) : null;
  if (!district) return null;
  const n = parseInt(String(district.properties?.DISTRICT), 10);
  const raceId = chamber === "house" ? `nc-house-${pad(n, 3)}` : `nc-senate-${pad(n, 2)}`;
  const precincts = loadMap(`precincts/${raceId}.geojson`);
  const precinct = precincts ? featureAt(lng, lat, precincts) : null;
  return {
    district: n,
    raceId,
    precinct: precinct ? { key: String(precinct.properties?.key), name: String(precinct.properties?.name) } : null,
  };
}

export async function POST(req: Request) {
  let address = "";
  try {
    address = String((await req.json())?.address ?? "").trim();
  } catch {
    // fall through to validation
  }
  if (address.length < 5 || address.length > 200) {
    return NextResponse.json({ error: "Enter a full street address, city, and ZIP." }, { status: 400 });
  }

  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
    encodeURIComponent(address);
  let match: { coordinates: { x: number; y: number }; matchedAddress: string; addressComponents?: { state?: string } } | undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    const data = await res.json();
    match = data?.result?.addressMatches?.[0];
  } catch {
    return NextResponse.json({ error: "The address lookup service didn't respond. Try again in a moment." }, { status: 502 });
  }

  if (!match) {
    return NextResponse.json({ error: "We couldn't find that address. Check the street, city, and ZIP." }, { status: 404 });
  }
  if (match.addressComponents?.state && match.addressComponents.state !== "NC") {
    return NextResponse.json({ error: "That address isn't in North Carolina." }, { status: 404 });
  }

  const { x: lng, y: lat } = match.coordinates;
  const house = locate(lng, lat, "house");
  const senate = locate(lng, lat, "senate");
  if (!house && !senate) {
    return NextResponse.json({ error: "That address isn't inside an NC legislative district." }, { status: 404 });
  }

  return NextResponse.json(
    { matchedAddress: match.matchedAddress, house, senate },
    { headers: { "Cache-Control": "no-store" } }
  );
}

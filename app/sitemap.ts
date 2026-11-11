import type { MetadataRoute } from "next";
import { getAllBillIds } from "../lib/bills";
import { allLegislators } from "../lib/data/store";
import { legislativeRaceIds } from "../lib/race-data";

const BASE = "https://www.ncpolisearch.com";

// Built at deploy time from the data files.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/bills", "/legislators", "/map", "/results", "/ballot", "/compare", "/write", "/about"];
  const billIds = await getAllBillIds();

  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...billIds.map((id) => ({ url: `${BASE}/bills/${id}` })),
    ...allLegislators().map((l) => ({ url: `${BASE}/legislators/${l.peopleId}` })),
    ...legislativeRaceIds().map((id) => ({ url: `${BASE}/results/${id}` })),
  ];
}

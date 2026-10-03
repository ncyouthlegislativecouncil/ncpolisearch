import type { MetadataRoute } from "next";
import { getAllBillIds } from "../lib/bills";
import { safeQuery } from "../lib/safe";

const BASE = "https://www.ncpolisearch.com";

// Rebuilt at most once a day, so new bills show up for Google without the
// sitemap hitting the database on every crawl.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/bills", "/legislators", "/map", "/ballot", "/compare", "/about"];
  // Falls back to just the static pages if the DB is unreachable at build time,
  // rather than failing the whole deploy.
  const billIds = await safeQuery(() => getAllBillIds(), [] as number[], "sitemap:getAllBillIds");

  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...billIds.map((id) => ({ url: `${BASE}/bills/${id}` })),
  ];
}

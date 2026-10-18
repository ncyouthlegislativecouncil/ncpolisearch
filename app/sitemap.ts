import type { MetadataRoute } from "next";
import { getAllBillIds } from "../lib/bills";

const BASE = "https://www.ncpolisearch.com";

// Built at deploy time from the bill data files.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/bills", "/legislators", "/map", "/ballot", "/compare", "/write", "/about"];
  const billIds = await getAllBillIds();

  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...billIds.map((id) => ({ url: `${BASE}/bills/${id}` })),
  ];
}

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import type { SQL } from "drizzle-orm";
import * as schema from "./schema";

// Neon's HTTP driver issues each query as an independent HTTPS request
// instead of holding a persistent TCP connection open. The previous
// postgres-js driver kept one connection alive per warm serverless instance;
// with many routes/instances that meant Neon's compute endpoint rarely got to
// autosuspend, burning compute-hours around the clock regardless of traffic.
// lib/poll.ts and lib/summarize.ts already used this driver for the same
// reason — this just brings the page-rendering runtime in line with them.
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// neon-http's db.execute() returns { rows: [...] }, unlike postgres-js (which
// returned an array-like result directly indexable as e.g. result[0]). This
// normalizes either shape so raw sql`` queries don't have to care which
// driver is active.
export async function execRows<T = Record<string, unknown>>(
  query: SQL
): Promise<T[]> {
  const result = await db.execute(query);
  const rows = (result as { rows?: unknown }).rows;
  return (rows ?? result) as T[];
}

// Applies the 0003 migration (adds legislators.running_for_reelection) and
// seeds it: all 120 House + 50 Senate seats are up in November 2026, so every
// incumbent defaults to `true`. Specific retirements can be flipped to `false`
// later. Idempotent — safe to re-run.
//
// Run:  npx tsx --env-file=.env.local scripts/set-reelection.ts
import { sql } from "drizzle-orm";
import { db } from "../db";

async function main() {
  // 1. Add the column if it doesn't already exist (the "migration").
  await db.execute(
    sql`ALTER TABLE "legislators" ADD COLUMN IF NOT EXISTS "running_for_reelection" boolean`
  );
  console.log("✓ Column running_for_reelection ensured.");

  // 2. Default all current legislators (Reps + Sens) to running. Only touches
  //    rows that are still NULL so any manual `false` overrides are preserved.
  const updated = await db.execute(
    sql`UPDATE "legislators"
        SET "running_for_reelection" = true
        WHERE "running_for_reelection" IS NULL
          AND "role" IN ('Rep', 'Sen')`
  );
  console.log(`✓ Set running_for_reelection = true for incumbents.`);

  // 3. Report the distribution.
  const counts = (await db.execute(
    sql`SELECT
          count(*) FILTER (WHERE running_for_reelection IS TRUE)  AS running,
          count(*) FILTER (WHERE running_for_reelection IS FALSE) AS not_running,
          count(*) FILTER (WHERE running_for_reelection IS NULL)  AS unknown
        FROM "legislators"
        WHERE role IN ('Rep', 'Sen')`
  )) as unknown as { running: number; not_running: number; unknown: number }[];
  console.log("Distribution (Rep/Sen):", counts[0]);

  void updated;
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

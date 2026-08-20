import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// One-time cleanup: bill_sponsors accumulated duplicate (bill_id, people_id)
// rows from earlier non-idempotent ingestion runs. Frozen into bills that
// haven't changed since (the poller skips unchanged bills, so they never get
// the delete-then-reinsert refresh). This:
//   1. Deletes duplicate rows, keeping the lowest id per (bill_id, people_id).
//   2. Adds a UNIQUE constraint so duplicates can never be inserted again.
// Re-runnable: step 1 is a no-op once clean, step 2 is guarded with IF NOT
// EXISTS via a DO block.
// Run: npx tsx --env-file=.env.local scripts/dedupe-sponsors.ts
// ---------------------------------------------------------------------------

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle(client);
  const q = async (text: ReturnType<typeof sql>) =>
    ((await db.execute(text)) as unknown as { rows: any[] }).rows;

  const before = (
    await q(sql`SELECT count(*)::int AS n FROM bill_sponsors`)
  )[0].n as number;
  console.log(`bill_sponsors rows before: ${before}`);

  // 1. Delete every row that isn't the lowest id for its (bill_id, people_id).
  const del = await q(sql`
    DELETE FROM bill_sponsors bs
    USING (
      SELECT bill_id, people_id, min(id) AS keep_id
      FROM bill_sponsors
      GROUP BY bill_id, people_id
    ) keep
    WHERE bs.bill_id = keep.bill_id
      AND bs.people_id = keep.people_id
      AND bs.id <> keep.keep_id
    RETURNING bs.id
  `);
  console.log(`Deleted ${del.length} duplicate rows`);

  // 2. Add a UNIQUE constraint so it can't happen again. Guarded so reruns and
  //    a fresh schema (where it may already exist) don't error.
  await q(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bill_sponsors_bill_people_unique'
      ) THEN
        ALTER TABLE bill_sponsors
          ADD CONSTRAINT bill_sponsors_bill_people_unique UNIQUE (bill_id, people_id);
      END IF;
    END $$;
  `);
  console.log("UNIQUE(bill_id, people_id) constraint ensured");

  const after = (
    await q(sql`SELECT count(*)::int AS n FROM bill_sponsors`)
  )[0].n as number;
  const remainingDupes = (
    await q(sql`
      SELECT coalesce(sum(extra),0)::int AS n FROM (
        SELECT count(*) - 1 AS extra FROM bill_sponsors
        GROUP BY bill_id, people_id HAVING count(*) > 1
      ) t
    `)
  )[0].n as number;

  console.log(`bill_sponsors rows after: ${after}`);
  console.log(`Remaining duplicate extras: ${remainingDupes}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

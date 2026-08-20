import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle(client);
  const q = async (text: ReturnType<typeof sql>) =>
    ((await db.execute(text)) as unknown as { rows: any[] }).rows;

  // 1. Duplicate sponsor rows: same (bill_id, people_id) appearing more than once.
  const dupeSponsors = await q(sql`
    SELECT bill_id, people_id, count(*)::int AS n
    FROM bill_sponsors
    GROUP BY bill_id, people_id
    HAVING count(*) > 1
    ORDER BY n DESC
    LIMIT 5
  `);

  const dupeTotals = await q(sql`
    SELECT
      (SELECT count(*)::int FROM bill_sponsors) AS total_rows,
      (SELECT count(*)::int FROM (
        SELECT bill_id, people_id FROM bill_sponsors
        GROUP BY bill_id, people_id HAVING count(*) > 1
      ) t) AS dup_pairs,
      (SELECT coalesce(sum(extra),0)::int FROM (
        SELECT count(*) - 1 AS extra FROM bill_sponsors
        GROUP BY bill_id, people_id HAVING count(*) > 1
      ) t) AS extra_rows
  `);

  // 2. Duplicate bills: same bill_number mapping to multiple bill_id.
  const dupeBills = await q(sql`
    SELECT bill_number, count(*)::int AS n,
           array_agg(bill_id ORDER BY bill_id) AS ids
    FROM bills
    GROUP BY bill_number
    HAVING count(*) > 1
    ORDER BY n DESC
    LIMIT 20
  `);

  const dupeVoteDetail = await q(sql`
    SELECT
      (SELECT count(*)::int FROM vote_detail) AS total_rows,
      (SELECT coalesce(sum(extra),0)::int FROM (
        SELECT count(*) - 1 AS extra FROM vote_detail
        GROUP BY roll_call_id, people_id HAVING count(*) > 1
      ) t) AS extra_rows
  `);

  console.log("=== bill_sponsors duplicate (bill_id, people_id) pairs ===");
  console.log(dupeTotals[0]);
  console.log("Sample dup pairs:", dupeSponsors);

  console.log("\n=== bills with same bill_number across multiple bill_id ===");
  console.log("count:", dupeBills.length);
  console.log(dupeBills);

  console.log("\n=== vote_detail duplicate (roll_call_id, people_id) ===");
  console.log(dupeVoteDetail[0]);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

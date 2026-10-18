import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";

// Read-only full dump of every table (including bills.bill_text) into
// backup/neon-<date>/<table>.json. Nothing in the database is modified. Rows
// are fetched in keyed pages to stay well under the HTTP driver's response
// size limit.
const sql = neon(process.env.DATABASE_URL!);
const outDir = join("backup", `neon-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(outDir, { recursive: true });

async function dumpPaged(table: string, key: string, pageSize: number) {
  const rows: Record<string, unknown>[] = [];
  let last = -1;
  for (;;) {
    const page = (await sql.query(
      `SELECT * FROM ${table} WHERE ${key} > $1 ORDER BY ${key} LIMIT ${pageSize}`,
      [last]
    )) as Record<string, unknown>[];
    if (page.length === 0) break;
    rows.push(...page);
    last = Number(page[page.length - 1][key]);
    process.stdout.write(`\r  ${table}: ${rows.length}`);
  }
  writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows));
  console.log(`\r  ${table}: ${rows.length} rows`);
  return rows.length;
}

async function main() {
  console.log(`Backing up to ${outDir}`);
  const counts = {
    bills: await dumpPaged("bills", "bill_id", 300),
    legislators: await dumpPaged("legislators", "people_id", 1000),
    bill_sponsors: await dumpPaged("bill_sponsors", "id", 10000),
    votes: await dumpPaged("votes", "roll_call_id", 5000),
    vote_detail: await dumpPaged("vote_detail", "id", 20000),
  };
  writeFileSync(join(outDir, "_counts.json"), JSON.stringify(counts, null, 2));
  console.log("Done:", counts);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});

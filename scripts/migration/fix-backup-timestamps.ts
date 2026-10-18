import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";

// The raw backup parsed `timestamp without time zone` values as local time,
// shifting them by the machine's UTC offset. Drizzle (what the site uses) reads
// them as UTC. Re-read created_at as text and store the UTC ISO string the site
// would have produced. Read-only against the database.
const sql = neon(process.env.DATABASE_URL!);
const dir = join("backup", readdirSync("backup").filter((d) => d.startsWith("neon-")).sort().pop()!);
const toIso = (t: string | null) => (t == null ? null : new Date(t.replace(" ", "T") + "Z").toISOString());

async function fix(table: string, key: string) {
  const rows = JSON.parse(readFileSync(join(dir, `${table}.json`), "utf8")) as Record<string, unknown>[];
  const texts = new Map<number, string | null>();
  let last = -1;
  for (;;) {
    const page = (await sql.query(
      `SELECT ${key} AS k, created_at::text AS t FROM ${table} WHERE ${key} > $1 ORDER BY ${key} LIMIT 20000`,
      [last]
    )) as { k: number; t: string | null }[];
    if (!page.length) break;
    for (const r of page) texts.set(Number(r.k), r.t);
    last = Number(page[page.length - 1].k);
  }
  let changed = 0;
  for (const r of rows) {
    const iso = toIso(texts.get(Number(r[key])) ?? null);
    if (r.created_at !== iso) changed++;
    r.created_at = iso;
  }
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows));
  console.log(`${table}: ${rows.length} rows, ${changed} timestamps corrected`);
}

async function main() {
  await fix("bills", "bill_id");
  await fix("legislators", "people_id");
  await fix("bill_sponsors", "id");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

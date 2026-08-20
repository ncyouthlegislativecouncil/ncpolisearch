import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  const commas = await db.execute(sql`SELECT name FROM legislators WHERE name LIKE '%,%' OR name ~* '\\m(jr|sr|ii|iii|iv)\\M' ORDER BY name`);
  console.log("names with comma/suffix:", commas.rows);
  const tokens = await db.execute(sql`SELECT name, regexp_replace(name, '^.*\\s', '') AS last_token FROM legislators ORDER BY length(name) - length(regexp_replace(name,'\\s','','g')) DESC LIMIT 12`);
  console.log("most-spaces names + derived last token:", tokens.rows);
}
main().catch(e=>{console.error(e);process.exit(1)});

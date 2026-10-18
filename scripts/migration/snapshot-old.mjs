// Saves the outputs of the current database-backed data functions (via the
// temporary /api/snapshot-tmp route on a running dev server) into
// backup/snapshot-old/, so the file-backed rewrite can be checked against them
// later without needing the database. Resumable: skips chunks already saved.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000/api/snapshot-tmp";
const OUT = join("backup", "snapshot-old");
mkdirSync(OUT, { recursive: true });

const backupDir = join("backup", readdirSync("backup").filter((d) => d.startsWith("neon-")).sort().pop());
const legislators = JSON.parse(readFileSync(join(backupDir, "legislators.json"), "utf8"));
const bills = JSON.parse(readFileSync(join(backupDir, "bills.json"), "utf8"));

async function save(name, query) {
  const file = join(OUT, `${name}.json`);
  if (existsSync(file)) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${BASE}?${query}`);
    if (res.ok) {
      writeFileSync(file, await res.text());
      console.log(`saved ${name}`);
      return;
    }
    console.log(`  ${name} attempt ${attempt} failed: HTTP ${res.status}`);
  }
  throw new Error(`could not snapshot ${name}`);
}

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

await save("home", "section=home");
await save("lists", "section=lists");
await save("districts-house", "section=districts&chamber=house");
await save("districts-senate", "section=districts&chamber=senate");

const legIds = legislators.map((l) => l.people_id).sort((a, b) => a - b);
for (const [i, c] of chunks(legIds, 15).entries()) await save(`legislators-${i}`, `section=legislators&ids=${c.join(",")}`);

const billIds = bills.map((b) => b.bill_id).sort((a, b) => a - b);
for (const [i, c] of chunks(billIds, 50).entries()) await save(`bills-${i}`, `section=bills&ids=${c.join(",")}`);

const wd = join(OUT, "write-data.json");
if (!existsSync(wd)) {
  const res = await fetch("http://localhost:3000/api/write-data");
  writeFileSync(wd, await res.text());
  console.log("saved write-data");
}
console.log("Snapshot complete.");

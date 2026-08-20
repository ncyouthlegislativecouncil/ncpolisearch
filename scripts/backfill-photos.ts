import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Backfill legislator profile photos from the OpenStates "current people"
// dataset for North Carolina. Photos are matched to our legislators by
// (chamber, district) + last name, downloaded into public/legislators, and the
// resulting path stored in legislators.image_url.
//
// One-time / occasional script — the roster changes maybe once a session.
// Re-run to pick up new members. Run:
//   npx tsx --env-file=.env.local scripts/backfill-photos.ts
// ---------------------------------------------------------------------------

const CSV_URL = "https://data.openstates.org/people/current/nc.csv";
const OUT_DIR = join(process.cwd(), "public", "legislators");
const CONCURRENCY = 8;

type CsvRow = Record<string, string>;

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas /
// newlines, and "" escaped quotes. Good enough for the OpenStates export.
function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore — handled by \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.length > 1)
    .map((r) => {
      const obj: CsvRow = {};
      header.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD") // decompose accents so the base letter survives below
    .replace(/[^a-z\s]/g, " ") // drop punctuation + combining marks
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t))
    .join(" ")
    .trim();
}

function lastName(fullName: string): string {
  const parts = normalize(fullName).split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

// "lower" -> "Rep", "upper" -> "Sen"
function chamberToRole(chamber: string): string | null {
  if (chamber === "lower") return "Rep";
  if (chamber === "upper") return "Sen";
  return null;
}

function districtNumber(district: string | null): string | null {
  if (!district) return null;
  const m = district.match(/(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

type DbLeg = {
  people_id: number;
  name: string;
  role: string;
  district: string;
};

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Fetching ${CSV_URL} ...`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV download failed: ${res.status}`);
  const rows = parseCsv(await res.text());
  console.log(`Parsed ${rows.length} OpenStates people.`);

  // Index CSV people by seat key "Role-DistrictNumber".
  const bySeat = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const role = chamberToRole(r.current_chamber);
    const dnum = districtNumber(r.current_district);
    if (!role || !dnum || !r.image) continue;
    const key = `${role}-${dnum}`;
    (bySeat.get(key) ?? bySeat.set(key, []).get(key)!).push(r);
  }

  const legs = (
    await db.execute(sql`SELECT people_id, name, role, district FROM legislators`)
  ).rows as unknown as DbLeg[];

  // Build the match list: DB legislator -> image URL.
  type Match = { peopleId: number; name: string; imageUrl: string };
  const matches: Match[] = [];
  const unmatched: DbLeg[] = [];

  for (const leg of legs) {
    const dnum = districtNumber(leg.district);
    const key = `${leg.role}-${dnum}`;
    const candidates = bySeat.get(key) ?? [];
    const dbLast = lastName(leg.name);
    const hit = candidates.find((c) => lastName(c.family_name || c.name) === dbLast);
    if (hit) {
      matches.push({ peopleId: leg.people_id, name: leg.name, imageUrl: hit.image });
    } else {
      unmatched.push(leg);
    }
  }

  console.log(`Matched ${matches.length}/${legs.length} legislators to a photo.`);

  // Download images with bounded concurrency, then record the local path.
  const updates: { peopleId: number; path: string }[] = [];
  const failures: { peopleId: number; name: string; reason: string }[] = [];

  for (let i = 0; i < matches.length; i += CONCURRENCY) {
    const batch = matches.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (m) => {
        try {
          const r = await fetch(m.imageUrl);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const ext = extFromContentType(r.headers.get("content-type"));
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 512) throw new Error(`tiny file (${buf.length}b)`);
          const fname = `${m.peopleId}.${ext}`;
          await writeFile(join(OUT_DIR, fname), buf);
          updates.push({ peopleId: m.peopleId, path: `/legislators/${fname}` });
        } catch (e) {
          failures.push({ peopleId: m.peopleId, name: m.name, reason: (e as Error).message });
        }
      })
    );
    console.log(`  downloaded ${Math.min(i + CONCURRENCY, matches.length)}/${matches.length}`);
  }

  // Persist image paths.
  for (const u of updates) {
    await db.execute(
      sql`UPDATE legislators SET image_url = ${u.path} WHERE people_id = ${u.peopleId}`
    );
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Photos saved + stored: ${updates.length}`);
  console.log(`Download failures: ${failures.length}`);
  if (failures.length) console.log(failures);
  console.log(`\nUnmatched legislators (no photo — likely former members): ${unmatched.length}`);
  if (unmatched.length)
    console.log(unmatched.map((u) => `${u.name} (${u.role} ${u.district})`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

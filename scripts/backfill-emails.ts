import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "fs";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { legislators } from "../db/schema";

// Pulls each member's official email from their page on ncleg.gov and saves
// them to lib/legislator-emails.json (keyed by LegiScan people_id), so profile
// pages show them with zero database involvement. ncleg.gov hides addresses behind
// Cloudflare's email obfuscation (a hex string whose first byte is an XOR key);
// decoding it is standard and gives back the plain public address.
//
// Usage:
//   npx tsx scripts/backfill-emails.ts          (dry run — prints matches only)
//   npx tsx scripts/backfill-emails.ts --write  (writes lib/legislator-emails.json)
const WRITE = process.argv.includes("--write");

const db = drizzle(neon(process.env.DATABASE_URL!), { schema: { legislators } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (NCPoliSearch email backfill)" };

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

// ncleg.gov names can carry HTML entities ("Par&#xE9;"), credentials after a
// comma ("Grant L. Campbell, MD") and suffixes ("Jr."); normalize all of that
// so the last name compares cleanly against our roster.
const lastName = (full: string) =>
  full
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .split(",")[0]
    .trim()
    .replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "")
    .split(/\s+/)
    .pop()!
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Member = { ncgaId: string; name: string; district: number; email: string | null };

async function scrapeChamber(chamber: "H" | "S"): Promise<Member[]> {
  const list = await get(`https://www.ncleg.gov/Members/MemberList/${chamber}`);
  // Each card: <a href="/Members/Biography/H/786">Name</a>&nbsp;(D) ... District 39
  const cards = list.split('class="row mb-3"').slice(1);
  const members: Member[] = [];
  for (const card of cards) {
    const m = card.match(
      new RegExp(`Biography/${chamber}/(\\d+)">([^<]+)</a>[\\s\\S]*?District (\\d+)`)
    );
    if (!m) continue;
    members.push({
      ncgaId: m[1],
      name: m[2].replace(/&nbsp;/g, " ").trim(),
      district: Number(m[3]),
      email: null,
    });
  }
  for (const mem of members) {
    try {
      const bio = await get(`https://www.ncleg.gov/Members/Biography/${chamber}/${mem.ncgaId}`);
      const cf = bio.match(/data-cfemail="([0-9a-f]+)"/i);
      if (cf) mem.email = decodeCfEmail(cf[1]).toLowerCase();
    } catch (err) {
      console.error(`  ! ${mem.name}: ${(err as Error).message}`);
    }
    await sleep(250);
  }
  return members;
}

async function main() {
  const all = await db.select().from(legislators);
  let matched = 0;
  const byPeopleId: Record<number, string> = {};
  const unmatched: string[] = [];
  const noEmail: string[] = [];

  for (const [chamber, role] of [["H", "Rep"], ["S", "Sen"]] as const) {
    console.log(`Scraping ${chamber === "H" ? "House" : "Senate"}…`);
    const members = await scrapeChamber(chamber);
    console.log(`  ${members.length} members found on ncleg.gov`);

    for (const mem of members) {
      if (!mem.email) {
        noEmail.push(`${mem.name} (${role} ${mem.district})`);
        continue;
      }
      // Same chamber + district + last name. A district can hold a departed
      // member and their replacement, so the last name picks the right row.
      const rows = all.filter(
        (l) =>
          l.role === role &&
          Number(l.district?.replace(/\D/g, "")) === mem.district &&
          lastName(l.name ?? "") === lastName(mem.name)
      );
      if (rows.length === 0) {
        unmatched.push(`${mem.name} (${role} ${mem.district}) ${mem.email}`);
        continue;
      }
      for (const row of rows) {
        matched++;
        byPeopleId[row.peopleId] = mem.email;
        if (!WRITE && matched <= 5) {
          console.log(`  ${row.name} -> ${mem.email}`);
        }
      }
    }
  }

  if (WRITE) {
    writeFileSync("lib/legislator-emails.json", JSON.stringify(byPeopleId, null, 2) + "\n");
  }
  console.log(`\n${WRITE ? "Saved" : "Would save"} ${matched} emails.`);
  if (noEmail.length) console.log(`No email on ncleg.gov (${noEmail.length}):\n  ` + noEmail.join("\n  "));
  if (unmatched.length) console.log(`Not matched to a DB legislator (${unmatched.length}):\n  ` + unmatched.join("\n  "));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

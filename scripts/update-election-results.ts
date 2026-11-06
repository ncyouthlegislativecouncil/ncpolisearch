// Downloads the NC State Board of Elections' precinct-level results for the
// 2026 general election and writes statewide totals for every federal race,
// the statewide court races, the constitutional amendments, and all 170 NC
// House/Senate races to data/elections/2026-general.json. Run daily by the
// data-update workflow until the results are certified; it does nothing once
// `certified` is true or when the State Board's file hasn't changed.
//
// Usage:
//   npx tsx scripts/update-election-results.ts              refresh if changed
//   npx tsx scripts/update-election-results.ts --certified  also mark as certified
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { formatDataFile } from "../lib/data/format";
import type { ElectionCandidate, ElectionResults, Race, RaceCategory } from "../lib/data/types";
import { unzip } from "../lib/zip";

const ELECTION = {
  date: "2026-11-03",
  name: "2026 General Election",
  url: "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip",
  file: "data/elections/2026-general.json",
};

const PARTY: Record<string, string> = { REP: "R", DEM: "D", LIB: "L", GRE: "G", UNA: "U" };

// Plain-English names for the amendments (the State Board's are long).
const AMENDMENT_TITLES: Record<string, string> = {
  "MAXIMUM INCOME TAX RATE OF 3.5%": "Income Tax Cap Amendment",
  "PROPERTY TAX LEVY LIMIT": "Property Tax Limit Amendment",
  "REQUIRE PHOTO ID FOR VOTING": "Photo Voter ID Amendment",
};

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const pad = (n: number, width: number) => String(n).padStart(width, "0");

type Classified = { id: string; category: RaceCategory; title: string; district: number | null };

// Which State Board contests appear on the results page, and how they're named.
function classify(contest: string): Classified | null {
  let m: RegExpMatchArray | null;
  if (contest === "US SENATE") return { id: "us-senate", category: "federal", title: "US Senate", district: null };
  if ((m = contest.match(/^US HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/))) {
    const d = parseInt(m[1], 10);
    return { id: `us-house-${pad(d, 2)}`, category: "federal", title: `US House District ${d}`, district: d };
  }
  if ((m = contest.match(/^NC SUPREME COURT .*SEAT (\d+)$/))) {
    const seat = parseInt(m[1], 10);
    return { id: `nc-supreme-court-${pad(seat, 2)}`, category: "courts", title: "NC Supreme Court", district: null };
  }
  if ((m = contest.match(/^NC COURT OF APPEALS JUDGE SEAT (\d+)$/))) {
    const seat = parseInt(m[1], 10);
    return {
      id: `nc-court-of-appeals-${pad(seat, 2)}`,
      category: "courts",
      title: `NC Court of Appeals · Seat ${seat}`,
      district: null,
    };
  }
  if ((m = contest.match(/^CONSTITUTIONAL AMENDMENT - (.+)$/))) {
    const slug = m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `amendment-${slug}`,
      category: "amendments",
      title: AMENDMENT_TITLES[m[1]] ?? `${titleCase(m[1])} Amendment`,
      district: null,
    };
  }
  if ((m = contest.match(/^NC HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/))) {
    const d = parseInt(m[1], 10);
    return { id: `nc-house-${pad(d, 3)}`, category: "nc-house", title: `NC House District ${d}`, district: d };
  }
  if ((m = contest.match(/^NC STATE SENATE DISTRICT (\d+)$/))) {
    const d = parseInt(m[1], 10);
    return { id: `nc-senate-${pad(d, 2)}`, category: "nc-senate", title: `NC Senate District ${d}`, district: d };
  }
  return null;
}

async function main() {
  const markCertified = process.argv.includes("--certified");
  const existing: ElectionResults | null = existsSync(ELECTION.file)
    ? JSON.parse(readFileSync(ELECTION.file, "utf8"))
    : null;
  if (existing?.certified && !markCertified) {
    console.log("Results are certified; nothing to update.");
    return;
  }

  const res = await fetch(ELECTION.url);
  if (!res.ok) throw new Error(`Results download failed: HTTP ${res.status}`);
  const lastModified = res.headers.get("last-modified");
  const sourceUpdated = lastModified ? new Date(lastModified).toISOString() : new Date().toISOString();
  if (existing?.races && existing.sourceUpdated === sourceUpdated && !markCertified) {
    console.log(`State Board results unchanged since ${sourceUpdated}.`);
    return;
  }

  const files = unzip(Buffer.from(await res.arrayBuffer()));
  const txt = Array.from(files.entries()).find(([name]) => name.endsWith(".txt"))?.[1];
  if (!txt) throw new Error("No results .txt in the State Board zip");

  const [header, ...rows] = txt.toString("utf8").split(/\r?\n/);
  const col = Object.fromEntries(header.split("\t").map((h, i) => [h.trim(), i]));
  for (const needed of ["County", "Contest Name", "Choice", "Choice Party", "Total Votes"]) {
    if (!(needed in col)) throw new Error(`Results file is missing the "${needed}" column`);
  }

  // contest name -> { counties, choice -> { party, votes } }
  const totals = new Map<string, { counties: Set<string>; choices: Map<string, { party: string; votes: number }> }>();
  for (const line of rows) {
    if (!line) continue;
    // Some cells carry stray control characters (e.g. a NUL as a write-in's
    // party), which would render inconsistently in the browser.
    const c = line.split("\t").map((cell) => cell.replace(/[\u0000-\u001f\u007f]/g, ""));
    const contest = c[col["Contest Name"]];
    if (!classify(contest)) continue;
    const entry = totals.get(contest) ?? { counties: new Set<string>(), choices: new Map() };
    entry.counties.add(c[col["County"]]);
    const choice = c[col["Choice"]].trim();
    const t = entry.choices.get(choice) ?? { party: c[col["Choice Party"]].trim(), votes: 0 };
    t.votes += Number(c[col["Total Votes"]]) || 0;
    entry.choices.set(choice, t);
    totals.set(contest, entry);
  }

  const order: RaceCategory[] = ["federal", "courts", "amendments", "nc-senate", "nc-house"];
  const races: Race[] = Array.from(totals.entries())
    .map(([contest, entry]) => {
      const info = classify(contest)!;
      const n = entry.counties.size;
      const candidates: ElectionCandidate[] = Array.from(entry.choices.entries())
        .map(([name, t]) => ({ name, party: PARTY[t.party] ?? (t.party || null), votes: t.votes }))
        .sort((a, b) => b.votes - a.votes);
      return {
        ...info,
        contest,
        area: n >= 100 ? "Statewide" : n === 1 ? `${titleCase(Array.from(entry.counties)[0])} County` : `${n} counties`,
        statewide: n >= 100,
        candidates,
      };
    })
    // Within a category: the top race first (US Senate, Supreme Court), then by id.
    .sort((a, b) => {
      const top = (r: Race) => (r.id === "us-senate" || r.id.startsWith("nc-supreme-court") ? 0 : 1);
      return order.indexOf(a.category) - order.indexOf(b.category) || top(a) - top(b) || a.id.localeCompare(b.id);
    });

  const count = (cat: RaceCategory) => races.filter((r) => r.category === cat).length;
  if (count("nc-house") !== 120 || count("nc-senate") !== 50 || count("federal") !== 15) {
    throw new Error(
      `Expected 15 federal, 50 NC Senate, and 120 NC House races; got ${count("federal")}, ${count("nc-senate")}, ${count("nc-house")}`
    );
  }

  const results: ElectionResults = {
    election: ELECTION.date,
    name: ELECTION.name,
    source: ELECTION.url,
    sourceUpdated,
    certified: markCertified || (existing?.certified ?? false),
    races,
  };

  mkdirSync(dirname(ELECTION.file), { recursive: true });
  writeFileSync(ELECTION.file, formatDataFile(results));
  console.log(
    `Wrote ${ELECTION.file}: ${races.length} races (${order.map((c) => `${count(c)} ${c}`).join(", ")}); ` +
      `State Board file updated ${sourceUpdated}, ${results.certified ? "certified" : "unofficial"}.`
  );
}

main().catch((err) => {
  console.error("Election results update failed:", err);
  process.exit(1);
});

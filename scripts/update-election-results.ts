// Downloads the NC State Board of Elections' precinct-level results for the
// 2026 general election and writes statewide totals for the constitutional
// amendments and all 170 NC House/Senate races to
// data/elections/2026-general.json. Run daily by the data-update workflow
// until the results are certified; it does nothing once `certified` is true or
// when the State Board's file hasn't changed.
//
// Usage:
//   npx tsx scripts/update-election-results.ts              refresh if changed
//   npx tsx scripts/update-election-results.ts --certified  also mark as certified
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { formatDataFile } from "../lib/data/format";
import type { ElectionCandidate, ElectionResults, LegislativeContest } from "../lib/data/types";
import { unzip } from "../lib/zip";

const ELECTION = {
  date: "2026-11-03",
  name: "2026 General Election",
  url: "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip",
  file: "data/elections/2026-general.json",
};

const PARTY: Record<string, string> = { REP: "R", DEM: "D", LIB: "L", GRE: "G" };

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
  if (existing && existing.sourceUpdated === sourceUpdated && !markCertified) {
    console.log(`State Board results unchanged since ${sourceUpdated}.`);
    return;
  }

  const files = unzip(Buffer.from(await res.arrayBuffer()));
  const txt = Array.from(files.entries()).find(([name]) => name.endsWith(".txt"))?.[1];
  if (!txt) throw new Error("No results .txt in the State Board zip");

  const [header, ...rows] = txt.toString("utf8").split(/\r?\n/);
  const col = Object.fromEntries(header.split("\t").map((h, i) => [h.trim(), i]));
  for (const needed of ["Contest Name", "Choice", "Choice Party", "Total Votes"]) {
    if (!(needed in col)) throw new Error(`Results file is missing the "${needed}" column`);
  }

  // contest name -> choice -> { party, votes }
  const totals = new Map<string, Map<string, { party: string; votes: number }>>();
  for (const line of rows) {
    if (!line) continue;
    const c = line.split("\t");
    const contest = c[col["Contest Name"]];
    if (!/^CONSTITUTIONAL AMENDMENT|^NC HOUSE OF REPRESENTATIVES DISTRICT|^NC STATE SENATE DISTRICT/.test(contest)) continue;
    const choice = c[col["Choice"]].trim();
    const byChoice = totals.get(contest) ?? new Map();
    const t = byChoice.get(choice) ?? { party: c[col["Choice Party"]].trim(), votes: 0 };
    t.votes += Number(c[col["Total Votes"]]) || 0;
    byChoice.set(choice, t);
    totals.set(contest, byChoice);
  }

  const candidatesOf = (contest: string): ElectionCandidate[] =>
    Array.from(totals.get(contest)!.entries())
      .map(([name, t]) => ({ name, party: PARTY[t.party] ?? (t.party || null), votes: t.votes }))
      .sort((a, b) => b.votes - a.votes);

  const legislative = (prefix: string): LegislativeContest[] =>
    Array.from(totals.keys())
      .filter((name) => name.startsWith(prefix))
      .map((name) => ({ district: parseInt(name.slice(prefix.length), 10), candidates: candidatesOf(name) }))
      .sort((a, b) => a.district - b.district);

  const results: ElectionResults = {
    election: ELECTION.date,
    name: ELECTION.name,
    source: ELECTION.url,
    sourceUpdated,
    certified: markCertified || (existing?.certified ?? false),
    amendments: Array.from(totals.keys())
      .filter((name) => name.startsWith("CONSTITUTIONAL AMENDMENT"))
      .sort()
      .map((contest) => {
        const byChoice = totals.get(contest)!;
        return { contest, for: byChoice.get("For")?.votes ?? 0, against: byChoice.get("Against")?.votes ?? 0 };
      }),
    house: legislative("NC HOUSE OF REPRESENTATIVES DISTRICT "),
    senate: legislative("NC STATE SENATE DISTRICT "),
  };

  if (results.house.length !== 120 || results.senate.length !== 50) {
    throw new Error(`Expected 120 House and 50 Senate contests, got ${results.house.length} and ${results.senate.length}`);
  }

  mkdirSync(dirname(ELECTION.file), { recursive: true });
  writeFileSync(ELECTION.file, formatDataFile(results));
  console.log(
    `Wrote ${ELECTION.file}: ${results.amendments.length} amendments, ${results.house.length} House and ` +
      `${results.senate.length} Senate races (State Board file updated ${sourceUpdated}` +
      `${results.certified ? ", certified" : ", unofficial"}).`
  );
}

main().catch((err) => {
  console.error("Election results update failed:", err);
  process.exit(1);
});

// One-time build of data/elections/2026-general-turnout.json: registered
// voters for each NC House/Senate district, plus the same district's 2024
// numbers and statewide turnout for 2022, 2024 and 2026, so the results pages
// can show turnout and compare it with earlier elections.
//
// Inputs, downloaded by this script from the State Board of Elections:
//   results_pct_<date>.zip   precinct results (2022, 2024)
//   voter_stats_<date>.zip   registered voters by precinct on Election Day
//
// Turnout here = votes cast in a race / registered voters. People who skip a
// race aren't counted, so it runs a few points below ballots-cast turnout;
// it's the same measure for every year, so the comparisons hold.
//
// Registered voters per district: each precinct's voters go to the district
// it's in. A precinct split between districts is shared out in proportion to
// the votes each district's race got there.
//
// 2026 votes aren't stored here: the pages read them from the live results.
// Re-run (npx tsx scripts/build-turnout.ts) only if districts or registration
// figures change.
import { writeFileSync } from "fs";
import { unzip } from "../lib/zip";
import { precinctKey } from "../lib/precincts";

const SBE = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS";
const OUT = "data/elections/2026-general-turnout.json";

type Year = { year: number; dir: string; date: string; top: string; topLabel: string; kind: string };
const YEARS: Year[] = [
  { year: 2022, dir: "2022_11_08", date: "20221108", top: "US SENATE", topLabel: "US Senate", kind: "Midterm" },
  { year: 2024, dir: "2024_11_05", date: "20241105", top: "US PRESIDENT", topLabel: "President", kind: "Presidential" },
  { year: 2026, dir: "2026_11_03", date: "20261103", top: "US SENATE", topLabel: "US Senate", kind: "Midterm" },
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const files = unzip(Buffer.from(await res.arrayBuffer()));
  const txt = Array.from(files.entries()).find(([name]) => name.endsWith(".txt"));
  if (!txt) throw new Error(`${url}: no .txt inside`);
  return txt[1].toString("utf8");
}

function table(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("\t").map((h) => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  return { col, rows: lines.slice(1).map((l) => l.split("\t")) };
}

function raceIdOf(contest: string): string | null {
  let m = contest.match(/^NC HOUSE OF REPRESENTATIVES DISTRICT 0*(\d+)$/);
  if (m) return `nc-house-${m[1].padStart(3, "0")}`;
  m = contest.match(/^NC STATE SENATE DISTRICT 0*(\d+)$/);
  if (m) return `nc-senate-${m[1].padStart(2, "0")}`;
  return null;
}

async function registration(y: Year) {
  const { col, rows } = table(await fetchText(`${SBE}/${y.dir}/voter_stats_${y.date}.zip`));
  const byPrecinct = new Map<string, number>();
  let total = 0;
  for (const c of rows) {
    if (c[col.stats_type]?.trim() !== "voter") continue;
    const n = Number(c[col.total_voters]) || 0;
    const key = precinctKey(c[col.county_desc], c[col.precinct_abbrv]);
    byPrecinct.set(key, (byPrecinct.get(key) ?? 0) + n);
    total += n;
  }
  return { byPrecinct, total };
}

// Votes per legislative race (all rows) and per race per real precinct, plus
// the statewide total for the top-of-ticket contest.
async function results(y: Year, resultsText?: string) {
  const { col, rows } = table(resultsText ?? (await fetchText(`${SBE}/${y.dir}/results_pct_${y.date}.zip`)));
  const raceTotal = new Map<string, number>();
  const racePrecincts = new Map<string, Map<string, number>>();
  const raceChoices = new Map<string, Set<string>>();
  let topVotes = 0;
  for (const c of rows) {
    const contest = c[col["Contest Name"]]?.trim() ?? "";
    const votes = Number(c[col["Total Votes"]]) || 0;
    if (contest === y.top) topVotes += votes;
    const id = raceIdOf(contest);
    if (!id) continue;
    raceTotal.set(id, (raceTotal.get(id) ?? 0) + votes);
    const choice = c[col.Choice]?.trim() ?? "";
    if (!/^write-in/i.test(choice)) raceChoices.set(id, (raceChoices.get(id) ?? new Set()).add(choice));
    if (c[col["Real Precinct"]]?.trim() !== "Y") continue;
    const key = precinctKey(c[col.County], c[col.Precinct]);
    const m = racePrecincts.get(id) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + votes);
    racePrecincts.set(id, m);
  }
  return { raceTotal, racePrecincts, raceChoices, topVotes };
}

// Shares each precinct's registered voters among the races (of one chamber)
// that got votes there, in proportion to those votes.
function registeredByRace(racePrecincts: Map<string, Map<string, number>>, reg: Map<string, number>) {
  const out = new Map<string, number>();
  for (const chamber of ["nc-house", "nc-senate"]) {
    const ids = Array.from(racePrecincts.keys()).filter((id) => id.startsWith(chamber + "-"));
    const precinctSum = new Map<string, number>();
    for (const id of ids) racePrecincts.get(id)!.forEach((v, k) => precinctSum.set(k, (precinctSum.get(k) ?? 0) + v));
    let matched = 0;
    for (const id of ids) {
      let r = 0;
      racePrecincts.get(id)!.forEach((v, k) => {
        const sum = precinctSum.get(k)!;
        if (sum > 0) r += (reg.get(k) ?? 0) * (v / sum);
      });
      out.set(id, Math.round(r));
      matched += r;
    }
    let total = 0;
    reg.forEach((n) => (total += n));
    console.log(`  ${chamber}: ${((100 * matched) / total).toFixed(1)}% of registered voters matched to a district`);
  }
  return out;
}

function overlap(a: Map<string, number> | undefined, b: Map<string, number> | undefined) {
  if (!a || !b) return 0;
  let both = 0;
  a.forEach((_, k) => b.has(k) && both++);
  return both / new Set(Array.from(a.keys()).concat(Array.from(b.keys()))).size;
}

async function main() {
  const data: Record<number, { reg: Awaited<ReturnType<typeof registration>>; res: Awaited<ReturnType<typeof results>> }> = {};
  for (const y of YEARS) {
    console.log(`${y.year}: downloading…`);
    const [reg, res] = await Promise.all([registration(y), results(y)]);
    data[y.year] = { reg, res };
  }

  console.log("2026 districts:");
  const reg2026 = registeredByRace(data[2026].res.racePrecincts, data[2026].reg.byPrecinct);
  console.log("2024 districts:");
  const reg2024 = registeredByRace(data[2024].res.racePrecincts, data[2024].reg.byPrecinct);

  const races: Record<string, unknown> = {};
  let comparable = 0;
  for (const id of Array.from(reg2026.keys()).sort()) {
    // Same district lines? Compare which precincts voted in the race.
    const same = overlap(data[2026].res.racePrecincts.get(id), data[2024].res.racePrecincts.get(id)) >= 0.85;
    if (same) comparable++;
    races[id] = {
      registered: reg2026.get(id),
      prev: same
        ? {
            year: 2024,
            votes: data[2024].res.raceTotal.get(id) ?? 0,
            registered: reg2024.get(id) ?? 0,
            unopposed: (data[2024].res.raceChoices.get(id)?.size ?? 0) <= 1,
          }
        : null,
    };
  }
  console.log(`${comparable} of ${reg2026.size} districts comparable with 2024`);

  const out = {
    note: "Built by scripts/build-turnout.ts from State Board of Elections voter_stats and results files.",
    statewide: YEARS.map((y) => ({
      year: y.year,
      kind: y.kind,
      top: y.topLabel,
      registered: data[y.year].reg.total,
      // 2026 votes come from the live results file instead.
      votes: y.year === 2026 ? null : data[y.year].res.topVotes,
    })),
    races,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`Wrote ${OUT}`);
  for (const s of out.statewide) {
    console.log(`  ${s.year}: ${s.registered.toLocaleString("en-US")} registered${s.votes ? `, ${s.votes.toLocaleString("en-US")} votes (${((100 * s.votes) / s.registered).toFixed(1)}%)` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

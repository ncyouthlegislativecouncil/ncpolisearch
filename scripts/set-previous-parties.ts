// Records which party held each seat going into the 2026 election
// (Race.previousParty in data/elections/2026-general.json), so the results
// page can mark flips. Run once, right after the results were first recorded,
// while the roster still reflects the pre-election legislature; the results
// update carries the values forward. Re-running after January 2027 would
// pick up the NEW members, so don't.
//
//   npx tsx scripts/set-previous-parties.ts   (needs .data-index: run `npm run data:index` first)
import { readFileSync, writeFileSync } from "fs";
import { formatDataFile } from "../lib/data/format";
import type { ElectionResults } from "../lib/data/types";
import { currentMembers } from "../lib/legislators";

const FILE = "data/elections/2026-general.json";

// Seats outside the legislature, by the party that won them last time:
// US Senate (Thom Tillis, R, did not seek reelection), US House per the 2024
// results, and the NC Supreme Court seat held by Anita Earls (D). Court of
// Appeals seats are left unknown.
const FEDERAL_AND_COURTS: Record<string, string> = {
  "us-senate": "R",
  "us-house-01": "D",
  "us-house-02": "D",
  "us-house-03": "R",
  "us-house-04": "D",
  "us-house-05": "R",
  "us-house-06": "R",
  "us-house-07": "R",
  "us-house-08": "R",
  "us-house-09": "R",
  "us-house-10": "R",
  "us-house-11": "R",
  "us-house-12": "D",
  "us-house-13": "R",
  "us-house-14": "R",
  "nc-supreme-court-01": "D",
};

function main() {
  const results: ElectionResults = JSON.parse(readFileSync(FILE, "utf8"));

  // The sitting member per legislative seat (including any who resigned and
  // whose replacement isn't on file yet — vacancies are filled by the same
  // party, so the seat's party is still right).
  const seatParty = new Map<string, string>();
  for (const l of currentMembers((x) => !!x.party)) {
    const d = parseInt(l.district?.match(/\d+/)?.[0] ?? "", 10);
    seatParty.set(`${l.role === "Rep" ? "nc-house" : "nc-senate"}|${d}`, l.party!);
  }

  let set = 0;
  for (const race of results.races) {
    const party =
      race.category === "nc-house" || race.category === "nc-senate"
        ? seatParty.get(`${race.category}|${race.district}`)
        : FEDERAL_AND_COURTS[race.id];
    race.previousParty = party ?? null;
    if (party) set++;
  }

  writeFileSync(FILE, formatDataFile(results));
  console.log(`previousParty set for ${set} of ${results.races.length} races`);
}

main();

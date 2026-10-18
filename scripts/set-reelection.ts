// Sets a legislator's 2026 reelection status in data/legislators.json.
// Commit and push the change to publish it.
//
// Usage:
//   npx tsx scripts/set-reelection.ts <peopleId> <true|false|unknown>
//   npx tsx scripts/set-reelection.ts --list-unknown
import { readFileSync, writeFileSync } from "fs";
import { formatDataFile } from "../lib/data/format";
import type { Legislator } from "../lib/data/types";

const FILE = "data/legislators.json";

function main() {
  const legislators: Legislator[] = JSON.parse(readFileSync(FILE, "utf8"));

  if (process.argv[2] === "--list-unknown") {
    for (const l of legislators.filter((x) => x.runningForReelection == null && (x.role === "Rep" || x.role === "Sen"))) {
      console.log(`${l.peopleId}\t${l.name}\t${l.role} ${l.district}`);
    }
    return;
  }

  const [idArg, statusArg] = process.argv.slice(2);
  const status = statusArg === "true" ? true : statusArg === "false" ? false : statusArg === "unknown" ? null : undefined;
  const leg = legislators.find((l) => String(l.peopleId) === idArg);
  if (!leg || status === undefined) {
    console.error("Usage: npx tsx scripts/set-reelection.ts <peopleId> <true|false|unknown>");
    process.exit(1);
  }
  leg.runningForReelection = status;
  writeFileSync(FILE, formatDataFile(legislators));
  console.log(`${leg.name}: runningForReelection = ${status}`);
}

main();

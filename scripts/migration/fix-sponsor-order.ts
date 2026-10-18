// Puts each bill's sponsors in LegiScan's official order (sponsor_order) using
// the bulk dataset in backup/legiscan-dataset/. Only reorders — the set of
// sponsors in each file is left exactly as it was.
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { formatDataFile } from "../../lib/data/format";
import type { BillFile } from "../../lib/data/types";

const DS = join("backup", "legiscan-dataset", "NC", "2025-2026_Regular_Session", "bill");

function main() {
  const official = new Map<number, number[]>();
  for (const f of readdirSync(DS)) {
    const { bill } = JSON.parse(readFileSync(join(DS, f), "utf8"));
    const order = [...(bill.sponsors ?? [])]
      .sort((a: { sponsor_order: number }, b: { sponsor_order: number }) => a.sponsor_order - b.sponsor_order)
      .map((s: { people_id: number }) => s.people_id);
    official.set(bill.bill_id, order);
  }

  let reordered = 0;
  let notInDataset = 0;
  let setDiffers = 0;
  for (const f of readdirSync(join("data", "bills"))) {
    const path = join("data", "bills", f);
    const bill: BillFile = JSON.parse(readFileSync(path, "utf8"));
    const order = official.get(bill.billId);
    if (!order) {
      notInDataset++;
      continue;
    }
    const rank = (pid: number | null) => {
      const i = pid == null ? -1 : order.indexOf(pid);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const ids = (list: { peopleId: number | null }[]) => list.map((s) => s.peopleId).sort().join(",");
    const officialPeople = order.filter((pid) => bill.sponsors.some((s) => s.peopleId === pid));
    if (officialPeople.length !== bill.sponsors.length) setDiffers++;

    const before = ids(bill.sponsors) + "|" + bill.sponsors.map((s) => s.peopleId).join(",");
    const sorted = bill.sponsors
      .map((s, i) => ({ s, i }))
      .sort((a, b) => rank(a.s.peopleId) - rank(b.s.peopleId) || a.i - b.i)
      .map(({ s }) => s);
    const after = ids(sorted) + "|" + sorted.map((s) => s.peopleId).join(",");
    if (before !== after) {
      bill.sponsors = sorted;
      writeFileSync(path, formatDataFile(bill));
      reordered++;
    }
  }
  console.log(`reordered ${reordered} bills; ${notInDataset} not in dataset; ${setDiffers} with sponsors LegiScan no longer lists (kept, placed last)`);
}

main();

// Side-by-side check: runs the new file-backed data functions on exactly the
// inputs captured in backup/snapshot-old/ (outputs of the old database-backed
// functions) and reports any differences.
//
// Postgres returned rows that tie on the ORDER BY key in no particular order,
// so for ordered lists we require: identical length, identical sequence of sort
// keys, identical item sets within each tie group, and identical item contents.
// When a list is a page/slice of a longer result, tie groups touching the page
// edges may legitimately contain different items; those are reported
// separately as "boundary ties", not as failures.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import * as billsLib from "../../lib/bills";
import * as legsLib from "../../lib/legislators";
import * as votesLib from "../../lib/votes";
import * as districtLib from "../../lib/district";
import { billById } from "../../lib/data/store";
import { BILL_FILTER_CASES, LEGISLATOR_FILTER_CASES, LITE_SEARCHES } from "./cases";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const SNAP = join("backup", "snapshot-old");
const snap = (name: string): Any => JSON.parse(readFileSync(join(SNAP, `${name}.json`), "utf8"));
const norm = (v: unknown): Any => JSON.parse(JSON.stringify(v ?? null));

let checks = 0;
const failures: string[] = [];
const boundaryTies: string[] = [];
const fail = (msg: string) => failures.push(msg);

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameFields(path: string, oldObj: Any, newObj: Any, skip: string[] = []) {
  checks++;
  if (oldObj == null || newObj == null) {
    if (oldObj !== newObj) fail(`${path}: one side is null (old=${JSON.stringify(oldObj)?.slice(0, 80)}, new=${JSON.stringify(newObj)?.slice(0, 80)})`);
    return;
  }
  for (const k of Object.keys(newObj)) {
    if (skip.includes(k) || !(k in oldObj)) continue;
    if (!deepEqual(oldObj[k], newObj[k])) {
      fail(`${path}.${k}: old=${JSON.stringify(oldObj[k])?.slice(0, 120)} new=${JSON.stringify(newObj[k])?.slice(0, 120)}`);
    }
  }
}

function orderedList(
  path: string,
  oldList: Any[],
  newList: Any[],
  key: (x: Any) => unknown,
  id: (x: Any) => unknown,
  opts: { paged?: boolean; compareItems?: (p: string, o: Any, n: Any) => void } = {}
) {
  checks++;
  if (oldList.length !== newList.length) {
    fail(`${path}: length old=${oldList.length} new=${newList.length}`);
    return;
  }
  const ok = oldList.map((x) => JSON.stringify(key(x)));
  const nk = newList.map((x) => JSON.stringify(key(x)));
  if (!deepEqual(ok, nk)) {
    const i = ok.findIndex((k, j) => k !== nk[j]);
    fail(`${path}: sort keys differ at #${i}: old=${ok[i]} new=${nk[i]}`);
    return;
  }
  // Tie groups.
  let start = 0;
  while (start < ok.length) {
    let end = start;
    while (end + 1 < ok.length && ok[end + 1] === ok[start]) end++;
    const oldIds = oldList.slice(start, end + 1).map(id).map(String).sort();
    const newIds = newList.slice(start, end + 1).map(id).map(String).sort();
    if (!deepEqual(oldIds, newIds)) {
      const atEdge = opts.paged && (start === 0 || end === ok.length - 1);
      (atEdge ? boundaryTies : failures).push(`${path}: tie group key=${ok[start]} items differ (old ${oldIds.length}, new ${newIds.length})`);
    }
    start = end + 1;
  }
  // Item contents, matched by id.
  const byId = new Map(oldList.map((x) => [String(id(x)), x]));
  for (const n of newList) {
    const o = byId.get(String(id(n)));
    if (!o) continue;
    if (opts.compareItems) opts.compareItems(`${path}[${id(n)}]`, o, n);
    else sameFields(`${path}[${id(n)}]`, o, n);
  }
}

const lastActionKey = (b: Any) => b.lastActionDate ?? null;

async function compareHome() {
  const old = snap("home");
  sameFields("home.stats", old.stats, norm(await billsLib.getHomeStats()));

  const feed = norm(await billsLib.getHomeFeed(5));
  sameFields("home.feed.featured", old.feed.featured, feed.featured);
  orderedList("home.feed.recent", old.feed.recent, feed.recent, lastActionKey, (b) => b.billId, { paged: true });

  orderedList("home.ticker", old.ticker, norm(await billsLib.getTickerBills(20)), lastActionKey, (b) => b.billId, { paged: true });
  const count = (x: Any) => x.billCount;
  orderedList("home.topRep", old.topRep, norm(await legsLib.getTopSponsors("Rep", 50)), count, (x) => x.peopleId, { paged: true });
  orderedList("home.topSen", old.topSen, norm(await legsLib.getTopSponsors("Sen", 50)), count, (x) => x.peopleId, { paged: true });
  orderedList("home.topOverall", old.topOverall, norm(await legsLib.getTopSponsorsOverall(3)), count, (x) => x.peopleId, { paged: true });

  checks++;
  if (!deepEqual(old.partyMap, norm(await districtLib.getDistrictPartyMap()))) fail("home.partyMap differs");
  checks++;
  const ids = (await billsLib.getAllBillIds()).sort((a, b) => a - b);
  if (!deepEqual(old.allBillIds, ids)) fail("home.allBillIds differ");
  checks++;
  if (old.billCount !== ids.length) fail(`home.billCount old=${old.billCount} new=${ids.length}`);
}

async function compareLists() {
  const old = snap("lists");
  for (const [name, filters] of Object.entries(BILL_FILTER_CASES)) {
    const o = old.bills[name];
    const n = norm(await billsLib.getBills({ ...filters, pageSize: 24 }));
    const path = `bills[${name}]`;
    checks++;
    if (o.total !== n.total) fail(`${path}.total old=${o.total} new=${n.total}`);
    const key =
      filters.sort === "title" ? (b: Any) => b.title : lastActionKey;
    orderedList(`${path}.rows`, o.bills, n.bills, key, (b) => b.billId, { paged: true });
    for (const idStr of Object.keys(n.sponsorMap)) {
      if (idStr in o.sponsorMap) {
        checks++;
        if (o.sponsorMap[idStr] !== n.sponsorMap[idStr]) fail(`${path}.sponsorMap[${idStr}] old=${o.sponsorMap[idStr]} new=${n.sponsorMap[idStr]}`);
      }
    }
  }
  for (const [name, filters] of Object.entries(LEGISLATOR_FILTER_CASES)) {
    const n = norm(await legsLib.getLegislators(filters));
    const lastName = (x: Any) => [String(x.name ?? "").replace(/^[\s\S]*\s/, "").toLowerCase(), String(x.name ?? "").toLowerCase()];
    orderedList(`legislators[${name}]`, old.legs[name], n, lastName, (x) => x.peopleId);
  }
  for (const q of LITE_SEARCHES) {
    const n = norm(await billsLib.searchBillsLite(q));
    const withDate = (list: Any[]) => list.map((b) => ({ ...b, _d: billById(b.billId)?.lastActionDate ?? null }));
    orderedList(`lite[${JSON.stringify(q)}]`, withDate(old.lite[q]), withDate(n), (b) => b._d, (b) => b.billId, { paged: true });
  }
}

async function compareDistricts() {
  for (const chamber of ["house", "senate"] as const) {
    const old = snap(`districts-${chamber}`);
    for (const d of Object.keys(old)) {
      const o = old[d];
      const n = norm(await districtLib.getDistrictLegislator(chamber, Number(d)));
      const path = `district[${chamber} ${d}]`;
      if (o == null || n == null) {
        checks++;
        if (o !== n) fail(`${path}: old=${o == null ? "null" : o.name} new=${n == null ? "null" : n.name}`);
        continue;
      }
      sameFields(path, o, n, ["recentBills", "recentVotes"]);
      const billDate = (b: Any) => billById(b.billId)?.lastActionDate ?? null;
      orderedList(`${path}.recentBills`, o.recentBills, n.recentBills, billDate, (b) => b.billId, { paged: true });
      orderedList(`${path}.recentVotes`, o.recentVotes, n.recentVotes, (v) => v.date, (v) => v.rollCallId, { paged: true });
    }
  }
}

async function compareLegislators() {
  for (const file of readdirSync(SNAP).filter((f) => f.startsWith("legislators-"))) {
    const old = snap(file.replace(/\.json$/, ""));
    for (const idStr of Object.keys(old)) {
      const id = Number(idStr);
      const o = old[idStr];
      const path = `legislator[${id}]`;
      sameFields(`${path}.row`, o.legislator, norm(await legsLib.getLegislator(id)));

      const bills = norm(await legsLib.getLegislatorBills(id));
      orderedList(`${path}.sponsored`, o.bills.sponsored, bills.sponsored, lastActionKey, (b) => b.billId);
      orderedList(`${path}.cosponsored`, o.bills.cosponsored, bills.cosponsored, lastActionKey, (b) => b.billId);

      sameFields(`${path}.voteSummary`, o.voteSummary, norm(await votesLib.getLegislatorVoteSummary(id)));
      for (const [k, page] of [["votesPage1", 1], ["votesPage2", 2], ["votesPage20", 20]] as const) {
        const n = norm(await votesLib.getLegislatorVotes(id, page, 10));
        checks++;
        if (o[k].total !== n.total) fail(`${path}.${k}.total old=${o[k].total} new=${n.total}`);
        orderedList(`${path}.${k}`, o[k].rows, n.rows, (r) => r.date, (r) => r.rollCallId, { paged: true });
      }

      checks++;
      const nu = await votesLib.getPartyUnity(id);
      if ((o.unity == null) !== (nu == null) || (o.unity != null && Math.abs(o.unity - (nu as number)) > 1e-12)) {
        fail(`${path}.unity old=${o.unity} new=${nu}`);
      }
    }
  }
}

async function compareBills() {
  let tiedLatestVote = 0;
  for (const file of readdirSync(SNAP).filter((f) => f.startsWith("bills-"))) {
    const old = snap(file.replace(/\.json$/, ""));
    for (const idStr of Object.keys(old)) {
      const id = Number(idStr);
      const o = old[idStr];
      const path = `bill[${id}]`;

      const nb = norm(await billsLib.getBill(id));
      sameFields(`${path}.row`, o.bill, nb);
      checks++;
      const oldKeys = Object.keys(o.bill).filter((k) => k !== "billText").sort();
      const missing = oldKeys.filter((k) => !(k in (nb ?? {})));
      if (missing.length) fail(`${path}.row missing fields: ${missing.join(",")}`);

      const ns = norm(await billsLib.getBillSponsors(id));
      for (const k of ["sponsors", "cosponsors"] as const) {
        checks++;
        if (!deepEqual(o.sponsors[k], ns[k])) {
          const sortKey = (x: Any) => JSON.stringify(x);
          if (deepEqual([...o.sponsors[k]].map(sortKey).sort(), [...ns[k]].map(sortKey).sort())) {
            fail(`${path}.${k}: same people, different order`);
          } else {
            fail(`${path}.${k}: differ (old ${o.sponsors[k].length}, new ${ns[k].length})`);
          }
        }
      }

      const nv = norm(await votesLib.getBillVotes(id));
      orderedList(`${path}.votes`, o.votes, nv, (rc) => rc.date, (rc) => rc.rollCallId, {
        compareItems: (p, ov, nvItem) => {
          sameFields(p, ov, nvItem, ["members"]);
          checks++;
          if (!deepEqual(ov.members, nvItem.members)) {
            const sk = (m: Any) => JSON.stringify(m);
            const sameSet = deepEqual(ov.members.map(sk).sort(), nvItem.members.map(sk).sort());
            fail(`${p}.members ${sameSet ? "same votes, different order" : "differ"}`);
          }
        },
      });

      const nsum = norm(await votesLib.getBillVoteSummary(id));
      checks++;
      if (!deepEqual(o.voteSummary, nsum)) {
        const latestDate = o.voteSummary?.date;
        const sameDay = o.votes.filter((rc: Any) => rc.date === latestDate).length;
        if (o.voteSummary && nsum && sameDay > 1 && o.voteSummary.date === nsum.date && o.voteSummary.rollCalls === nsum.rollCalls) {
          tiedLatestVote++;
          boundaryTies.push(`${path}.voteSummary: ${sameDay} roll calls share the latest date; picked a different one`);
        } else {
          fail(`${path}.voteSummary old=${JSON.stringify(o.voteSummary)} new=${JSON.stringify(nsum)}`);
        }
      }
    }
  }
  return tiedLatestVote;
}

function compareWriteData() {
  const old = snap("write-data");
  const bills = billsLib.getBillsForPicker();
  const withDate = (list: Any[]) => list.map((b) => ({ ...b, _d: billById(b.id)?.lastActionDate ?? null }));
  orderedList("writeData.bills", withDate(old.bills), withDate(bills), (b) => b._d, (b) => b.id);
}

async function main() {
  const t = Date.now();
  await compareHome();
  await compareLists();
  await compareDistricts();
  await compareLegislators();
  await compareBills();
  compareWriteData();

  console.log(`\n${checks} checks in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  console.log(`Boundary/tie-order differences (expected, not failures): ${boundaryTies.length}`);
  for (const b of boundaryTies.slice(0, 15)) console.log("  ~ " + b);
  console.log(`FAILURES: ${failures.length}`);
  for (const f of failures.slice(0, 60)) console.log("  ✗ " + f);
  if (process.env.DUMP) require("fs").writeFileSync(process.env.DUMP, JSON.stringify({ failures, boundaryTies }, null, 1));
  if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

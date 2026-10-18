// Builds the lookup files the site reads at request time (.data-index/, not
// committed) from the committed data files (data/). Runs automatically before
// `next dev` and `next build` (see package.json), so the index always matches
// the data being deployed.
//
//   bills.json              every bill minus its roll calls (list/search/filters)
//   legislators.json        copy of data/legislators.json
//   rollcalls.json          roll-call metadata (no member votes)
//   legislator-stats.json   per-legislator vote totals + party-unity score
//   legislator-votes/<id>.json  [rollCallId, vote] pairs for one legislator
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import type { BillFile, Legislator } from "../lib/data/types";

const DATA = "data";
const OUT = ".data-index";

function main() {
  const started = Date.now();
  const legislators: Legislator[] = JSON.parse(readFileSync(join(DATA, "legislators.json"), "utf8"));
  const files = readdirSync(join(DATA, "bills")).filter((f) => f.endsWith(".json"));
  const bills: BillFile[] = files.map((f) => JSON.parse(readFileSync(join(DATA, "bills", f), "utf8")));
  bills.sort((a, b) => a.billId - b.billId);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "legislator-votes"), { recursive: true });

  writeFileSync(join(OUT, "legislators.json"), JSON.stringify(legislators));
  writeFileSync(join(OUT, "bills.json"), JSON.stringify(bills.map(({ rollCalls: _rc, ...rest }) => rest))); // eslint-disable-line @typescript-eslint/no-unused-vars

  const rollCalls = bills.flatMap((b) =>
    b.rollCalls.map(({ votes: _v, ...rc }) => ({ ...rc, billId: b.billId })) // eslint-disable-line @typescript-eslint/no-unused-vars
  );
  writeFileSync(join(OUT, "rollcalls.json"), JSON.stringify(rollCalls));

  // Majority position of each party on each roll call, counting only decisive
  // (Yea/Nay) votes; ties count as Yea. Mirrors the old SQL's party_majority CTE.
  const majority = new Map<string, "Yea" | "Nay">();
  const tally = new Map<string, { yea: number; nay: number }>();
  for (const b of bills) {
    for (const rc of b.rollCalls) {
      for (const v of rc.votes) {
        if ((v.party !== "R" && v.party !== "D") || (v.vote !== "Yea" && v.vote !== "Nay")) continue;
        const key = `${rc.rollCallId}:${v.party}`;
        const t = tally.get(key) ?? { yea: 0, nay: 0 };
        if (v.vote === "Yea") t.yea++;
        else t.nay++;
        tally.set(key, t);
      }
    }
  }
  for (const [key, t] of Array.from(tally)) majority.set(key, t.yea >= t.nay ? "Yea" : "Nay");

  type Stats = { total: number; yea: number; nay: number; notVoting: number; absent: number; partyLine: number; totalCast: number };
  const stats = new Map<number, Stats>();
  const votesByPerson = new Map<number, [number, string | null][]>();
  for (const b of bills) {
    for (const rc of b.rollCalls) {
      for (const v of rc.votes) {
        if (v.peopleId == null) continue;
        const s = stats.get(v.peopleId) ?? { total: 0, yea: 0, nay: 0, notVoting: 0, absent: 0, partyLine: 0, totalCast: 0 };
        s.total++;
        if (v.vote === "Yea") s.yea++;
        else if (v.vote === "Nay") s.nay++;
        else if (v.vote === "NV") s.notVoting++;
        else if (v.vote === "Absent") s.absent++;
        if ((v.vote === "Yea" || v.vote === "Nay") && (v.party === "R" || v.party === "D")) {
          s.totalCast++;
          if (majority.get(`${rc.rollCallId}:${v.party}`) === v.vote) s.partyLine++;
        }
        stats.set(v.peopleId, s);
        const list = votesByPerson.get(v.peopleId) ?? [];
        list.push([rc.rollCallId, v.vote]);
        votesByPerson.set(v.peopleId, list);
      }
    }
  }

  const statsOut: Record<number, unknown> = {};
  for (const [id, s] of Array.from(stats)) {
    statsOut[id] = {
      summary: {
        total: s.total,
        yea: s.yea,
        nay: s.nay,
        notVoting: s.notVoting,
        absent: s.absent,
        participation: s.total > 0 ? (s.yea + s.nay) / s.total : 0,
      },
      partyUnity: s.totalCast > 0 ? s.partyLine / s.totalCast : null,
    };
  }
  writeFileSync(join(OUT, "legislator-stats.json"), JSON.stringify(statsOut));
  for (const [id, list] of Array.from(votesByPerson)) {
    writeFileSync(join(OUT, "legislator-votes", `${id}.json`), JSON.stringify(list));
  }

  console.log(
    `data index: ${bills.length} bills, ${rollCalls.length} roll calls, ${legislators.length} legislators, ` +
      `${votesByPerson.size} voters (${Date.now() - started} ms)`
  );
}

main();

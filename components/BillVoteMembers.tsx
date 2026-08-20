"use client";

import { useState } from "react";
import Link from "next/link";
import type { BillVoteMember } from "../lib/votes";
import { voteInfo } from "../lib/vote-display";
import { partyInfo } from "../lib/legislator-display";

function partyAbbrev(party: string | null): string {
  if (party === "R") return "R";
  if (party === "D") return "D";
  return party ?? "·";
}

function MemberRow({ m }: { m: BillVoteMember }) {
  const v = voteInfo(m.vote);
  const party = partyInfo(m.party);
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span
        className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-bold ${party.className}`}
        title={party.label}
      >
        {partyAbbrev(m.party)}
      </span>
      {m.peopleId != null ? (
        <Link
          href={`/legislators/${m.peopleId}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-navy hover:underline"
        >
          {m.name ?? "Unknown"}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
          {m.name ?? "Unknown"}
        </span>
      )}
      <span
        className={`flex-none rounded px-2 py-0.5 text-[10px] font-bold ${v.className}`}
      >
        {v.label}
      </span>
    </li>
  );
}

// Click-to-reveal list of every member's vote on a roll call. Collapsed by
// default because a single roll call can hold 100+ voters.
export default function BillVoteMembers({ members }: { members: BillVoteMember[] }) {
  const [open, setOpen] = useState(false);

  if (members.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-skyblue"
      >
        {open ? "Hide" : "Show"} individual votes ({members.length})
        <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, i) => (
            <MemberRow key={m.peopleId ?? `${m.name}-${i}`} m={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

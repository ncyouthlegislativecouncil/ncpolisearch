"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { LegislatorVoteRow, LegislatorVoteSummary } from "../lib/votes";
import { voteInfo } from "../lib/vote-display";
import { chamberLabel } from "../lib/status";

function SummaryCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-4 py-4 text-center">
      <div className="font-mono text-2xl font-bold text-navy">{value}</div>
      <div className="mt-1 text-xs text-navymuted">{label}</div>
    </div>
  );
}

function PassedBadge({ passed }: { passed: boolean | null }) {
  if (passed == null) return null;
  return passed ? (
    <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
      Passed
    </span>
  ) : (
    <span className="rounded bg-negbg px-2 py-0.5 text-[11px] font-semibold text-ncred">
      Failed
    </span>
  );
}

function VoteRow({ row }: { row: LegislatorVoteRow }) {
  const v = voteInfo(row.vote);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span
        className={`w-24 flex-none rounded px-2 py-1 text-center text-xs font-bold ${v.className}`}
      >
        {v.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {row.billId != null && row.billNumber && (
            <Link
              href={`/bills/${row.billId}`}
              className="font-mono text-sm font-semibold text-navy hover:text-skyblue"
            >
              {row.billNumber}
            </Link>
          )}
          {chamberLabel(row.chamber) && (
            <span className="font-mono text-[11px] text-navymuted">
              {chamberLabel(row.chamber)}
            </span>
          )}
          <PassedBadge passed={row.passed} />
        </div>
        {row.billTitle && (
          <p className="mt-1 truncate text-sm text-gray-700">{row.billTitle}</p>
        )}
      </div>
      {row.date && (
        <span className="flex-none font-mono text-xs text-navymuted">{row.date}</span>
      )}
    </li>
  );
}

// Pager. Buttons, not links: pages switch in the browser, so there are no
// per-page URLs for crawlers to follow and no server work per click.
function Pagination({
  page,
  totalPages,
  busy,
  onGo,
}: {
  page: number;
  totalPages: number;
  busy: boolean;
  onGo: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const on =
    "rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-skyblue hover:text-skyblue disabled:opacity-60";
  const off = "rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-300";

  return (
    <div className="mt-6 flex items-center justify-between">
      {page > 1 ? (
        <button type="button" disabled={busy} onClick={() => onGo(page - 1)} className={on}>
          ← Newer
        </button>
      ) : (
        <span className={off}>← Newer</span>
      )}

      <span className="font-mono text-xs text-navymuted">
        {busy ? "Loading…" : `Page ${page} of ${totalPages}`}
      </span>

      {page < totalPages ? (
        <button type="button" disabled={busy} onClick={() => onGo(page + 1)} className={on}>
          Older →
        </button>
      ) : (
        <span className={off}>Older →</span>
      )}
    </div>
  );
}

// `rows` is the first page (newest votes), built into the page. The rest load
// once from this legislator's pre-built votes file the first time the pager is
// used, then every page switch is instant.
export default function VotingRecord({
  peopleId,
  summary,
  rows,
  pageSize,
  total,
}: {
  peopleId: number;
  summary: LegislatorVoteSummary;
  rows: LegislatorVoteRow[];
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);
  const [all, setAll] = useState<LegislatorVoteRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const go = async (next: number) => {
    setFailed(false);
    if (!all && next !== 1) {
      setBusy(true);
      try {
        const res = await fetch(`/api/legislator-votes/${peopleId}`);
        if (!res.ok) throw new Error(String(res.status));
        setAll((await res.json()) as LegislatorVoteRow[]);
      } catch {
        setFailed(true);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setPage(next);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shown = all ? all.slice((page - 1) * pageSize, page * pageSize) : rows;
  const participationPct = `${Math.round(summary.participation * 100)}%`;

  return (
    <section ref={sectionRef} id="voting-record" className="mt-10 scroll-mt-24">
      <h2 className="font-serif text-xl font-bold text-navy">
        Voting Record{" "}
        <span className="text-base font-normal text-navymuted">({summary.total})</span>
      </h2>

      {summary.total === 0 ? (
        <p className="mt-4 text-sm text-navymuted">
          No recorded floor votes for this legislator.
        </p>
      ) : (
        <>
          {/* Summary strip. */}
          <div className="mt-4 flex flex-wrap divide-x divide-gray-200 overflow-hidden rounded-md border border-gray-200 bg-white">
            <SummaryCell value={summary.total.toLocaleString("en-US")} label="Votes Cast" />
            <SummaryCell value={summary.yea.toLocaleString("en-US")} label="Yea" />
            <SummaryCell value={summary.nay.toLocaleString("en-US")} label="Nay" />
            <SummaryCell value={participationPct} label="Participation" />
          </div>

          {/* Vote list (one page). */}
          <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white px-4">
            {shown.map((row) => (
              <VoteRow key={row.rollCallId} row={row} />
            ))}
          </ul>

          <Pagination page={page} totalPages={totalPages} busy={busy} onGo={go} />
          {failed && (
            <p className="mt-2 text-center text-xs text-ncred">Couldn&apos;t load more votes. Try again.</p>
          )}
        </>
      )}
    </section>
  );
}

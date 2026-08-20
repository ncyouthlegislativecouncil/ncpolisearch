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

function Pagination({
  peopleId,
  page,
  totalPages,
}: {
  peopleId: number;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => `/legislators/${peopleId}?vpage=${p}#voting-record`;

  return (
    <div className="mt-6 flex items-center justify-between">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-skyblue hover:text-skyblue"
        >
          ← Newer
        </Link>
      ) : (
        <span className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">
          ← Newer
        </span>
      )}

      <span className="font-mono text-xs text-navymuted">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-skyblue hover:text-skyblue"
        >
          Older →
        </Link>
      ) : (
        <span className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">
          Older →
        </span>
      )}
    </div>
  );
}

export default function VotingRecord({
  peopleId,
  summary,
  rows,
  page,
  pageSize,
  total,
}: {
  peopleId: number;
  summary: LegislatorVoteSummary;
  rows: LegislatorVoteRow[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const participationPct = `${Math.round(summary.participation * 100)}%`;

  return (
    <section id="voting-record" className="mt-10 scroll-mt-6">
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
            <SummaryCell value={summary.total.toLocaleString()} label="Votes Cast" />
            <SummaryCell value={summary.yea.toLocaleString()} label="Yea" />
            <SummaryCell value={summary.nay.toLocaleString()} label="Nay" />
            <SummaryCell value={participationPct} label="Participation" />
          </div>

          {/* Vote list (one page). */}
          <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white px-4">
            {rows.map((row) => (
              <VoteRow key={row.rollCallId} row={row} />
            ))}
          </ul>

          <Pagination peopleId={peopleId} page={page} totalPages={totalPages} />
        </>
      )}
    </section>
  );
}

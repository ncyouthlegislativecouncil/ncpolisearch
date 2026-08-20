"use client";

import { useState } from "react";
import type {
  LabeledRollCall,
  PartyTally,
  VoteOutcomeBanner,
} from "../lib/votes";
import { formatVoteDate } from "../lib/date";
import BillVoteMembers from "./BillVoteMembers";

// Proportional Yea/Nay bar. Widths are relative to (yea + nay) so the bar
// reflects the decisive vote, with NV/Absent omitted from the proportion.
function VoteBar({ yea, nay }: { yea: number; nay: number }) {
  const decisive = yea + nay;
  const yeaPct = decisive > 0 ? (yea / decisive) * 100 : 0;
  const nayPct = decisive > 0 ? (nay / decisive) * 100 : 0;

  return (
    <div className="mt-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="bg-green-600" style={{ width: `${yeaPct}%` }} />
        <div className="bg-ncred" style={{ width: `${nayPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px]">
        <span className="text-green-700">{yea} Yea</span>
        <span className="text-ncred">{nay} Nay</span>
      </div>
    </div>
  );
}

function CountChip({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  return (
    <div className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-center">
      <div className={`font-mono text-lg font-bold ${className}`}>{value}</div>
      <div className="text-[11px] text-navymuted">{label}</div>
    </div>
  );
}

function PartyRow({
  label,
  tally,
  className,
}: {
  label: string;
  tally: PartyTally;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className={`w-24 flex-none font-semibold ${className}`}>{label}</span>
      <span className="font-mono text-green-700">{tally.yea} Yea</span>
      <span className="text-gray-300">·</span>
      <span className="font-mono text-ncred">{tally.nay} Nay</span>
    </div>
  );
}

function PassChip({ passed }: { passed: boolean | null }) {
  if (passed == null) return null;
  return passed ? (
    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      Passed
    </span>
  ) : (
    <span className="rounded bg-negbg px-2 py-0.5 text-xs font-semibold text-ncred">
      Failed
    </span>
  );
}

function RollCallCard({
  rc,
  featured = false,
}: {
  rc: LabeledRollCall;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-lg bg-white ${
        featured
          ? "border border-gray-200 border-t-4 border-t-gold p-6 shadow-sm"
          : "border border-gray-200 p-5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {featured && (
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-gold">
              Final Vote
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-semibold text-navy ${
                featured ? "text-lg" : "font-mono text-sm"
              }`}
            >
              {rc.label}
            </span>
            {rc.date && (
              <span className="font-mono text-xs text-navymuted">
                {formatVoteDate(rc.date)}
              </span>
            )}
          </div>
          {rc.detail && (
            <p className="mt-1 text-xs text-navymuted">
              On: <span className="font-medium text-navy">{rc.detail}</span>
            </p>
          )}
        </div>
        <PassChip passed={rc.passed} />
      </div>

      {/* Totals. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <CountChip value={rc.yea} label="Yea" className="text-green-700" />
        <CountChip value={rc.nay} label="Nay" className="text-ncred" />
        <CountChip value={rc.nv} label="Not Voting" className="text-navymuted" />
        <CountChip value={rc.absent} label="Absent" className="text-navymuted" />
      </div>

      {/* Proportion bar. */}
      <VoteBar yea={rc.yea} nay={rc.nay} />

      {/* Party breakdown. */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="section-label mb-1">Party Breakdown</p>
        <PartyRow label="Republican" tally={rc.republican} className="text-republican" />
        <PartyRow label="Democrat" tally={rc.democrat} className="text-democrat" />
      </div>

      {/* Individual member votes (collapsible). */}
      <BillVoteMembers members={rc.members} />
    </div>
  );
}

function OutcomeBanner({ banner }: { banner: VoteOutcomeBanner }) {
  const tone =
    banner.tone === "vetoed"
      ? "border-l-ncred bg-negbg text-ncred"
      : banner.tone === "enacted"
        ? "border-l-lowrisk bg-posbg text-lowrisk"
        : "border-l-skyblue bg-badge text-navy";

  return (
    <div className={`rounded-md border border-gray-200 border-l-4 p-4 ${tone}`}>
      <p className="text-sm font-semibold">{banner.text}</p>
      {banner.note && (
        <p className="mt-1 text-xs font-medium opacity-90">{banner.note}</p>
      )}
    </div>
  );
}

export default function BillVoteBreakdown({
  final,
  others,
  banner,
  total,
}: {
  final: LabeledRollCall | null;
  others: LabeledRollCall[];
  banner: VoteOutcomeBanner | null;
  total: number;
}) {
  const [open, setOpen] = useState(false);

  // Nothing to show: no banner and no recorded votes.
  if (!final && !banner) return null;

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-navy">
        Vote Breakdown
        {total > 0 && (
          <span className="text-base font-normal text-navymuted">
            {" "}
            ({total} roll call{total === 1 ? "" : "s"})
          </span>
        )}
      </h2>

      <div className="mt-4 space-y-4">
        {banner && <OutcomeBanner banner={banner} />}

        {final ? (
          <>
            <RollCallCard rc={final} featured />

            {others.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-skyblue"
                >
                  {open ? "Hide" : "View"} all roll calls ({others.length})
                  <span
                    aria-hidden
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>

                {open && (
                  <div className="mt-4 space-y-4">
                    {others.map((rc) => (
                      <RollCallCard key={rc.rollCallId} rc={rc} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-navymuted">
            No recorded roll-call votes for this bill yet.
          </p>
        )}
      </div>
    </section>
  );
}

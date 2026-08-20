import Link from "next/link";
import type { CompareBill } from "../lib/bills";
import { chamberLabel, statusInfo } from "../lib/status";
import { partyInfo } from "../lib/legislator-display";
import { toBullets } from "../lib/text";

function SponsorLink({
  sponsor,
}: {
  sponsor: NonNullable<CompareBill["primarySponsor"]>;
}) {
  const party = partyInfo(sponsor.party);
  const inner = (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium text-navy">{sponsor.name}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${party.className}`}>
        {party.label}
      </span>
    </span>
  );
  return sponsor.peopleId != null ? (
    <Link href={`/legislators/${sponsor.peopleId}`} className="hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ArgList({
  text,
  tone,
}: {
  text: string | null;
  tone: "for" | "against";
}) {
  const bullets = toBullets(text);
  if (bullets.length === 0) {
    return <p className="mt-1 text-sm text-navymuted">Not available.</p>;
  }
  const marker = tone === "for" ? "text-lowrisk" : "text-ncred";
  return (
    <ul className="mt-2 space-y-1.5">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-700">
          <span className={`flex-none font-bold ${marker}`}>•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 py-3">
      <p className="section-label mb-1">{label}</p>
      {children}
    </div>
  );
}

export default function CompareBillCard({
  bill,
  side,
  otherId,
  statusDiffers,
  passOutcome,
}: {
  bill: CompareBill;
  side: "left" | "right";
  otherId?: number;
  // True when the two bills' statuses differ — highlights this badge yellow.
  statusDiffers: boolean;
  // "passed" | "failed" | null — when the two bills diverge on passage, this
  // side gets a colored banner; null means no divergence to flag.
  passOutcome: "passed" | "failed" | null;
}) {
  const status = statusInfo(bill.status ?? "");

  // "Change bill" clears this side, preserving the other.
  const changeParams = new URLSearchParams();
  if (otherId != null) {
    changeParams.set(side === "left" ? "right" : "left", String(otherId));
  }
  const changeHref = `/compare${changeParams.toString() ? `?${changeParams.toString()}` : ""}`;

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      {passOutcome && (
        <div
          className={`px-5 py-2 text-center text-sm font-bold ${
            passOutcome === "passed"
              ? "bg-green-600 text-white"
              : "bg-ncred text-white"
          }`}
        >
          {passOutcome === "passed" ? "✓ This bill passed" : "✗ Has not passed"}
        </div>
      )}

      <div className="p-5">
        {/* Header. */}
        <div className="flex items-start justify-between gap-3">
          <span className="inline-block rounded bg-navy px-2.5 py-1 font-mono text-sm font-semibold text-white">
            {bill.billNumber}
          </span>
          <Link href={changeHref} className="text-xs text-navymuted hover:text-skyblue">
            Change ✕
          </Link>
        </div>

        <h2 className="mt-3 font-serif text-lg font-bold leading-snug text-navy">
          {bill.title}
        </h2>

        {/* Status + chamber. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              statusDiffers
                ? "bg-yellow-200 text-yellow-900 ring-1 ring-yellow-400"
                : status.className
            }`}
          >
            {status.label}
          </span>
          {chamberLabel(bill.chamber) && (
            <span className="font-mono text-xs text-navymuted">
              {chamberLabel(bill.chamber)}
            </span>
          )}
        </div>

        {/* Primary sponsor. */}
        <Field label="Primary Sponsor">
          {bill.primarySponsor ? (
            <SponsorLink sponsor={bill.primarySponsor} />
          ) : (
            <p className="text-sm text-navymuted">Not listed.</p>
          )}
        </Field>

        {/* Last action. */}
        <Field label="Last Action">
          {bill.lastAction ? (
            <p className="text-sm leading-relaxed text-gray-700">
              {bill.lastAction}
              {bill.lastActionDate && (
                <span className="ml-2 font-mono text-xs text-navymuted">
                  {bill.lastActionDate}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-navymuted">No recorded action.</p>
          )}
        </Field>

        {/* Vote breakdown. */}
        <Field label="Vote Breakdown">
          {bill.vote ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="font-mono font-semibold text-green-700">
                {bill.vote.yea} Yea
              </span>
              <span className="font-mono font-semibold text-ncred">
                {bill.vote.nay} Nay
              </span>
              {bill.vote.date && (
                <span className="font-mono text-xs text-navymuted">{bill.vote.date}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-navymuted">No floor votes recorded.</p>
          )}
        </Field>

        {/* Plain language summary. */}
        <Field label="Plain Language Summary">
          {bill.aiSummary ? (
            <p className="text-sm leading-relaxed text-gray-700">{bill.aiSummary}</p>
          ) : (
            <p className="text-sm text-navymuted">Not available yet.</p>
          )}
        </Field>

        {/* Arguments. */}
        <Field label="Arguments in Favor">
          <ArgList text={bill.aiProArguments} tone="for" />
        </Field>
        <Field label="Arguments Against">
          <ArgList text={bill.aiConArguments} tone="against" />
        </Field>

        {/* Link to full detail. */}
        <div className="border-t border-gray-100 pt-4">
          <Link
            href={`/bills/${bill.billId}`}
            className="text-sm font-semibold text-navy hover:text-skyblue"
          >
            View full bill detail →
          </Link>
        </div>
      </div>
    </div>
  );
}

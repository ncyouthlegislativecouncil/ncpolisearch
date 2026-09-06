import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBill, getBillSponsors, getAllBillIds } from "../../../lib/bills";
import { getBillVotes, buildVoteBreakdown } from "../../../lib/votes";
import { chamberLabel, statusInfo } from "../../../lib/status";
import {
  partyInfo,
  roleLabel,
  districtNumber,
} from "../../../lib/legislator-display";
import LegislatorAvatar from "../../../components/LegislatorAvatar";
import ShareBar from "../../../components/ShareBar";
import BillArguments from "../../../components/BillArguments";
import BillVoteBreakdown from "../../../components/BillVoteBreakdown";

// Unlike /bills and /legislators, this page doesn't read searchParams, so it
// CAN be fully static instead of just data-cached. Pre-building every bill id
// at deploy time means normal visits are served straight from Vercel's CDN
// with zero database contact — the strongest form of the fix applied to the
// query-level caches elsewhere in lib/. Data only actually changes once a day
// (the cron poll), so the 24hr revalidate window costs no real freshness.
export async function generateStaticParams() {
  const ids = await getAllBillIds();
  return ids.map((id) => ({ id: String(id) }));
}

export const revalidate = 86400;

// FEATURE 4 — Open Graph / social preview metadata for shared bill links.
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const billId = Number(params.id);
  if (!Number.isInteger(billId)) return { title: "Bill — NCPoliSearch" };

  const bill = await getBill(billId);
  if (!bill) return { title: "Bill not found — NCPoliSearch" };

  const title = `${bill.billNumber}: ${bill.title} — NCPoliSearch`;
  const description = bill.lastAction ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      // Use the branded site card rather than letting scrapers grab a random
      // legislator photo off the page.
      images: ["/og-image.png"],
      siteName: "NCPoliSearch by NCYLC",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

type Sponsor = {
  peopleId: number | null;
  name: string | null;
  party: string | null;
  isPrimary: boolean | null;
  imageUrl: string | null;
  role: string | null;
  district: string | null;
};

// Inline, party-colored sponsor name shown on the navy banner (light text).
function BannerSponsor({ sponsor }: { sponsor: Sponsor }) {
  const text = (
    <span className="font-semibold text-white">
      {sponsor.name}
      {sponsor.party ? ` (${sponsor.party})` : ""}
    </span>
  );
  return sponsor.peopleId != null ? (
    <Link
      href={`/legislators/${sponsor.peopleId}`}
      className="underline-offset-2 hover:underline"
    >
      {text}
    </Link>
  ) : (
    text
  );
}

// Mini legislator card for the Sponsors section. `primary` renders a larger,
// gold-accented card; cosponsors get a compact variant.
function SponsorCard({
  sponsor,
  primary = false,
}: {
  sponsor: Sponsor;
  primary?: boolean;
}) {
  const party = partyInfo(sponsor.party);
  const dist = districtNumber(sponsor.district);

  const inner = (
    <div
      className={`flex h-full items-center gap-3 rounded-md border border-gray-200 bg-white transition-all hover:border-skyblue hover:shadow-md ${
        primary ? "border-l-4 border-l-gold p-4" : "p-3"
      }`}
    >
      <LegislatorAvatar
        name={sponsor.name}
        imageUrl={sponsor.imageUrl}
        size={primary ? 64 : 44}
      />
      <div className="min-w-0">
        {primary && (
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-gold">
            Primary Sponsor
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`truncate font-semibold text-navy ${
              primary ? "text-base" : "text-sm"
            }`}
          >
            {sponsor.name}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${party.className}`}
          >
            {party.label}
          </span>
        </div>
        {(sponsor.role || dist) && (
          <p className="mt-1 text-xs text-navylight">
            {roleLabel(sponsor.role)}
            {dist ? ` · District ${dist}` : ""}
          </p>
        )}
      </div>
    </div>
  );

  return sponsor.peopleId != null ? (
    <Link href={`/legislators/${sponsor.peopleId}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// Small line-icons for the Bill Details sidebar (16px, currentColor stroke).
function Icon({ name }: { name: "status" | "chamber" | "date" | "sponsor" }) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "status")
    return (
      <svg {...common}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  if (name === "chamber")
    return (
      <svg {...common}>
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="5" y1="21" x2="5" y2="10" />
        <line x1="19" y1="21" x2="19" y2="10" />
        <line x1="9" y1="21" x2="9" y2="10" />
        <line x1="15" y1="21" x2="15" y2="10" />
        <polygon points="12 2 21 8 3 8" />
      </svg>
    );
  if (name === "date")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: "status" | "chamber" | "date" | "sponsor";
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex-none text-skyblue">
        <Icon name={icon} />
      </span>
      <span className="text-xs text-navymuted">{label}</span>
      <span className="ml-auto text-right text-xs font-medium text-navy">
        {value}
      </span>
    </div>
  );
}

export default async function BillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const billId = Number(params.id);
  if (!Number.isInteger(billId)) notFound();

  const bill = await getBill(billId);
  if (!bill) notFound();

  const [{ sponsors, cosponsors }, rollCalls] = await Promise.all([
    getBillSponsors(billId),
    getBillVotes(billId),
  ]);
  const status = statusInfo(bill.status ?? "");
  const primary = sponsors.find((s) => s.isPrimary) ?? sponsors[0];
  const voteBreakdown = buildVoteBreakdown(rollCalls, {
    billNumber: bill.billNumber,
    status: bill.status,
  });

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <Link href="/bills" className="text-sm text-navylight hover:text-skyblue">
        ← Back to all bills
      </Link>

      {/* BILL HEADER — full-width navy banner. */}
      <section className="mt-4 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-navy px-6 py-7 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-block rounded bg-skyblue px-3 py-1 font-mono text-sm font-bold text-navy">
              {bill.billNumber}
            </span>
            <Link
              href={`/compare?left=${bill.billId}`}
              className="inline-flex flex-none items-center gap-2 rounded-md border border-white/60 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <span aria-hidden>⇄</span>
              Compare
            </Link>
          </div>

          <h1 className="mt-4 font-serif text-3xl font-bold leading-tight text-white">
            {bill.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/75">
            <span
              className={`rounded px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
            >
              {status.label}
            </span>
            {primary && (
              <>
                <span className="text-white/40" aria-hidden>
                  ·
                </span>
                <BannerSponsor sponsor={primary} />
              </>
            )}
            {chamberLabel(bill.chamber) && (
              <>
                <span className="text-white/40" aria-hidden>
                  ·
                </span>
                <span>{chamberLabel(bill.chamber)}</span>
              </>
            )}
            <span className="text-white/40" aria-hidden>
              ·
            </span>
            <span className="font-mono text-xs">2025–2026 Session</span>
            {bill.topic && (
              <>
                <span className="text-white/40" aria-hidden>
                  ·
                </span>
                <span className="rounded bg-skyblue/20 px-2 py-0.5 text-xs font-semibold text-skyblue">
                  {bill.topic}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* MAIN COLUMN */}
        <div className="space-y-6 lg:col-span-7">
          {/* PLAIN ENGLISH SUMMARY — prominent, AI-generated badge. */}
          {bill.aiSummary ? (
            <>
              <section className="relative rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
                <span className="absolute right-5 top-5 rounded-full bg-skyblue px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-navy">
                  AI Generated
                </span>
                <p className="section-label">Plain English Summary</p>
                <p className="mt-3 pr-20 text-base leading-relaxed text-gray-700">
                  {bill.aiSummary}
                </p>
              </section>

              {/* Arguments for / against — two always-visible cards. */}
              <BillArguments pro={bill.aiProArguments} con={bill.aiConArguments} />

              <p className="text-xs text-navymuted">
                AI-generated analysis based on bill text. Always verify with
                official sources at ncleg.gov. This is not legal or political
                advice.
              </p>
            </>
          ) : (
            <section className="rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
              <p className="section-label">Plain English Summary</p>
              <p className="mt-3 text-sm text-navymuted">
                A plain-language analysis for this bill isn&apos;t available yet.
              </p>
            </section>
          )}

          {/* SPONSORS — mini legislator cards; primary larger. */}
          <section>
            <h2 className="font-serif text-xl font-bold text-navy">Sponsors</h2>
            {sponsors.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sponsors.map((s, i) => (
                  <SponsorCard
                    key={s.peopleId ?? `${s.name}-${i}`}
                    sponsor={s}
                    primary
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-navymuted">None listed.</p>
            )}

            {cosponsors.length > 0 && (
              <>
                <h3 className="mt-6 font-serif text-base font-bold text-navy">
                  Cosponsors{" "}
                  <span className="font-normal text-navymuted">
                    ({cosponsors.length})
                  </span>
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {cosponsors.map((s, i) => (
                    <SponsorCard
                      key={s.peopleId ?? `${s.name}-${i}`}
                      sponsor={s}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <BillVoteBreakdown
            final={voteBreakdown.final}
            others={voteBreakdown.others}
            banner={voteBreakdown.banner}
            total={rollCalls.length}
          />
        </div>

        {/* SIDEBAR — wider. */}
        <aside className="space-y-4 lg:col-span-5">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="section-label mb-2">Bill Details</p>
            <div className="divide-y divide-gray-100">
              <DetailRow icon="status" label="Status" value={status.label} />
              {chamberLabel(bill.chamber) && (
                <DetailRow
                  icon="chamber"
                  label="Chamber"
                  value={chamberLabel(bill.chamber)}
                />
              )}
              {bill.lastActionDate && (
                <DetailRow
                  icon="date"
                  label="Last Action"
                  value={
                    <span className="font-mono">{bill.lastActionDate}</span>
                  }
                />
              )}
              {primary && (
                <DetailRow
                  icon="sponsor"
                  label="Sponsor"
                  value={primary.name}
                />
              )}
            </div>
            {bill.url && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-center">
                <a
                  href={bill.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-navy hover:text-skyblue"
                >
                  View on LegiScan →
                </a>
              </div>
            )}
          </div>

          {/* LATEST ACTION — prominent, skyblue accent. */}
          {bill.lastAction && (
            <div className="rounded-lg border border-gray-200 border-t-4 border-t-skyblue bg-white p-5 shadow-sm">
              <p className="section-label mb-2">Latest Action</p>
              <p className="text-sm font-medium leading-relaxed text-navy">
                {bill.lastAction}
              </p>
              {bill.lastActionDate && (
                <p className="mt-2 font-mono text-xs text-navymuted">
                  {bill.lastActionDate}
                </p>
              )}
            </div>
          )}

          {/* FEATURE 3 — Social share bar. */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="section-label mb-3">Share</p>
            <ShareBar billNumber={bill.billNumber} title={bill.title} />
          </div>
        </aside>
      </div>
    </main>
  );
}

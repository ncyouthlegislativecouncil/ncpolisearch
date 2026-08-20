"use client";

import Link from "next/link";
import LegislatorAvatar from "../LegislatorAvatar";
import { partyInfo, roleLabel, reelectionInfo } from "../../lib/legislator-display";
import { statusInfo } from "../../lib/status";
import type { DistrictLegislator } from "../../lib/district";

type Chamber = "house" | "senate";

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-center">
      <div className="font-mono text-xl font-bold text-navy">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-navymuted">{label}</div>
    </div>
  );
}

// Empty / loading / error states share this centered frame.
function PanelMessage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-6 text-center">
      <svg
        className="mb-3 h-10 w-10 text-skyblue"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <p className="text-sm font-semibold text-navy">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-navymuted">{subtitle}</p>}
    </div>
  );
}

export default function LegislatorPanel({
  data,
  loading,
  error,
  selectedDistrict,
  chamber,
}: {
  data: DistrictLegislator | null;
  loading: boolean;
  error: string | null;
  selectedDistrict: number | null;
  chamber: Chamber;
}) {
  const chamberLabel = chamber === "house" ? "House" : "Senate";

  if (loading) {
    return (
      <PanelMessage
        title={`Loading District ${selectedDistrict ?? ""}…`}
        subtitle="Fetching legislator data"
      />
    );
  }

  if (error) {
    return (
      <PanelMessage
        title={`${chamberLabel} District ${selectedDistrict ?? ""}`}
        subtitle={error}
      />
    );
  }

  if (!data) {
    return (
      <PanelMessage
        title="Select a district to view legislator info"
        subtitle="Click any district on the map to see who represents it."
      />
    );
  }

  const party = partyInfo(data.party);
  const reelection = reelectionInfo(data.runningForReelection);

  return (
    <div className="space-y-6">
      {/* Top section: photo, name, party, role/district, profile link. */}
      <div>
        <div className="flex items-start gap-4">
          <LegislatorAvatar name={data.name} imageUrl={data.imageUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight text-navy">{data.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${party.className}`}
              >
                {party.label}
              </span>
              <span className="text-xs text-navymuted">
                {roleLabel(data.role)} · District {data.districtNumber}
              </span>
            </div>
            {/* 2026 reelection status. */}
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${reelection.className}`}
            >
              {reelection.label}
            </span>
          </div>
        </div>

        <Link
          href={`/legislators/${data.peopleId}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ncred px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ncred/90"
        >
          View Full Profile →
        </Link>
      </div>

      {/* Stats. */}
      <div className="flex gap-2">
        <StatBox value={data.sponsoredCount} label="Bills Sponsored" />
        <StatBox value={data.cosponsoredCount} label="Cosponsored" />
        {data.partyUnity != null && (
          <StatBox
            value={`${Math.round(data.partyUnity * 100)}%`}
            label="Party Unity"
          />
        )}
      </div>

      {/* Recent sponsored bills. */}
      <div>
        <p className="section-label mb-2">Recent Bills</p>
        {data.recentBills.length === 0 ? (
          <p className="text-sm text-navymuted">No sponsored bills on record.</p>
        ) : (
          <div className="space-y-2">
            {data.recentBills.map((b) => {
              const s = statusInfo(b.status ?? "");
              return (
                <Link
                  key={b.billId}
                  href={`/bills/${b.billId}`}
                  className="block rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-skyblue"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-navy">
                      {b.billNumber}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${s.className}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-navylight">{b.title}</p>
                </Link>
              );
            })}
          </div>
        )}
        <Link
          href={`/legislators/${data.peopleId}`}
          className="mt-2 inline-block text-xs font-semibold text-navy hover:text-skyblue"
        >
          See all bills →
        </Link>
      </div>

      {/* Voting record teaser. */}
      <div>
        <p className="section-label mb-2">Recent Votes</p>
        {data.recentVotes.length === 0 ? (
          <p className="text-sm text-navymuted">No recorded votes yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recentVotes.map((v) => {
              const yea = v.vote === "Yea";
              return (
                <Link
                  key={v.rollCallId}
                  href={v.billId ? `/bills/${v.billId}` : `/legislators/${data.peopleId}`}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-skyblue"
                >
                  <span
                    className={`flex-none rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                      yea ? "bg-green-100 text-green-700" : "bg-negbg text-ncred"
                    }`}
                  >
                    {v.vote}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs font-semibold text-navy">
                      {v.billNumber}
                    </span>
                    <p className="line-clamp-1 text-xs text-navylight">{v.title}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Link
          href={`/legislators/${data.peopleId}`}
          className="mt-2 inline-block text-xs font-semibold text-navy hover:text-skyblue"
        >
          See full voting record →
        </Link>
      </div>
    </div>
  );
}

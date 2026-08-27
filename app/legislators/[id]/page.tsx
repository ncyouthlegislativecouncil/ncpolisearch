import Link from "next/link";
import { notFound } from "next/navigation";
import CollapsibleBills from "../../../components/CollapsibleBills";
import VotingRecord from "../../../components/VotingRecord";
import LegislatorAvatar from "../../../components/LegislatorAvatar";
import NcOutline from "../../../components/NcOutline";
import DistrictBadgeModal from "../../../components/DistrictBadgeModal";
import { getLegislator, getLegislatorBills } from "../../../lib/legislators";
import {
  getLegislatorVotes,
  getLegislatorVoteSummary,
  getPartyUnity,
} from "../../../lib/votes";
import { getDistrictBadge } from "../../../lib/district-shape";
import {
  partyInfo,
  roleLabel,
  districtNumber,
  chamberFromRole,
  reelectionInfo,
} from "../../../lib/legislator-display";

const VOTES_PER_PAGE = 20;

function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 border-t-4 border-t-skyblue bg-white px-4 py-5 text-center shadow-sm">
      <div className="font-mono text-3xl font-bold text-navy">{value}</div>
      <div className="mt-1 text-xs text-navymuted">{label}</div>
    </div>
  );
}

export default async function LegislatorProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { vpage?: string };
}) {
  const peopleId = Number(params.id);
  if (!Number.isInteger(peopleId)) notFound();

  const legislator = await getLegislator(peopleId);
  if (!legislator) notFound();

  const parsedPage = Number(searchParams.vpage);
  const votePage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [{ sponsored, cosponsored }, voteSummary, voteData, unity] =
    await Promise.all([
      getLegislatorBills(peopleId),
      getLegislatorVoteSummary(peopleId),
      getLegislatorVotes(peopleId, votePage, VOTES_PER_PAGE),
      getPartyUnity(peopleId),
    ]);
  const party = partyInfo(legislator.party);
  const dist = districtNumber(legislator.district);
  const districtNum = dist ? parseInt(dist, 10) : null;
  const mapChamber = legislator.role === "Rep" ? "house" : legislator.role === "Sen" ? "senate" : null;
  // Small static silhouette for the banner — computed synchronously from the
  // same GeoJSON /map uses, no client-side map library involved.
  const badge = mapChamber && districtNum != null ? getDistrictBadge(mapChamber, districtNum) : null;
  const reelection = reelectionInfo(legislator.runningForReelection);
  const unityLabel = unity != null ? `${Math.round(unity * 100)}%` : "—";

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <Link href="/legislators" className="text-sm text-navylight hover:text-skyblue">
        ← Back to all legislators
      </Link>

      {/* Profile header — navy banner with overlapping photo. */}
      <section className="relative mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="relative h-44 overflow-hidden rounded-t-lg bg-navy">
          {/* District silhouette — the whole state, this legislator's district
              lit up in gold, so it always reads as "North Carolina" at a
              glance. Small urban districts can be hard to make out at this
              size, so it's a button: clicking opens the same silhouette much
              bigger (DistrictBadgeModal) instead of cropping the state down
              to an unrecognizable fragment. */}
          {badge ? (
            <div className="absolute right-4 top-1/2 h-32 -translate-y-1/2 sm:right-6 sm:h-36 lg:right-10 lg:h-40">
              <DistrictBadgeModal
                data={badge}
                chamberLabel={chamberFromRole(legislator.role)}
                district={districtNum!}
                legislatorName={legislator.name}
                buttonClassName="h-full w-auto text-gold"
              />
            </div>
          ) : (
            <NcOutline className="pointer-events-none absolute right-4 top-1/2 h-32 -translate-y-1/2 text-navylight/40 sm:right-6 sm:h-36 lg:right-10 lg:h-40" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gold" />
          <div className="relative flex h-full flex-col justify-end pb-7 pl-[198px] pr-6">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-gold">
              North Carolina {chamberFromRole(legislator.role)}
            </span>
            <h1 className="font-serif text-3xl font-bold leading-tight text-white drop-shadow-sm">
              {legislator.name}
            </h1>
          </div>
        </div>

        {/* Photo overlaps the banner — half in, half below. */}
        <div className="absolute left-6 top-[80px] z-10">
          <LegislatorAvatar
            name={legislator.name}
            imageUrl={legislator.imageUrl}
            width={150}
            height={190}
            circle={false}
            className="ring-2 ring-gold shadow-lg"
          />
        </div>

        {/* Party + district below the banner. */}
        <div className="min-h-[116px] pb-6 pl-[198px] pr-6 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${party.className}`}>
              {party.label}
            </span>
            <span className="text-sm text-navylight">
              {roleLabel(legislator.role)}
              {dist ? ` · District ${dist}` : ""}
            </span>
          </div>

          {/* 2026 reelection status. */}
          <div className="mt-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${reelection.className}`}
            >
              {reelection.label}
            </span>
            <p className="mt-2 text-xs text-navymuted">
              Election Day: November 3, 2026 ·{" "}
              <a
                href="https://www.ncsbe.gov/registering"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-navy underline-offset-2 hover:text-skyblue hover:underline"
              >
                Register to vote at ncsbe.gov
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Stats row — four cards. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={sponsored.length} label="Bills Sponsored" />
        <StatCard value={cosponsored.length} label="Bills Cosponsored" />
        <StatCard value={voteSummary.total} label="Votes Cast" />
        <StatCard value={unityLabel} label="Party Unity Score" />
      </div>

      <CollapsibleBills title="Sponsored Bills" bills={sponsored} />
      <CollapsibleBills title="Cosponsored Bills" bills={cosponsored} />

      <VotingRecord
        peopleId={peopleId}
        summary={voteSummary}
        rows={voteData.rows}
        page={voteData.page}
        pageSize={voteData.pageSize}
        total={voteData.total}
      />
    </main>
  );
}

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

const VOTES_PER_PAGE = 10;

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

      {/* Profile header. Mobile and desktop get genuinely different layouts
          (not just resized versions of each other) — cramming the same
          photo-overlaps-banner arrangement into a narrow screen made the
          district badge collide with the name and left the photo hanging
          awkwardly far below the banner. Only one of these two sections
          renders visually at a time; the other stays in the DOM as
          `hidden`. */}

      {/* --- Mobile: photo in the banner, everything else in the white area
          below, all centered — a plain stacked card instead of the overlap
          trick. --- */}
      <section className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:hidden">
        <div className="relative flex h-40 items-center justify-center bg-navy">
          {badge ? (
            <DistrictBadgeModal
              data={badge}
              chamberLabel={chamberFromRole(legislator.role)}
              district={districtNum!}
              legislatorName={legislator.name}
              buttonClassName="absolute right-3 top-3 h-14 text-gold"
              idPrefix="district-badge-glow-mobile"
            />
          ) : (
            <NcOutline className="pointer-events-none absolute right-3 top-3 h-14 text-navylight/40" />
          )}
          <LegislatorAvatar
            name={legislator.name}
            imageUrl={legislator.imageUrl}
            width={150}
            height={190}
            circle={false}
            sizeClassName="h-28 w-[110px]"
            className="ring-2 ring-gold shadow-lg"
          />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gold" />
        </div>

        <div className="px-5 py-5 text-center">
          <p className="section-label inline-block">
            North Carolina {chamberFromRole(legislator.role)}
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-navy">
            {legislator.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className={`rounded px-2.5 py-1 text-xs font-semibold ${party.className}`}>
              {party.label}
            </span>
            <span className="text-sm text-navylight">
              {roleLabel(legislator.role)}
              {dist ? ` · District ${dist}` : ""}
            </span>
          </div>

          <div className="mt-4">
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

      {/* --- Desktop/tablet: the original wide layout — navy banner with the
          photo overlapping its bottom edge, name in the banner. --- */}
      <section className="relative mt-4 hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:block">
        <div className="relative h-44 overflow-hidden rounded-t-lg bg-navy">
          {/* District silhouette — the whole state, this legislator's district
              lit up in gold, so it always reads as "North Carolina" at a
              glance. Small urban districts can be hard to make out at this
              size, so it's a button: clicking opens the same silhouette much
              bigger (DistrictBadgeModal) instead of cropping the state down
              to an unrecognizable fragment. */}
          {badge ? (
            <DistrictBadgeModal
              data={badge}
              chamberLabel={chamberFromRole(legislator.role)}
              district={districtNum!}
              legislatorName={legislator.name}
              buttonClassName="absolute right-6 top-1/2 h-36 -translate-y-1/2 text-gold lg:right-10 lg:h-40"
              idPrefix="district-badge-glow-desktop"
            />
          ) : (
            <NcOutline className="pointer-events-none absolute right-6 top-1/2 h-36 -translate-y-1/2 text-navylight/40 lg:right-10 lg:h-40" />
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

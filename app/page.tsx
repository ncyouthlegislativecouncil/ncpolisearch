import Link from "next/link";
import BillCard from "../components/BillCard";
import FeaturedBillCard from "../components/FeaturedBillCard";
import GlanceLegislatorCard from "../components/GlanceLegislatorCard";
import SearchBar from "../components/SearchBar";
import StatsBar from "../components/StatsBar";
import ActivityTicker from "../components/ActivityTicker";
import SponsorLeaderboard from "../components/SponsorLeaderboard";
import {
  getHomeStats,
  getHomeFeed,
  getTickerBills,
} from "../lib/bills";
import { getTopSponsors, getTopSponsorsOverall } from "../lib/legislators";

// Re-render at most once an hour so new bills, fresh AI summaries, and the live
// counts keep flowing onto the homepage. Without this the page would be frozen
// at build-time data (the /bills page stays current only because it reads
// searchParams, which forces dynamic rendering).
export const revalidate = 3600;

export default async function Home() {
  const [stats, feed, ticker, topHouse, topSenate, topOverall] =
    await Promise.all([
      getHomeStats(),
      getHomeFeed(5),
      getTickerBills(20),
      getTopSponsors("Rep", 50),
      getTopSponsors("Sen", 50),
      getTopSponsorsOverall(3),
    ]);

  const { featured, recent: rest } = feed;

  return (
    <main>
      {/* HERO — navy bleed from the nav, with a faint animated line pattern. */}
      <section className="relative overflow-hidden bg-navy">
        {/* NC State Capitol backdrop, anchored center/bottom so the dome shows. */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-[center_25%]"
          style={{ backgroundImage: "url('/nccapitol.jpg')" }}
        />
        {/* Dark navy overlay to keep the white hero text readable. */}
        <div className="pointer-events-none absolute inset-0 bg-navy/75" />
        <div className="hero-pattern pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-[1600px] flex-col items-center px-6 pb-16 pt-16 text-center">
          <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
            Understand Any NC Bill
            <br />
            in 60 Seconds
          </h1>

          {/* Prominent NC-red underline accent. */}
          <div className="mt-5 h-1.5 w-28 rounded-full bg-ncred shadow-[0_0_12px_rgba(140,22,22,0.6)]" />

          <p className="mt-5 max-w-xl text-base leading-relaxed text-skyblue">
            Nonpartisan, plain-language analysis of North Carolina legislation.
            Who benefits. What it does. No spin.
          </p>

          {/* Live counts line — monospace, green accents. */}
          <div className="mt-6 rounded-md border border-white/10 bg-white/[0.06] px-4 py-2 font-mono text-xs text-skyblue">
            Tracking{" "}
            <span className="font-semibold text-[#4ac4a0]">
              {stats.totalBills.toLocaleString()}
            </span>{" "}
            bills &nbsp;·&nbsp;{" "}
            <span className="font-semibold text-[#4ac4a0]">
              {stats.introduced.toLocaleString()}
            </span>{" "}
            introduced &nbsp;·&nbsp; 2025–2026 session
          </div>

          <div className="mt-7 flex w-full justify-center">
            <SearchBar />
          </div>

          {/* CTA buttons. */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/bills"
              className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-white/70 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-white hover:bg-white/10"
            >
              Browse All Bills
            </Link>
            <Link
              href="/legislators"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-skyblue px-5 py-2.5 text-sm font-semibold text-navy transition-all hover:brightness-105"
            >
              View Legislators
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar, pulled up to overlap the hero edge. */}
      <StatsBar stats={stats} />

      {/* Live activity ticker of the 20 most recently updated bills. */}
      <div className="mt-14">
        <div className="mx-auto mb-3 max-w-[1600px] px-6">
          <h2 className="section-label">Live Activity</h2>
        </div>
        <ActivityTicker bills={ticker} />
      </div>

      {/* What's Moving in Raleigh — featured + grid. */}
      <section className="mx-auto max-w-[1600px] px-6 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="section-label">Latest Action</h2>
            <h3 className="mt-2 font-serif text-2xl font-bold text-navy">
              What&rsquo;s Moving in Raleigh
            </h3>
          </div>
        </div>

        {featured && (
          <div className="grid gap-4 lg:grid-cols-2">
            <FeaturedBillCard bill={featured} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {rest.slice(0, 2).map((bill) => (
                <BillCard key={bill.billId} bill={bill} sponsor={bill.sponsor ?? undefined} />
              ))}
            </div>
          </div>
        )}

        {rest.length > 2 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.slice(2, 5).map((bill) => (
              <BillCard key={bill.billId} bill={bill} sponsor={bill.sponsor ?? undefined} />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link
            href="/bills"
            className="inline-flex items-center gap-2 rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-navylight"
          >
            View All {stats.totalBills.toLocaleString()} Bills →
          </Link>
        </div>
      </section>

      {/* NC Legislators at a Glance — top 3 most active across both chambers. */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="section-label">Most Active Members</h2>
              <h3 className="mt-2 font-serif text-2xl font-bold text-navy">
                NC Legislators at a Glance
              </h3>
            </div>
            <Link
              href="/legislators"
              className="hidden text-sm font-semibold text-navy hover:text-skyblue sm:inline"
            >
              View All Legislators →
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {topOverall.map((leg, i) => (
              <GlanceLegislatorCard key={leg.peopleId} leg={leg} rank={i + 1} />
            ))}
          </div>

          <div className="mt-6 flex justify-center sm:hidden">
            <Link
              href="/legislators"
              className="text-sm font-semibold text-navy hover:text-skyblue"
            >
              View All Legislators →
            </Link>
          </div>
        </div>
      </section>

      {/* Most active sponsors — leaderboard per chamber. */}
      <section className="mx-auto max-w-[1600px] px-6 py-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-bold text-navy">Most Active Sponsors</h2>
          <Link
            href="/legislators"
            className="text-sm font-medium text-navy hover:text-skyblue"
          >
            All legislators →
          </Link>
        </div>
        <SponsorLeaderboard house={topHouse} senate={topSenate} />
      </section>
    </main>
  );
}

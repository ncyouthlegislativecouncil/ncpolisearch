import type { Metadata } from "next";
import Link from "next/link";
import InteractiveBallot from "../../components/ballot/InteractiveBallot";

export const metadata: Metadata = {
  title: "Your November 2026 Ballot — NCPoliSearch",
  description:
    "North Carolina's statewide constitutional amendments for the November 2026 election, explained in plain English by NCPoliSearch.",
};

export default function BallotPage() {
  return (
    <main className="bg-pagebg">
      {/* PAGE HEADER — full-width navy hero with gold bottom border. */}
      <section className="border-b-4 border-[#c9a84c] bg-navy">
        <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
            Your November 2026 Ballot
          </h1>
          <p className="mt-3 text-lg text-skyblue sm:text-xl">
            North Carolina statewide amendments — explained in plain English
          </p>
          <span className="mt-6 inline-block rounded-full bg-[#c9a84c] px-4 py-1.5 text-sm font-bold text-navy">
            Election Day: November 3, 2026
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
        {/* INTERACTIVE BALLOT — an actual ballot-styled card. Pick an
            amendment to slide the ballot aside and reveal the full
            breakdown; "Back to Ballot" slides it back. */}
        <div>
          <InteractiveBallot />
        </div>

        {/* BOTTOM CTA — gold card. */}
        <div className="mt-12 rounded-lg bg-[#c9a84c] p-6 shadow-md sm:p-8">
          <h2 className="font-serif text-2xl font-bold text-navy">
            Want to see your specific races?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-navy/90">
            Visit our District Map to find your NC House and Senate
            representatives and see who&apos;s running in your district this
            November.
          </p>
          <Link
            href="/map"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-navy px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-navylight"
          >
            View District Map →
          </Link>
        </div>

        {/* DISCLAIMER — small gray italic, centered. */}
        <p className="mt-10 text-center text-xs italic leading-relaxed text-gray-500">
          Amendment information sourced from NC General Assembly legislation and
          verified by NCPoliSearch. Arguments reflect positions stated by
          legislators during committee and floor debates. This is not an
          endorsement of any position. Always verify with official sources at
          ncsbe.gov.
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import InteractiveBallot from "../../components/ballot/InteractiveBallot";
import { CURRENT_ELECTION, amendmentVotes } from "../../lib/elections";
import { electionResults } from "../../lib/data/store";

export const metadata: Metadata = {
  title: "2026 Ballot Results — NCPoliSearch",
  description:
    "How North Carolina voted on the three constitutional amendments in the November 2026 election, with what each one does explained in plain English.",
};

export default function BallotPage() {
  const results = electionResults(CURRENT_ELECTION);
  const certified = results?.certified ?? false;
  const updated = results
    ? new Date(results.sourceUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : null;

  return (
    <main className="bg-pagebg">
      {/* PAGE HEADER — full-width navy hero with gold bottom border. */}
      <section className="border-b-4 border-[#c9a84c] bg-navy">
        <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
            2026 Ballot Results
          </h1>
          <p className="mt-3 text-lg text-skyblue sm:text-xl">
            How North Carolina voted on the statewide amendments — explained in plain English
          </p>
          <span className="mt-6 inline-block rounded-full bg-[#c9a84c] px-4 py-1.5 text-sm font-bold text-navy">
            {certified
              ? "Certified results · General Election, November 3, 2026"
              : `Unofficial results${updated ? ` · updated ${updated}` : ""}`}
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
        {/* INTERACTIVE BALLOT — an actual ballot-styled card. Pick an
            amendment to slide the ballot aside and reveal its result and full
            breakdown. */}
        <div>
          <InteractiveBallot votes={amendmentVotes(results)} certified={certified} />
        </div>

        {/* BOTTOM CTA — gold card. */}
        <div className="mt-12 rounded-lg bg-[#c9a84c] p-6 shadow-md sm:p-8">
          <h2 className="font-serif text-2xl font-bold text-navy">
            How did your legislators do?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-navy/90">
            Find your NC House and Senate members on our District Map to see
            whether they were re-elected, and what they&apos;ve been voting on.
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
          Vote totals from the NC State Board of Elections
          {certified ? "" : " — unofficial until the State Board certifies them"}.
          Amendment explanations are sourced from NC General Assembly legislation
          and verified by NCPoliSearch. Arguments reflect positions stated by
          legislators during committee and floor debates. This is not an
          endorsement of any position.
        </p>
      </div>
    </main>
  );
}

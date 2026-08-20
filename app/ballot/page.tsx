import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your November 2026 Ballot — NCPoliSearch",
  description:
    "North Carolina's statewide constitutional amendments for the November 2026 election, explained in plain English by NCPoliSearch.",
};

// ---------------------------------------------------------------------------
// Amendment content. Each card is rendered identically from this data so the
// three sections stay consistent and easy to update.
// ---------------------------------------------------------------------------
type Amendment = {
  number: number;
  shortTitle: string;
  ballotLabel: string;
  question: string;
  actuallyDoes: string;
  ifPasses: string;
  ifFails: string;
  argFor: string;
  argAgainst: string;
};

const AMENDMENTS: Amendment[] = [
  {
    number: 1,
    shortTitle: "Income Tax Cap",
    ballotLabel: "SB 1080 · Income Tax",
    question:
      "Constitutional amendment to lower the maximum allowable state income tax rate from 7% to 3.5%",
    actuallyDoes:
      "NC's income tax rate is already scheduled to drop to 3.49% next year regardless of this vote. This amendment doesn't lower your taxes today — it permanently prevents any future legislature from raising the income tax above 3.5%, even during a recession, natural disaster, or state emergency. Changing it later would require another statewide vote.",
    ifPasses:
      "Future legislators cannot raise income taxes above 3.5% without voter approval.",
    ifFails:
      "The current 7% constitutional cap remains. Income taxes still drop to 3.49% next year as already planned.",
    argFor:
      "Protects taxpayers from future tax hikes and locks in the legislature's commitment to lower taxes permanently.",
    argAgainst:
      "Tying the state's hands during future emergencies could force cuts to schools, roads, disaster relief, and public safety when revenue is needed most.",
  },
  {
    number: 2,
    shortTitle: "Property Tax Limit",
    ballotLabel: "HB 1089 · Property Tax",
    question:
      "Constitutional amendment requiring limits on property tax increases by local governments",
    actuallyDoes:
      "Requires the legislature to pass a law capping how fast local governments can raise property taxes — but the actual cap number is not decided yet. You are voting to require a limit without knowing what that limit will be.",
    ifPasses:
      "The legislature must create a property tax cap law. Cities and counties will face new restrictions on raising property taxes.",
    ifFails:
      "Local governments keep their current authority to set property tax rates based on local needs.",
    argFor:
      "Property taxes have risen too fast in NC and homeowners need constitutional protection from local government overtaxing.",
    argAgainst:
      "Local governments use property taxes to fund schools, emergency services, and infrastructure. A vague amendment with no specified limit gives voters no way to evaluate what they're actually agreeing to.",
  },
  {
    number: 3,
    shortTitle: "Photo Voter ID",
    ballotLabel: "SB 921 · Voter ID",
    question:
      "Constitutional amendment requiring photographic identification to vote, including for mail-in ballots",
    actuallyDoes:
      "Photo ID for in-person voting is already NC law. This amendment adds mail-in voter ID to the state constitution, making both requirements permanent and much harder for future legislators to modify or repeal. Free photo IDs are available from county election boards and the DMV.",
    ifPasses:
      "Photo ID becomes a constitutional requirement for all voting in NC — in person and by mail.",
    ifFails:
      "In-person photo ID requirement stays as state law. Mail-in voters are not required to include a photo ID.",
    argFor:
      "Putting voter ID in the constitution ensures consistent election security that can't be undone by a future legislature.",
    argAgainst:
      "Elderly, low-income, and minority voters are less likely to have qualifying photo ID, and adding a mail-in ID requirement could disenfranchise voters who already face barriers to getting to polling locations.",
  },
];

function AmendmentCard({ a }: { a: Amendment }) {
  return (
    <article className="rounded-lg border-t-4 border-[#c9a84c] bg-white p-6 shadow-lg sm:p-8">
      {/* Amendment label pill + bill number. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">
          Amendment {a.number}
        </span>
        <span className="font-mono text-sm text-gray-500">{a.ballotLabel}</span>
      </div>

      {/* Title. */}
      <h2 className="mt-4 font-serif text-2xl font-bold text-navy sm:text-3xl">
        {a.shortTitle}
      </h2>

      {/* Ballot question — italic gray inside a light gray inset box. */}
      <div className="mt-4 rounded-md bg-pagebg p-4">
        <p className="text-base italic leading-relaxed text-gray-600">
          {a.question}
        </p>
      </div>

      {/* What it actually does — navy left border. */}
      <div className="mt-6 border-l-4 border-navy pl-4">
        <p className="text-sm font-bold uppercase tracking-wide text-navy">
          What it actually does
        </p>
        <p className="mt-2 text-base leading-relaxed text-gray-700">
          {a.actuallyDoes}
        </p>
      </div>

      {/* If it passes / if it fails — side by side, stack on mobile. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border-l-4 border-lowrisk bg-[#f0fdf4] p-4">
          <p className="font-bold text-lowrisk">✅ If it passes</p>
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            {a.ifPasses}
          </p>
        </div>
        <div className="rounded-md border-l-4 border-ncred bg-[#fef2f2] p-4">
          <p className="font-bold text-ncred">❌ If it fails</p>
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            {a.ifFails}
          </p>
        </div>
      </div>

      {/* Arguments — side by side, stack on mobile. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-lowrisk bg-[#f0fdf4] p-5">
          <p className="text-base font-bold text-lowrisk">
            👍 Arguments in Favor
          </p>
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            {a.argFor}
          </p>
        </div>
        <div className="rounded-md border border-ncred bg-[#fef2f2] p-5">
          <p className="text-base font-bold text-ncred">👎 Arguments Against</p>
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            {a.argAgainst}
          </p>
        </div>
      </div>
    </article>
  );
}

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
        {/* INTRO CARD — white, skyblue left border, ballot icon. */}
        <div className="rounded-lg border-l-4 border-skyblue bg-white p-6 shadow-md sm:p-7">
          <p className="text-base leading-relaxed text-gray-700 sm:text-lg">
            <span className="mr-2" aria-hidden>
              🗳️
            </span>
            Every NC voter will see these three constitutional amendments on
            their ballot this November. We&apos;ve explained what each one
            actually does — not just what it says.
          </p>
        </div>

        {/* AMENDMENT CARDS — two side by side, third beneath the first.
            The bottom-right slot is reserved for future ballot content. */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
          {AMENDMENTS.map((a) => (
            <AmendmentCard key={a.number} a={a} />
          ))}
          {/* Placeholder — fills the open bottom-right slot on desktop. */}
          <div className="hidden rounded-lg border-2 border-dashed border-[#c9a84c]/60 bg-white/40 p-8 lg:flex lg:min-h-[12rem] lg:items-center lg:justify-center">
            <p className="text-center text-sm font-medium text-navymuted">
              More ballot information coming soon
            </p>
          </div>
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

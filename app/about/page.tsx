import type { Metadata } from "next";
import { getHomeStats } from "../../lib/bills";

export const metadata: Metadata = {
  title: "About — NCPoliSearch",
  description:
    "NCPoliSearch makes North Carolina's legislature accessible to every citizen. A nonpartisan civic project of the NC Youth Legislative Council.",
};

// ---------------------------------------------------------------------------
// Inline line-icons (24px, currentColor). Kept local to this page since they
// are only used here.
// ---------------------------------------------------------------------------
type IconName =
  | "collect"
  | "analyze"
  | "present"
  | "legiscan"
  | "ncleg"
  | "anthropic"
  | "ncsbe";

function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "collect":
    case "legiscan":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case "analyze":
    case "anthropic":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
      );
    case "present":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="14" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="15" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "ncleg":
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
    case "ncsbe":
      return (
        <svg {...common}>
          <path d="M12 2l8 4v5c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V6z" />
          <polyline points="9 11 11 13 15 9" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Section content (timeline steps + data sources).
// ---------------------------------------------------------------------------
const STEPS: { icon: IconName; step: string; title: string; body: string }[] = [
  {
    icon: "collect",
    step: "Step 1",
    title: "We collect the data",
    body: "Every bill introduced in the NC General Assembly is automatically pulled into our database daily using the LegiScan API, cross-referenced with official bill text and legislator information from the NC General Assembly website at ncleg.gov.",
  },
  {
    icon: "analyze",
    step: "Step 2",
    title: "We analyze it",
    body: "Our AI system, powered by Anthropic's Claude API, reads each bill and generates a plain language summary along with balanced arguments from both supporters and opponents. Every summary is grounded in the actual bill text — no spin, no opinion, no political agenda.",
  },
  {
    icon: "present",
    step: "Step 3",
    title: "We present it clearly",
    body: "We display everything in one place — bill summaries, voting records, legislator profiles, and bill comparisons — so any North Carolinian can understand what their representatives are doing in Raleigh.",
  },
];

const SOURCES: { icon: IconName; name: string; body: string; link: string }[] = [
  {
    icon: "legiscan",
    name: "LegiScan API",
    body: "Our primary data provider. LegiScan tracks all NC General Assembly bills in real time, including bill text, sponsor information, voting records, and status updates. Our database syncs with LegiScan daily to ensure NCPoliSearch always reflects the latest legislative activity.",
    link: "legiscan.com",
  },
  {
    icon: "ncleg",
    name: "NC General Assembly (ncleg.gov)",
    body: "The official website of the North Carolina General Assembly. We cross-reference all bill information with ncleg.gov to ensure accuracy and link directly to official bill text so users can always verify information at the source.",
    link: "ncleg.gov",
  },
  {
    icon: "anthropic",
    name: "Anthropic Claude API",
    body: "Our AI analysis is powered by Claude, Anthropic's AI assistant. Claude reads each bill's text and generates plain language summaries and balanced pro/con arguments. All AI-generated content is clearly labeled and should be verified with official sources.",
    link: "anthropic.com",
  },
  {
    icon: "ncsbe",
    name: "NC State Board of Elections",
    body: "Legislator and district information is sourced from the NC State Board of Elections, ensuring accurate representation data for all 170 members of the NC General Assembly.",
    link: "ncsbe.gov",
  },
];

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-gray-200 border-t-4 border-t-skyblue bg-white px-4 py-6 text-center shadow-sm">
      <div className="font-mono text-3xl font-bold text-navy">{value}</div>
      <div className="mt-1 text-xs text-navymuted">{label}</div>
    </div>
  );
}

export default async function AboutPage() {
  const stats = await getHomeStats();

  return (
    <main>
      {/* 1. HERO — navy bleed from the nav. */}
      <section className="bg-navy">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
            About NCPoliSearch
          </h1>
          {/* Bipartisan accent — democrat + republican side by side. */}
          <div className="mt-5 flex justify-center">
            <div className="flex overflow-hidden rounded-full">
              <span className="h-1.5 w-10 bg-democrat" />
              <span className="h-1.5 w-10 bg-republican" />
            </div>
          </div>
          <p className="mt-5 text-lg font-semibold text-skyblue sm:text-xl">
            Transparency. Accessibility. Democracy.
          </p>
        </div>
      </section>

      {/* 2. ABOUT NCPOLISEARCH */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-serif text-3xl font-bold text-navy">
          About NCPoliSearch
        </h2>
        <div className="mt-5 space-y-5 text-base leading-relaxed text-gray-700">
          <p>
            NCPoliSearch was built with a single mission in mind: to make North
            Carolina&apos;s legislature accessible to every citizen, not just
            those with law degrees. The NC General Assembly debates and passes
            legislation that affects the lives of over 10 million North
            Carolinians every single day — from education funding to healthcare
            policy to criminal justice reform. Yet most of these bills are
            written in dense legal language spanning dozens, sometimes hundreds
            of pages, making them nearly impossible for everyday citizens to
            understand.
          </p>
          <p>
            NCPoliSearch changes that. Using artificial intelligence and plain
            language analysis, we break down every bill in the NC General
            Assembly into clear, nonpartisan summaries that anyone can
            understand in under a minute. We show you who sponsored the bill,
            how legislators voted, and what supporters and critics are saying —
            all in one place, completely free.
          </p>
        </div>
      </section>

      {/* 3. ABOUT NCYLC — light blue band. */}
      <section className="bg-skyblue">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-serif text-3xl font-bold text-navy">
            A Project of NC Youth Legislative Council
          </h2>
          <p className="mt-5 text-base leading-relaxed text-navy/90">
            The NC Youth Legislative Council (NCYLC) is a student-led advisory
            board dedicated to giving the youth of North Carolina a meaningful
            voice in the legislature. We believe that civic engagement
            shouldn&apos;t start at 18 — young North Carolinians deserve to
            understand, engage with, and shape the policies that will define
            their future. NCYLC works directly with state legislators to bridge
            the gap between the next generation and the halls of the General
            Assembly, fostering a culture of informed participation and
            democratic accountability across the state.
          </p>
        </div>
      </section>

      {/* 4. HOW IT WORKS — three-step timeline. */}
      <section className="mx-auto max-w-[1600px] px-6 py-16">
        <h2 className="text-center font-serif text-3xl font-bold text-navy">
          How NCPoliSearch Works
        </h2>
        <div className="relative mt-12 grid gap-10 md:grid-cols-3">
          {/* Connector line behind the icon row (desktop only). */}
          <div
            className="absolute left-0 right-0 top-7 hidden h-px bg-skyblue md:block"
            aria-hidden
          />
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="relative flex flex-col items-center text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-skyblue ring-8 ring-pagebg">
                <Icon name={s.icon} />
              </div>
              <p className="mt-4 font-mono text-xs font-bold uppercase tracking-widest text-navymuted">
                {s.step}
              </p>
              <h3 className="mt-1 font-serif text-lg font-bold text-navy">
                {s.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-700">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. DATA SOURCES — card grid. */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-16">
          <h2 className="text-center font-serif text-3xl font-bold text-navy">
            Our Data Sources
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {SOURCES.map((src) => (
              <a
                key={src.name}
                href={`https://${src.link}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-skyblue hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-badge text-navy">
                    <Icon name={src.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="font-serif text-base font-bold text-navy">
                    {src.name}
                  </h3>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                  {src.body}
                </p>
                <span className="mt-4 font-mono text-xs font-semibold text-navylight transition-colors group-hover:text-skyblue">
                  {src.link} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BUILT BY — navy-bordered card. */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-lg border border-gray-200 border-l-4 border-l-navy bg-white p-8 shadow-sm">
          <h2 className="font-serif text-2xl font-bold text-navy">
            Who Built This?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            NCPoliSearch was designed and developed by Shrenik Sridharala, a
            student representative in Senate District 42, with the support and
            guidance of Senator Woodson Bradley. This project was born out of a
            simple frustration: why is it so hard for regular people to find out
            what their representatives are actually doing? NCPoliSearch is our
            answer to that question.
          </p>
        </div>
      </section>

      {/* 7. MISSION STATS. */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            value={stats.totalBills.toLocaleString()}
            label="Bills Tracked"
          />
          <StatCard
            value={stats.legislators.toLocaleString()}
            label="Legislators"
          />
          <StatCard value="100%" label="Nonpartisan" />
        </div>
      </section>

      {/* 8. DISCLAIMER. */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <p className="text-xs leading-relaxed text-navymuted">
          NCPoliSearch is an independent civic technology project produced by
          the NC Youth Legislative Council. We are not affiliated with the NC
          General Assembly or any political party. AI-generated summaries are
          for informational purposes only and are based on bill text retrieved
          from LegiScan. Always verify information with official sources at
          ncleg.gov. Data is updated daily.
        </p>
      </section>
    </main>
  );
}

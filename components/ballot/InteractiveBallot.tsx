"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NcOutline from "../NcOutline";

// ---------------------------------------------------------------------------
// Amendment content. Each panel is rendered identically from this data so the
// three amendments stay consistent and easy to update.
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

const GOLD = "#c9a84c";
const NAVY = "#1a1f8f";

// A fill-in-the-oval ballot marker, drawn as real SVG shapes. Smoothly
// animates its fill so picking an amendment feels like marking a ballot.
function VoteOval({ marked }: { marked: boolean }) {
  return (
    <svg width="30" height="17" viewBox="0 0 30 17" className="mt-0.5 shrink-0" aria-hidden>
      <motion.ellipse
        cx="15"
        cy="8.5"
        rx="13"
        ry="7"
        stroke={NAVY}
        strokeWidth="1.6"
        initial={false}
        animate={{ fill: marked ? GOLD : "#ffffff" }}
        transition={{ duration: 0.2 }}
      />
    </svg>
  );
}

function AmendmentRow({
  a,
  marked,
  onSelect,
}: {
  a: Amendment;
  marked: boolean;
  onSelect: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(a.number)}
      aria-label={`Read more about Amendment ${a.number}: ${a.shortTitle}`}
      className="group flex w-full items-start gap-3 border-b border-gray-200 py-4 text-left transition-colors last:border-b-0 hover:bg-[#faf6ec]"
    >
      <VoteOval marked={marked} />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs font-bold tracking-wide text-navy">
          AMENDMENT {a.number}
        </span>
        <h3 className="mt-0.5 font-serif text-lg font-bold leading-snug text-navy">
          {a.shortTitle}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm italic leading-snug text-gray-500">
          {a.question}
        </p>
      </div>
      <svg
        className="mt-2 h-4 w-4 shrink-0 text-navymuted transition-transform group-hover:translate-x-1"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// The "paper" itself — a letterhead, a perforation line, and the three
// amendment rows to fill in.
function BallotPaper({
  viewed,
  onSelect,
}: {
  viewed: Set<number>;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="w-full border-[3px] border-navy bg-white p-6 shadow-xl sm:p-8">
      <div className="-mx-6 -mt-6 h-2 bg-[#c9a84c] sm:-mx-8 sm:-mt-8" aria-hidden />

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-navy">
          <NcOutline className="h-8 w-8 text-navy" />
        </div>
        <p className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-navymuted">
          State of North Carolina
        </p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-navy sm:text-3xl">
          Official Ballot
        </h2>
        <p className="mt-1 text-sm text-gray-500">General Election · November 3, 2026</p>
      </div>

      {/* Perforation line — a torn-stub effect between the letterhead and the
          amendment section, like an actual ballot stub. */}
      <div className="relative my-6" aria-hidden>
        <div className="border-t-2 border-dashed border-gray-300" />
        <div className="absolute -left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-pagebg ring-2 ring-gray-200 sm:-left-4" />
        <div className="absolute -right-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-pagebg ring-2 ring-gray-200 sm:-right-4" />
      </div>

      <p className="section-label">Constitutional Amendments</p>
      <p className="mt-2 text-sm text-gray-500">
        Select an amendment below to read what it actually does before you vote.
      </p>

      <div className="mt-4">
        {AMENDMENTS.map((a) => (
          <AmendmentRow key={a.number} a={a} marked={viewed.has(a.number)} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function DetailPanel({ a, onClose }: { a: Amendment; onClose: () => void }) {
  return (
    <article className="relative rounded-lg border-t-4 border-[#c9a84c] bg-white p-6 shadow-lg sm:p-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-navymuted transition-colors hover:bg-gray-200 hover:text-navy"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Keyed by amendment number so switching between amendments while the
          card is already open crossfades the content instead of jumping. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={a.number}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <span className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">
              Amendment {a.number}
            </span>
            <span className="font-mono text-sm text-gray-500">{a.ballotLabel}</span>
          </div>

          <h2 className="mt-4 font-serif text-2xl font-bold text-navy sm:text-3xl">
            {a.shortTitle}
          </h2>

          <div className="mt-4 rounded-md bg-pagebg p-4">
            <p className="text-base italic leading-relaxed text-gray-600">{a.question}</p>
          </div>

          <div className="mt-6 border-l-4 border-navy pl-4">
            <p className="text-sm font-bold uppercase tracking-wide text-navy">
              What it actually does
            </p>
            <p className="mt-2 text-base leading-relaxed text-gray-700">{a.actuallyDoes}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border-l-4 border-lowrisk bg-[#f0fdf4] p-4">
              <p className="font-bold text-lowrisk">✅ If it passes</p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">{a.ifPasses}</p>
            </div>
            <div className="rounded-md border-l-4 border-ncred bg-[#fef2f2] p-4">
              <p className="font-bold text-ncred">❌ If it fails</p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">{a.ifFails}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-lowrisk bg-[#f0fdf4] p-5">
              <p className="text-base font-bold text-lowrisk">👍 Arguments in Favor</p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">{a.argFor}</p>
            </div>
            <div className="rounded-md border border-ncred bg-[#fef2f2] p-5">
              <p className="text-base font-bold text-ncred">👎 Arguments Against</p>
              <p className="mt-2 text-base leading-relaxed text-gray-700">{a.argAgainst}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </article>
  );
}

// Centered alone by default; picking an amendment mounts the detail panel as
// a flex sibling, which naturally shifts the ballot toward the left of the
// pair (via layout on the ballot's own motion.div, which animates the move
// instead of snapping to its new position) while the card animates in on the
// right. Picking a different amendment while one is already open just swaps
// the card's content — see the AnimatePresence keyed by amendment number
// inside DetailPanel. Stacks vertically on mobile, where there isn't room
// for two full-width panels side by side.
export default function InteractiveBallot() {
  // null = only the ballot is showing; a number = that amendment's detail
  // panel is open alongside it.
  const [selected, setSelected] = useState<number | null>(null);
  // Which amendments have been opened at least once — kept separate from
  // `selected` so the oval stays marked gold even after closing the card,
  // instead of un-filling the moment you close it.
  const [viewed, setViewed] = useState<Set<number>>(new Set());
  // The amendment the detail panel renders. Only updated when opening a NEW
  // one (not cleared on close), so the content doesn't vanish mid-animation
  // while the panel is still visibly sliding/fading out.
  const [detailAmendment, setDetailAmendment] = useState<Amendment | null>(null);

  function handleSelect(n: number) {
    setDetailAmendment(AMENDMENTS.find((a) => a.number === n) ?? null);
    setSelected(n);
    setViewed((prev) => new Set(prev).add(n));
  }

  const springTransition = { type: "spring" as const, stiffness: 260, damping: 28 };

  return (
    // max-w here has to fit BOTH panels at their full lg:max-w-2xl (672px)
    // size side by side, plus the gap — a narrower cap (max-w-5xl = 1024px
    // was tried first) forces flexbox to shrink both panels below their
    // intended width even on a wide screen, which read as "everything got
    // skinny for no reason." flex-shrink-0 backs that up so neither panel
    // ever gets squeezed once there's a sibling.
    <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <motion.div
        layout
        transition={springTransition}
        className="w-full shrink-0 lg:max-w-2xl"
      >
        <BallotPaper viewed={viewed} onSelect={handleSelect} />
      </motion.div>

      <AnimatePresence>
        {selected != null && detailAmendment && (
          <motion.div
            key="detail"
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={springTransition}
            className="w-full shrink-0 lg:max-w-2xl"
          >
            <DetailPanel a={detailAmendment} onClose={() => setSelected(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

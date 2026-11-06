import type { RaceTurnout } from "../../lib/turnout";

const fmt = (n: number) => n.toLocaleString("en-US");

function Bar({ label, sub, pct, strong }: { label: string; sub: string; pct: number; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className={strong ? "font-semibold text-navy" : "text-navymuted"}>
          {label} <span className="font-normal text-navymuted">{sub}</span>
        </span>
        <span className={`font-mono ${strong ? "font-semibold text-navy" : "text-navymuted"}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${strong ? "bg-navy" : "bg-navymuted/50"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

// Share of the district's registered voters who cast a vote in this race,
// next to the same district in 2024 and the statewide figure for recent
// elections.
export default function TurnoutCard({
  votes,
  turnout,
  statewide,
  unopposed,
}: {
  votes: number;
  turnout: RaceTurnout | null;
  statewide: { year: number; kind: string; pct: number }[];
  unopposed: boolean;
}) {
  const reg = turnout?.registered ?? 0;
  const pct = reg > 0 ? (100 * votes) / reg : null;
  const prev = turnout?.prev ?? null;
  const prevPct = prev && prev.registered > 0 ? (100 * prev.votes) / prev.registered : null;
  const state2026 = statewide.find((s) => s.year === 2026);
  const state2022 = statewide.find((s) => s.year === 2022);

  let change: string | null = null;
  if (pct != null && prevPct != null && prev) {
    const diff = pct - prevPct;
    const voteDiff = votes - prev.votes;
    change = `${Math.abs(diff) < 0.05 ? "Even with" : `${Math.abs(diff).toFixed(1)} pts ${diff > 0 ? "higher than" : "lower than"}`} 2024 · ${voteDiff >= 0 ? "+" : "−"}${fmt(Math.abs(voteDiff))} votes`;
  }

  return (
    <section className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="section-label">Turnout</h2>
      {pct == null ? (
        <p className="mt-3 text-sm text-navymuted">Registered-voter counts aren&apos;t available for this district.</p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-4xl font-bold text-navy">{pct.toFixed(1)}%</span>
            {change && <span className="text-xs text-navymuted">{change}</span>}
          </div>
          <p className="mt-1 text-xs text-navymuted">
            {fmt(votes)} of {fmt(reg)} registered voters cast a vote in this race.
          </p>

          <div className="mt-4 space-y-3">
            <Bar label="This district, 2026" sub="midterm" pct={pct} strong />
            {prev && prevPct != null ? (
              <Bar
                label="This district, 2024"
                sub={prev.unopposed ? "presidential · unopposed" : "presidential"}
                pct={prevPct}
              />
            ) : (
              <p className="text-xs text-navymuted">
                No 2024 comparison: this district&apos;s precincts changed since then.
              </p>
            )}
            {state2026 && <Bar label="Statewide, 2026" sub="US Senate" pct={state2026.pct} />}
            {state2022 && <Bar label="Statewide, 2022" sub="last midterm" pct={state2022.pct} />}
          </div>

          <p className="mt-auto pt-4 text-[11px] leading-snug text-navymuted">
            Counts voters who marked this race; people who skipped it aren&apos;t included.
            {unopposed && " Unopposed races are skipped more often."}
            {prev?.unopposed && !unopposed && " The 2024 race was unopposed, which drew fewer votes."}
            {" "}Presidential years always draw more voters than midterms.
          </p>
        </>
      )}
    </section>
  );
}

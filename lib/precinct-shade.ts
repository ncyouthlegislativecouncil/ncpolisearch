// Precinct map shading shared by the interactive race page and the printable
// report: who led each precinct, and by how many percentage points.

export const SHADES: Record<string, string[]> = {
  D: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"],
  R: ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c"],
  other: ["#e5e7eb", "#c4c6d8", "#9a9dc4", "#7a7eb8"],
};
export const BIN_EDGES = [5, 15, 30]; // < 5, 5–15, 15–30, 30+
export const NO_VOTES = "#f3f4f6";

// votes: one number per candidate.
export function tallyVotes(votes: number[]) {
  const total = votes.reduce((a, b) => a + b, 0);
  const order = votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const margin = total > 0 && order.length > 1 ? (100 * (order[0].v - order[1].v)) / total : total > 0 ? 100 : 0;
  return { votes, total, leader: total > 0 ? order[0].i : -1, margin };
}

export function shadeOf(t: ReturnType<typeof tallyVotes>, candidates: { party: string | null }[]): string {
  if (t.leader < 0) return NO_VOTES;
  const party = candidates[t.leader].party;
  const ramp = SHADES[party === "D" || party === "R" ? party : "other"];
  return ramp[BIN_EDGES.filter((e) => t.margin >= e).length];
}

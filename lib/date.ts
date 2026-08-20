// Vote dates from LegiScan arrive as bare calendar strings ("YYYY-MM-DD") with
// no time or zone. Running those through `new Date("2026-06-26")` parses them as
// UTC midnight, and any subsequent locale formatting shifts the displayed day
// forward or back depending on the runtime's offset — which is exactly the
// "vote shows one day ahead" bug.
//
// The dates are pure calendar dates, so we format them from their literal parts
// and never construct a timezone-sensitive Date. This pins the output to the day
// LegiScan actually recorded, treated as Eastern, with no forward shift.
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(date: string | null): { y: string; mi: number; d: number } | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const mi = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  if (mi < 0 || mi > 11 || d < 1 || d > 31) return null;
  return { y: m[1], mi, d };
}

// "2026-06-26" -> "Jun 26, 2026" (or the original string if unparseable).
export function formatVoteDate(date: string | null): string | null {
  if (!date) return null;
  const p = parts(date);
  if (!p) return date;
  return `${MONTHS_SHORT[p.mi]} ${p.d}, ${p.y}`;
}

// "2026-06-26" -> "June 26, 2026" — long form for the featured card.
export function formatVoteDateLong(date: string | null): string | null {
  if (!date) return null;
  const p = parts(date);
  if (!p) return date;
  return `${MONTHS_LONG[p.mi]} ${p.d}, ${p.y}`;
}

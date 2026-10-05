// Pure helpers for the "Write your legislator" page: searching the bill and
// legislator lists, and assembling the letter text. No React, no database —
// everything the form needs is computed from plain data already in the browser.

export type Position = "support" | "oppose" | "info";

export type WriteBill = { id: number; n: string; t: string };

export type WriteLegislator = {
  id: number;
  name: string;
  role: string; // "Rep" | "Sen"
  district: string | null;
  party: string | null;
  email: string;
};

export type LetterInput = {
  legislator: WriteLegislator | null;
  bill: WriteBill | null;
  position: Position | null;
  place: string;
  anonymous: boolean;
  name: string;
  email: string;
  phone: string;
};

// Shown wherever a choice hasn't been made yet, e.g. "Dear Legislator ________,".
export const BLANK = "________";

export function lastName(full: string): string {
  const base = full.split(",")[0].trim().replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "");
  return base.split(/\s+/).pop() ?? base;
}

export function greeting(legislator: WriteLegislator | null): string {
  if (!legislator) return `Dear Legislator ${BLANK},`;
  const title = legislator.role === "Sen" ? "Senator" : "Representative";
  return `Dear ${title} ${lastName(legislator.name)},`;
}

// The bill reference plus the sentence-ending period; with a title, the period
// goes inside the closing quote (American style): H1006, "Title."
function billRefEnd(bill: WriteBill | null): string {
  return bill ? `${bill.n}, “${bill.t.replace(/[.\s]+$/, "")}.”` : `${BLANK}.`;
}

// "I am writing in strong support of H1006, "Title"." — with blanks for
// anything not chosen yet, so the sentence fills in as the visitor picks.
export function opening(
  position: Position | null,
  bill: WriteBill | null,
  place: string
): string {
  const ref = billRefEnd(bill);
  let sentence: string;
  if (position === "support") sentence = `I am writing in strong support of ${ref}`;
  else if (position === "oppose") sentence = `I am writing in strong opposition to ${ref}`;
  else if (position === "info") sentence = `I am writing to ask for more information about ${ref}`;
  else sentence = `I am writing ${BLANK} ${ref}`;
  const where = place.trim();
  return where ? `${sentence} I am a resident of ${where}.` : sentence;
}

export function signature(input: LetterInput): string {
  const lines = ["Sincerely,", input.anonymous ? "A concerned North Carolinian" : input.name.trim() || BLANK];
  if (input.email.trim()) lines.push(`Email: ${input.email.trim()}`);
  if (input.phone.trim()) lines.push(`Phone: ${input.phone.trim()}`);
  return lines.join("\n");
}

export function subject(position: Position | null, bill: WriteBill | null): string {
  const n = bill?.n ?? "a bill";
  if (position === "support") return `Support for ${n}`;
  if (position === "oppose") return `Opposition to ${n}`;
  if (position === "info") return `Question about ${n}`;
  return `Regarding ${n}`;
}

export function buildBody(input: LetterInput, message: string): string {
  const parts = [greeting(input.legislator), opening(input.position, input.bill, input.place)];
  if (message.trim()) parts.push(message.trim());
  parts.push(signature(input));
  return parts.join("\n\n");
}

export function mailtoUrl(to: string, subj: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
}

export function gmailUrl(to: string, subj: string, body: string): string {
  return (
    "https://mail.google.com/mail/?view=cm&fs=1" +
    `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// "SB 1006", "s.b. 1006", "sb1006" and "S1006" should all find S1006 — NC
// writes "Senate Bill"/"House Bill" but this site stores bare H/S numbers.
function normalizeBillQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[\s.\-#]/g, "")
    .replace(/^(sb|hb)/, (m) => m[0]);
}

export function searchBills(bills: WriteBill[], query: string, limit = 8): WriteBill[] {
  const raw = query.trim();
  if (!raw) return [];

  const norm = normalizeBillQuery(raw);
  if (/^[hs]?\d+$/.test(norm)) {
    const hasLetter = /^[hs]/.test(norm);
    const exact: WriteBill[] = [];
    const prefix: WriteBill[] = [];
    for (const b of bills) {
      const n = b.n.toLowerCase();
      const matches = hasLetter ? n.startsWith(norm) : n.slice(1).startsWith(norm);
      if (!matches) continue;
      (n === norm || n.slice(1) === norm ? exact : prefix).push(b);
    }
    return [...exact, ...prefix].slice(0, limit);
  }

  const tokens = raw.toLowerCase().split(/\s+/);
  const out: WriteBill[] = [];
  for (const b of bills) {
    const t = b.t.toLowerCase();
    if (tokens.every((tok) => t.includes(tok))) out.push(b);
    if (out.length >= limit) break;
  }
  return out;
}

export function searchLegislators(
  legislators: WriteLegislator[],
  query: string,
  limit = 8
): WriteLegislator[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return [];
  const tokens = raw.split(/\s+/);
  const out: WriteLegislator[] = [];
  for (const l of legislators) {
    const hay = `${l.name} ${l.district ?? ""} ${l.role === "Sen" ? "senate senator" : "house representative"}`.toLowerCase();
    if (tokens.every((tok) => hay.includes(tok))) out.push(l);
    if (out.length >= limit) break;
  }
  return out;
}

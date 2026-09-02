// Fixed set of topic categories a bill can be classified into. Shared between
// the AI classification prompts (lib/summarize.ts, scripts/summarize.ts,
// scripts/backfill-topics.ts) and the UI (FilterBar, BillCard) so the list
// only needs to change in one place.
export const TOPICS = [
  "Education",
  "Healthcare",
  "Criminal Justice & Public Safety",
  "Taxes & Budget",
  "Elections & Voting",
  "Environment & Energy",
  "Transportation & Infrastructure",
  "Business & Labor",
  "Housing",
  "Agriculture",
  "Technology & Privacy",
  "Social Services & Welfare",
  "Local Government",
  "Other / General Government",
] as const;

export type Topic = (typeof TOPICS)[number];

export function isValidTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}

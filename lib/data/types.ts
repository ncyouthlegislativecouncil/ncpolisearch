// Shapes of the committed data files under data/. These replace the old
// Postgres tables: one file per bill (bill + sponsors + roll calls with each
// member's vote), plus one file listing every legislator.

export type Sponsor = {
  peopleId: number | null;
  name: string | null;
  party: string | null;
  isPrimary: boolean | null;
};

export type MemberVote = {
  peopleId: number | null;
  name: string | null;
  party: string | null;
  vote: string | null;
};

export type RollCall = {
  rollCallId: number;
  date: string | null;
  // What the roll call was on, from LegiScan ("Amendment 3", "Second Reading").
  description: string | null;
  chamber: string | null;
  yea: number | null;
  nay: number | null;
  nv: number | null;
  absent: number | null;
  passed: boolean | null;
  votes: MemberVote[];
};

export type BillFile = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  changeHash: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  url: string | null;
  aiSummary: string | null;
  aiProArguments: string | null;
  aiConArguments: string | null;
  topic: string | null;
  // Character length of the source text the AI analysis was based on. The full
  // text itself isn't kept (the site never shows it); the homepage uses this
  // length to feature substantial bills over short procedural ones.
  textLength: number;
  createdAt: string | null;
  sponsors: Sponsor[];
  rollCalls: RollCall[];
};

export type Legislator = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  imageUrl: string | null;
  // 2026 reelection status. null = unknown, true = running, false = retiring.
  runningForReelection: boolean | null;
  createdAt: string | null;
};

// Results of one election, built from the NC State Board of Elections'
// precinct results file by scripts/update-election-results.ts.
export type ElectionCandidate = {
  name: string; // for amendments, the choice: "For" / "Against"
  party: string | null; // "R", "D", "L", "G", "U" (unaffiliated), or the State Board's code
  votes: number;
};

export type RaceCategory = "federal" | "courts" | "amendments" | "nc-senate" | "nc-house";

export type Race = {
  id: string; // "us-senate", "us-house-01", "nc-house-067", ...
  category: RaceCategory;
  contest: string; // State Board contest name, e.g. "NC HOUSE OF REPRESENTATIVES DISTRICT 067"
  title: string; // "NC House District 67"
  district: number | null;
  area: string; // "Statewide", "Wake County", or "7 counties"
  statewide: boolean;
  // Party that held the seat going into the election ("R", "D", ...), used to
  // mark flips. Frozen when the results were first recorded so it survives the
  // roster turning over afterward; null when unknown (e.g. Court of Appeals).
  previousParty: string | null;
  candidates: ElectionCandidate[]; // most votes first
};

export type ElectionResults = {
  election: string; // "2026-11-03"
  name: string;
  source: string;
  // When the State Board last updated its results file.
  sourceUpdated: string;
  // False until the State Board certifies the results; while false the daily
  // update keeps refreshing them.
  certified: boolean;
  races: Race[];
};

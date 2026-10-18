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

// Shared test inputs for the files-migration comparison: the snapshot route
// (old, database-backed) and the comparison script (new, file-backed) both
// run exactly these cases.
import { TOPICS } from "../../lib/topics";

type BillFilters = { search?: string; chamber?: string; status?: string; party?: string; topic?: string; sort?: string; page?: number; pageSize?: number };
type LegislatorFilters = { chamber?: string; party?: string; search?: string };

export const BILL_FILTER_CASES: Record<string, BillFilters> = {
  default: {},
  page2: { page: 2 },
  page50: { page: 50 },
  pageLast: { page: 98 },
  pageBeyond: { page: 500 },
  oldest: { sort: "oldest" },
  oldestPage3: { sort: "oldest", page: 3 },
  title: { sort: "title" },
  titlePage10: { sort: "title", page: 10 },
  house: { chamber: "H" },
  senate: { chamber: "S" },
  badChamber: { chamber: "X" },
  republican: { party: "Republican" },
  democrat: { party: "Democrat" },
  bipartisan: { party: "Bipartisan" },
  bipartisanPage2: { party: "Bipartisan", page: 2 },
  searchEducation: { search: "education" },
  searchH10: { search: "H10" },
  searchLowerS4: { search: "s4" },
  searchTax: { search: "tax" },
  searchNone: { search: "zzzqqq" },
  combo1: { chamber: "S", party: "Democrat", sort: "title" },
  combo2: { topic: "Education", party: "Bipartisan" },
  combo3: { search: "school", status: "1", chamber: "H" },
  combo4: { status: "4", sort: "oldest", page: 2 },
  ...Object.fromEntries(["1", "2", "3", "4", "5"].map((s) => [`status${s}`, { status: s }])),
  ...Object.fromEntries(TOPICS.map((t) => [`topic:${t}`, { topic: t }])),
};

export const LEGISLATOR_FILTER_CASES: Record<string, LegislatorFilters> = {
  all: {},
  house: { chamber: "House" },
  senate: { chamber: "Senate" },
  republican: { party: "Republican" },
  democrat: { party: "Democrat" },
  searchSmith: { search: "smith" },
  searchJo: { search: "jo" },
  combo: { chamber: "Senate", party: "Democrat" },
  searchNone: { search: "zzzqqq" },
};

export const LITE_SEARCHES = ["h10", "S445", "budget", "education", "", "zzzqqq", "  tax  "];


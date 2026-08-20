export type VoteInfo = { label: string; className: string };

// Maps a LegiScan vote_text value to a display label + badge styling.
//   Yea        -> green
//   Nay        -> NC red (#8c1616 via bg-ncred)
//   NV/Absent  -> gray
export function voteInfo(vote: string | null): VoteInfo {
  switch (vote) {
    case "Yea":
      return { label: "Yea", className: "bg-green-600 text-white" };
    case "Nay":
      return { label: "Nay", className: "bg-ncred text-white" };
    case "NV":
      return { label: "Not Voting", className: "bg-gray-300 text-gray-600" };
    case "Absent":
      return { label: "Absent", className: "bg-gray-300 text-gray-600" };
    default:
      return { label: vote ?? "—", className: "bg-gray-200 text-gray-600" };
  }
}

export function billNumberFor(chamber: string | null): string {
  if (chamber === "H") return "House";
  if (chamber === "S") return "Senate";
  return chamber ?? "";
}

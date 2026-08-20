export type StatusInfo = { label: string; className: string };

// LegiScan numeric status codes -> display label + pill styling.
const STATUS_MAP: Record<string, StatusInfo> = {
  "1": { label: "Introduced", className: "bg-gray-200 text-gray-700" },
  "2": { label: "Engrossed", className: "bg-skyblue text-navy" },
  "3": { label: "Enrolled", className: "bg-navy text-white" },
  "4": { label: "Passed", className: "bg-green-600 text-white" },
  "5": { label: "Vetoed", className: "bg-ncred text-white" },
  "6": { label: "Failed", className: "bg-ncred text-white" },
};

export function statusInfo(status: string): StatusInfo {
  return STATUS_MAP[status] ?? { label: "Unknown", className: "bg-gray-200 text-gray-700" };
}

export function chamberLabel(chamber: string | null): string {
  if (chamber === "H") return "House";
  if (chamber === "S") return "Senate";
  return "";
}

export const STATUS_OPTIONS = [
  { value: "1", label: "Introduced" },
  { value: "2", label: "Engrossed" },
  { value: "3", label: "Enrolled" },
  { value: "4", label: "Passed" },
  { value: "5", label: "Vetoed" },
] as const;

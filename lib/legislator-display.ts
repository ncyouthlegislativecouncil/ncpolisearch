import type { ElectionOutcome } from "./elections";

export type PartyInfo = { label: string; className: string };

export function partyInfo(party: string | null): PartyInfo {
  if (party === "R") return { label: "Republican", className: "bg-republican text-white" };
  if (party === "D") return { label: "Democrat", className: "bg-democrat text-white" };
  return { label: party ? party : "Unaffiliated", className: "bg-navymuted text-white" };
}

// Badge for how a sitting legislator fared in the 2026 general election.
export type ElectionBadge = { label: string; className: string; note: string };

export function electionBadge(outcome: ElectionOutcome | null): ElectionBadge | null {
  if (!outcome) return null;
  const pct = outcome.pct != null ? `${(outcome.pct * 100).toFixed(1)}%` : "";
  const note = `2026 general election · ${outcome.certified ? "certified" : "unofficial"} results from the NC State Board of Elections`;
  if (outcome.kind === "won") {
    return {
      label: outcome.unopposed ? "Re-elected · Unopposed" : `Re-elected · ${pct}`,
      className: "bg-lowrisk text-white",
      note,
    };
  }
  if (outcome.kind === "lost") {
    return { label: `Lost reelection · ${pct}`, className: "bg-ncred text-white", note };
  }
  return {
    label: "Leaving office · January 2027",
    className: "bg-navymuted text-white",
    note: "Not on the 2026 ballot for this seat",
  };
}

// Initials for an avatar placeholder, e.g. "Norma Torres" -> "NT".
export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function roleLabel(role: string | null): string {
  if (role === "Rep") return "Representative";
  if (role === "Sen") return "Senator";
  return role ?? "";
}

export function chamberFromRole(role: string | null): string {
  if (role === "Rep") return "House";
  if (role === "Sen") return "Senate";
  return "";
}

// District codes look like "HD-038" or "SD-012"; show just the number.
export function districtNumber(district: string | null): string | null {
  if (!district) return null;
  const m = district.match(/(\d+)/);
  return m ? String(parseInt(m[1], 10)) : district;
}

export type PartyInfo = { label: string; className: string };

export function partyInfo(party: string | null): PartyInfo {
  if (party === "R") return { label: "Republican", className: "bg-republican text-white" };
  if (party === "D") return { label: "Democrat", className: "bg-democrat text-white" };
  return { label: party ? party : "Unaffiliated", className: "bg-navymuted text-white" };
}

// 2026 reelection badge. null = unknown, true = running, false = retiring.
export type ReelectionInfo = { label: string; className: string };

export function reelectionInfo(
  running: boolean | null | undefined
): ReelectionInfo {
  if (running === true)
    return {
      label: "Running for Reelection · November 2026",
      className: "bg-lowrisk text-white",
    };
  if (running === false)
    return {
      label: "Not Seeking Reelection",
      className: "bg-ncred text-white",
    };
  return { label: "2026 Status Unknown", className: "bg-navymuted text-white" };
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

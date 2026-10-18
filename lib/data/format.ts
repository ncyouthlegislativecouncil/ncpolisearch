// Serializes data files so that git diffs stay small and readable: objects and
// arrays that contain only plain values (a sponsor, one member's vote, a
// legislator) are written on a single line; anything nested is expanded with
// two-space indentation.

function isFlat(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.every((c) => c === null || typeof c !== "object");
}

function format(value: unknown, indent: string): string {
  if (isFlat(value)) return JSON.stringify(value);
  const inner = indent + "  ";
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => inner + format(v, inner)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  return `{\n${entries
    .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`)
    .join(",\n")}\n${indent}}`;
}

export function formatDataFile(value: unknown): string {
  return format(value, "") + "\n";
}

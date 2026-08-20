// Splits a prose paragraph (how ai_pro_arguments / ai_con_arguments are
// stored) into individual sentence bullets for list display. Abbreviations
// are rare in this content, so a sentence-ending split is good enough.
export function toBullets(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

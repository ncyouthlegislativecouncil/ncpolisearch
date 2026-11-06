// Loose person-name matching between sources that spell names differently:
// LegiScan ("Zack Forde-Hawkins", "Patricia Cotham"), the State Board ballot
// ("Tricia Ann Cotham", "Grant L. Campbell, MD"), and ncleg.gov ("Zack Hawkins").

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "md", "phd", "dds", "esq"]);

// Lowercased name parts without accents, HTML entities, punctuation, quoted or
// parenthesized nicknames, initials, or suffixes:
// "Grant L. Campbell, MD" -> ["grant", "campbell"];
// "Zack Forde-Hawkins" -> ["zack", "forde", "hawkins"].
export function nameTokens(name: string): string[] {
  return name
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/"[^"]*"|\([^)]*\)/g, " ")
    .split(/[\s\-.,']+/)
    .filter((t) => t.length > 1 && !SUFFIXES.has(t));
}

// True when the two names plausibly share a last name: a's last name appears
// anywhere in b, or b's last name appears among a's non-first names.
export function sameLastName(a: string, b: string): boolean {
  const at = nameTokens(a);
  const bt = nameTokens(b);
  if (at.length === 0 || bt.length === 0) return false;
  return bt.includes(at[at.length - 1]) || at.slice(1).includes(bt[bt.length - 1]);
}

// True when the first names agree, allowing short forms ("Tim"/"Timothy").
export function sameFirstName(a: string, b: string): boolean {
  const af = nameTokens(a)[0];
  const bf = nameTokens(b)[0];
  return !!af && !!bf && (af.startsWith(bf) || bf.startsWith(af));
}

import "./pdf-polyfill"; // must load before pdf-parse (defines DOMMatrix in Node)
import { PDFParse } from "pdf-parse";

// Generous cap (~40k tokens). Most NC bills are a few pages and sit well under
// this, so they're summarized in full. Only the rare omnibus/appropriations
// bills exceed it and get section-aware sampling (below) rather than a blind
// head-truncation that would drop late provisions.
export const MAX_CHARS = 160_000;

function cleanWhitespace(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

// Decode a base64 LegiScan document and extract readable plain text.
export async function decodeDocText(base64: string, mime: string): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  if (mime.includes("pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const res = await parser.getText();
    return cleanWhitespace(res.text || "");
  }
  const raw = buf.toString("utf8");
  if (mime.includes("html")) return cleanWhitespace(stripHtml(raw));
  return cleanWhitespace(raw);
}

// Reduce an over-cap bill to <= maxChars while preserving coverage across the
// WHOLE document — so a provision in Section 40 is represented as much as one in
// Section 2, and the trailing effective-date clause is never lost.
export function condenseBillText(
  fullText: string,
  maxChars = MAX_CHARS
): { text: string; sampled: boolean } {
  if (fullText.length <= maxChars) return { text: fullText, sampled: false };

  // NC bills are divided into "SECTION n." blocks. Split on those (keeping the
  // marker via lookahead). parts[0] is the preamble (title/short title/etc.).
  const parts = fullText.split(/(?=SECTION\s+\d+)/i);

  if (parts.length <= 1) {
    // No section structure to exploit: keep a generous head plus the tail so
    // the closing/effective-date provisions survive.
    const headLen = Math.floor(maxChars * 0.7);
    const tailLen = maxChars - headLen;
    return {
      text:
        fullText.slice(0, headLen) +
        "\n\n[… middle of bill omitted for length …]\n\n" +
        fullText.slice(-tailLen),
      sampled: true,
    };
  }

  // Give every section an equal char budget; keep its heading + opening, plus a
  // slice of its end. Sum of pieces <= maxChars by construction.
  const budget = Math.floor(maxChars / parts.length);
  const pieces = parts.map((p) => {
    if (p.length <= budget) return p;
    const headLen = Math.floor(budget * 0.8);
    const tailLen = budget - headLen;
    return p.slice(0, headLen) + " […] " + p.slice(-tailLen);
  });
  return { text: pieces.join("\n"), sampled: true };
}

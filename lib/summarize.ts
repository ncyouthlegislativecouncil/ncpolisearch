import Anthropic from "@anthropic-ai/sdk";
import { getBill, getBillText } from "./legiscan";
import { decodeDocText, condenseBillText } from "./billtext";
import { TOPICS, isValidTopic } from "./topics";

// ---------------------------------------------------------------------------
// AI analysis of a bill: fetch its text from LegiScan and ask Claude for a
// plain-language summary, pro/con arguments, and a topic. Used by the daily data
// update (scripts/update-data.ts) for new bills that don't have analysis yet.
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT =
  "You are a nonpartisan civic education assistant for the NC Youth Legislative Council. Your job is to help everyday North Carolinians understand state legislation clearly and fairly. Never express your own opinion. Always present both sides equally.";

function userPrompt(title: string, billText: string): string {
  return `Analyze this North Carolina bill and respond in exactly this JSON format with no other text:
{
  "summary": "2-3 sentence plain language explanation of what this bill does. Neutral, factual, no opinion.",
  "pro_arguments": "2-3 sentences explaining what supporters of this bill argue. What problem does it solve? Who benefits?",
  "con_arguments": "2-3 sentences explaining what opponents of this bill argue. What are the concerns or tradeoffs?",
  "topic": "The single best-fit category for this bill. Must be EXACTLY one of: ${TOPICS.join(", ")}."
}

Bill title: ${title}
Bill text: ${billText}`;
}

export type Analysis = {
  summary: string;
  pro_arguments: string;
  con_arguments: string;
  topic: string;
};

// Claude is told to return only JSON, but defend against stray prose/code fences
// by slicing to the outermost braces. Returns null on any failure.
function parseAnalysis(text: string): Analysis | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1));
    if (
      typeof obj.summary === "string" &&
      typeof obj.pro_arguments === "string" &&
      typeof obj.con_arguments === "string" &&
      typeof obj.topic === "string" &&
      isValidTopic(obj.topic)
    ) {
      return obj as Analysis;
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch the most recent LegiScan document for a bill, decode it, and (for long
// bills) section-sample it so late provisions survive. Returns null when the
// bill has no usable document yet.
export async function fetchBillTextFromLegiScan(billId: number): Promise<string | null> {
  let detail;
  try {
    detail = await getBill(billId);
  } catch {
    return null;
  }

  const docs = detail.texts ?? [];
  if (docs.length === 0) return null;

  const doc = docs[docs.length - 1];

  let fullText: string;
  try {
    const fetched = await getBillText(doc.doc_id);
    fullText = await decodeDocText(fetched.doc, fetched.mime);
  } catch {
    return null;
  }

  if (!fullText || fullText.trim().length < 40) return null;

  const { text: condensed, sampled } = condenseBillText(fullText);
  return (
    (sampled
      ? "[Note: this is a long bill; the text below is sampled across all of its sections.]\n\n"
      : "") + condensed
  );
}

// Ask Claude for the summary, pro/con arguments, and topic. Returns null if the
// response can't be parsed; throws on API errors.
export async function analyzeBill(
  anthropic: Anthropic,
  title: string,
  text: string
): Promise<Analysis | null> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(title, text) }],
  });
  const out = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("");
  return parseAnalysis(out);
}

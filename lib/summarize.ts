import { desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { bills } from "../db/schema";
import { getBill, getBillText } from "./legiscan";
import { decodeDocText, condenseBillText } from "./billtext";

// ---------------------------------------------------------------------------
// Shared AI-analysis logic, used by both the CLI backfill (scripts/summarize.ts,
// which processes the whole backlog) and the daily cron (app/api/cron/poll),
// which tops up the newest handful of un-summarized bills each run so new bills
// get a plain-language summary automatically. Kept small and self-contained so
// it runs the same in a long-lived process and a short-lived serverless function.
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5";
const MIN_REAL_TEXT = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT =
  "You are a nonpartisan civic education assistant for the NC Youth Legislative Council. Your job is to help everyday North Carolinians understand state legislation clearly and fairly. Never express your own opinion. Always present both sides equally.";

function userPrompt(title: string, billText: string): string {
  return `Analyze this North Carolina bill and respond in exactly this JSON format with no other text:
{
  "summary": "2-3 sentence plain language explanation of what this bill does. Neutral, factual, no opinion.",
  "pro_arguments": "2-3 sentences explaining what supporters of this bill argue. What problem does it solve? Who benefits?",
  "con_arguments": "2-3 sentences explaining what opponents of this bill argue. What are the concerns or tradeoffs?"
}

Bill title: ${title}
Bill text: ${billText}`;
}

type Analysis = {
  summary: string;
  pro_arguments: string;
  con_arguments: string;
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
      typeof obj.con_arguments === "string"
    ) {
      return obj as Analysis;
    }
    return null;
  } catch {
    return null;
  }
}

type DB = ReturnType<typeof drizzle>;

// Get usable source text: the cached bill_text if it's real, otherwise fetch the
// most recent LegiScan document, decode it, and (for long bills) section-sample
// it. Caches the result into bills.bill_text so a later run never re-parses it.
async function resolveBillText(
  db: DB,
  billId: number,
  existing: string | null
): Promise<string | null> {
  if (existing && existing.trim().length >= MIN_REAL_TEXT) return existing;

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
  const composed =
    (sampled
      ? "[Note: this is a long bill; the text below is sampled across all of its sections.]\n\n"
      : "") + condensed;

  try {
    await db.update(bills).set({ billText: composed }).where(eq(bills.billId, billId));
  } catch {
    // Caching is best-effort; proceed with the in-memory text regardless.
  }
  return composed;
}

export interface SummarizeResult {
  analyzed: number;
  skipped: number;
  failed: number;
}

// Top up the AI analysis for the newest un-summarized bills. `limit` is kept
// small by the cron so the whole run stays comfortably within the serverless
// time budget; the CLI backfill uses its own loop for the full backlog. Only
// bills with a null ai_summary are ever selected, so nothing is re-analyzed
// (or re-charged) once done. Newest bills (highest bill_id) are handled first.
export async function summarizePending(limit = 10): Promise<SummarizeResult> {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema: { bills } });
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the env

  const pending = await db
    .select({
      billId: bills.billId,
      title: bills.title,
      billText: bills.billText,
    })
    .from(bills)
    .where(isNull(bills.aiSummary))
    .orderBy(desc(bills.billId))
    .limit(limit);

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;

  for (const bill of pending) {
    const text = await resolveBillText(db, bill.billId, bill.billText);
    if (!text) {
      skipped++;
      continue;
    }

    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt(bill.title ?? "Untitled", text) },
        ],
      });

      const out = message.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("");

      const analysis = parseAnalysis(out);
      if (!analysis) {
        failed++;
      } else {
        await db
          .update(bills)
          .set({
            aiSummary: analysis.summary,
            aiProArguments: analysis.pro_arguments,
            aiConArguments: analysis.con_arguments,
          })
          .where(eq(bills.billId, bill.billId));
        analyzed++;
      }
    } catch {
      // Never let one bill's failure stop the rest.
      failed++;
    }

    await sleep(300);
  }

  return { analyzed, skipped, failed };
}

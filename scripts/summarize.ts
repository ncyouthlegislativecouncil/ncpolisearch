import { config } from "dotenv";
// override:true so the key in .env.local wins over any empty/stale
// ANTHROPIC_API_KEY that may already be present in the shell environment.
config({ path: ".env.local", override: true });

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { bills } from "../db/schema";
import { getBill, getBillText } from "../lib/legiscan";
import { decodeDocText, condenseBillText } from "../lib/billtext";
import { TOPICS, isValidTopic } from "../lib/topics";

// Neon's HTTP driver issues each query as an independent HTTPS request, which
// holds up better than a long-lived pooled socket across a long, rate-limited
// job — same reasoning as scripts/backfill-votes.ts.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { bills } });

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const MODEL = "claude-haiku-4-5";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Resumability
// ---------------------------------------------------------------------------
// This job is long and costs real API credits, so it must be safely resumable.
// There are two layers:
//   1. DB state — we only select bills where ai_summary IS NULL, so anything
//      already analyzed is never re-sent to Claude (and never re-charged).
//   2. A checkpoint file recording the last fully-processed bill_id. Bills are
//      processed in ascending bill_id order, so this is a single high-water
//      mark we can resume right after. It lives in the OS temp dir (not the
//      project folder) so OneDrive sync can't lock it mid-write.
// Delete the checkpoint file (or pass --start 0) to re-scan from the beginning;
// already-summarized bills are still skipped by layer 1 regardless.
const CHECKPOINT_FILE = join(tmpdir(), "ncpolisearch-summarize-checkpoint");

function readCheckpoint(): number {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const n = parseInt(readFileSync(CHECKPOINT_FILE, "utf8").trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // A missing/corrupt checkpoint just means start from the beginning.
  }
  return -1;
}

function writeCheckpoint(billId: number) {
  try {
    writeFileSync(CHECKPOINT_FILE, String(billId));
  } catch {
    // Losing a checkpoint write only costs us re-scanning that bill on resume,
    // which is idempotent (layer 1 skips it) — never worth crashing over.
  }
}

// Optional manual start position via `--start N` or START_AT=N. Only bills with
// bill_id >= N are considered. Returns -1 (no override) when not provided.
function readStartOverride(): number {
  const flagIndex = process.argv.indexOf("--start");
  const raw = flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.START_AT;
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : -1;
}

// Optional cap on how many bills to process this run, via `--limit N` or
// LIMIT=N. Handy for a small test run before committing to the full job.
// Returns Infinity (no cap) when not provided.
function readLimit(): number {
  const flagIndex = process.argv.indexOf("--limit");
  const raw = flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.LIMIT;
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

// ---------------------------------------------------------------------------
// Prompts (verbatim per spec)
// ---------------------------------------------------------------------------
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

type Analysis = {
  summary: string;
  pro_arguments: string;
  con_arguments: string;
  topic: string;
};

// Extract a JSON object from the model's text output. Claude is instructed to
// return only JSON, but we defend against stray prose / code fences by slicing
// to the outermost braces. Returns null on any failure (caller treats as fail).
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

// Source the analysis input: the bill's ACTUAL text. LegiScan stores bill
// documents as PDFs, so we fetch the most recent version, decode it, extract the
// text, and (for very long bills) section-sample it so late provisions survive.
// The result is cached into bills.bill_text so a resume never re-downloads or
// re-parses a PDF it already processed.
//
// `existing` is honored only if it looks like real extracted text (the earlier
// title-only pass left short stubs we must NOT reuse).
const MIN_REAL_TEXT = 200;

async function resolveBillText(
  billId: number,
  existing: string | null,
  title: string | null
): Promise<string | null> {
  if (existing && existing.trim().length >= MIN_REAL_TEXT) return existing;

  let detail;
  try {
    detail = await getBill(billId);
  } catch (err) {
    console.error(`  ! getBill(${billId}) failed:`, (err as Error).message);
    return null;
  }

  const docs = detail.texts ?? [];
  if (docs.length === 0) return null;

  // The texts array is chronological; the last entry is the most recent version
  // (e.g. an "Amended" draft supersedes the original "Introduced" one).
  const doc = docs[docs.length - 1];

  let fullText: string;
  try {
    const fetched = await getBillText(doc.doc_id);
    fullText = await decodeDocText(fetched.doc, fetched.mime);
  } catch (err) {
    console.error(
      `  ! getBillText(${doc.doc_id}) for bill ${billId} failed:`,
      (err as Error).message
    );
    return null;
  }

  if (!fullText || fullText.trim().length < 40) return null;

  const { text: condensed, sampled } = condenseBillText(fullText);
  // Flag sampling honestly to the model (the title is added by userPrompt()).
  const composed =
    (sampled
      ? "[Note: this is a long bill; the text below is sampled across all of its sections.]\n\n"
      : "") +
    condensed;

  try {
    await db.update(bills).set({ billText: composed }).where(eq(bills.billId, billId));
  } catch {
    // Caching is best-effort; proceed with the text in memory regardless.
  }
  return composed;
}

async function main() {
  const startOverride = readStartOverride();
  const checkpoint = startOverride >= 0 ? startOverride - 1 : readCheckpoint();
  if (startOverride >= 0) {
    console.log(`Manual start override: bill_id >= ${startOverride}`);
  } else if (checkpoint >= 0) {
    console.log(`Resuming after checkpoint bill_id ${checkpoint}`);
  }

  // Layer 1: only bills not yet analyzed, in ascending bill_id order.
  const pending = await db
    .select({
      billId: bills.billId,
      title: bills.title,
      billText: bills.billText,
    })
    .from(bills)
    .where(isNull(bills.aiSummary))
    .orderBy(asc(bills.billId));

  const limit = readLimit();
  const queue = pending
    .filter((b) => b.billId > checkpoint)
    .slice(0, limit === Infinity ? undefined : limit);
  console.log(
    `${pending.length} bill(s) without AI analysis; ${queue.length} to process this run` +
      (limit === Infinity ? "" : ` (capped at ${limit})`) +
      ".\n"
  );

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  // Running token + cost estimate. Haiku 4.5 pricing: $1 / 1M input, $5 / 1M output.
  let inTokens = 0;
  let outTokens = 0;
  const estCost = () => (inTokens / 1e6) * 1 + (outTokens / 1e6) * 5;

  for (let i = 0; i < queue.length; i++) {
    const bill = queue[i];

    // Make sure we have usable source text (cached or fetched from LegiScan).
    const text = await resolveBillText(bill.billId, bill.billText, bill.title);
    if (!text) {
      skipped++;
      writeCheckpoint(bill.billId);
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

      inTokens += message.usage?.input_tokens ?? 0;
      outTokens += message.usage?.output_tokens ?? 0;

      const out = message.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("");

      const analysis = parseAnalysis(out);
      if (!analysis) {
        failed++;
        console.error(
          `  ! Bill ${bill.billId}: could not parse JSON response, skipping.`
        );
      } else {
        await db
          .update(bills)
          .set({
            aiSummary: analysis.summary,
            aiProArguments: analysis.pro_arguments,
            aiConArguments: analysis.con_arguments,
            topic: analysis.topic,
          })
          .where(eq(bills.billId, bill.billId));
        analyzed++;
      }
    } catch (err) {
      // Never crash the whole run on a single bill's failure.
      failed++;
      console.error(`  ! Bill ${bill.billId}: API error —`, (err as Error).message);
    }

    writeCheckpoint(bill.billId);

    // Progress every 10 bills.
    if ((i + 1) % 10 === 0) {
      console.log(
        `[${i + 1}/${queue.length}] analyzed=${analyzed} skipped=${skipped} failed=${failed} | ~${(inTokens / 1000).toFixed(0)}k in / ${(outTokens / 1000).toFixed(0)}k out tok / ~$${estCost().toFixed(2)}`
      );
    }

    await sleep(500);
  }

  // A clean pass means the checkpoint can be cleared; the next run starts fresh
  // (and layer 1 still skips anything already done).
  if (failed === 0) {
    try {
      if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
    } catch {
      // Non-fatal.
    }
  }

  console.log("\n=== SUMMARIZE COMPLETE ===");
  console.log(`Total analyzed: ${analyzed}`);
  console.log(`Total skipped:  ${skipped} (no bill document / unreadable text)`);
  console.log(`Total failed:   ${failed}`);
  console.log(
    `Tokens: ${inTokens.toLocaleString()} in / ${outTokens.toLocaleString()} out — est. cost ~$${estCost().toFixed(2)}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

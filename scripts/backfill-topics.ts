import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { and, asc, isNotNull, isNull, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { bills } from "../db/schema";
import { TOPICS, isValidTopic } from "../lib/topics";

// One-time job: classify the topic for every ALREADY-summarized bill that
// doesn't have one yet. Deliberately uses the short ai_summary (not the full
// bill text) as input — it's a few sentences instead of thousands of words, so
// this stays cheap (Haiku 4.5, ~$1/1M input tokens) and runs in a few minutes
// instead of re-fetching/re-parsing every bill's PDF. Bills with no summary
// yet are left alone; the daily cron (lib/summarize.ts) assigns their topic
// automatically the same run it writes their summary.
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { bills } });
const anthropic = new Anthropic();

const MODEL = "claude-haiku-4-5";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CHECKPOINT_FILE = join(tmpdir(), "ncpolisearch-backfill-topics-checkpoint");

function readCheckpoint(): number {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const n = parseInt(readFileSync(CHECKPOINT_FILE, "utf8").trim(), 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // Missing/corrupt checkpoint just means start from the beginning.
  }
  return -1;
}

function writeCheckpoint(billId: number) {
  try {
    writeFileSync(CHECKPOINT_FILE, String(billId));
  } catch {
    // Non-fatal — worst case a resumed run re-classifies one bill.
  }
}

const SYSTEM_PROMPT =
  "You are a nonpartisan civic education assistant for the NC Youth Legislative Council. You classify North Carolina bills into topic categories.";

function userPrompt(title: string, summary: string): string {
  return `Classify this North Carolina bill into exactly one topic category. Respond in exactly this JSON format with no other text:
{
  "topic": "The single best-fit category. Must be EXACTLY one of: ${TOPICS.join(", ")}."
}

Bill title: ${title}
Bill summary: ${summary}`;
}

function parseTopic(text: string): string | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1));
    if (typeof obj.topic === "string" && isValidTopic(obj.topic)) return obj.topic;
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const checkpoint = readCheckpoint();
  if (checkpoint >= 0) console.log(`Resuming after checkpoint bill_id ${checkpoint}`);

  const pending = await db
    .select({ billId: bills.billId, title: bills.title, aiSummary: bills.aiSummary })
    .from(bills)
    .where(and(isNotNull(bills.aiSummary), isNull(bills.topic)))
    .orderBy(asc(bills.billId));

  const queue = pending.filter((b) => b.billId > checkpoint);
  console.log(`${pending.length} summarized bill(s) missing a topic; ${queue.length} to process.\n`);

  let done = 0;
  let failed = 0;
  let inTokens = 0;
  let outTokens = 0;
  const estCost = () => (inTokens / 1e6) * 1 + (outTokens / 1e6) * 5;

  for (let i = 0; i < queue.length; i++) {
    const bill = queue[i];
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt(bill.title ?? "Untitled", bill.aiSummary ?? ""),
          },
        ],
      });

      inTokens += message.usage?.input_tokens ?? 0;
      outTokens += message.usage?.output_tokens ?? 0;

      const out = message.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("");

      const topic = parseTopic(out);
      if (!topic) {
        failed++;
        console.error(`  ! Bill ${bill.billId}: could not parse topic, skipping.`);
      } else {
        await db.update(bills).set({ topic }).where(eq(bills.billId, bill.billId));
        done++;
      }
    } catch (err) {
      failed++;
      console.error(`  ! Bill ${bill.billId}: API error —`, (err as Error).message);
    }

    writeCheckpoint(bill.billId);

    if ((i + 1) % 50 === 0) {
      console.log(
        `[${i + 1}/${queue.length}] classified=${done} failed=${failed} | ~${(inTokens / 1000).toFixed(0)}k in / ${(outTokens / 1000).toFixed(0)}k out tok / ~$${estCost().toFixed(2)}`
      );
    }

    await sleep(150);
  }

  if (failed === 0) {
    try {
      if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
    } catch {
      // Non-fatal.
    }
  }

  console.log("\n=== TOPIC BACKFILL COMPLETE ===");
  console.log(`Classified: ${done}`);
  console.log(`Failed:     ${failed}`);
  console.log(
    `Tokens: ${inTokens.toLocaleString()} in / ${outTokens.toLocaleString()} out — est. cost ~$${estCost().toFixed(2)}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

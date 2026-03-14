/**
 * scripts/generate-events.ts
 *
 * Generates batches of 50 historical events using the Groq API (llama-3.3-70b)
 * and merges them into src/data/events.json.
 *
 * Usage:
 *   GROQ_API_KEY=your_key npx tsx scripts/generate-events.ts
 *
 * Model: llama-3.1-8b-instant
 *   Chosen over llama-3.3-70b-versatile because:
 *   - 500K TPD vs 100K TPD — 5× more headroom for bulk generation
 *   - Structured JSON generation of factual events doesn't need the 70B model
 *   - At ~3,500 tokens/batch × 20 batches = ~70K tokens to generate 950 events,
 *     the 8b model comfortably fits within the daily limit in a single run.
 *
 * Options (env vars):
 *   GROQ_API_KEY   — required
 *   BATCH_SIZE     — events per API call (default: 50)
 *   TARGET_TOTAL   — stop when pool reaches this size (default: 1000)
 *   DRY_RUN        — if "true", print JSON but don't write to file
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoricalEvent {
  id: string;
  text: string;
  year: number;
  category: "politics" | "culture" | "popculture" | "tech";
  difficulty: "easy" | "medium" | "hard";
}

// ─── Config ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EVENTS_PATH = path.join(__dirname, "../src/data/events.json");

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "30", 10);
const TARGET_TOTAL = parseInt(process.env.TARGET_TOTAL ?? "1000", 10);
const DRY_RUN = process.env.DRY_RUN === "true";

// llama-3.1-8b-instant: 500K TPD, 6K TPM, 30 RPM, 14.4K RPD
// Max output tokens: 8,192. At ~100 tokens/event, batch of 30 = ~3K output tokens.
// Prompt overhead ~800 tokens → ~3,800 tokens/batch total.
// To go from 50 → 1,000 (32 batches of 30) = ~122K tokens total. Well within 500K/day.
const MODEL = "llama-3.1-8b-instant";
const MAX_OUTPUT_TOKENS = 8192; // model's hard output ceiling
const TPD_SOFT_WARN = 400000;   // warn at 80% of 500K daily limit

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(event: HistoricalEvent): string {
  return `${event.year}::${normalizeText(event.text)}`;
}

function loadExisting(): HistoricalEvent[] {
  if (!fs.existsSync(EVENTS_PATH)) return [];
  const raw = fs.readFileSync(EVENTS_PATH, "utf-8");
  return JSON.parse(raw) as HistoricalEvent[];
}

function generateId(
  category: HistoricalEvent["category"],
  index: number
): string {
  const prefix = { politics: "pol", culture: "cul", popculture: "pop", tech: "tech" }[category];
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function assignIds(
  events: HistoricalEvent[],
  existing: HistoricalEvent[]
): HistoricalEvent[] {
  // Find max id per category prefix
  const maxByPrefix: Record<string, number> = { pol: 0, cul: 0, pop: 0, tech: 0 };
  for (const e of existing) {
    const [prefix, numStr] = e.id.split("-");
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && prefix in maxByPrefix) {
      maxByPrefix[prefix] = Math.max(maxByPrefix[prefix], num);
    }
  }

  return events.map((e) => {
    const prefix = { politics: "pol", culture: "cul", popculture: "pop", tech: "tech" }[
      e.category
    ];
    maxByPrefix[prefix]++;
    return { ...e, id: generateId(e.category, maxByPrefix[prefix]) };
  });
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(batchSize: number, existingTexts: string[]): string {
  const sampleExisting =
    existingTexts.length > 0
      ? `\nExisting events to avoid duplicating (sample):\n${existingTexts
          .slice(0, 20)
          .map((t) => `- ${t}`)
          .join("\n")}\n`
      : "";

  return `You are a history expert generating trivia events for a history ranking game called ChronoRank.

Generate exactly ${batchSize} historical events as a JSON array. Each event must have this exact shape:
{
  "id": "",
  "text": "string — one clear sentence describing the event",
  "year": number,
  "category": "politics" | "culture" | "popculture" | "tech",
  "difficulty": "easy" | "medium" | "hard"
}

Rules:
1. Years must be between 1900 and 2026 (inclusive). NO events outside this range.
2. EVERY year should appear at most twice in the batch — spread across the decades.
3. Decade distribution (MANDATORY - the LLM often ignores this): 
   - 1900-1919: at least 4 events (early 20th century)
   - 1920-1939: at least 4 events (interwar period)  
   - 1940-1959: at least 4 events (WWII/post-war)
   - 1960-1979: at least 4 events (cold war)
   - 1980-1999: at least 4 events (late 20th century)
   - 2000-2019: at most 6 events (recent history)
   - 2020-2026: at most 4 events (very recent)
   This ensures true chronological spread across 126 years, not just recent decades.
4. Category distribution: ~25% politics, ~25% culture, ~25% popculture, ~25% tech.
5. Difficulty distribution: Equal split ~33% easy, ~33% medium, ~33% hard.
6. Make events niche and obscure - the difficulty system will ensure gameplay variety.
7. Categories:
   - politics: obscure legislation, forgotten scandals, minor coups, regional treaties, failed revolutions, overlooked elections
   - culture: one-hit wonders, viral internet moments, obscure albums, forgotten films, niche art movements, viral memes
   - popculture: celebrity controversies, TikTok trends, viral challenges, internet drama, influencer milestones, meme origins, obscure fandom moments
   - tech: failed products, obscure inventions, regional tech launches, forgotten websites, niche scientific discoveries
8. Include global history from all continents with slight weight toward US history.
9. Each event text must be a single, clear, complete sentence of 10–20 words describing ONLY what happened. Use active voice ("X releases Y", "Z invades W") not passive voice ("Y is released", "W is invaded"). ABSOLUTELY FORBIDDEN: Including the year in the text. This causes immediate rejection.

   ❌ BAD (will be rejected): "Austrian politician Kurt Waldheim is accused of wartime atrocities in 1986."
   ✅ GOOD: "Austrian politician Kurt Waldheim faces accusations of wartime atrocities."
   
   ❌ BAD (will be rejected): "French film 'Rashomon' is released in 1950."
   ✅ GOOD: "French film 'Rashomon' debuts in theaters."
   
   ❌ BAD (will be rejected): "The first Apple iPhone is released in 2007."
   ✅ GOOD: "Apple unveils the first iPhone at Macworld."
   
   ❌ BAD (will be rejected): "British band The Smiths release their debut single 'Hand in Glove' in 1983."
   ✅ GOOD: "British band The Smiths releases debut single 'Hand in Glove'."
   
   The year field stores the date separately. NEVER write "in YYYY", "during the 90s", "last year", or any date in the text.
10. Years must be historically accurate and verifiable.
11. Hard events should require deep knowledge or research to date correctly.
12. Easy events should be recognizable to most adults.
13. Leave "id" as empty string "" — IDs will be assigned programmatically.
14. Do NOT duplicate these events:${sampleExisting}

Return ONLY the JSON array. No markdown. No explanation. No code fences. Just the raw JSON array starting with [ and ending with ].`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function containsYear(text: string): boolean {
  // Check for 4-digit years (1900-2026)
  const yearPattern = /\b(19|20)\d{2}\b/;
  return yearPattern.test(text);
}

function isValidEvent(e: unknown): e is Omit<HistoricalEvent, "id"> {
  if (typeof e !== "object" || e === null) return false;
  const ev = e as Record<string, unknown>;

  if (typeof ev.text !== "string" || ev.text.trim().length < 10) return false;
  if (typeof ev.year !== "number" || ev.year < 1900 || ev.year > 2026) return false;
  if (!["politics", "culture", "popculture", "tech"].includes(ev.category as string)) return false;
  if (!["easy", "medium", "hard"].includes(ev.difficulty as string)) return false;
  
  // Reject events that include years in the text
  if (containsYear(ev.text)) {
    console.warn(`  ⚠  Rejecting event with year in text: "${ev.text}"`);
    return false;
  }

  return true;
}

function parseAndValidate(raw: string): HistoricalEvent[] {
  // Strip any accidental markdown fences
  let cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Truncation guard: if the response was cut off mid-JSON, salvage complete
  // objects by trimming to the last complete entry before the truncation point.
  if (!cleaned.endsWith("]")) {
    console.warn("  ⚠  Response appears truncated — attempting to salvage complete objects...");
    // Find the last complete object: last occurrence of `}` followed only by
    // optional whitespace/commas/newlines before EOF
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      cleaned = cleaned.slice(0, lastBrace + 1) + "\n]";
    } else {
      throw new Error("No complete objects found in truncated response");
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`JSON parse failed: ${err}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Response is not a JSON array");
  }

  const valid = parsed.filter(isValidEvent) as HistoricalEvent[];
  const invalid = parsed.length - valid.length;
  if (invalid > 0) {
    console.warn(`  ⚠  Dropped ${invalid} invalid events from batch`);
  }

  return valid;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Error: GROQ_API_KEY environment variable is not set.");
    console.error("Usage: GROQ_API_KEY=your_key npx tsx scripts/generate-events.ts");
    process.exit(1);
  }

  const groq = new Groq({ apiKey });

  const existing = loadExisting();
  console.log(`\n📚 ChronoRank Event Generator`);
  console.log(`   Model:        ${MODEL}`);
  console.log(`   Current pool: ${existing.length} events`);
  console.log(`   Target:       ${TARGET_TOTAL} events`);
  console.log(`   Batch size:   ${BATCH_SIZE} events`);
  console.log(`   Est. tokens:  ~${Math.ceil(((TARGET_TOTAL - existing.length) / BATCH_SIZE) * 3500).toLocaleString()} (limit: 500K/day)\n`);

  if (existing.length >= TARGET_TOTAL) {
    console.log(`✅ Already at target (${existing.length} >= ${TARGET_TOTAL}). Nothing to do.`);
    return;
  }

  const existingKeys = new Set(existing.map(dedupeKey));
  const existingTexts = existing.map((e) => e.text);
  let pool = [...existing];
  let batchNum = 0;
  let totalTokensUsed = 0;

  while (pool.length < TARGET_TOTAL) {
    batchNum++;
    const batchStart = Date.now();
    const needed = TARGET_TOTAL - pool.length;
    const thisBatch = Math.min(BATCH_SIZE, needed + 10); // request extras to cover dedupe losses

    console.log(
      `🔄 Batch ${batchNum}: requesting ${thisBatch} events (pool: ${pool.length}/${TARGET_TOTAL}, tokens used: ~${totalTokensUsed.toLocaleString()})...`
    );

    // Soft warn if approaching daily limit
    if (totalTokensUsed >= TPD_SOFT_WARN) {
      console.warn(
        `⚠  Approaching daily token limit (${totalTokensUsed.toLocaleString()} / 500,000 used). Consider running again tomorrow.`
      );
    }

    let rawResponse: string;
    let tokensUsedThisBatch = 0;
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: buildPrompt(thisBatch, existingTexts),
          },
        ],
        temperature: 0.8,
        // 30 events × ~100 tokens each = ~3K output. 8192 is the model ceiling —
        // using it fully ensures the response is never truncated mid-JSON.
        max_tokens: MAX_OUTPUT_TOKENS,
      });

      rawResponse = completion.choices[0]?.message?.content ?? "";
      if (!rawResponse) throw new Error("Empty response from Groq");

      // Track actual token usage from the response
      tokensUsedThisBatch = completion.usage?.total_tokens ?? 3500;
      totalTokensUsed += tokensUsedThisBatch;
    } catch (err: unknown) {
      // Handle rate limit errors specifically
      const isRateLimit =
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number }).status === 429;

      if (isRateLimit) {
        console.warn("  ⏳ Rate limited (429). Waiting 62 seconds before retry...");
        await new Promise((r) => setTimeout(r, 62_000));
      } else {
        console.error(`  ❌ API call failed:`, err);
        console.error("  Retrying in 5 seconds...");
        await new Promise((r) => setTimeout(r, 5000));
      }
      continue;
    }

    let batch: HistoricalEvent[];
    try {
      batch = parseAndValidate(rawResponse);
    } catch (err) {
      console.error(`  ❌ Parse failed:`, err);
      console.error("  Raw response (first 500 chars):", rawResponse.slice(0, 500));
      continue;
    }

    // Deduplicate
    const newEvents: HistoricalEvent[] = [];
    for (const event of batch) {
      const key = dedupeKey(event);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        existingTexts.push(event.text);
        newEvents.push(event);
      }
    }

    const dupes = batch.length - newEvents.length;
    console.log(
      `  ✓ ${newEvents.length} new events (${dupes} dupes dropped, ${tokensUsedThisBatch} tokens used)`
    );

    // Assign IDs
    const withIds = assignIds(newEvents, pool);
    pool = [...pool, ...withIds];

    // Write after every batch — safe to Ctrl+C and resume at any time
    if (!DRY_RUN) {
      fs.writeFileSync(EVENTS_PATH, JSON.stringify(pool, null, 2) + "\n", "utf-8");
      console.log(`  💾 Saved (${pool.length} events total)`);
    }

    // Respect TPM: 6K tokens/min. Each batch uses ~3.8K tokens so max 1 batch/min.
    // Wait out the remainder of the 60s window from when this batch started.
    if (pool.length < TARGET_TOTAL) {
      const elapsed = Date.now() - batchStart;
      const waitMs = Math.max(0, 62_000 - elapsed); // 62s to be safe
      if (waitMs > 500) {
        process.stdout.write(`  ⏱  Waiting ${(waitMs / 1000).toFixed(0)}s for TPM window...`);
        await new Promise((r) => setTimeout(r, waitMs));
        process.stdout.write(" done\n");
      }
    }
  }

  console.log(`\n✨ Pool complete: ${pool.length} events`);
  console.log(`   Total tokens used: ~${totalTokensUsed.toLocaleString()} / 500,000 daily limit`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would write:");
    console.log(JSON.stringify(pool.slice(-5), null, 2));
    console.log(`... (${pool.length} total events)`);
    return;
  }

  console.log(`\n💾 Final save: ${EVENTS_PATH}`);
  console.log(`Run 'npm run build' to bundle the updated event pool.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import type { HistoricalEvent, Difficulty } from "../types";

/**
 * mulberry32 — fast, deterministic 32-bit PRNG.
 * Returns a function that yields floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a provided PRNG.
 * Returns a new shuffled array — does not mutate the input.
 */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Core draw logic: 1 easy + 2 medium + 2 hard from a seeded shuffle.
 * Shared by daily and practice draws.
 * Ensures all 5 events have unique years to guarantee solvable puzzles.
 */
function drawFive(events: HistoricalEvent[], seed: number): HistoricalEvent[] {
  const rng = mulberry32(seed);
  const shuffled = seededShuffle(events, rng);

  const drawn: Record<Difficulty, HistoricalEvent[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  const targets: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 2 };
  const drawnYears = new Set<number>();

  for (const event of shuffled) {
    const diff = event.difficulty;
    
    // Skip if year already used (ensures all 5 events have unique years)
    if (drawnYears.has(event.year)) continue;
    
    // Skip if we've already filled this difficulty slot
    if (drawn[diff].length >= targets[diff]) continue;
    
    drawn[diff].push(event);
    drawnYears.add(event.year);
    
    if (
      drawn.easy.length === targets.easy &&
      drawn.medium.length === targets.medium &&
      drawn.hard.length === targets.hard
    ) {
      break;
    }
  }

  const five = [...drawn.easy, ...drawn.medium, ...drawn.hard];

  if (five.length !== 5) {
    throw new Error(
      `drawFive: expected 5 events but got ${five.length}. ` +
      `Check that the event pool has enough easy/medium/hard events with unique years.`
    );
  }

  // Second pass shuffles display order so it's never difficulty-sorted
  const rng2 = mulberry32(seed + 1);
  return seededShuffle(five, rng2);
}

/** The IANA timezone used for daily puzzle boundaries. */
const PUZZLE_TZ = "America/New_York";

/**
 * Get the current date components in the puzzle timezone (US Eastern).
 * Automatically handles EST/EDT transitions.
 */
function puzzleDateParts(date: Date = new Date()): { year: number; month: number; day: number } {
  // Intl.DateTimeFormat gives us the date as it appears in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PUZZLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
  };
}

/**
 * Convert today's date (or a supplied Date) to the integer seed YYYYMMDD.
 * Uses US Eastern time so the puzzle flips at midnight ET.
 */
export function dateSeed(date: Date = new Date()): number {
  const { year, month, day } = puzzleDateParts(date);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return parseInt(`${year}${m}${d}`, 10);
}

/**
 * Get today's date string as YYYY-MM-DD for display / localStorage keys.
 * Uses US Eastern time to stay consistent with dateSeed.
 */
export function dateKey(date: Date = new Date()): string {
  const { year, month, day } = puzzleDateParts(date);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Get yesterday's date key in the puzzle timezone.
 * Uses Date constructor to handle month/year rollovers correctly.
 */
export function yesterdayKey(): string {
  const { year, month, day } = puzzleDateParts();
  // Date constructor handles underflow (day 0 → last day of prev month)
  const yesterday = new Date(year, month - 1, day - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the number of milliseconds until midnight in the puzzle timezone.
 * Used by the countdown timer.
 */
export function msUntilPuzzleMidnight(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PUZZLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Find the offset: format "now" in ET, parse it back, compare to UTC
  const etParts = formatter.formatToParts(now);
  const getP = (type: string) => parseInt(etParts.find((p) => p.type === type)!.value, 10);
  const etHour = getP("hour") === 24 ? 0 : getP("hour");
  const etMin = getP("minute");
  const etSec = getP("second");

  // Seconds remaining until midnight ET
  const secsSinceMidnight = etHour * 3600 + etMin * 60 + etSec;
  const secsUntilMidnight = 86400 - secsSinceMidnight;

  // Guard: if we're right at midnight, return a full day
  return secsUntilMidnight <= 0 ? 86400 * 1000 : secsUntilMidnight * 1000;
}

/**
 * Daily draw — same 5 events for every player on a given day.
 */
export function getDailyEvents(
  events: HistoricalEvent[],
  date: Date = new Date()
): HistoricalEvent[] {
  return drawFive(events, dateSeed(date));
}

/**
 * Practice draw by explicit seed — fully deterministic and shareable.
 * The seed is encoded in the URL (?seed=N) so anyone with the link
 * gets the exact same puzzle.
 */
export function getPracticeEventsBySeed(
  events: HistoricalEvent[],
  seed: number
): HistoricalEvent[] {
  return drawFive(events, seed);
}

/**
 * Generate a random practice seed and return both the seed and events.
 * Tries up to 10 seeds to avoid overlapping with today's daily puzzle.
 */
export function getPracticeEvents(
  events: HistoricalEvent[],
  dailyEvents: HistoricalEvent[]
): { seed: number; events: HistoricalEvent[] } {
  const dailyIds = new Set(dailyEvents.map((e) => e.id));

  for (let attempt = 0; attempt < 10; attempt++) {
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const five = drawFive(events, seed);
    if (!five.some((e) => dailyIds.has(e.id))) {
      return { seed, events: five };
    }
  }

  // Fallback: overlap is unlikely but acceptable if pool is small
  const seed = Math.floor(Math.random() * 2_147_483_647);
  return { seed, events: drawFive(events, seed) };
}

/**
 * The correct chronological order of a set of events.
 * Ties broken by id to keep ordering stable.
 */
export function getCorrectOrder(events: HistoricalEvent[]): HistoricalEvent[] {
  return [...events].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.id.localeCompare(b.id)
  );
}

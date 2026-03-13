import type { HistoricalEvent, ScoreResult } from "../types";

/** Maximum number of attempts per puzzle. */
export const MAX_ATTEMPTS = 4;

/**
 * Score the player's guess against the correct chronological order.
 *
 * A card is "correct" if it is in the same position as in the answer array.
 * Both arrays must have the same length.
 *
 * `previousAttempts` carries forward emoji rows from earlier attempts.
 */
export function scoreGuess(
  guess: HistoricalEvent[],
  answer: HistoricalEvent[],
  previousAttempts: string[] = []
): ScoreResult {
  if (guess.length !== answer.length) {
    throw new Error("guess and answer must have the same length");
  }

  const results = guess.map((event, i) => event.id === answer[i].id);
  const score = results.filter(Boolean).length;

  // Wordle-style emoji grid
  const emoji = results.map((correct) => (correct ? "🟩" : "🟥")).join("");

  const attempts = [...previousAttempts, emoji];

  return { results, score, emoji, attempts, attemptsUsed: attempts.length };
}

/**
 * Build the clipboard share string.
 *
 * Format: `ChronoRank <date> <attempt>/<max>` (Wordle-style).
 * If the player didn't get a perfect score, show X instead of a number.
 */
export function buildShareText(
  score: number,
  total: number,
  attempts: string[],
  attemptsUsed: number,
  maxAttempts: number,
  dateStr: string,
  practiceSeed?: number
): string {
  const solved = score === total;
  const attemptStr = solved ? `${attemptsUsed}/${maxAttempts}` : `X/${maxAttempts}`;
  const header = `ChronoRank\n${dateStr} ${attemptStr}`;
  const grid = attempts.join("\n");
  const url = practiceSeed !== undefined
    ? `https://chronorank.vercel.app?seed=${practiceSeed}`
    : "https://chronorank.vercel.app";
  return `${header}\n${grid}\n${url}`;
}

import type { StreakData } from "../types";
import { dateKey, yesterdayKey } from "./seed";

const STREAK_KEY = "chronorank_streak";

/** Minimum score (out of 5) that counts as a win for streak purposes. */
const WIN_THRESHOLD = 4;

const defaultStreak = (): StreakData => ({
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDate: "",
});

export function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return defaultStreak();
    return JSON.parse(raw) as StreakData;
  } catch {
    return defaultStreak();
  }
}

export function saveStreak(data: StreakData): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore storage errors (e.g. private browsing)
  }
}

/**
 * Record a completed game. Called after submit regardless of score.
 * A "win" is defined as score >= WIN_THRESHOLD (4 out of 5).
 */
export function recordGame(score: number): StreakData {
  const today = dateKey();
  const streak = loadStreak();

  // Already played today — don't double-count
  if (streak.lastPlayedDate === today) return streak;

  const isWin = score >= WIN_THRESHOLD;
  const yesterday = yesterdayKey();
  const playedYesterday = streak.lastPlayedDate === yesterday;

  const newCurrentStreak = isWin
    ? playedYesterday || streak.lastPlayedDate === ""
      ? streak.currentStreak + 1
      : 1
    : 0;

  const updated: StreakData = {
    wins: streak.wins + (isWin ? 1 : 0),
    currentStreak: newCurrentStreak,
    bestStreak: Math.max(streak.bestStreak, newCurrentStreak),
    lastPlayedDate: today,
  };

  saveStreak(updated);
  return updated;
}

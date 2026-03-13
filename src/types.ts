export type Category = "politics" | "culture" | "tech";
export type Difficulty = "easy" | "medium" | "hard";

export interface HistoricalEvent {
  id: string;
  text: string;
  year: number;
  category: Category;
  difficulty: Difficulty;
}

export interface ScoreResult {
  results: boolean[];
  score: number;
  emoji: string;
  /** All emoji rows from each attempt (length = attemptsUsed) */
  attempts: string[];
  /** How many attempts the player used (1-3) */
  attemptsUsed: number;
}

export interface StreakData {
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string; // YYYYMMDD
}

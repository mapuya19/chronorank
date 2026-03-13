import { useState, useEffect } from "react";
import type { ScoreResult, HistoricalEvent, StreakData } from "./types";
import {
  getDailyEvents,
  getPracticeEvents,
  getPracticeEventsBySeed,
  dateKey,
} from "./lib/seed";
import { recordGame, loadStreak } from "./lib/streak";
import { GameBoard } from "./components/GameBoard";
import { ResultPanel } from "./components/ResultPanel";
import eventsData from "./data/events.json";

// ─── Static setup (module-level, runs once) ───────────────────────────────────

const allEvents = eventsData as HistoricalEvent[];
const today = new Date();
const todayKey = dateKey(today);
const dailyEvents = getDailyEvents(allEvents, today);

const PLAYED_KEY = `chronorank_played_${todayKey}`;
const RESULT_KEY = `chronorank_result_${todayKey}`;
const PROGRESS_KEY = `chronorank_progress_${todayKey}`;

interface GameProgress {
  attempt: number;
  previousAttempts: string[];
}

const DEFAULT_PROGRESS: GameProgress = Object.freeze({ attempt: 1, previousAttempts: Object.freeze([] as string[]) }) as GameProgress;

function loadProgress(key: string): GameProgress {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_PROGRESS;
    return JSON.parse(raw) as GameProgress;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function saveProgress(key: string, progress: GameProgress): void {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch { /* ignore */ }
}

function practiceProgressKey(seed: number): string {
  return `chronorank_practice_progress_${seed}`;
}

function practiceResultKey(seed: number): string {
  return `chronorank_practice_result_${seed}`;
}

function loadPracticeResult(seed: number): { result: ScoreResult; answer: HistoricalEvent[] } | null {
  try {
    const raw = localStorage.getItem(practiceResultKey(seed));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const r = parsed.result as ScoreResult;
    if (!r.attempts) {
      r.attempts = [r.emoji];
      r.attemptsUsed = 1;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Read ?seed= from URL to auto-load a shared practice puzzle. */
function getUrlSeed(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("seed");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function loadSavedResult(): { result: ScoreResult; answer: HistoricalEvent[] } | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Backward compat: old saves may lack attempts/attemptsUsed
    const r = parsed.result as ScoreResult;
    if (!r.attempts) {
      r.attempts = [r.emoji];
      r.attemptsUsed = 1;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auto-reload when the daily puzzle rolls over (midnight ET) ───────────
  useEffect(() => {
    const id = setInterval(() => {
      if (dateKey() !== todayKey) {
        window.location.reload();
      }
    }, 30_000); // check every 30 seconds
    return () => clearInterval(id);
  }, []);

  const savedResult = loadSavedResult();
  const alreadyPlayed = !!localStorage.getItem(PLAYED_KEY);
  const urlSeed = getUrlSeed();

  // ── Daily state ─────────────────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(alreadyPlayed);
  const [result, setResult] = useState<ScoreResult | null>(savedResult?.result ?? null);
  const [answer, setAnswer] = useState<HistoricalEvent[]>(savedResult?.answer ?? []);
  const [streak, setStreak] = useState<StreakData | undefined>(() => {
    const data = loadStreak();
    return data.lastPlayedDate === "" ? undefined : data;
  });

  // ── Practice state ──────────────────────────────────────────────────────────
  // If ?seed= is in the URL, start directly in practice mode with that puzzle
  const [practiceMode, setPracticeMode] = useState(urlSeed !== null);
  const [practiceSeed, setPracticeSeed] = useState<number | null>(urlSeed);
  const [practiceEvents, setPracticeEvents] = useState<HistoricalEvent[]>(() =>
    urlSeed !== null ? getPracticeEventsBySeed(allEvents, urlSeed) : []
  );

  // Restore practice result/progress from localStorage if resuming a seed
  const [practiceSubmitted, setPracticeSubmitted] = useState<boolean>(() => {
    if (urlSeed === null) return false;
    return loadPracticeResult(urlSeed) !== null;
  });
  const [practiceResult, setPracticeResult] = useState<ScoreResult | null>(() => {
    if (urlSeed === null) return null;
    return loadPracticeResult(urlSeed)?.result ?? null;
  });
  const [practiceAnswer, setPracticeAnswer] = useState<HistoricalEvent[]>(() => {
    if (urlSeed === null) return [];
    return loadPracticeResult(urlSeed)?.answer ?? [];
  });
  const [practiceProgress, setPracticeProgress] = useState<GameProgress>(() => {
    if (urlSeed === null) return DEFAULT_PROGRESS;
    return loadProgress(practiceProgressKey(urlSeed));
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  // ── Daily progress (persisted for mid-game refresh) ──────────────────────
  const [dailyProgress, setDailyProgress] = useState<GameProgress>(() => loadProgress(PROGRESS_KEY));

  function handleDailyAttemptUsed(attempt: number, previousAttempts: string[]) {
    const progress = { attempt, previousAttempts };
    setDailyProgress(progress);
    saveProgress(PROGRESS_KEY, progress);
  }

  function handleDailySubmit(newResult: ScoreResult, correctAnswer: HistoricalEvent[]) {
    setResult(newResult);
    setAnswer(correctAnswer);
    setSubmitted(true);
    try {
      localStorage.setItem(PLAYED_KEY, "1");
      localStorage.setItem(
        RESULT_KEY,
        JSON.stringify({ result: newResult, answer: correctAnswer })
      );
      // Clean up in-progress state now that the game is done
      localStorage.removeItem(PROGRESS_KEY);
    } catch { /* ignore */ }
    const updated = recordGame(newResult.score);
    setStreak(updated);
  }

  function handlePracticeAttemptUsed(attempt: number, previousAttempts: string[]) {
    if (practiceSeed === null) return;
    const progress = { attempt, previousAttempts };
    setPracticeProgress(progress);
    saveProgress(practiceProgressKey(practiceSeed), progress);
  }

  function handlePracticeSubmit(newResult: ScoreResult, correctAnswer: HistoricalEvent[]) {
    setPracticeResult(newResult);
    setPracticeAnswer(correctAnswer);
    setPracticeSubmitted(true);
    // Persist the completed practice result
    if (practiceSeed !== null) {
      try {
        localStorage.setItem(
          practiceResultKey(practiceSeed),
          JSON.stringify({ result: newResult, answer: correctAnswer })
        );
        // Clean up in-progress state
        localStorage.removeItem(practiceProgressKey(practiceSeed));
      } catch { /* ignore */ }
    }
  }

  function enterPractice() {
    const { seed, events } = getPracticeEvents(allEvents, dailyEvents);
    setPracticeSeed(seed);
    setPracticeEvents(events);
    setPracticeSubmitted(false);
    setPracticeResult(null);
    setPracticeAnswer([]);
    setPracticeProgress(DEFAULT_PROGRESS);
    setPracticeMode(true);
    // Push seed to URL so the current practice puzzle is shareable immediately
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(seed));
    window.history.pushState({}, "", url);
  }

  function exitPractice() {
    setPracticeMode(false);
    // Remove seed from URL when returning to daily
    const url = new URL(window.location.href);
    url.searchParams.delete("seed");
    window.history.pushState({}, "", url);
  }

  function newPracticeRound() {
    // Clean up old seed's progress if any
    if (practiceSeed !== null) {
      try {
        localStorage.removeItem(practiceProgressKey(practiceSeed));
        localStorage.removeItem(practiceResultKey(practiceSeed));
      } catch { /* ignore */ }
    }
    const { seed, events } = getPracticeEvents(allEvents, dailyEvents);
    setPracticeSeed(seed);
    setPracticeEvents(events);
    setPracticeSubmitted(false);
    setPracticeResult(null);
    setPracticeAnswer([]);
    setPracticeProgress(DEFAULT_PROGRESS);
    // Update URL to new seed
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(seed));
    window.history.pushState({}, "", url);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeEvents = practiceMode ? practiceEvents : dailyEvents;
  const activeSubmitted = practiceMode ? practiceSubmitted : submitted;
  const activeResult = practiceMode ? practiceResult : result;
  const activeAnswer = practiceMode ? practiceAnswer : answer;

  return (
    <div
      className="min-h-screen min-h-dvh flex flex-col"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Header */}
      <header className="border-b border-[#1e1e35] py-3 px-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-black text-[#c8a84b] leading-none tracking-tight"
                style={{ fontFamily: "var(--font-family-heading)" }}
              >
                ChronoRank
              </h1>
              <p
                className="text-xs text-[#555570] mt-0.5"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                {practiceMode
                  ? `practice · #${practiceSeed}`
                  : `five events · one order · ${todayKey}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Streak badge — daily only */}
              {!practiceMode && streak && streak.currentStreak > 0 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(200,168,75,0.1)] border border-[rgba(200,168,75,0.25)]"
                  title={`Current streak: ${streak.currentStreak} days`}
                >
                  <span className="text-base">🔥</span>
                  <span
                    className="text-sm font-bold text-[#c8a84b] tabular-nums"
                    style={{ fontFamily: "var(--font-family-mono)" }}
                  >
                    {streak.currentStreak}
                  </span>
                </div>
              )}

              {practiceMode ? (
                <button
                  onClick={exitPractice}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#2a2a45] text-[#8888aa] hover:border-[#555570] hover:text-[#e8e8f0] transition-all duration-150"
                  style={{ fontFamily: "var(--font-family-mono)" }}
                >
                  ← daily puzzle
                </button>
              ) : (
                <button
                  onClick={enterPractice}
                  className="text-xs px-3 py-1.5 rounded-full border border-[rgba(200,168,75,0.3)] text-[#c8a84b] hover:bg-[rgba(200,168,75,0.08)] hover:border-[rgba(200,168,75,0.6)] transition-all duration-150"
                  style={{ fontFamily: "var(--font-family-mono)" }}
                >
                  practice
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 flex flex-col">
        <div className="max-w-xl mx-auto w-full">

          {/* Practice mode banner */}
          {practiceMode && (
            <div className="mb-5 rounded-xl border border-[rgba(200,168,75,0.2)] bg-[rgba(200,168,75,0.06)] px-4 py-3 flex items-center justify-between gap-3">
              <p
                className="text-xs text-[#c8a84b]"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                practice mode · results don't count toward your streak
              </p>
              {/* Inline share link — always visible in practice mode */}
              {practiceSeed !== null && (
                <CopyLinkButton seed={practiceSeed} />
              )}
            </div>
          )}

          {/* Pre-game info strip — daily mode only */}
          {!practiceMode && !activeSubmitted && (
            <div className="mb-4 flex items-center justify-between">
              <p
                className="text-sm italic text-[#9a7d35]"
                style={{ fontFamily: "var(--font-family-heading)" }}
              >
                Five events. One order.
              </p>
              <div
                className="flex items-center gap-3 text-xs text-[#555570]"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                <span>{streak?.wins ?? 0} <span className="text-[#3a3a55]">wins</span></span>
                <span>{streak?.bestStreak ?? 0} <span className="text-[#3a3a55]">best</span></span>
              </div>
            </div>
          )}

          {/* Already played today banner */}
          {!practiceMode && submitted && !result && (
            <div className="mb-4 text-center rounded-xl border border-[#2a2a45] bg-[#12121e] px-4 py-3">
              <p
                className="text-sm text-[#8888aa]"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                you already played today — here are your results
              </p>
            </div>
          )}

          {/* Game board */}
          <GameBoard
            key={practiceMode ? practiceEvents.map((e) => e.id).join("-") : "daily"}
            events={activeEvents}
            onSubmit={practiceMode ? handlePracticeSubmit : handleDailySubmit}
            submitted={activeSubmitted}
            initialAttempt={practiceMode ? practiceProgress.attempt : dailyProgress.attempt}
            initialPreviousAttempts={practiceMode ? practiceProgress.previousAttempts : dailyProgress.previousAttempts}
            onAttemptUsed={practiceMode ? handlePracticeAttemptUsed : handleDailyAttemptUsed}
          />

          {/* Result panel */}
          {activeSubmitted && activeResult && (
            <ResultPanel
              result={activeResult}
              dateStr={practiceMode ? `practice #${practiceSeed}` : todayKey}
              streak={practiceMode ? undefined : streak}
              answer={activeAnswer}
              practiceMode={practiceMode}
              practiceSeed={practiceMode ? (practiceSeed ?? undefined) : undefined}
              onNewRound={practiceMode ? newPracticeRound : undefined}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e35] py-3 px-4">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-2">
          <span
            className="text-xs text-[#555570]"
            style={{ fontFamily: "var(--font-family-mono)" }}
          >
            &copy; {new Date().getFullYear()} ChronoRank
          </span>
          <span className="text-[#2a2a45]">&middot;</span>
          <a
            href="https://github.com/mapuya19/chronorank"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#555570] hover:text-[#8888aa] transition-colors duration-150"
            style={{ fontFamily: "var(--font-family-mono)" }}
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── CopyLinkButton ───────────────────────────────────────────────────────────

function CopyLinkButton({ seed }: { seed: number }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(seed));
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = url.toString();
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      ta.style.top = `${window.scrollY}px`;
      ta.setAttribute("readonly", "");
      document.body.appendChild(ta);
      ta.focus();
      ta.setSelectionRange(0, ta.value.length);
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className={[
        "flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all duration-150",
        copied
          ? "border-[rgba(45,106,79,0.6)] text-[#74c69d]"
          : "border-[rgba(200,168,75,0.3)] text-[#c8a84b] hover:bg-[rgba(200,168,75,0.08)]",
      ].join(" ")}
      style={{ fontFamily: "var(--font-family-mono)" }}
    >
      {copied ? "✓ copied" : "copy link"}
    </button>
  );
}

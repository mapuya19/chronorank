import { useState } from "react";
import type { ScoreResult, HistoricalEvent, StreakData } from "../types";
import { buildShareText, MAX_ATTEMPTS } from "../lib/score";

interface ResultPanelProps {
  result: ScoreResult;
  dateStr: string;
  streak?: StreakData;
  answer: HistoricalEvent[];
  practiceMode?: boolean;
  practiceSeed?: number;
  onNewRound?: () => void;
}

const SCORE_MESSAGES: Record<number, string> = {
  0: "A lesson in humility",
  1: "History is hard",
  2: "Getting warmer",
  3: "Solid effort",
  4: "Almost perfect",
  5: "Flawless — you are time itself",
};

export function ResultPanel({
  result,
  dateStr,
  streak,
  answer,
  practiceMode = false,
  practiceSeed,
  onNewRound,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const { score, attempts, attemptsUsed } = result;
  const total = answer.length;
  const barPct = (score / total) * 100;
  const message = SCORE_MESSAGES[score] ?? "Well played";

  const shareText = buildShareText(score, total, attempts, attemptsUsed, MAX_ATTEMPTS, dateStr, practiceSeed);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for iOS Safari which requires the element to be
      // visible and within the viewport for execCommand to work.
      const ta = document.createElement("textarea");
      ta.value = shareText;
      // Position off-screen but not display:none or opacity:0
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      ta.style.top = `${window.scrollY}px`;
      ta.style.fontSize = "16px"; // prevent iOS zoom on focus
      ta.setAttribute("readonly", ""); // prevent iOS keyboard popup
      document.body.appendChild(ta);
      // iOS requires a specific selection range
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ta.setSelectionRange(0, ta.value.length);
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="result-entrance mt-6 rounded-2xl border border-[#2a2a45] bg-[#12121e] p-5">
      {/* Header */}
      <div className="text-center mb-4">
        <p
          className="text-xs uppercase tracking-widest text-[#555570] mb-1"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          {practiceMode ? "practice round" : dateStr}
        </p>
        <div
          className="text-4xl font-black text-[#c8a84b] leading-none mb-1.5 tabular-nums"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          {score}
          <span className="text-xl text-[#555570] font-normal">/{total}</span>
        </div>
        <p
          className="text-xs text-[#555570] mb-1"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          {score === total
            ? attemptsUsed === 1
              ? "solved in 1 attempt"
              : `solved in ${attemptsUsed} attempts`
            : `${attemptsUsed} ${attemptsUsed === 1 ? "attempt" : "attempts"} used`}
        </p>
        <p
          className="text-sm text-[#8888aa] italic"
          style={{ fontFamily: "var(--font-family-heading)" }}
        >
          {message}
        </p>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="h-3 rounded-full bg-[#1a1a2e] border border-[#2a2a45] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9a7d35] to-[#c8a84b] score-bar-fill"
            style={{ "--bar-target-width": `${barPct}%` } as React.CSSProperties}
          />
        </div>
        <div
          className="flex justify-between mt-1 text-xs text-[#555570]"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          <span>0</span>
          <span>{total}</span>
        </div>
      </div>

      {/* Emoji grid — all attempts */}
      <div className="text-center mb-4">
        {attempts.map((row, i) => (
          <p
            key={i}
            className="text-xl tracking-widest leading-relaxed"
            aria-label={`Attempt ${i + 1}: ${row}`}
          >
            {row}
          </p>
        ))}
      </div>

      {/* Correct order reveal */}
      <div className="mb-4">
        <p
          className="text-xs uppercase tracking-widest text-[#555570] mb-2"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          Correct Order
        </p>
        <ol className="flex flex-col gap-2">
          {answer.map((event, i) => (
            <li key={event.id} className="flex items-baseline gap-3 text-sm">
              <span
                className="flex-shrink-0 w-5 text-right text-[#555570] tabular-nums"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                {i + 1}.
              </span>
              <span
                className="flex-shrink-0 text-[#c8a84b] tabular-nums font-bold text-xs"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                {event.year}
              </span>
              <span className="text-[#8888aa] leading-snug">{event.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Streak stats — daily mode only */}
      {!practiceMode && streak && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          {[
            { label: "wins", value: streak.wins },
            { label: "streak", value: streak.currentStreak },
            { label: "best", value: streak.bestStreak },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-[#1a1a2e] border border-[#2a2a45] py-2 px-2"
            >
              <div
                className="text-xl font-bold text-[#c8a84b] tabular-nums leading-none mb-1"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                {value}
              </div>
              <div
                className="text-xs text-[#555570] uppercase tracking-wider"
                style={{ fontFamily: "var(--font-family-mono)" }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {/* Copy result — both modes */}
        <button
          onClick={handleCopy}
          className={[
            "w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200",
            copied
              ? "bg-[rgba(45,106,79,0.3)] border border-[rgba(45,106,79,0.6)] text-[#74c69d]"
              : "bg-[#1a1a2e] border border-[#2a2a45] text-[#c8a84b] hover:border-[#c8a84b] hover:bg-[rgba(200,168,75,0.08)]",
          ].join(" ")}
          style={{ fontFamily: "var(--font-family-mono)", letterSpacing: "0.05em" }}
        >
          {copied ? "✓ COPIED TO CLIPBOARD" : "COPY RESULT"}
        </button>

        {/* Play again — practice mode only */}
        {practiceMode && onNewRound && (
          <button
            onClick={onNewRound}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 bg-[#c8a84b] text-[#0a0a0f] hover:bg-[#d4b85e] hover:shadow-[0_0_20px_rgba(200,168,75,0.35)] active:scale-[0.98]"
            style={{ fontFamily: "var(--font-family-mono)", letterSpacing: "0.05em" }}
          >
            PLAY AGAIN
          </button>
        )}
      </div>

      {/* Footer note */}
      <p
        className="text-center text-xs text-[#555570] mt-3"
        style={{ fontFamily: "var(--font-family-mono)" }}
      >
        {practiceMode
          ? "practice results don't count toward your streak"
          : "new puzzle at midnight · come back tomorrow"}
      </p>
    </div>
  );
}

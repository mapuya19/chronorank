/**
 * Timer — stretch goal stub.
 *
 * Displays a countdown timer for timed mode.
 * When wired up, it should:
 *  1. Count down from `initialSeconds` (e.g. 120)
 *  2. Auto-submit when it reaches 0
 *  3. Turn gold → red as time runs low
 *
 * TODO: Wire `onTimeUp` callback to GameBoard's handleSubmit
 */
import { useEffect, useState } from "react";

interface TimerProps {
  initialSeconds: number;
  running: boolean;
  onTimeUp: () => void;
}

export function Timer({ initialSeconds, running, onTimeUp }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      onTimeUp();
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [running, secondsLeft, onTimeUp]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const urgent = secondsLeft <= 15;

  return (
    <div
      className={[
        "text-center text-2xl font-bold tabular-nums transition-colors duration-300",
        urgent ? "text-[#e07070]" : "text-[#c8a84b]",
      ].join(" ")}
      style={{ fontFamily: "var(--font-family-mono)" }}
      aria-live="polite"
      aria-label={`${mm} minutes ${ss} seconds remaining`}
    >
      {mm}:{ss}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HistoricalEvent, ScoreResult } from "../types";
import { EventCard } from "./EventCard";
import { getCorrectOrder, msUntilPuzzleMidnight } from "../lib/seed";
import { scoreGuess, MAX_ATTEMPTS } from "../lib/score";

// ─── Countdown to next puzzle ─────────────────────────────────────────────────

function NextPuzzleCountdown() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilMidnight());

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) return null;

  return (
    <p
      className="mt-2 text-center text-xs text-[#3a3a55]"
      style={{ fontFamily: "var(--font-family-mono)" }}
    >
      next puzzle in {timeLeft}
    </p>
  );
}

function getTimeUntilMidnight(): string {
  const diff = msUntilPuzzleMidnight();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────

function SortableCard({
  event,
  index,
  revealed,
  correct,
  disabled,
  isDragOverlay,
}: {
  event: HistoricalEvent;
  index: number;
  revealed: boolean;
  correct?: boolean;
  disabled: boolean;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging && !isDragOverlay ? "opacity-0" : undefined}
    >
      <EventCard
        event={event}
        index={index}
        revealed={revealed}
        correct={correct}
        disabled={disabled}
        zone="ranked"
        isDragSource={isDragging && !isDragOverlay}
        attributes={disabled ? undefined : attributes}
        listeners={disabled ? undefined : listeners}
      />
    </div>
  );
}

// ─── GameBoard ────────────────────────────────────────────────────────────────

interface GameBoardProps {
  events: HistoricalEvent[];
  onSubmit: (result: ScoreResult, answer: HistoricalEvent[]) => void;
  submitted: boolean;
  /** Starting attempt number (1-based). Used to restore state after refresh. */
  initialAttempt?: number;
  /** Emoji rows from previous attempts. Used to restore state after refresh. */
  initialPreviousAttempts?: string[];
  /** Called after an intermediate (non-final) attempt so the parent can persist progress. */
  onAttemptUsed?: (attempt: number, previousAttempts: string[]) => void;
}

export function GameBoard({
  events,
  onSubmit,
  submitted,
  initialAttempt = 1,
  initialPreviousAttempts = [],
  onAttemptUsed,
}: GameBoardProps) {
  const [order, setOrder] = useState<HistoricalEvent[]>(events);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Lock submit until the player has moved at least one card
  const [hasMoved, setHasMoved] = useState(false);

  // ── Attempt tracking ──────────────────────────────────────────────────────
  const [attempt, setAttempt] = useState(initialAttempt);
  const [previousAttempts, setPreviousAttempts] = useState<string[]>(initialPreviousAttempts);
  // Intermediate reveal: show results between attempts
  const [reviewing, setReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<boolean[] | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeEvent = activeId ? order.find((e) => e.id === activeId) : undefined;
  const canSubmit = hasMoved;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    document.body.classList.add("dragging");
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    document.body.classList.remove("dragging");

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrder((items) => {
      const oldIndex = items.findIndex((e) => e.id === active.id);
      const newIndex = items.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });

    setHasMoved(true);
  }

  function handleDragCancel() {
    setActiveId(null);
    document.body.classList.remove("dragging");
  }

  function handleSubmit() {
    const answer = getCorrectOrder(order);
    const result = scoreGuess(order, answer, previousAttempts);

    // Perfect score or last attempt → final submit
    if (result.score === answer.length || attempt >= MAX_ATTEMPTS) {
      onSubmit(result, answer);
      return;
    }

    // Not perfect & attempts remaining → show review state
    setReviewResults(result.results);
    setPreviousAttempts(result.attempts);
    setReviewing(true);
    // Notify parent so it can persist progress
    onAttemptUsed?.(attempt + 1, result.attempts);
  }

  function handleTryAgain() {
    setReviewing(false);
    setReviewResults(undefined);
    setHasMoved(false);
    setAttempt((a) => a + 1);
  }

  // ── Final submitted state (from parent) ─────────────────────────────────
  // Don't render anything — ResultPanel shows the correct order with years.
  // Rendering here would show cards in the shuffled deal order (not the
  // player's submitted order), producing incorrect green/red coloring.
  if (submitted) {
    return null;
  }

  // ── Review state between attempts ────────────────────────────────────────
  if (reviewing) {
    return (
      <div className="flex flex-col gap-3">
        {/* Attempt feedback */}
        <div className="flex items-center justify-between">
          <p
            className="text-xs text-[#8888aa]"
            style={{ fontFamily: "var(--font-family-mono)" }}
          >
            attempt {attempt}/{MAX_ATTEMPTS}
          </p>
          <p
            className="text-xs text-[#555570]"
            style={{ fontFamily: "var(--font-family-mono)" }}
          >
            {reviewResults?.filter(Boolean).length ?? 0}/{order.length} correct
          </p>
        </div>

        {/* Cards with results — no year reveal between attempts */}
        <div className="flex flex-col gap-2">
          {order.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              index={i}
              revealed
              correct={reviewResults?.[i]}
              disabled
              showYear={false}
              zone="ranked"
            />
          ))}
        </div>

        {/* Previous attempts emoji rows */}
        {previousAttempts.length > 0 && (
          <div className="text-center">
            {previousAttempts.map((row, i) => (
              <p
                key={i}
                className="text-lg tracking-widest leading-relaxed"
                aria-label={`Attempt ${i + 1}`}
              >
                {row}
              </p>
            ))}
          </div>
        )}

        {/* Try again button */}
        <button
          onClick={handleTryAgain}
          className="mt-1 w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 bg-[#c8a84b] text-[#0a0a0f] hover:bg-[#d4b85e] hover:shadow-[0_0_20px_rgba(200,168,75,0.35)] active:scale-[0.98]"
          style={{ fontFamily: "var(--font-family-mono)", letterSpacing: "0.05em" }}
        >
          TRY AGAIN ({MAX_ATTEMPTS - attempt} {MAX_ATTEMPTS - attempt === 1 ? "ATTEMPT" : "ATTEMPTS"} LEFT)
        </button>
      </div>
    );
  }

  // ── Active play state ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Instruction + attempt counter */}
      <div className="flex items-center justify-between">
        <p
          className="text-xs text-[#8888aa]"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          drag to rank from earliest ↑ to latest ↓
        </p>
        <p
          className="text-xs text-[#555570]"
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          {attempt}/{MAX_ATTEMPTS}
        </p>
      </div>

      {/* Previous attempts emoji rows */}
      {previousAttempts.length > 0 && (
        <div className="text-center">
          {previousAttempts.map((row, i) => (
            <p
              key={i}
              className="text-lg tracking-widest leading-relaxed opacity-50"
              aria-label={`Attempt ${i + 1}`}
            >
              {row}
            </p>
          ))}
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={order.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {order.map((event, i) => (
              <SortableCard
                key={event.id}
                event={event}
                index={i}
                revealed={false}
                disabled={false}
              />
            ))}
          </div>
        </SortableContext>

        {/* Overlay: ghost card that follows the cursor/finger */}
        <DragOverlay>
          {activeEvent ? (
            <SortableCard
              event={activeEvent}
              index={order.findIndex((e) => e.id === activeEvent.id)}
              revealed={false}
              disabled
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={[
          "mt-1 w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200",
          canSubmit
            ? "bg-[#c8a84b] text-[#0a0a0f] hover:bg-[#d4b85e] hover:shadow-[0_0_20px_rgba(200,168,75,0.35)] active:scale-[0.98]"
            : "bg-[#1a1a2e] text-[#555570] border border-[#2a2a45] cursor-not-allowed",
        ].join(" ")}
        style={{ fontFamily: "var(--font-family-mono)", letterSpacing: "0.05em" }}
      >
        {canSubmit ? "SUBMIT RANKING" : "REORDER THE CARDS TO SUBMIT"}
      </button>

      <NextPuzzleCountdown />
    </div>
  );
}

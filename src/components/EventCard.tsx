import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { HistoricalEvent, Category } from "../types";

interface EventCardProps {
  event: HistoricalEvent;
  index: number;
  revealed: boolean;
  correct?: boolean;
  disabled?: boolean;
  showYear?: boolean; // default true — set false for mid-attempt review
  zone?: "pool" | "ranked";
  // Passed from SortableCard wrapper — undefined when card is disabled/revealed
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
  isDragSource?: boolean; // true when this instance is the ghost (hidden underneath overlay)
}

const CATEGORY_STYLES: Record<Category, { pill: string; label: string }> = {
  politics: {
    pill: "bg-[rgba(74,111,165,0.18)] border border-[rgba(74,111,165,0.4)] text-[#7ca3d4]",
    label: "Politics",
  },
  culture: {
    pill: "bg-[rgba(123,94,167,0.18)] border border-[rgba(123,94,167,0.4)] text-[#b08ee0]",
    label: "Culture",
  },
  tech: {
    pill: "bg-[rgba(74,140,111,0.18)] border border-[rgba(74,140,111,0.4)] text-[#7cc4a0]",
    label: "Tech & Science",
  },
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "text-[#6b8c6b]",
  medium: "text-[#8c7a4a]",
  hard: "text-[#8c4a4a]",
};

export function EventCard({
  event,
  index,
  revealed,
  correct,
  disabled,
  showYear = true,
  zone = "ranked",
  attributes,
  listeners,
  isDragSource = false,
}: EventCardProps) {
  const catStyle = CATEGORY_STYLES[event.category];
  const isDragging = isDragSource;

  const revealedBg =
    correct === true
      ? "bg-[rgba(45,106,79,0.25)] border-[rgba(45,106,79,0.6)]"
      : correct === false
      ? "bg-[rgba(107,45,45,0.25)] border-[rgba(107,45,45,0.6)]"
      : "";

  const revealedText =
    correct === true
      ? "text-[#74c69d]"
      : correct === false
      ? "text-[#e07070]"
      : "";

  const isDraggable = !disabled && !revealed;

  return (
    <div
      // Spread dnd attributes onto the card so keyboard nav + aria work
      {...(attributes ?? {})}
      data-draggable={isDraggable || undefined}
      className={[
        "relative flex items-start gap-3 rounded-xl border px-4 py-2.5",
        "select-none",
        "transition-all duration-200",
        revealed
          ? revealedBg
          : "bg-[#1a1a2e] border-[#2a2a45]",
        isDragging
          ? "shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_0_2px_rgba(200,168,75,0.4)] scale-[1.03] rotate-[0.4deg]"
          : !revealed && !disabled
          ? "shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-[#1f1f3a] hover:border-[#3a3a5a]"
          : "",
        revealed && !isDragging ? "card-reveal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Position number */}
      <div
        className={[
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
          revealed
            ? correct
              ? "bg-[rgba(45,106,79,0.4)] text-[#74c69d]"
              : "bg-[rgba(107,45,45,0.4)] text-[#e07070]"
            : "bg-[#252540] text-[#8888aa]",
        ].join(" ")}
        style={{ fontFamily: "var(--font-family-mono)" }}
      >
        {index + 1}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-sm leading-snug mb-1.5",
            revealed ? revealedText : "text-[#e8e8f0]",
          ].join(" ")}
          style={{ fontFamily: "var(--font-family-body)" }}
        >
          {event.text}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${catStyle.pill}`}
            style={{ fontFamily: "var(--font-family-mono)", fontSize: "0.7rem" }}
          >
            {catStyle.label}
          </span>
          <span
            className={`text-xs ${DIFFICULTY_STYLES[event.difficulty]}`}
            style={{ fontFamily: "var(--font-family-mono)", fontSize: "0.7rem" }}
          >
            {event.difficulty}
          </span>
        </div>
      </div>

      {/* Year reveal */}
      {revealed && showYear && (
        <div className="flex-shrink-0 text-right mt-0.5">
          <span
            className={[
              "text-lg font-bold tabular-nums",
              correct ? "text-[#74c69d]" : "text-[#e07070]",
            ].join(" ")}
            style={{ fontFamily: "var(--font-family-mono)" }}
          >
            {event.year}
          </span>
        </div>
      )}

      {/* Drag handle — only shown when draggable, acts as the grab target */}
      {isDraggable && zone === "ranked" && (
        <div
          {...(listeners ?? {})}
          data-draggable
          className="flex-shrink-0 flex flex-col gap-[5px] justify-center self-stretch px-1 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <div className="w-4 h-0.5 bg-[#555570] rounded" />
          <div className="w-4 h-0.5 bg-[#555570] rounded" />
          <div className="w-4 h-0.5 bg-[#555570] rounded" />
        </div>
      )}
    </div>
  );
}

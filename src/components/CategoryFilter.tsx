/**
 * CategoryFilter — stretch goal stub.
 *
 * Renders category filter pills. When wired up, clicking a pill
 * filters the event pool to only draw from that category.
 *
 * TODO: Connect `selected` state to getDailyEvents() in App.tsx
 */
import type { Category } from "../types";

interface CategoryFilterProps {
  selected: Category | "all";
  onChange: (category: Category | "all") => void;
}

const CATEGORIES: { value: Category | "all"; label: string; className: string }[] = [
  { value: "all", label: "All", className: "border-[#2a2a45] text-[#8888aa] hover:border-[#555570]" },
  { value: "politics", label: "Politics", className: "border-[rgba(74,111,165,0.4)] text-[#7ca3d4] hover:bg-[rgba(74,111,165,0.18)]" },
  { value: "culture", label: "Culture", className: "border-[rgba(123,94,167,0.4)] text-[#b08ee0] hover:bg-[rgba(123,94,167,0.18)]" },
  { value: "popculture", label: "Pop Culture", className: "border-[rgba(217,70,239,0.4)] text-[#e879f9] hover:bg-[rgba(217,70,239,0.18)]" },
  { value: "tech", label: "Tech", className: "border-[rgba(74,140,111,0.4)] text-[#7cc4a0] hover:bg-[rgba(74,140,111,0.18)]" },
];

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {CATEGORIES.map(({ value, label, className }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={[
            "px-3 py-1 rounded-full text-xs border transition-all duration-150",
            className,
            selected === value ? "opacity-100 font-semibold" : "opacity-50",
          ].join(" ")}
          style={{ fontFamily: "var(--font-family-mono)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

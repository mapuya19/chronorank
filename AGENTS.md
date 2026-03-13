# AGENTS.md

Instructions and context for AI coding agents working on ChronoRank.

## Project overview

ChronoRank is a daily history trivia game. Players drag 5 historical events into chronological order. The puzzle is deterministic -- seeded by the current date so every player gets the same 5 events each day. The app is a fully static Vite + React + TypeScript SPA with zero runtime API calls.

## Architecture

### Build tooling

- **Vite 7** with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Tailwind CSS v4** -- uses the new `@theme` directive in `src/index.css` instead of a `tailwind.config.js` file. All custom colors, fonts, and design tokens are defined there.
- **TypeScript** with strict mode. Three tsconfig files: `tsconfig.json` (project references), `tsconfig.app.json` (app source), `tsconfig.node.json` (scripts/config).

### Core modules

| File | Purpose |
|------|---------|
| `src/lib/seed.ts` | **Critical.** mulberry32 PRNG, `getDailyEvents(events)`, `getPracticeEventsBySeed(events, seed)`. Deterministic puzzle generation -- changing this breaks puzzle parity across players. |
| `src/lib/score.ts` | `scoreGuess()` compares player ordering to correct chronological order. Generates emoji grid and share text. |
| `src/lib/streak.ts` | `useStreak()` React hook. Reads/writes `StreakData` to localStorage. Tracks wins, current streak, best streak, last played date (`YYYYMMDD` string). |
| `src/data/events.json` | Array of `HistoricalEvent` objects. Imported at build time. Currently 50+ events, expandable to 1,000 via the generation script. |

### Components

| Component | Role |
|-----------|------|
| `App.tsx` | Top-level state: daily vs practice mode, date computation, `?seed=` URL param parsing. Renders `GameBoard` or `ResultPanel`. |
| `GameBoard.tsx` | dnd-kit `DndContext` + `SortableContext`. Uses `arrayMove` on drag end. Manages a single vertical list (do NOT split into two lists -- this caused a critical 5th-card duplication bug). Submit button locked until at least one drag move. |
| `EventCard.tsx` | Individual draggable card. Shows category pill, difficulty badge, position number. On reveal: CSS flip animation, year display, green/red coloring. Drag listeners attached to handle div only, not the whole card. |
| `ResultPanel.tsx` | Post-submit view. Animated score bar, emoji grid, ranked event list with years, streak stats, "Copy Result" clipboard button. |
| `CategoryFilter.tsx` | Stub for stretch goal (category filter mode). |
| `Timer.tsx` | Stub for stretch goal (timed mode). |

### Types (`src/types.ts`)

```typescript
type Category = "politics" | "culture" | "tech";
type Difficulty = "easy" | "medium" | "hard";

interface HistoricalEvent {
  id: string;       // unique slug, e.g. "moon-landing-1969"
  text: string;     // event description shown on card
  year: number;     // correct year
  category: Category;
  difficulty: Difficulty;
}

interface ScoreResult {
  results: boolean[];  // per-position correctness
  score: number;       // count of correct positions (0-5)
  emoji: string;       // emoji grid string
}

interface StreakData {
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string; // YYYYMMDD
}
```

### Event data format

Events in `src/data/events.json` follow this structure:

```json
{
  "id": "berlin-wall-fall-1989",
  "text": "The Berlin Wall falls",
  "year": 1989,
  "category": "politics",
  "difficulty": "easy"
}
```

When adding events manually, ensure:
- `id` is unique, lowercase, hyphenated, includes the year
- `year` is a 4-digit integer
- `category` is one of: `politics`, `culture`, `tech`
- `difficulty` is one of: `easy`, `medium`, `hard`
- `text` is concise (under 80 chars), historically accurate, uses present tense

## Known constraints and pitfalls

### Do NOT change

- **Single-list drag architecture in GameBoard.tsx.** A previous two-list design (unranked + ranked) caused a stale-closure bug where dragging the 5th card duplicated entries. The fix was reverting to a single `SortableContext` with `arrayMove`. Do not reintroduce a two-list pattern.
- **Daily seed formula in `seed.ts`.** The PRNG seed is derived from `YYYYMMDD` as an integer (e.g., `20260313`). Changing this formula means different players see different puzzles for the same day.
- **Drag listeners on handle only.** In `EventCard.tsx`, `{...listeners}` is spread on the drag handle div, not the outer card. This prevents accidental drags on mobile when scrolling.

### Mobile-specific fixes (do not revert)

- `body.dragging { position: fixed; overflow: hidden }` applied only on touch devices via `@media (hover: none) and (pointer: coarse)` in `index.css`. Prevents iOS scroll-to-top during drag.
- `-webkit-touch-callout: none` on `[data-draggable]` elements. Prevents iOS long-press context menu.
- `dvh` viewport unit with `100vh` fallback. Older Android WebViews don't support `dvh`.
- Clipboard fallback in `ResultPanel.tsx` uses a visible textarea with `font-size: 16px` to prevent iOS zoom on focus.

### dnd-kit configuration

- No `modifiers` on `DndContext` or `DragOverlay`. The `restrictToWindowEdges` modifier was previously used but caused the drag overlay to fight cursor position on desktop. It was removed.
- Sensors: `PointerSensor` (distance: 5), `TouchSensor` (delay: 150ms, tolerance: 8), `KeyboardSensor`.

## Styling

Tailwind v4 with custom theme tokens in `src/index.css`. Key values:

- Background: `bg` (`#0a0a0f`), `surface` (`#12121e`), `card` (`#1a1a2e`)
- Accent: `gold` (`#c8a84b`), `gold-dim` (`#9a7d35`)
- Category: `politics` (blue), `culture` (purple), `tech` (green)
- Fonts: `font-heading` (Playfair Display), `font-mono` (JetBrains Mono), `font-body` (Inter)

Use the custom color names in Tailwind classes (e.g., `bg-card`, `text-gold`, `border-border`).

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | TypeScript check + Vite production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build locally |
| `npm run generate` | Expand event pool via Groq API (requires `GROQ_API_KEY` in `.env`) |

## Event generation script

`scripts/generate-events.ts` uses the Groq API with `llama-3.1-8b-instant` to batch-generate events. Key details:

- Batches of ~30-50 events per API call
- Deduplicates by `year + normalized text` against existing pool
- Writes incrementally to `events.json` (safe to interrupt)
- Respects 6K TPM rate limit with smart per-batch backoff
- Warns at 80% of daily token limit (400K of 500K)
- Env vars: `GROQ_API_KEY` (required), `BATCH_SIZE`, `TARGET_TOTAL`, `DRY_RUN`

## Deployment

Static site on Vercel. `vercel.json` configures:
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: all routes to `index.html`

No server, no SSR, no edge functions. The entire app is a static bundle.

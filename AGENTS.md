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
| `src/lib/seed.ts` | **Critical.** mulberry32 PRNG, daily/practice event selection, timezone-aware date handling (US Eastern). Exports: `dateSeed()`, `dateKey()`, `yesterdayKey()`, `msUntilPuzzleMidnight()`, `getDailyEvents()`, `getPracticeEventsBySeed()`, `getPracticeEvents()`, `getCorrectOrder()`. |
| `src/lib/score.ts` | Positional scoring, emoji grid generation, share text builder. Exports: `MAX_ATTEMPTS` (4), `scoreGuess()`, `buildShareText()`. |
| `src/lib/streak.ts` | Streak persistence via localStorage. Exports: `loadStreak()`, `saveStreak()`, `recordGame(score)`. Constants: `WIN_THRESHOLD` (4 — minimum score for a "win"), `STREAK_KEY` ("chronorank_streak"). |
| `src/data/events.json` | Array of `HistoricalEvent` objects. Imported at build time. Currently 50+ events, expandable to 1,000 via the generation script. |

### Components

| Component | Role |
|-----------|------|
| `App.tsx` | Top-level state: daily vs practice mode, date computation, `?seed=` URL param parsing, auto-reload on midnight ET. Renders `GameBoard` or `ResultPanel`. Manages `GameProgress` persistence to localStorage for both daily and practice modes. |
| `GameBoard.tsx` | dnd-kit `DndContext` + `SortableContext`. Uses `arrayMove` on drag end. Manages a single vertical list (do NOT split into two lists -- this caused a critical 5th-card duplication bug). 4-attempt system with review state between attempts. Submit button locked until at least one drag move. Countdown timer to next daily puzzle. |
| `EventCard.tsx` | Individual draggable card. Shows category pill, difficulty badge, position number. On reveal: CSS flip animation, year display (gated by `showYear` prop), green/red coloring. Drag listeners attached to handle div only, not the whole card. |
| `ResultPanel.tsx` | Post-submit view. Animated score bar, stacked emoji grid (all attempts), ranked event list with years, streak stats, unified "Copy Result" clipboard button with Wordle-style share text. Conditional "solved" text (only shown on wins). |
| `Countdown.tsx` | Inline countdown to next daily puzzle (midnight ET). Used inside `GameBoard`. |
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
  emoji: string;       // emoji grid string for this attempt
  attempts: string[];  // all emoji rows from each attempt (length = attemptsUsed)
  attemptsUsed: number; // how many attempts the player used (1-4)
}

interface StreakData {
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string; // YYYY-MM-DD (ET timezone)
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
- **Timezone: US Eastern for all puzzle boundaries.** All date/seed/key functions in `seed.ts` use `Intl.DateTimeFormat` with `timeZone: "America/New_York"`. This ensures puzzle rollover at midnight ET and consistent keys across timezones. Do not switch to UTC or local time.
- **4-attempt system with review state.** Between attempts, cards show green/red coloring but years stay hidden (`showYear={false}` in the review state). Years are only revealed after all 4 attempts are spent or 5/5 is achieved. Do not reveal years between attempts — it allows cheating by memorization.
- **`GameBoard` returns `null` when `submitted === true`.** This prevents stale card order display. The `ResultPanel` handles the completed state with correct order and years.

### Mobile-specific fixes (do not revert)

- `body.dragging { position: fixed; overflow: hidden }` applied only on touch devices via `@media (hover: none) and (pointer: coarse)` in `index.css`. Prevents iOS scroll-to-top during drag.
- `touch-action: none` is on `[data-draggable]` (the drag handle only), NOT on `[data-drag-card]` (the card root). This lets users scroll by touching the card body; drag only activates from the handle. Do not add `touch-action: none` back to the card root.
- `-webkit-touch-callout: none` and `-webkit-user-select: none` on `[data-drag-card]` (card root). Prevents iOS long-press context menu and text selection without blocking scroll.
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

## State persistence

### localStorage keys

| Key | Purpose |
|-----|---------|
| `chronorank_played_YYYY-MM-DD` | Flag: daily puzzle completed for this date |
| `chronorank_result_YYYY-MM-DD` | Full `{ result: ScoreResult, answer: HistoricalEvent[] }` for daily |
| `chronorank_progress_YYYY-MM-DD` | Mid-game `{ attempt: number, previousAttempts: string[] }` for daily |
| `chronorank_practice_progress_<seed>` | Mid-game progress for practice seed |
| `chronorank_practice_result_<seed>` | Completed result for practice seed |
| `chronorank_streak` | `StreakData` object (wins, streaks, last played date) |

### Persistence flow

1. On page load, `App` checks `chronorank_played_YYYY-MM-DD` — if set, loads saved result and shows `ResultPanel`.
2. If not played, loads `chronorank_progress_YYYY-MM-DD` to restore mid-game attempt state.
3. `GameBoard` calls `onAttemptUsed(attempt, previousAttempts)` after each non-final attempt — `App` persists this to the progress key.
4. On final submit, `App` writes result to the result key, sets the played flag, and removes the progress key.
5. Practice mode uses the same pattern with seed-keyed localStorage entries.

## Auto-reload

`App` runs a `useEffect` that checks `dateKey()` every 30 seconds. When the current date key differs from the initial `todayKey` (i.e., midnight ET has passed), the page calls `window.location.reload()`. This ensures players never see a stale puzzle or store results under the wrong date.

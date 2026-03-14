# ChronoRank

A daily history trivia game where you drag historical events into chronological order. Same puzzle for every player each day, seeded deterministically by date.

**Live at:** [chronorank.vercel.app](https://chronorank.vercel.app)

## How it works

Each day, 5 historical events are drawn from the pool (1 easy, 2 medium, 2 hard) using a deterministic PRNG seeded by the date. Players drag the shuffled cards into chronological order and submit. Correct positions light up green, wrong ones red.

You get **4 attempts** per puzzle. Between attempts you see which cards are right/wrong, but years stay hidden until you finish -- no memorizing answers. Share your score as an emoji grid when you're done.

### Features

- **Daily puzzle** -- same 5 events for every player, resets at midnight ET
- **4 attempts** -- review green/red feedback between tries, years revealed only at the end
- **Practice mode** -- random puzzles with shareable seed URLs (`?seed=42`)
- **Progress persistence** -- mid-game state saved to localStorage; refreshing won't give extra attempts
- **Drag-and-drop** -- reorder cards with mouse or touch; drag handle prevents accidental drags on mobile
- **Score sharing** -- Wordle-style emoji grid copied to clipboard (works on iOS too)
- **Streak tracking** -- wins, current streak, and best streak persisted in localStorage
- **Auto-reload** -- page refreshes automatically when the daily puzzle rolls over at midnight ET
- **Zero API calls at runtime** -- all events are bundled at build time

### Share format

```
ChronoRank
2026-03-13 2/4
🟩🟩🟥🟩🟩
🟩🟩🟩🟩🟩
https://chronorank.vercel.app
```

Failed puzzles show `X/4` instead of the attempt number. Practice shares include the seed link.

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Drag-and-drop | dnd-kit (core + sortable) |
| Fonts | Playfair Display, JetBrains Mono, Inter (Google Fonts) |
| Deployment | Vercel (static site) |

## Getting started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Event requirements

- **Year range:** 1900-2026 (126 years of modern history)
- **Categories:** Politics (blue), Culture (purple), Pop Culture (pink), Tech (green)
- **Voice:** Active voice only ("X releases Y", not "Y is released by X")
- **No dates in text:** Event descriptions must not contain years (stored separately)
- **Unique years:** Each daily puzzle guarantees 5 events with distinct years

## Expanding the event pool

The game ships with events generated via LLM. To generate more (up to 1,000) using the Groq API:

```bash
# Copy the example env file and add your key
cp .env.example .env
# Edit .env and set GROQ_API_KEY=gsk_...

# Run the generator (~35 min for 950 events)
npm run generate
```

The script calls `llama-3.1-8b-instant` in batches, deduplicates against the existing pool, and writes incrementally to `src/data/events.json`. Safe to interrupt and resume. See `scripts/generate-events.ts` for options (`BATCH_SIZE`, `TARGET_TOTAL`, `DRY_RUN`).

## Deploying

Push to a GitHub repo connected to Vercel. The `vercel.json` handles build config and SPA rewrites. No server required -- the entire app is static.

```bash
# Or deploy manually with the Vercel CLI
npx vercel --prod
```

## Project structure

```
chronorank/
├── src/
│   ├── App.tsx                  # Game state, daily vs practice mode, auto-reload
│   ├── types.ts                 # HistoricalEvent, ScoreResult, StreakData
│   ├── index.css                # Tailwind imports, theme tokens, animations
│   ├── components/
│   │   ├── GameBoard.tsx        # dnd-kit SortableContext, 4-attempt system, countdown
│   │   ├── EventCard.tsx        # Draggable card with flip reveal animation
│   │   ├── ResultPanel.tsx      # Score bar, emoji grid, streak display, share buttons
│   │   ├── CategoryFilter.tsx   # (stub -- stretch goal)
│   │   └── Timer.tsx            # (stub -- stretch goal)
│   ├── data/
│   │   └── events.json          # Event pool (50--1000 events)
│   └── lib/
│       ├── seed.ts              # mulberry32 PRNG, daily/practice selection, ET timezone
│       ├── score.ts             # Positional scoring, emoji generation, MAX_ATTEMPTS
│       └── streak.ts            # localStorage streak persistence, WIN_THRESHOLD
├── scripts/
│   └── generate-events.ts       # Groq batch generation script
├── vercel.json                  # Static deployment config
└── package.json
```

## Design

- **Background:** `#0a0a0f` (near-black)
- **Accent:** `#c8a84b` (gold)
- **Category colors:** blue (politics), purple (culture), pink (popculture), green (tech)
- **Correct/wrong:** green/red with subtle background tints

## License

MIT

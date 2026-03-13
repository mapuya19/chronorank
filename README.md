# ChronoRank

A daily history trivia game where you drag historical events into chronological order. Same puzzle for every player each day, seeded deterministically by date.

**Live at:** [chronorank.vercel.app](https://chronorank.vercel.app)

## How it works

Each day, 5 historical events are drawn from the pool (2 easy, 2 medium, 1 hard) using a deterministic PRNG seeded by the date. Players drag the shuffled cards into chronological order and submit. Correct positions light up green, wrong ones red. Share your score as an emoji grid.

### Features

- **Daily puzzle** -- same 5 events for every player, resets at midnight
- **Practice mode** -- append `?seed=42` (any integer) to the URL for shareable non-daily puzzles
- **Drag-and-drop** -- reorder cards with mouse or touch; drag handle prevents accidental drags on mobile
- **Score sharing** -- copy an emoji grid to clipboard (works on iOS too)
- **Streak tracking** -- wins, current streak, and best streak persisted in localStorage
- **Zero API calls at runtime** -- all events are bundled at build time

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

## Expanding the event pool

The game ships with 50 hand-written events. To generate more (up to 1,000) using the Groq API:

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
│   ├── App.tsx                  # Game state, daily vs practice mode
│   ├── types.ts                 # HistoricalEvent, ScoreResult, StreakData
│   ├── index.css                # Tailwind imports, theme tokens, animations
│   ├── components/
│   │   ├── GameBoard.tsx        # dnd-kit SortableContext, drag sensors
│   │   ├── EventCard.tsx        # Draggable card with flip reveal animation
│   │   ├── ResultPanel.tsx      # Score bar, emoji grid, streak display
│   │   ├── CategoryFilter.tsx   # (stub -- stretch goal)
│   │   └── Timer.tsx            # (stub -- stretch goal)
│   ├── data/
│   │   └── events.json          # Event pool (50--1000 events)
│   └── lib/
│       ├── seed.ts              # mulberry32 PRNG, daily/practice event selection
│       ├── score.ts             # Positional scoring, emoji generation
│       └── streak.ts            # localStorage streak persistence
├── scripts/
│   └── generate-events.ts       # Groq batch generation script
├── vercel.json                  # Static deployment config
└── package.json
```

## Design

- **Background:** `#0a0a0f` (near-black)
- **Accent:** `#c8a84b` (gold)
- **Category colors:** blue (politics), purple (culture), green (tech)
- **Correct/wrong:** green/red with subtle background tints

## License

MIT

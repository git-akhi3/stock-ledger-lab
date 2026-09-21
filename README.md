# Stock Ledger Lab

An interactive simulation that accompanies a system-design document about replacing two
stock-sync pipelines in a Firestore-backed point-of-sale product.

**Live:** https://git-akhi3.github.io/stock-ledger-lab/

The stock number a shop owner sees is derived from an append-only ledger. Today, four writers
race to overwrite it with absolute values and two server pipelines replay the entire ledger on
every write. The proposed design stamps every row with a server-computed signed delta, sums
deltas since the last recount with a Firestore aggregation query, and lets exactly one guarded
writer own the field.

This page runs both designs on the same simulated event stream so you can *watch* where the old
one goes wrong and how the new one handles each case.

## Scenarios

Each story is a few steps. At every step you see what's on the shelf, what today's system
shows, and what the new design shows, each with one sentence saying why.

| # | Story | What it shows |
|---|---|---|
| 1 | The first sale of the day goes negative | One writer + a monotonic guard beats last-writer-wins |
| 2 | Four months offline, then everything at once | Grouped recalculation + aggregation billing keep it cheap |
| 3 | A late sale arrives after a hand count | Recount checkpoints, and their honest clock-skew limit |
| 4 | The product is re-imported from a spreadsheet | An import is a checkpoint, not a delta |
| 5 | A till sends the same sale twice | Why the normalize trigger is `onWrite`, not `onCreate` |
| 6 | One message, delivered three times | Deterministic label + absolute write + guard = idempotent |
| 7 | A till records an impossible sale | Quarantine at the trigger, never at the sale |
| 8 | Forty sales in ten seconds | The hot spot is the item document; grouping caps it |
| 9 | Everything at once | The new number holds while the old one drifts |

"Under the hood" reveals the ledger, each system's mechanics, costs and a server log. The
**What if…** button (header, and a prompt inside the stories it affects) opens settings for a
till's clock skew, an offline burst size, and fleet scale (1× / 10× / 100×). Changing a setting
keeps you on the same step so you can see its effect immediately.

## How it works

- `src/engine/` — a small deterministic model of one item's stock under both designs. Nothing is
  canned: every scenario is a script of events fed through the same engine, and every number on
  screen is computed from its state.
- `src/scenarios/` — the scripted steps for each story, plus the test suite.
- `src/player/` — applies steps; rebuilds from scratch when you step backwards.
- `src/components/` — the interface, built with React, Tailwind and Framer Motion.
- `src/analytics.ts` — PostHog setup and the `track()` helper.

Costs use representative Firestore pricing: $0.06 per 100k reads, $0.18 per 100k writes, and
aggregation queries billed at one read per 1,000 index entries scanned.

## Tests

```bash
npm test
```

Runs every story, every step, against every value the sliders can produce (0–6 h clock skew,
50–2,000 burst sizes, 1×/10×/100× scale), and checks each story ends where the design document
says it should. It also replays each story step by step the way the Back button does, so going
back can never change history. `npm run deploy` runs the tests first.

## Analytics

PostHog (events and session recordings) is switched on only when `VITE_POSTHOG_KEY` is set, which
happens in production builds via a git-ignored `.env.production.local`:

```
VITE_POSTHOG_HOST=https://your-proxy.example
VITE_POSTHOG_KEY=phc_...
```

Every event carries `app: stock-ledger-lab`. Custom events: `story_selected`, `step_viewed`,
`story_completed`, `story_restarted`, `what_if_opened`, `what_if_changed`, `what_if_reset`,
`under_the_hood_toggled`, `autoplay_toggled`, `theme_changed`.

## Run locally

```bash
npm install
npm run dev
```

Keyboard: `←` `→` to step.

## Deploy

```bash
npm run deploy
```

Runs the tests, builds to `dist/`, and pushes it to the `gh-pages` branch.

*Illustrative simulation of a design document — not production data.*

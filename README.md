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

| # | Scenario | What it proves |
|---|---|---|
| 1 | First sale of the day goes negative | One writer + a monotonic guard beats last-writer-wins |
| 2 | Four months offline, then a flush | Per-item debounce + aggregation billing keep it cheap and calm |
| 3 | A late sale arrives after a recount | Recount anchors, and their honest clock-skew limit |
| 4 | CSV re-import, ledger wiped | An import is an anchor, not a delta |
| 5 | A re-send wipes the field | Why the normalize trigger is `onWrite`, not `onCreate` |
| 6 | The same event, delivered three times | Deterministic stamp + absolute write + guard = idempotent |
| 7 | A 32-bit overflow row | Quarantine at the trigger, never at the sale |
| 8 | Flash sale on a hot item | The hot spot is the item document; debounce caps it |
| 9 | Chaos mode | The invariant holds while the old number drifts |

The **Sandbox** drawer adds sliders for fleet scale (1× / 10× / 100×), client clock skew and
offline burst size, plus the shadow-mode disagreement buckets from the rollout plan.

## How it works

- `src/engine/` — a small deterministic model of one item's stock under both designs. Nothing is
  canned: every scenario is a script of events fed through the same engine, and every number on
  screen is computed from its state.
- `src/scenarios/` — the scripted beats for each scenario.
- `src/player/` — plays beats forward, rebuilds from scratch when you step backwards.
- `src/fx/` — the particle flight layer and cue bus that visualise what the engine did.
- `src/components/` — the stage panels, built with React, Tailwind and Framer Motion.

Costs use representative Firestore pricing: $0.06 per 100k reads, $0.18 per 100k writes, and
aggregation queries billed at one read per 1,000 index entries scanned.

## Run locally

```bash
npm install
npm run dev
```

Keyboard: `space` play/pause · `←` `→` step · `R` restart.

## Deploy

```bash
npm run deploy
```

Builds to `dist/` and pushes it to the `gh-pages` branch.

*Illustrative simulation of a design document — not production data.*

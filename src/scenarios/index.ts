import { Engine, T, fmtInt, fmtMoney, fmtNum } from '../engine/engine'
import { cost } from '../engine/types'
import type { Snapshot } from '../engine/types'
import type { Beat, ScenarioDef } from './types'

const money = (s: Snapshot, lane: 'old' | 'nu') => fmtMoney(cost(s[lane].reads, s[lane].writes))

// ───────────────────────────────────────────────────────────────────────────
// 1. First sale of the day goes negative
// ───────────────────────────────────────────────────────────────────────────
const firstSale: ScenarioDef = {
  id: 'first-sale',
  short: 'First sale',
  n: 1,
  title: 'First sale of the day goes negative',
  tagline: 'The #1 support ticket, reproduced.',
  headliner: true,
  proves: 'One writer + a guard beats last-writer-wins',
  build: () => ({
    seed: (e) => {
      const restock = e.makeRow({ kind: 'add', delta: 12, deviceId: 'console', eventTime: T(0, 21, 30), note: 'restock' })
      e.seed({ truth: 12, hiddenCount: 3, hiddenSum: 0, now: T(1, 8, 59), rows: [restock] })
      e.device('a').online = false
      e.device('a').cached = 0
    },
    beats: [
      {
        caption: 'Tuesday 08:59. The shelf holds 12.',
        detail: 'Last night the owner restocked +12 from the web console. POS A was asleep, still holding 0 in its cache.',
        duration: 5000,
        run: (_e, fx) => fx.emit({ type: 'pulse', target: 'dev-a', tone: 'warn' }),
      },
      {
        caption: '09:02 — POS A wakes and rings the first sale of the day.',
        detail: 'Its ledger row (−1) lands. Old: both pipelines start a full replay. New: the trigger stamps the row and queues a recompute.',
        duration: 5000,
        run: (e, fx) => {
          e.now = T(1, 9, 2)
          e.device('a').online = true
          e.truth -= 1
          const row = e.makeRow({ kind: 'sale', delta: 1, deviceId: 'a', eventTime: e.now })
          e.writeRow(row)
          fx.emit({ type: 'fly', from: 'dev-a', to: 'ledger', tone: 'ink' })
          fx.after(700, () => {
            e.startReplay('pubsub')
            e.startReplay('cron')
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', count: 2, tone: 'old', stagger: 250 })
            e.normalize(row.id)
            e.enqueue()
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'new' })
          })
        },
      },
      {
        caption: 'The replays finish at 11 — then the phone’s cached number lands last.',
        detail:
          'POS A writes its own absolute value, 0 − 1 = −1, straight into the stock field. Today: last writer wins, the owner sees −1. Proposed: the same stray write lands for a moment, but it is flagged as foreign and a repair is already queued.',
        duration: 6000,
        run: (e, fx) => {
          fx.after(200, () => e.finishReplay('pubsub'))
          fx.after(1100, () => e.finishReplay('cron'))
          fx.after(2600, () => {
            e.device('a').cached = -1
            e.legacyWrite(-1, 'POS A', 'both')
            fx.emit({ type: 'fly', from: 'dev-a', to: 'field-old', tone: 'bad', size: 12 })
            fx.emit({ type: 'fly', from: 'dev-a', to: 'lane-new', tone: 'bad', size: 12 })
          })
          fx.after(3600, () => fx.emit({ type: 'shake', target: 'field-old' }))
        },
      },
      {
        caption: 'New: the bucket fires and the single writer commits 11 behind the guard.',
        detail: 'The phone’s stray write was flagged as foreign and queued into the same 5-second bucket — one recompute repairs it within seconds.',
        duration: 6000,
        run: (e, fx) => {
          fx.after(600, () => {
            e.tick(5)
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
            fx.emit({ type: 'burst', at: 'guard', tone: 'new' })
          })
        },
      },
      {
        caption: (s) => `Old shows ${fmtNum(s.old.value)}. New shows ${fmtNum(s.nu.value)}. The shelf holds ${fmtNum(s.truth)}.`,
        detail: (s) =>
          `Old spent ${fmtInt(s.old.reads)} reads and 3 writes (${money(s, 'old')}) to end up wrong. New spent ${s.nu.reads} reads and ${s.nu.writes} writes (${money(s, 'nu')}) and is right.`,
        duration: 8000,
        run: () => {},
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Four months offline, then a flush
// ───────────────────────────────────────────────────────────────────────────
const offlineFlush: ScenarioDef = {
  id: 'offline-flush',
  short: 'Offline flush',
  n: 2,
  title: 'Four months offline, then a flush',
  tagline: 'Hundreds of backdated rows in one burst.',
  headliner: true,
  proves: 'Debounce + aggregation billing: cheap and calm',
  build: (p) => {
    const N = p.burstSize
    const HIST = 3000
    return {
      seed: (e) => {
        e.seed({ truth: 600, hiddenCount: HIST, hiddenSum: 600, now: T(4, 10, 0) })
        e.device('b').online = false
        e.device('b').held = N
      },
      beats: [
        {
          caption: 'May: a market stall’s POS B lost its data plan. It kept selling.',
          detail: `${fmtInt(N)} sales sit in its offline queue. The ledger already carries ${fmtInt(HIST)} rows of history. Both systems show 600.`,
          duration: 5000,
          run: (_e, fx) => fx.emit({ type: 'pulse', target: 'dev-b', tone: 'warn' }),
        },
        {
          caption: 'September: POS B reconnects and flushes everything in one burst.',
          detail: 'Each row is dated months ago, each lands right now. eventTime is old; serverTime is today.',
          duration: 5500,
          run: (e, fx) => {
            e.device('b').online = true
            e.device('b').held = 0
            e.truth -= N
            for (let i = 0; i < N; i++) {
              const day = Math.floor((i / N) * 120)
              const row = e.makeRow({ kind: 'sale', delta: 1, deviceId: 'b', eventTime: T(-120 + day, 9 + (i % 9), (i * 7) % 60) })
              e.writeRow(row, { silent: true })
            }
            e.log('ledger', `${fmtInt(N)} backdated rows landed from POS B`, 'warn')
            fx.emit({ type: 'fly', from: 'dev-b', to: 'ledger', count: 36, tone: 'ink', stagger: 45, size: 6 })
          },
        },
        {
          caption: 'Old: every one of those rows triggers a full replay.',
          detail: `${fmtInt(N)} triggers × ${fmtInt(HIST + N)} rows ≈ ${fmtInt(N * (HIST + N))} document reads, plus a cron pass. The value flickers as replays race each other.`,
          duration: 7000,
          run: (e, fx) => {
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', count: 24, tone: 'old', stagger: 90, size: 5 })
            const flicker = [600, 553, 601, 388, 412, 240, 199, 133, 120]
            flicker.forEach((v, i) => {
              fx.after(400 + i * 520, () => {
                e.old.workers.pubsub = i % 2 ? 'running' : 'idle'
                e.old.workers.cron = i % 2 ? 'idle' : 'running'
                e.old.value = v
                e.old.lastWriter = i % 2 ? 'cron' : 'pubsub'
                e.old.reads += Math.round((N * (HIST + N)) / flicker.length)
                e.old.writes += Math.round(N / flicker.length)
                e.old.docWrites += Math.round(N / flicker.length)
                e.old.replayRuns += Math.round(N / flicker.length)
                if (i === flicker.length - 1) {
                  e.old.workers.pubsub = 'idle'
                  e.old.workers.cron = 'idle'
                  e.log('old', `${fmtInt(N)} replays × ${fmtInt(HIST + N)} rows = ${fmtInt(N * (HIST + N))} reads`, 'warn')
                }
              })
            })
          },
        },
        {
          caption: 'New: every row is stamped on arrival; the 5-second bucket swallows the burst.',
          detail: `${fmtInt(N)} triggers collapse into 2 recomputes. Each one is 1 + ⌈${fmtInt(HIST + N)} ÷ 1000⌉ reads, because aggregation bills per 1,000 index entries, not per row.`,
          duration: 7000,
          run: (e, fx) => {
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', count: 24, tone: 'new', stagger: 60, size: 5 })
            for (const r of e.rows) e.normalize(r.id)
            for (let i = 0; i < N; i++) e.enqueue()
            e.log('new', `${fmtInt(N)} stamps, 1 task queued, ${fmtInt(N - 1)} deduped`)
            fx.after(2600, () => {
              e.tick(5)
              e.recompute()
              fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
            })
            fx.after(4200, () => {
              e.tick(5)
              e.enqueue()
              e.recompute()
            })
          },
        },
        {
          caption: (s) => `Both land on ${fmtNum(s.nu.value)} — but look at what it cost.`,
          detail: (s) =>
            `Old: ${fmtInt(s.old.reads)} reads (${money(s, 'old')}) and minutes of wrong, flickering numbers. New: ${s.nu.reads} reads (${money(s, 'nu')}), ${s.nu.writes - N} writes to the item, and the number moved once.`,
          duration: 9000,
          run: () => {},
        },
      ],
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 3. A late sale arrives after a recount
// ───────────────────────────────────────────────────────────────────────────
const lateAfterRecount: ScenarioDef = {
  id: 'late-recount',
  short: 'Late recount',
  n: 3,
  title: 'A late sale arrives after a recount',
  tagline: 'Where “order doesn’t matter” actually breaks — and the fix.',
  headliner: true,
  proves: 'Recount anchors, and their honest clock-skew limit',
  build: (p) => {
    const skew = Math.round(p.clockSkewHours * 3600)
    const saleTime = T(1, 15, 0) + skew
    const anchorTime = T(1, 18, 0)
    const skewed = saleTime > anchorTime
    return {
      seed: (e) => {
        e.seed({ truth: 10, hiddenCount: 40, hiddenSum: 15, now: T(1, 17, 59) })
      },
      beats: [
        {
          caption: 'Tuesday 18:00 — the owner counts the shelf: 10, not the 15 the ledger implies.',
          detail: 'Five units of unrecorded shrinkage. Old: the console writes 10 straight into the field. New: a recount row lands — an anchor pinned at 18:00.',
          duration: 6000,
          run: (e, fx) => {
            e.now = anchorTime
            e.consoleWrite(10)
            fx.emit({ type: 'fly', from: 'dev-console', to: 'field-old', tone: 'old', size: 12 })
            const row = e.makeRow({ kind: 'recount', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: 10_000 })
            e.writeRow(row)
            fx.emit({ type: 'fly', from: 'dev-console', to: 'ledger', tone: 'ink' })
            fx.after(800, () => {
              e.normalize(row.id)
              e.enqueue()
              fx.emit({ type: 'fly', from: 'ledger', to: 'anchor', tone: 'new' })
            })
            fx.after(2000, () => {
              e.tick(5)
              e.recompute()
              fx.emit({ type: 'pulse', target: 'anchor', tone: 'new' })
            })
          },
        },
        {
          caption: 'Meanwhile: POS B sold 2 at 15:00 — three hours before the count — but it was offline.',
          detail: 'That sale is already reflected in the count of 10. The row is still sitting on the device.',
          duration: 5000,
          run: (e, fx) => {
            e.device('b').online = false
            e.device('b').held = 1
            fx.emit({ type: 'pulse', target: 'dev-b', tone: 'warn' })
          },
        },
        {
          caption: 'Wednesday 09:00 — POS B syncs. The row lands with an eventTime from yesterday.',
          detail: 'Old: the replay never knew a recount happened (it wasn’t a row), so it computes 15 − 2 = 13 and overwrites the console’s 10.',
          duration: 6000,
          run: (e, fx) => {
            e.now = T(2, 9, 0)
            e.device('b').online = true
            e.device('b').held = 0
            const row = e.makeRow({ id: 'late', kind: 'sale', delta: 2, deviceId: 'b', eventTime: saleTime, note: skewed ? 'clock +' + p.clockSkewHours + 'h' : 'backdated' })
            e.writeRow(row)
            fx.emit({ type: 'fly', from: 'dev-b', to: 'ledger', tone: 'ink' })
            fx.after(700, () => {
              e.startReplay('pubsub')
              fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'old' })
            })
            fx.after(2200, () => {
              e.finishReplay('pubsub')
              fx.emit({ type: 'shake', target: 'field-old' })
            })
          },
        },
        {
          caption: skewed
            ? `Clock skew of ${p.clockSkewHours}h stamped the row after the anchor. The anchor can’t tell — it subtracts it again: 8.`
            : 'Plain summation would subtract it again: 10 − 2 = 8. The anchor ignores anything stamped before 18:00.',
          detail: skewed
            ? 'This is the design’s honest limit: the anchor trusts the client clock. It is bounded, it shows up in the “recount boundary” bucket, and the next recount corrects it.'
            : 'The sum stays 10. Nothing was replayed, nothing depends on arrival order — only on whether the row is stamped before or after the count.',
          duration: 7000,
          run: (e, fx) => {
            e.normalize('late')
            e.enqueue()
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'new' })
            fx.after(1500, () => {
              e.tick(5)
              e.recompute()
              if (skewed) fx.emit({ type: 'shake', target: 'field-new' })
              else fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
            })
          },
        },
        {
          caption: (s) => `Old shows ${fmtNum(s.old.value)}. New shows ${fmtNum(s.nu.value)}. The shelf holds ${fmtNum(s.truth)}.`,
          detail: 'Try the clock-skew slider in the Sandbox: past 3 hours this row lands after the anchor and the new design gets it wrong too — visibly, and in a bucket you can watch.',
          duration: 8000,
          run: () => {},
        },
      ],
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 4. CSV re-import with the ledger gone
// ───────────────────────────────────────────────────────────────────────────
const csvReimport: ScenarioDef = {
  id: 'csv-reimport',
  short: 'CSV re-import',
  n: 4,
  title: 'CSV re-import, ledger wiped',
  tagline: 'The history is gone. What survives?',
  headliner: false,
  proves: 'An import is an anchor, not a delta',
  build: () => ({
    seed: (e) => e.seed({ truth: 50, hiddenCount: 800, hiddenSum: 47, now: T(3, 11, 0) }),
    beats: [
      {
        caption: 'Thursday 11:00 — the owner re-imports the item from a CSV. The old ledger is wiped; the sheet says 50.',
        detail: 'Old: the import is just a +50 row with no serverTime. New: the import writes an opening-balance anchor at 11:00.',
        duration: 6000,
        run: (e, fx) => {
          e.rows = []
          e.hiddenCount = 0
          e.hiddenSum = 0
          e.log('ledger', '800 rows deleted by the import (no delete trigger fires)', 'warn')
          const row = e.makeRow({ kind: 'import', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: 50_000, serverTime: null })
          e.writeRow(row)
          fx.emit({ type: 'fly', from: 'dev-console', to: 'ledger', tone: 'ink' })
          fx.after(700, () => {
            e.startReplay('pubsub')
            e.normalize(row.id)
            e.enqueue()
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'old' })
            fx.emit({ type: 'fly', from: 'ledger', to: 'anchor', tone: 'new' })
          })
          fx.after(1800, () => {
            e.finishReplay('pubsub')
            e.tick(5)
            e.recompute()
          })
        },
      },
      {
        caption: 'A straggler: POS A had an offline sale of 3 from Monday. It lands now.',
        detail: 'The sheet the owner imported was counted after that sale — it already reflects it.',
        duration: 5000,
        run: (e, fx) => {
          e.tick(3600)
          const row = e.makeRow({ id: 'straggler', kind: 'sale', delta: 3, deviceId: 'a', eventTime: T(0, 14, 0), note: 'backdated' })
          e.writeRow(row)
          fx.emit({ type: 'fly', from: 'dev-a', to: 'ledger', tone: 'ink' })
        },
      },
      {
        caption: 'Old: 50 − 3 = 47 ✗. New: the row is dated before the anchor, so it is ignored: 50 ✓.',
        detail: 'Nothing needed serverTime, nothing got double counted, and the wiped history never mattered — the sum starts at the import.',
        duration: 7000,
        run: (e, fx) => {
          e.startReplay('pubsub')
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'old' })
          fx.after(1200, () => {
            e.finishReplay('pubsub')
            fx.emit({ type: 'shake', target: 'field-old' })
          })
          e.normalize('straggler')
          e.enqueue()
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'new' })
          fx.after(2400, () => {
            e.tick(5)
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
          })
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 5. A re-send wipes the server field
// ───────────────────────────────────────────────────────────────────────────
const resend: ScenarioDef = {
  id: 'resend',
  short: 'Re-send',
  n: 5,
  title: 'A re-send wipes the field',
  tagline: 'Why the trigger is onWrite, not onCreate.',
  headliner: false,
  proves: 'onWrite repairs what a full set() erases',
  build: () => ({
    seed: (e) => {
      const sale = e.makeRow({ id: 'sale-9f2', kind: 'sale', delta: 1, deviceId: 'a', eventTime: T(2, 13, 58) })
      e.seed({ truth: 11, hiddenCount: 20, hiddenSum: 12, now: T(2, 14, 0), rows: [sale] })
    },
    beats: [
      {
        caption: 'POS A’s network flaps. Firestore re-sends the sale row under the same id.',
        detail: 'It is a plain set(), which replaces the whole document — including the field the server stamped on it.',
        duration: 5000,
        run: (e, fx) => {
          const row = e.rows[0]
          e.writeRow(row, { resend: true })
          fx.emit({ type: 'fly', from: 'dev-a', to: 'ledger', tone: 'warn' })
          fx.after(600, () => {
            e.startReplay('pubsub')
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'old' })
          })
          fx.after(1600, () => e.finishReplay('pubsub'))
        },
      },
      {
        caption: (s) => `normalizedMilli is gone. With an onCreate trigger, nothing would fire again — the sum would silently read ${fmtNum(s.derived.value)}.`,
        detail: 'A re-send is an update, not a create. The row would drop out of every future sum and the number would look perfectly plausible.',
        duration: 6000,
        run: (_e, fx) => fx.emit({ type: 'pulse', target: 'ledger', tone: 'bad' }),
      },
      {
        caption: 'onWrite sees the field is missing, re-stamps it, and only then queues the recompute: 11 ✓.',
        detail: 'If the field is already there and correct, the trigger does nothing, so it never loops on its own write.',
        duration: 6000,
        run: (e, fx) => {
          e.normalize('sale-9f2')
          e.enqueue()
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'new' })
          fx.after(1500, () => {
            e.tick(5)
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
          })
        },
      },
      {
        caption: (s) => `Old: the re-send just triggered another full replay — ${fmtInt(s.old.reads)} reads to land on the same 11.`,
        detail: 'Same answer, more money, and no protection if a field it relied on had been erased.',
        duration: 7000,
        run: () => {},
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Duplicate delivery
// ───────────────────────────────────────────────────────────────────────────
const duplicate: ScenarioDef = {
  id: 'duplicate',
  short: 'Triple delivery',
  n: 6,
  title: 'The same event, delivered three times',
  tagline: 'At-least-once is the contract. Idempotent or bust.',
  headliner: false,
  proves: 'Deterministic stamp + absolute write + guard',
  build: () => ({
    seed: (e) => e.seed({ truth: 10, hiddenCount: 30, hiddenSum: 10, now: T(3, 16, 0) }),
    beats: [
      {
        caption: 'POS B sells 1. Eventarc delivers that single ledger write three times.',
        detail: 'Triggers are at-least-once; a function timeout is an instance kill with no ack, so the event is redelivered.',
        duration: 5000,
        run: (e, fx) => {
          e.truth -= 1
          const row = e.makeRow({ id: 'sale-x', kind: 'sale', delta: 1, deviceId: 'b', eventTime: e.now })
          e.writeRow(row)
          fx.emit({ type: 'fly', from: 'dev-b', to: 'ledger', tone: 'ink' })
          fx.after(800, () => {
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', count: 3, tone: 'old', stagger: 300 })
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', count: 3, tone: 'new', stagger: 300 })
          })
        },
      },
      {
        caption: 'Old: three replays race, three absolute writes, 3 × 31 reads. The last to finish wins — that’s luck.',
        duration: 5500,
        run: (e, fx) => {
          const seq = [
            () => e.startReplay('pubsub'),
            () => e.startReplay('cron'),
            () => e.finishReplay('cron'),
            () => e.startReplay('pubsub'),
            () => e.finishReplay('pubsub'),
            () => e.finishReplay('pubsub'),
          ]
          seq.forEach((fn, i) => fx.after(300 + i * 500, fn))
        },
      },
      {
        caption: 'New: normalize runs three times — twice it’s a no-op. Three enqueues collapse into one bucket. One write.',
        duration: 6000,
        run: (e, fx) => {
          e.normalize('sale-x')
          e.normalize('sale-x')
          e.normalize('sale-x')
          e.enqueue()
          e.enqueue()
          e.enqueue()
          e.log('new', '3 deliveries → 1 stamp, 1 task queued, 2 deduped')
          fx.after(1500, () => {
            e.tick(5)
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
          })
        },
      },
      {
        caption: 'A slow duplicate that started before the write finally finishes — the guard rejects it.',
        detail: 'Its startedAt is older than the stored stocksComputedAt. An older computation can never overwrite a newer one.',
        duration: 6000,
        run: (e, fx) => {
          fx.after(500, () => {
            e.recomputeStale(e.now - 9)
            fx.emit({ type: 'fly', from: 'lane-new', to: 'guard', tone: 'bad', bounce: true, size: 10 })
            fx.emit({ type: 'burst', at: 'guard', tone: 'new' })
          })
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 7. A 32-bit overflow row
// ───────────────────────────────────────────────────────────────────────────
const overflow: ScenarioDef = {
  id: 'overflow',
  short: 'Overflow row',
  n: 7,
  title: 'A 32-bit overflow row',
  tagline: 'One garbage row, two very different mornings.',
  headliner: false,
  proves: 'Quarantine at the trigger, never at the sale',
  build: () => ({
    seed: (e) => e.seed({ truth: 12, hiddenCount: 50, hiddenSum: 12, now: T(4, 12, 0) }),
    beats: [
      {
        caption: 'A buggy client writes a sale of 2,147,483,647 units.',
        detail: 'It cannot be rejected at write time — the only gate before a write lands is security rules, and rejecting there would reject a real sale.',
        duration: 5000,
        run: (e, fx) => {
          const row = e.makeRow({ id: 'ovf', kind: 'sale', delta: 2_147_483_647, deviceId: 'a', eventTime: e.now, note: 'overflow' })
          e.writeRow(row)
          fx.emit({ type: 'fly', from: 'dev-a', to: 'ledger', tone: 'bad', size: 12 })
        },
      },
      {
        caption: 'Old: the replay swallows it. Stock becomes −2,147,483,635.',
        detail: 'Low-stock alerts fire, reports break, and the shop owner sees garbage until someone notices.',
        duration: 6000,
        run: (e, fx) => {
          e.startReplay('pubsub')
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'bad' })
          fx.after(1200, () => {
            e.finishReplay('pubsub')
            fx.emit({ type: 'shake', target: 'field-old' })
          })
        },
      },
      {
        caption: 'New: the trigger quarantines it — normalizedMilli = 0, quarantined = true, alert fired. Stock stays 12.',
        detail: 'The row stays in the ledger, flagged, so the owner’s history screen still shows it. An admin can release it after review.',
        duration: 7000,
        run: (e, fx) => {
          e.normalize('ovf')
          e.enqueue()
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'bad' })
          fx.after(1500, () => {
            e.tick(5)
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
          })
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Flash sale on a hot item
// ───────────────────────────────────────────────────────────────────────────
const flashSale: ScenarioDef = {
  id: 'flash-sale',
  short: 'Flash sale',
  n: 8,
  title: 'Flash sale on a hot item',
  tagline: 'Forty sales, ten seconds, one document.',
  headliner: false,
  proves: 'The hot spot is the item doc; debounce caps it',
  build: () => ({
    seed: (e) => e.seed({ truth: 200, hiddenCount: 400, hiddenSum: 200, now: T(5, 20, 0) }),
    beats: [
      {
        caption: 'Saturday 20:00 — a limited drop. 40 sales hit one item inside 10 seconds.',
        detail: 'All six variants of the item share one document, and one map field. That document is the unit of contention.',
        duration: 5500,
        run: (e, fx) => {
          e.truth -= 40
          for (let i = 0; i < 40; i++) {
            e.writeRow(e.makeRow({ kind: 'sale', delta: 1, deviceId: i % 2 ? 'a' : 'b', eventTime: e.now + (i * 10) / 40 }), { silent: true })
          }
          e.log('ledger', '40 sales landed in 10 s')
          fx.emit({ type: 'fly', from: 'dev-a', to: 'ledger', count: 20, tone: 'ink', stagger: 80, size: 6 })
          fx.emit({ type: 'fly', from: 'dev-b', to: 'ledger', count: 20, tone: 'ink', stagger: 80, size: 6 })
        },
      },
      {
        caption: 'Old: 40 triggers × 2 pipelines = 80 replays and 80 writes to one document in 10 seconds.',
        detail: 'Firestore sustains about 1 write per second per document. Past that: contention, retries, and whichever replay finishes last wins.',
        duration: 7000,
        run: (e, fx) => {
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', count: 30, tone: 'old', stagger: 70, size: 5 })
          const steps = 8
          for (let i = 0; i < steps; i++) {
            fx.after(300 + i * 450, () => {
              e.replayBurst(i % 2 ? 'cron' : 'pubsub', 10)
              e.old.value = 200 - Math.round(((i + 1) / steps) * 40) + (i % 3 === 1 ? 7 : 0)
              if (i === steps - 1) e.old.value = e.replayValue()
            })
          }
        },
      },
      {
        caption: 'New: 40 stamps, but the per-item bucket means 2 writes in 10 seconds.',
        detail: 'The gauge stays green. The number is at most 5 seconds stale and never wrong — a POS sells against local state, so nothing waits on it.',
        duration: 7000,
        run: (e, fx) => {
          fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', count: 30, tone: 'new', stagger: 50, size: 5 })
          for (const r of e.rows) e.normalize(r.id)
          for (let i = 0; i < 40; i++) e.enqueue()
          fx.after(2000, () => {
            e.tick(5)
            e.recompute()
          })
          fx.after(3800, () => {
            e.tick(5)
            e.enqueue()
            e.recompute()
            fx.emit({ type: 'pulse', target: 'field-new', tone: 'good' })
          })
        },
      },
      {
        caption: 'At 100× fleet scale, what breaks first isn’t this document — it’s Cloud Tasks dispatch rate.',
        detail: 'Open the Sandbox and drag the scale slider. Cost stays boring; the queue gauge is what turns amber.',
        duration: 8000,
        run: () => {},
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Chaos mode
// ───────────────────────────────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const chaos: ScenarioDef = {
  id: 'chaos',
  short: 'Chaos',
  n: 9,
  title: 'Chaos mode',
  tagline: 'Everything at once, for thirty seconds.',
  headliner: false,
  proves: 'The invariant holds while the old number drifts',
  build: () => {
    const rand = rng(1337)
    const beats: Beat[] = []
    const STEPS = 30
    let inFlight: string[] = []
    for (let i = 0; i < STEPS; i++) {
      const roll = rand()
      const kind: 'sale' | 'legacy' | 'dup' | 'late' | 'recount' | 'resend' | 'settle' =
        roll < 0.42 ? 'sale' : roll < 0.54 ? 'legacy' : roll < 0.64 ? 'dup' : roll < 0.76 ? 'late' : roll < 0.8 ? 'recount' : roll < 0.88 ? 'resend' : 'settle'
      beats.push({
        caption: {
          sale: 'A sale lands and both systems react.',
          legacy: 'A phone pushes a stale cached value into the field.',
          dup: 'The same trigger fires twice.',
          late: 'A backdated row from an offline device arrives.',
          recount: 'The owner counts the shelf — a new anchor.',
          resend: 'A re-send replaces a row and wipes its stamp.',
          settle: 'Quiet second. The bucket fires; the guard checks.',
        }[kind],
        detail: `Chaos ${i + 1} of ${STEPS}`,
        duration: 1000,
        run: (e, fx) => {
          e.tick(6)
          const dev = rand() < 0.5 ? 'a' : 'b'
          const fire = (row: { id: string }) => {
            e.startReplay('pubsub')
            fx.emit({ type: 'fly', from: 'ledger', to: 'lane-old', tone: 'old', duration: 500 })
            fx.after(350, () => e.finishReplay('pubsub'))
            inFlight.push(row.id)
            fx.after(250, () => {
              e.normalize(row.id)
              e.enqueue()
              fx.emit({ type: 'fly', from: 'ledger', to: 'lane-new', tone: 'new', duration: 500 })
            })
          }
          const settle = () => {
            fx.after(600, () => {
              inFlight = []
              e.recompute()
              e.checkInvariant()
            })
          }
          if (kind === 'sale' || kind === 'settle') {
            if (kind === 'sale') {
              const q = 1 + Math.floor(rand() * 3)
              e.truth -= q
              const row = e.writeRow(e.makeRow({ kind: 'sale', delta: q, deviceId: dev, eventTime: e.now }))
              fx.emit({ type: 'fly', from: `dev-${dev}`, to: 'ledger', tone: 'ink', duration: 500 })
              fire(row)
            }
            settle()
          } else if (kind === 'legacy') {
            const stale = e.old.value + Math.round(rand() * 9) - 4
            e.legacyWrite(stale, dev === 'a' ? 'POS A' : 'POS B', 'both')
            e.bump('legacyOverwrite')
            fx.emit({ type: 'fly', from: `dev-${dev}`, to: 'field-old', tone: 'bad', size: 10, duration: 500 })
            fx.emit({ type: 'fly', from: `dev-${dev}`, to: 'lane-new', tone: 'bad', size: 10, duration: 500 })
            settle()
          } else if (kind === 'dup') {
            const row = e.rows[e.rows.length - 1]
            if (row) {
              fire(row)
              fire(row)
              e.bump('duplicateDelivery')
            }
            settle()
          } else if (kind === 'late') {
            const q = 1 + Math.floor(rand() * 2)
            const back = 3600 * (1 + Math.floor(rand() * 30))
            const eventTime = e.now - back
            const a = e.rows.find((r) => r.id === e.nu.anchorId)
            const beforeAnchor = !!a && eventTime <= a.eventTime
            // a sale from before the count is already on the shelf number
            if (!beforeAnchor) e.truth -= q
            const row = e.writeRow(e.makeRow({ kind: 'sale', delta: q, deviceId: dev, eventTime, note: 'backdated' }))
            fx.emit({ type: 'fly', from: `dev-${dev}`, to: 'ledger', tone: 'warn', duration: 500 })
            fire(row)
            e.bump(beforeAnchor ? 'recountBoundary' : 'lateRow')
            settle()
          } else if (kind === 'recount') {
            const counted = e.truth
            e.consoleWrite(counted)
            const row = e.writeRow(e.makeRow({ kind: 'recount', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: counted * 1000 }))
            fx.emit({ type: 'fly', from: 'dev-console', to: 'ledger', tone: 'ink', duration: 500 })
            fx.emit({ type: 'fly', from: 'dev-console', to: 'field-old', tone: 'old', size: 10, duration: 500 })
            fx.after(250, () => {
              e.normalize(row.id)
              e.enqueue()
              fx.emit({ type: 'fly', from: 'ledger', to: 'anchor', tone: 'new', duration: 500 })
            })
            settle()
          } else if (kind === 'resend') {
            const row = e.rows[e.rows.length - 1]
            if (row && row.kind === 'sale') {
              e.writeRow(row, { resend: true })
              fx.emit({ type: 'fly', from: `dev-${row.deviceId}`, to: 'ledger', tone: 'warn', duration: 500 })
              e.bump('resend')
              fire(row)
            }
            settle()
          }
        },
      })
    }
    beats.push({
      caption: (s) => `Thirty seconds of chaos. Old drifted to ${fmtNum(s.old.value)}; the shelf holds ${fmtNum(s.truth)}; new shows ${fmtNum(s.nu.value)}.`,
      detail: (s) =>
        `${s.nu.foreignWrites} foreign writes caught, ${s.nu.guardRejects} stale writes rejected by the guard, ${s.nu.dedupes} tasks deduped. The invariant ${s.nu.invariantOk ? 'held' : 'broke'}.`,
      duration: 12000,
      run: (e) => {
        e.tick(5)
        e.enqueue()
        e.recompute()
      },
    })
    return {
      seed: (e) => e.seed({ truth: 30, hiddenCount: 100, hiddenSum: 30, now: T(0, 9, 0) }),
      beats,
    }
  },
}

export const SCENARIOS: ScenarioDef[] = [firstSale, offlineFlush, lateAfterRecount, csvReimport, resend, duplicate, overflow, flashSale, chaos]

export function scenarioById(id: string): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}

export { Engine }

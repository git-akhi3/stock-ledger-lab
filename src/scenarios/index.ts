import { T, fmtInt, fmtMoney, fmtNum } from '../engine/engine'
import { cost } from '../engine/types'
import type { Snapshot } from '../engine/types'
import type { Beat, ScenarioDef } from './types'

const bill = (s: Snapshot, lane: 'old' | 'nu') => fmtMoney(cost(s[lane].reads, s[lane].writes))

// ───────────────────────────────────────────────────────────────────────────
// 1. The first sale of the day goes negative
// ───────────────────────────────────────────────────────────────────────────
const firstSale: ScenarioDef = {
  id: 'first-sale',
  n: 1,
  short: 'First sale',
  title: 'The first sale of the day goes negative',
  tagline: 'The most common customer complaint, step by step.',
  headliner: true,
  build: () => ({
    seed: (e) => {
      const restock = e.makeRow({ kind: 'add', delta: 12, deviceId: 'console', eventTime: T(0, 21, 30), note: 'restock' })
      e.seed({ truth: 12, hiddenCount: 3, hiddenSum: 0, now: T(1, 8, 59), rows: [restock] })
      e.device('a').online = false
      e.device('a').cached = 0
    },
    beats: [
      {
        caption: 'Tuesday morning. The shelf holds 12 bottles.',
        detail: 'They were restocked last night from the back office. Till A was switched off at the time, so it still remembers the old count: 0.',
        old: 'Correct.',
        nu: 'Correct.',
        run: () => {},
      },
      {
        caption: '9:02. Till A switches on and sells 1 bottle.',
        detail: 'The sale is added to the ledger, the list of every stock movement. The shelf now holds 11.',
        old: 'Busy adding up the entire history again to work out the new number.',
        nu: 'Has seen the sale and will recalculate within a few seconds.',
        run: (e) => {
          e.now = T(1, 9, 2)
          e.device('a').online = true
          e.truth -= 1
          const row = e.makeRow({ kind: 'sale', delta: 1, deviceId: 'a', eventTime: e.now })
          e.writeRow(row)
          e.startReplay('pubsub')
          e.startReplay('cron')
          e.normalize(row.id)
          e.enqueue()
        },
      },
      {
        caption: 'Till A also sends the stock number it believes: 0 − 1 = −1.',
        detail: 'Old versions of the app do this. They overwrite the stock number with their own out-of-date count.',
        old: 'Shows −1. Its recount got 11, but the till wrote after it, and whoever writes last wins.',
        nu: 'The till’s −1 lands for a moment, but the server can tell it didn’t write it, and queues a fix.',
        run: (e) => {
          e.finishReplay('pubsub')
          e.finishReplay('cron')
          e.device('a').cached = -1
          e.legacyWrite(-1, 'Till A', 'both')
        },
      },
      {
        caption: 'A few seconds later.',
        old: 'Still −1. It stays wrong until another sale triggers a recount, and a till can overwrite that too.',
        nu: 'Back to 11. The server recalculated from the ledger, and it is the only thing allowed to set the number.',
        run: (e) => {
          e.tick(5)
          e.recompute()
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Four months offline, then everything at once
// ───────────────────────────────────────────────────────────────────────────
const offlineFlush: ScenarioDef = {
  id: 'offline-flush',
  n: 2,
  short: 'Offline flush',
  title: 'Four months offline, then everything at once',
  tagline: 'Hundreds of old sales arrive in one burst.',
  headliner: true,
  build: (p) => {
    const N = p.burstSize
    const HIST = 3000
    const START = 600
    return {
      seed: (e) => {
        e.seed({ truth: START - N, hiddenCount: HIST, hiddenSum: START, now: T(4, 10, 0) })
        e.device('b').online = false
        e.device('b').held = N
      },
      beats: [
        {
          caption: 'A market stall’s till B has had no signal for four months. It kept selling.',
          detail: `It saved ${fmtInt(N)} sales on the device. The shelf holds ${fmtInt(START - N)}, but nothing else has heard about those sales yet.`,
          old: `Shows ${START}. It can’t know about sales it hasn’t received.`,
          nu: `Shows ${START}, for the same reason.`,
          run: () => {},
        },
        {
          caption: `Till B gets signal back and sends all ${fmtInt(N)} sales at once.`,
          detail: 'Each sale is dated months ago, but they all arrive right now.',
          old: (s) => `Right answer, but it added up the whole history once for every sale: ${fmtInt(s.old.reads)} reads. The number jumped around while it worked.`,
          nu: (s) => `Right answer. It grouped the burst into 2 recalculations: ${fmtInt(s.nu.reads)} reads.`,
          run: (e) => {
            e.device('b').online = true
            e.device('b').held = 0
            for (let i = 0; i < N; i++) {
              const day = Math.floor((i / N) * 120)
              e.writeRow(e.makeRow({ kind: 'sale', delta: 1, deviceId: 'b', eventTime: T(-120 + day, 9 + (i % 9), (i * 7) % 60) }), { silent: true })
            }
            e.log('ledger', `${fmtInt(N)} old sales arrived from Till B`, 'warn')
            e.replayBurst('pubsub', N)
            for (const r of e.rows) e.normalize(r.id)
            for (let i = 0; i < N; i++) e.enqueue()
            e.tick(5)
            e.recompute()
            e.tick(5)
            e.enqueue()
            e.recompute()
          },
        },
        {
          caption: 'Same answer, very different bill.',
          detail: 'Today’s cost grows with every sale ever recorded. The new design’s cost grows about a thousand times slower, because the database charges one read per thousand rows it adds up.',
          old: (s) => `${bill(s, 'old')} for this one burst.`,
          nu: (s) => `${bill(s, 'nu')} for the same burst.`,
          run: () => {},
        },
      ],
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 3. A late sale arrives after a hand count
// ───────────────────────────────────────────────────────────────────────────
const lateAfterRecount: ScenarioDef = {
  id: 'late-recount',
  n: 3,
  short: 'Late sale',
  title: 'A late sale arrives after a hand count',
  tagline: 'The one case where simple adding-up breaks, and the fix.',
  headliner: true,
  build: (p) => {
    const skew = Math.round(p.clockSkewHours * 3600)
    const anchorTime = T(1, 18, 0)
    const saleTime = T(1, 15, 0) + skew
    const skewed = saleTime > anchorTime
    const h = p.clockSkewHours
    return {
      seed: (e) => {
        e.seed({ truth: 10, hiddenCount: 40, hiddenSum: 15, now: anchorTime })
        e.device('b').online = false
        e.device('b').held = 1
      },
      beats: [
        {
          caption: 'Tuesday 6pm. The owner counts the shelf by hand: 10 bottles.',
          detail: 'The system thought 15. A few went missing, and till B sold 2 at 3pm while it had no signal.',
          old: 'Shows 10. The back office wrote the count straight over the number.',
          nu: 'Shows 10. The count is saved as a checkpoint: “10, as of 6pm”. Only later sales are added to it.',
          run: (e) => {
            e.consoleWrite(10)
            const row = e.makeRow({ kind: 'recount', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: 10_000 })
            e.writeRow(row)
            e.normalize(row.id)
            e.enqueue()
            e.tick(5)
            e.recompute()
          },
        },
        {
          caption: 'Wednesday 9am. Till B gets signal and sends its 3pm sale of 2.',
          detail: skewed
            ? `But till B’s clock runs ${h} hours fast, so the sale is stamped after 6pm.`
            : 'That sale happened before the count, so the 10 already accounts for it.',
          old: 'Shows 13. It knows nothing about the count, so it added up the history again: 15 − 2.',
          nu: skewed
            ? 'Shows 8. The wrong clock puts the sale after the checkpoint, so it’s subtracted twice. This is the new design’s known weak spot; the next hand count fixes it.'
            : 'Still 10. The sale is from before the checkpoint, so it’s ignored. Simply adding everything up would have given 8.',
          run: (e) => {
            e.now = T(2, 9, 0)
            e.device('b').online = true
            e.device('b').held = 0
            e.writeRow(e.makeRow({ id: 'late', kind: 'sale', delta: 2, deviceId: 'b', eventTime: saleTime, note: skewed ? `clock +${h}h` : 'late' }))
            e.startReplay('pubsub')
            e.finishReplay('pubsub')
            e.normalize('late')
            e.enqueue()
            e.tick(5)
            e.recompute()
          },
        },
      ],
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Re-imported from a spreadsheet
// ───────────────────────────────────────────────────────────────────────────
const csvReimport: ScenarioDef = {
  id: 'csv-reimport',
  n: 4,
  short: 'Spreadsheet import',
  title: 'The product is re-imported from a spreadsheet',
  tagline: 'The old history is wiped. What happens to stragglers?',
  headliner: false,
  build: () => ({
    seed: (e) => e.seed({ truth: 50, hiddenCount: 800, hiddenSum: 47, now: T(3, 11, 0) }),
    beats: [
      {
        caption: 'The owner re-imports this product from a spreadsheet that says 50.',
        detail: 'The import deletes the product’s old history and starts fresh.',
        old: 'Shows 50. The import is treated as “add 50” to an empty history.',
        nu: 'Shows 50. The import is saved as a checkpoint: “50, as of now”.',
        run: (e) => {
          e.rows = []
          e.hiddenCount = 0
          e.hiddenSum = 0
          e.log('ledger', '800 old rows deleted by the import', 'warn')
          const row = e.makeRow({ kind: 'import', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: 50_000, serverTime: null })
          e.writeRow(row)
          e.startReplay('pubsub')
          e.finishReplay('pubsub')
          e.normalize(row.id)
          e.enqueue()
          e.tick(5)
          e.recompute()
        },
      },
      {
        caption: 'An old sale of 3 from Monday finally arrives from till A.',
        detail: 'The spreadsheet was made after that sale, so its 50 already accounts for it.',
        old: 'Shows 47. It subtracts the old sale again.',
        nu: 'Still 50. The sale is from before the checkpoint, so it’s ignored.',
        run: (e) => {
          e.tick(3600)
          e.writeRow(e.makeRow({ id: 'straggler', kind: 'sale', delta: 3, deviceId: 'a', eventTime: T(0, 14, 0), note: 'late' }))
          e.startReplay('pubsub')
          e.finishReplay('pubsub')
          e.normalize('straggler')
          e.enqueue()
          e.tick(5)
          e.recompute()
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 5. A sale is sent twice
// ───────────────────────────────────────────────────────────────────────────
const resend: ScenarioDef = {
  id: 'resend',
  n: 5,
  short: 'Sent twice',
  title: 'A till sends the same sale twice',
  tagline: 'Why the server re-checks every record, not just new ones.',
  headliner: false,
  build: () => ({
    seed: (e) => {
      const sale = e.makeRow({ id: 'sale-9f2', kind: 'sale', delta: 1, deviceId: 'a', eventTime: T(2, 13, 58) })
      e.seed({ truth: 11, hiddenCount: 20, hiddenSum: 12, now: T(2, 14, 0), rows: [sale] })
    },
    beats: [
      {
        caption: 'Till A’s connection flickers, and it re-sends a sale it already sent.',
        detail: 'Same sale, same ID, so the saved record is replaced. That also wipes the label the server had put on it.',
        old: 'Shows 11. It added up the whole history again to reach the same answer.',
        nu: (s) => `Still 11, but the sale has lost its label. If nothing re-labelled it, the next recalculation would say ${fmtNum(s.derived.value)}.`,
        run: (e) => {
          e.writeRow(e.rows[0], { resend: true })
          e.startReplay('pubsub')
          e.finishReplay('pubsub')
        },
      },
      {
        caption: 'The server notices the missing label and puts it back.',
        detail: 'It checks every write, including replaced records, so nothing can silently drop out of the total.',
        old: 'Still 11.',
        nu: 'Still 11: re-labelled, recalculated, correct.',
        run: (e) => {
          e.normalize('sale-9f2')
          e.enqueue()
          e.tick(5)
          e.recompute()
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 6. One message, delivered three times
// ───────────────────────────────────────────────────────────────────────────
const duplicate: ScenarioDef = {
  id: 'duplicate',
  n: 6,
  short: 'Delivered 3×',
  title: 'One message, delivered three times',
  tagline: 'Duplicates are normal in the cloud. They must be harmless.',
  headliner: false,
  build: () => ({
    seed: (e) => e.seed({ truth: 10, hiddenCount: 30, hiddenSum: 10, now: T(3, 16, 0) }),
    beats: [
      {
        caption: 'Till B sells 1 bottle. The cloud delivers that one message three times.',
        detail: 'Cloud services promise “at least once”, so the same message can arrive more than once.',
        old: (s) => `Shows 9 after adding up the history three times (${fmtInt(s.old.reads)} reads). Correct, but only because all three runs agreed.`,
        nu: 'Shows 9. The sale was labelled once and recalculated once. The two extra copies changed nothing.',
        run: (e) => {
          e.truth -= 1
          e.writeRow(e.makeRow({ id: 'sale-x', kind: 'sale', delta: 1, deviceId: 'b', eventTime: e.now }))
          e.startReplay('pubsub')
          e.startReplay('cron')
          e.startReplay('pubsub')
          e.finishReplay('cron')
          e.finishReplay('pubsub')
          e.finishReplay('pubsub')
          e.normalize('sale-x')
          e.normalize('sale-x')
          e.normalize('sale-x')
          e.enqueue()
          e.enqueue()
          e.enqueue()
          e.tick(5)
          e.recompute()
        },
      },
      {
        caption: 'One of the slow copies finishes late, carrying an older result.',
        detail: 'This late, out-of-date result is the race that breaks today’s system.',
        old: 'Unchanged here, but in today’s system a late, older result simply overwrites a newer one.',
        nu: 'Rejected. The server only accepts a result that is newer than the one already saved.',
        run: (e) => {
          e.recomputeStale(e.now - 9)
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 7. A glitched sale
// ───────────────────────────────────────────────────────────────────────────
const overflow: ScenarioDef = {
  id: 'overflow',
  n: 7,
  short: 'Glitched sale',
  title: 'A till records an impossible sale',
  tagline: 'One garbage record, two very different outcomes.',
  headliner: false,
  build: () => ({
    seed: (e) => e.seed({ truth: 12, hiddenCount: 50, hiddenSum: 12, now: T(4, 12, 0) }),
    beats: [
      {
        caption: 'An ordinary lunchtime. The shelf holds 12.',
        old: 'Correct.',
        nu: 'Correct.',
        run: () => {},
      },
      {
        caption: 'A glitch in one till records a sale of 2,147,483,647 bottles.',
        detail: 'It’s a number-overflow bug. It can’t be blocked on the way in without risking blocking real sales too.',
        old: 'Shows −2,147,483,635. The impossible sale went straight into the total.',
        nu: 'Still 12. The server flags the impossible sale, counts it as 0 and alerts someone. It stays visible in the history.',
        run: (e) => {
          e.writeRow(e.makeRow({ id: 'glitch', kind: 'sale', delta: 2_147_483_647, deviceId: 'a', eventTime: e.now, note: 'glitch' }))
          e.startReplay('pubsub')
          e.finishReplay('pubsub')
          e.normalize('glitch')
          e.enqueue()
          e.tick(5)
          e.recompute()
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Flash sale
// ───────────────────────────────────────────────────────────────────────────
const flashSale: ScenarioDef = {
  id: 'flash-sale',
  n: 8,
  short: 'Flash sale',
  title: 'Forty sales in ten seconds',
  tagline: 'Where the database’s own speed limit bites.',
  headliner: false,
  build: () => ({
    seed: (e) => e.seed({ truth: 200, hiddenCount: 400, hiddenSum: 200, now: T(5, 20, 0) }),
    beats: [
      {
        caption: 'Saturday 8pm. A flash sale is about to start. The shelf holds 200.',
        old: 'Correct.',
        nu: 'Correct.',
        run: () => {},
      },
      {
        caption: '40 bottles sell in 10 seconds.',
        detail: 'The stock number lives in one database record, and a single record handles about one write per second.',
        old: (s) => `Shows 160, but it wrote to that record ${fmtInt(s.old.docWrites)} times in 10 seconds. Under real load that jams.`,
        nu: (s) => `Shows 160. Updates are grouped into one every 5 seconds: ${s.nu.docWrites} writes, well under the limit.`,
        run: (e) => {
          e.truth -= 40
          for (let i = 0; i < 40; i++) {
            e.writeRow(e.makeRow({ kind: 'sale', delta: 1, deviceId: i % 2 ? 'a' : 'b', eventTime: e.now + (i * 10) / 40 }), { silent: true })
          }
          e.log('ledger', '40 sales arrived in 10 seconds')
          e.replayBurst('pubsub', 80)
          for (const r of e.rows) e.normalize(r.id)
          for (let i = 0; i < 40; i++) e.enqueue()
          e.tick(5)
          e.recompute()
          e.tick(5)
          e.enqueue()
          e.recompute()
        },
      },
    ],
  }),
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Everything at once
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
  n: 9,
  short: 'Chaos',
  title: 'Everything at once',
  tagline: 'Thirty random events. Watch which number drifts.',
  headliner: false,
  build: () => {
    const rand = rng(1337)
    const beats: Beat[] = []
    const STEPS = 30
    const captions = {
      sale: 'A till sells something.',
      legacy: 'An old till overwrites the number with its own stale count.',
      dup: 'The same message arrives twice.',
      late: 'An old sale arrives from a till that had no signal.',
      recount: 'The owner counts the shelf by hand.',
      resend: 'A till re-sends a sale it already sent.',
      quiet: 'A quiet moment.',
    }
    for (let i = 0; i < STEPS; i++) {
      const roll = rand()
      const kind: keyof typeof captions =
        roll < 0.42 ? 'sale' : roll < 0.54 ? 'legacy' : roll < 0.64 ? 'dup' : roll < 0.76 ? 'late' : roll < 0.8 ? 'recount' : roll < 0.88 ? 'resend' : 'quiet'
      beats.push({
        caption: captions[kind],
        detail: `Event ${i + 1} of ${STEPS}`,
        duration: 1100,
        run: (e) => {
          e.tick(6)
          const dev = rand() < 0.5 ? 'a' : 'b'
          const fire = (id: string) => {
            e.startReplay('pubsub')
            e.finishReplay('pubsub')
            e.normalize(id)
            e.enqueue()
          }
          if (kind === 'sale') {
            const q = 1 + Math.floor(rand() * 3)
            e.truth -= q
            fire(e.writeRow(e.makeRow({ kind: 'sale', delta: q, deviceId: dev, eventTime: e.now })).id)
          } else if (kind === 'legacy') {
            e.legacyWrite(e.old.value + Math.round(rand() * 9) - 4, dev === 'a' ? 'Till A' : 'Till B', 'both')
            e.bump('legacyOverwrite')
          } else if (kind === 'dup') {
            const row = e.rows[e.rows.length - 1]
            if (row) {
              fire(row.id)
              fire(row.id)
              e.bump('duplicateDelivery')
            }
          } else if (kind === 'late') {
            const q = 1 + Math.floor(rand() * 2)
            const eventTime = e.now - 3600 * (1 + Math.floor(rand() * 30))
            const a = e.rows.find((r) => r.id === e.nu.anchorId)
            const beforeAnchor = !!a && eventTime <= a.eventTime
            // a sale from before the hand count is already reflected in it
            if (!beforeAnchor) e.truth -= q
            fire(e.writeRow(e.makeRow({ kind: 'sale', delta: q, deviceId: dev, eventTime, note: 'late' })).id)
            e.bump(beforeAnchor ? 'recountBoundary' : 'lateRow')
          } else if (kind === 'recount') {
            e.consoleWrite(e.truth)
            fire(e.writeRow(e.makeRow({ kind: 'recount', delta: 0, deviceId: 'console', eventTime: e.now, countedMilli: e.truth * 1000 })).id)
          } else if (kind === 'resend') {
            const row = e.rows[e.rows.length - 1]
            if (row && row.kind === 'sale') {
              e.writeRow(row, { resend: true })
              e.bump('resend')
              fire(row.id)
            }
          }
          e.recompute()
          e.checkInvariant()
        },
      })
    }
    beats.push({
      caption: 'Thirty random events later.',
      old: (s) => `Drifted to ${fmtNum(s.old.value)} while the shelf holds ${fmtNum(s.truth)}.`,
      nu: (s) => `Shows ${fmtNum(s.nu.value)}. Along the way it caught and repaired ${s.nu.foreignWrites} stray writes from tills.`,
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

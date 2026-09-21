import { describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import { SCENARIOS, scenarioById } from './index'
import { say } from './say'
import { DEFAULT_PARAMS, type Params } from './types'

const SCALES: Params['scale'][] = [1, 10, 100]
// every value the sandbox sliders can produce
const SKEWS = Array.from({ length: 13 }, (_, i) => i * 0.5) // 0 … 6 h, step 0.5
const BURSTS = Array.from({ length: 40 }, (_, i) => 50 + i * 50) // 50 … 2000, step 50

/** Run a story to step `upTo` on a fresh engine, the way the player rebuilds on Back. */
function runTo(id: string, p: Params, upTo: number): Snapshot {
  const { seed, beats } = scenarioById(id).build(p)
  const e = new Engine()
  seed(e)
  for (let k = 0; k <= upTo; k++) beats[k].run(e)
  return e.snapshot()
}

function numbersAreSane(s: Snapshot) {
  for (const v of [s.truth, s.old.value, s.nu.value, s.old.reads, s.old.writes, s.nu.reads, s.nu.writes, s.derived.value, s.derived.plain]) {
    expect(Number.isFinite(v)).toBe(true)
  }
  // a physical shelf can never hold less than nothing
  expect(s.truth).toBeGreaterThanOrEqual(0)
  expect(s.old.reads).toBeGreaterThanOrEqual(0)
  expect(s.nu.reads).toBeGreaterThanOrEqual(0)
}

function allParams(): Params[] {
  const out: Params[] = []
  for (const scale of SCALES) for (const clockSkewHours of SKEWS) out.push({ ...DEFAULT_PARAMS, scale, clockSkewHours })
  for (const burstSize of BURSTS) out.push({ ...DEFAULT_PARAMS, burstSize })
  return out
}

describe('every story, every step, every sandbox setting', () => {
  for (const def of SCENARIOS) {
    it(`${def.n}. ${def.title}`, () => {
      for (const p of allParams()) {
        const { seed, beats } = def.build(p)
        expect(beats.length).toBeGreaterThan(0)
        const e = new Engine()
        seed(e)
        for (let k = 0; k < beats.length; k++) {
          beats[k].run(e)
          const s = e.snapshot()
          numbersAreSane(s)
          // every piece of copy renders to a real sentence
          expect(say(beats[k].caption, s).length).toBeGreaterThan(3)
          for (const t of [beats[k].detail, beats[k].old, beats[k].nu]) {
            if (t) expect(say(t, s)).not.toMatch(/undefined|NaN|Infinity/)
          }
        }
      }
    })
  }
})

describe('stepping back and forth replays the same history', () => {
  for (const def of SCENARIOS) {
    it(`${def.n}. ${def.short}`, () => {
      const p = DEFAULT_PARAMS
      const { beats } = def.build(p)
      // forward in one engine
      const { seed } = def.build(p)
      const e = new Engine()
      seed(e)
      const forward: Snapshot[] = []
      for (const b of beats) {
        b.run(e)
        forward.push(e.snapshot())
      }
      // rebuilt from scratch at every step, like pressing Back
      for (let k = 0; k < beats.length; k++) {
        const again = runTo(def.id, p, k)
        expect(again.truth).toBe(forward[k].truth)
        expect(again.old.value).toBe(forward[k].old.value)
        expect(again.nu.value).toBe(forward[k].nu.value)
      }
    })
  }

  it('chaos is identical when one build is replayed twice (Back button path)', () => {
    const { seed, beats } = scenarioById('chaos').build(DEFAULT_PARAMS)
    const a = new Engine()
    seed(a)
    for (const b of beats) b.run(a)
    const b2 = new Engine()
    seed(b2)
    for (const b of beats) b.run(b2)
    expect(b2.snapshot().nu.value).toBe(a.snapshot().nu.value)
    expect(b2.snapshot().old.value).toBe(a.snapshot().old.value)
    expect(b2.snapshot().truth).toBe(a.snapshot().truth)
  })
})

describe('each story ends where the design document says it should', () => {
  const last = (id: string, p: Params = DEFAULT_PARAMS) => runTo(id, p, scenarioById(id).build(p).beats.length - 1)

  it('1. first sale: today stays at −1, new design recovers to the shelf', () => {
    const s = last('first-sale')
    expect(s.truth).toBe(11)
    expect(s.old.value).toBe(-1)
    expect(s.nu.value).toBe(11)
    expect(s.nu.foreignWrites).toBe(1)
    expect(s.nu.invariantOk).toBe(true)
  })

  it('1. first sale: the new design shows "fixing" at step 3, not a silent wrong number', () => {
    const s = runTo('first-sale', DEFAULT_PARAMS, 2)
    expect(s.nu.value).toBe(-1)
    expect(s.nu.foreignFlag).toBe(true)
  })

  for (const burstSize of BURSTS) {
    it(`2. offline flush of ${burstSize}: both right, new design far cheaper`, () => {
      const s = last('offline-flush', { ...DEFAULT_PARAMS, burstSize })
      expect(s.truth).toBe(120)
      expect(s.old.value).toBe(s.truth)
      expect(s.nu.value).toBe(s.truth)
      expect(s.nu.recomputes).toBe(2)
      expect(s.nu.reads).toBeLessThan(s.old.reads / 100)
    })
  }

  for (const clockSkewHours of SKEWS) {
    const skewed = clockSkewHours > 3
    it(`3. late sale with a ${clockSkewHours} h fast clock: new design shows ${skewed ? 8 : 10}`, () => {
      const s = last('late-recount', { ...DEFAULT_PARAMS, clockSkewHours })
      expect(s.truth).toBe(10)
      expect(s.old.value).toBe(13)
      expect(s.nu.value).toBe(skewed ? 8 : 10)
      expect(s.derived.plain).toBe(8)
    })
  }

  it('4. spreadsheet import: straggler ignored by the checkpoint', () => {
    const s = last('csv-reimport')
    expect(s.truth).toBe(50)
    expect(s.old.value).toBe(47)
    expect(s.nu.value).toBe(50)
  })

  it('5. sent twice: the wiped label would drop the sale, then gets restored', () => {
    const mid = runTo('resend', DEFAULT_PARAMS, 0)
    expect(mid.derived.missing).toBe(1)
    expect(mid.derived.value).toBe(12)
    const s = last('resend')
    expect(s.derived.missing).toBe(0)
    expect(s.nu.value).toBe(11)
    expect(s.old.value).toBe(11)
  })

  it('6. delivered three times: one recalculation, late stale result rejected', () => {
    const s = last('duplicate')
    expect(s.nu.value).toBe(9)
    expect(s.nu.recomputes).toBe(1)
    expect(s.nu.dedupes).toBe(2)
    expect(s.nu.guardRejects).toBe(1)
  })

  it('7. glitched sale: quarantined, stock untouched', () => {
    const s = last('overflow')
    expect(s.nu.value).toBe(12)
    expect(s.nu.quarantined).toBe(1)
    expect(s.old.value).toBe(12 - 2_147_483_647)
  })

  it('8. flash sale: 80 writes today vs 2 in the new design', () => {
    const s = last('flash-sale')
    expect(s.truth).toBe(160)
    expect(s.old.value).toBe(160)
    expect(s.nu.value).toBe(160)
    expect(s.old.docWrites).toBe(80)
    expect(s.nu.docWrites).toBe(2)
  })

  it('9. chaos: new design matches the shelf at every step', () => {
    const { beats } = scenarioById('chaos').build(DEFAULT_PARAMS)
    for (let k = 0; k < beats.length; k++) {
      const s = runTo('chaos', DEFAULT_PARAMS, k)
      expect(s.nu.value).toBe(s.truth)
      expect(s.nu.invariantOk).toBe(true)
    }
  })
})

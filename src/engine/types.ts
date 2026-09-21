export type Kind = 'sale' | 'add' | 'return' | 'remove' | 'recount' | 'import'

/** One ledger row. Times are seconds on the simulation clock. */
export interface Row {
  id: string
  eventTime: number
  serverTime: number | null
  kind: Kind
  /** Positive magnitude for plain rows; signed for edit rows (the brief's two conventions). */
  delta: number
  isEdit: boolean
  deviceId: string
  /** Server-stamped signed change in thousandths. Null until the normalize trigger runs. */
  normalizedMilli: number | null
  quarantined: boolean
  /** Absolute counted value for recount / import rows. */
  countedMilli?: number
  note?: string
}

export type WorkerName = 'pubsub' | 'cron'

export interface OldState {
  value: number
  lastWriter: string
  reads: number
  writes: number
  workers: Record<WorkerName, 'idle' | 'running'>
  replayRuns: number
  /** writes to the item document within the current 10s window (hot-spot gauge) */
  docWrites: number
  garbage: boolean
}

export interface NewState {
  value: number
  computedAt: number
  reads: number
  writes: number
  queuePending: boolean
  queueBucket: number
  recomputes: number
  dedupes: number
  guardRejects: number
  foreignWrites: number
  foreignFlag: boolean
  quarantined: number
  anchorId: string | null
  /** what a plain sum with no anchor would show (ghost value) */
  plainSum: number
  invariantOk: boolean
  docWrites: number
  alerts: number
  missingField: number
}

export interface DeviceState {
  id: string
  label: string
  kind: 'pos' | 'console'
  online: boolean
  /** rows held in the offline queue */
  held: number
  /** the absolute stock value this device believes (legacy behaviour) */
  cached: number | null
}

export interface Snapshot {
  now: number
  truth: number
  rows: Row[]
  hiddenCount: number
  hiddenSum: number
  old: OldState
  nu: NewState
  events: LogLine[]
  devices: DeviceState[]
  /** what the NEW derivation returns right now, before any write */
  derived: { value: number; plain: number; missing: number; anchorId: string | null }
  /** scenario-specific counters (chaos buckets etc.) */
  extra: Record<string, number>
}

export interface LogLine {
  t: number
  lane: 'old' | 'new' | 'ledger'
  text: string
  tone?: 'bad' | 'good' | 'warn' | 'muted'
}

export const PRICE = {
  readPer100k: 0.06,
  writePer100k: 0.18,
}

export function cost(reads: number, writes: number): number {
  return (reads / 100_000) * PRICE.readPer100k + (writes / 100_000) * PRICE.writePer100k
}

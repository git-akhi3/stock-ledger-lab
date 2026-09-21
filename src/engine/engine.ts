import type { DeviceState, Kind, LogLine, NewState, OldState, Row, Snapshot, WorkerName } from './types'

export const BUCKET_SECONDS = 5

/**
 * A tiny, deterministic model of one item's stock under two designs.
 *
 * OLD:  every ledger write triggers a chronological replay (1 read per row),
 *       two pipelines race each other, and any writer may drop an absolute
 *       value into the field — last writer wins.
 * NEW:  a server trigger stamps `normalizedMilli` on each row, a per-item
 *       5-second bucket coalesces recomputes, and the single writer commits
 *       `anchor + sum(since anchor)` behind a monotonic guard.
 */
export class Engine {
  now = 0
  truth = 0
  rows: Row[] = []
  hiddenCount = 0
  hiddenSum = 0
  old: OldState = {
    value: 0,
    lastWriter: '—',
    reads: 0,
    writes: 0,
    workers: { pubsub: 'idle', cron: 'idle' },
    replayRuns: 0,
    docWrites: 0,
    garbage: false,
  }
  nu: NewState = {
    value: 0,
    computedAt: -1,
    reads: 0,
    writes: 0,
    queuePending: false,
    queueBucket: -1,
    recomputes: 0,
    dedupes: 0,
    guardRejects: 0,
    foreignWrites: 0,
    foreignFlag: false,
    quarantined: 0,
    anchorId: null,
    plainSum: 0,
    invariantOk: true,
    docWrites: 0,
    alerts: 0,
    missingField: 0,
  }
  events: LogLine[] = []
  devices: DeviceState[] = []
  extra: Record<string, number> = {}
  private seq = 0

  device(id: string): DeviceState {
    const d = this.devices.find((x) => x.id === id)
    if (!d) throw new Error(`unknown device ${id}`)
    return d
  }

  bump(key: string, by = 1) {
    this.extra[key] = (this.extra[key] ?? 0) + by
  }

  // ---------- setup ----------

  seed(opts: {
    truth: number
    hiddenCount?: number
    hiddenSum?: number
    now?: number
    rows?: Row[]
    devices?: DeviceState[]
  }) {
    this.truth = opts.truth
    this.hiddenCount = opts.hiddenCount ?? 0
    this.hiddenSum = opts.hiddenSum ?? 0
    this.now = opts.now ?? 0
    this.rows = opts.rows ?? []
    this.devices = opts.devices ?? [
      { id: 'a', label: 'Till A', kind: 'pos', online: true, held: 0, cached: null },
      { id: 'b', label: 'Till B', kind: 'pos', online: true, held: 0, cached: null },
      { id: 'console', label: 'Back office', kind: 'console', online: true, held: 0, cached: null },
    ]
    for (const r of this.rows) if (r.normalizedMilli === null) this.normalizeRow(r)
    this.old.value = this.replayValue()
    this.old.lastWriter = 'cron'
    this.recomputeValueInto()
    this.nu.computedAt = this.now
    this.nu.value = this.derive().value
    this.nu.plainSum = this.derive().plain
    this.checkInvariant()
  }

  tick(seconds: number) {
    this.now += seconds
  }

  log(lane: LogLine['lane'], text: string, tone?: LogLine['tone']) {
    this.events.push({ t: this.now, lane, text, tone })
    if (this.events.length > 60) this.events.shift()
  }

  // ---------- ledger ----------

  makeRow(p: Partial<Row> & { kind: Kind; delta: number; deviceId: string; eventTime: number }): Row {
    this.seq += 1
    return {
      id: p.id ?? `r${this.seq}`,
      eventTime: p.eventTime,
      serverTime: p.serverTime === undefined ? this.now : p.serverTime,
      kind: p.kind,
      delta: p.delta,
      isEdit: p.isEdit ?? false,
      deviceId: p.deviceId,
      normalizedMilli: null,
      quarantined: false,
      countedMilli: p.countedMilli,
      note: p.note,
    }
  }

  /** A client write. `resend` models a plain set() under the same id, which replaces the document. */
  writeRow(row: Row, opts: { resend?: boolean; silent?: boolean } = {}): Row {
    const idx = this.rows.findIndex((r) => r.id === row.id)
    if (idx >= 0) {
      if (opts.resend) {
        // full replace: server-stamped fields are gone
        this.rows[idx] = { ...row, normalizedMilli: null, quarantined: false, serverTime: this.now }
      } else {
        this.rows[idx] = row
      }
      if (!opts.silent) this.log('ledger', `re-send ${row.id} (same id) → document replaced`, 'warn')
      return this.rows[idx]
    }
    this.rows.push(row)
    if (!opts.silent) this.log('ledger', `${row.id} ${describe(row)}`)
    return row
  }

  deleteRow(id: string) {
    this.rows = this.rows.filter((r) => r.id !== id)
    this.log('ledger', `${id} deleted by client (no delete trigger fires)`, 'warn')
  }

  // ---------- NEW design: normalize trigger ----------

  private normalizeRow(r: Row) {
    if (r.kind === 'recount' || r.kind === 'import') {
      r.normalizedMilli = 0
      return
    }
    const mag = Math.abs(r.delta)
    if (!Number.isFinite(r.delta) || mag > 1_000_000) {
      r.normalizedMilli = 0
      r.quarantined = true
      return
    }
    if (r.isEdit) {
      r.normalizedMilli = Math.round(r.delta * 1000)
    } else {
      const sign = r.kind === 'sale' || r.kind === 'remove' ? -1 : 1
      r.normalizedMilli = Math.round(sign * mag * 1000)
    }
  }

  /** onWrite trigger: stamp the field if it is missing; deterministic, so re-delivery is harmless. */
  normalize(id: string): 'stamped' | 'quarantined' | 'noop' {
    const r = this.rows.find((x) => x.id === id)
    if (!r) return 'noop'
    if (r.normalizedMilli !== null) return 'noop'
    this.normalizeRow(r)
    this.nu.writes += 1
    if (r.quarantined) {
      this.nu.quarantined += 1
      this.nu.alerts += 1
      this.log('new', `${id} quarantined (|Δ| = ${fmtInt(Math.abs(r.delta))}) → contributes 0, alert fired`, 'warn')
      return 'quarantined'
    }
    this.log('new', `${id} stamped normalizedMilli = ${fmtSigned(r.normalizedMilli!)}`)
    return 'stamped'
  }

  /** Cloud Task named recompute-{item}-{bucket}: a duplicate name is a no-op. */
  enqueue(): 'queued' | 'deduped' {
    const bucket = Math.floor(this.now / BUCKET_SECONDS)
    if (this.nu.queuePending && this.nu.queueBucket === bucket) {
      this.nu.dedupes += 1
      return 'deduped'
    }
    this.nu.queuePending = true
    this.nu.queueBucket = bucket
    return 'queued'
  }

  private anchor(): Row | null {
    let a: Row | null = null
    for (const r of this.rows) {
      if ((r.kind === 'recount' || r.kind === 'import') && (!a || r.eventTime >= a.eventTime)) a = r
    }
    return a
  }

  /** anchor + sum(normalizedMilli where eventTime > anchor.eventTime). Rows without the field silently contribute 0. */
  derive(): { value: number; plain: number; reads: number; scanned: number; missing: number; anchor: Row | null } {
    const a = this.anchor()
    let sum = 0
    let plain = 0
    let scanned = 0
    let missing = 0
    for (const r of this.rows) {
      const v = r.normalizedMilli ?? 0
      if (r.normalizedMilli === null && r.kind !== 'recount' && r.kind !== 'import') missing += 1
      plain += v
      if (!a || r.eventTime > a.eventTime) {
        sum += v
        scanned += 1
      }
    }
    const base = a ? (a.countedMilli ?? 0) : this.hiddenSum * 1000
    if (!a) scanned += this.hiddenCount
    const reads = 1 + Math.max(1, Math.ceil(scanned / 1000))
    return {
      value: (base + sum) / 1000,
      plain: (a ? (a.countedMilli ?? 0) : this.hiddenSum * 1000) / 1000 + plain / 1000,
      reads,
      scanned,
      missing,
      anchor: a,
    }
  }

  private recomputeValueInto() {
    const d = this.derive()
    this.nu.anchorId = d.anchor?.id ?? null
    this.nu.plainSum = d.plain
    this.nu.missingField = d.missing
  }

  /** The single writer. Fires at the end of the bucket. */
  recompute(): 'written' | 'rejected' | 'refused' {
    const startedAt = this.now
    const d = this.derive()
    this.nu.reads += d.reads
    this.nu.recomputes += 1
    this.nu.queuePending = false
    this.nu.anchorId = d.anchor?.id ?? null
    this.nu.plainSum = d.plain
    this.nu.missingField = d.missing
    if (!Number.isFinite(d.value) || Math.abs(d.value) > 1e9) {
      this.nu.alerts += 1
      this.log('new', `recompute refused: non-finite/out-of-bounds sum — alert, nothing written`, 'bad')
      return 'refused'
    }
    if (startedAt <= this.nu.computedAt) {
      this.nu.guardRejects += 1
      this.log('new', `guard rejected write (started ${fmtT(startedAt)} ≤ stored ${fmtT(this.nu.computedAt)})`, 'muted')
      return 'rejected'
    }
    this.nu.value = d.value
    this.nu.computedAt = startedAt
    this.nu.writes += 1
    this.nu.docWrites += 1
    this.nu.foreignFlag = false
    this.checkInvariant()
    this.log('new', `wrote ${fmtNum(d.value)} (${d.reads} reads, ${d.scanned} rows scanned)`, 'good')
    return 'written'
  }

  /** A stale computation that started earlier and finishes now. */
  recomputeStale(startedAt: number): 'written' | 'rejected' {
    const d = this.derive()
    this.nu.reads += d.reads
    if (startedAt <= this.nu.computedAt) {
      this.nu.guardRejects += 1
      this.log('new', `guard rejected stale write (started ${fmtT(startedAt)})`, 'muted')
      return 'rejected'
    }
    this.nu.value = d.value
    this.nu.computedAt = startedAt
    this.nu.writes += 1
    return 'written'
  }

  checkInvariant() {
    const d = this.derive()
    this.nu.invariantOk = Math.abs(d.value - this.nu.value) < 0.0005
  }

  // ---------- OLD design ----------

  /** Chronological replay, one document read per row; recount rows do not exist in the old world. */
  replayValue(): number {
    const sorted = [...this.rows].sort((a, b) => a.eventTime - b.eventTime)
    let bal = this.hiddenSum
    for (const r of sorted) {
      if (r.kind === 'recount') continue
      if (r.kind === 'import') {
        // the old import is just a +N row: it adds, it does not reset
        bal += (r.countedMilli ?? 0) / 1000
        continue
      }
      if (r.isEdit) bal += r.delta
      else bal += (r.kind === 'sale' || r.kind === 'remove' ? -1 : 1) * Math.abs(r.delta)
    }
    return bal
  }

  startReplay(worker: WorkerName) {
    this.old.workers[worker] = 'running'
    this.old.replayRuns += 1
    this.old.reads += this.hiddenCount + this.rows.length
  }

  finishReplay(worker: WorkerName) {
    this.old.workers[worker] = 'idle'
    const v = this.replayValue()
    this.old.value = v
    this.old.lastWriter = worker
    this.old.writes += 1
    this.old.docWrites += 1
    this.old.garbage = !Number.isFinite(v) || Math.abs(v) > 1e6
    this.log('old', `${worker} replay wrote ${fmtNum(v)} (${this.hiddenCount + this.rows.length} reads)`)
  }

  /** Full replay in one step, for bursts. */
  replayBurst(worker: WorkerName, times: number) {
    this.old.replayRuns += times
    this.old.reads += times * (this.hiddenCount + this.rows.length)
    this.old.writes += times
    this.old.docWrites += times
    this.old.value = this.replayValue()
    this.old.lastWriter = worker
    this.log('old', `${times} replays × ${fmtInt(this.hiddenCount + this.rows.length)} rows = ${fmtInt(times * (this.hiddenCount + this.rows.length))} reads`, 'warn')
  }

  /** A client pushing its cached absolute value straight into the field. */
  legacyWrite(value: number, device: string, into: 'old' | 'both' = 'both') {
    this.old.value = value
    this.old.lastWriter = device
    this.old.writes += 1
    this.old.docWrites += 1
    this.log('old', `${device} wrote absolute ${fmtNum(value)} — last writer wins`, 'bad')
    if (into === 'both') {
      this.nu.value = value
      this.nu.foreignWrites += 1
      this.nu.foreignFlag = true
      this.nu.docWrites += 1
      this.checkInvariant()
      this.enqueue()
      this.log('new', `foreign write detected from ${device} (stocksComputedAt unchanged) → recompute queued`, 'warn')
    }
  }

  /** Web console setting stock directly (old world only; the new world writes a recount row). */
  consoleWrite(value: number) {
    this.old.value = value
    this.old.lastWriter = 'console'
    this.old.writes += 1
    this.old.docWrites += 1
    this.log('old', `back office wrote ${fmtNum(value)}`)
  }

  // ---------- snapshot ----------

  snapshot(): Snapshot {
    const d = this.derive()
    return {
      now: this.now,
      truth: this.truth,
      rows: this.rows.map((r) => ({ ...r })),
      hiddenCount: this.hiddenCount,
      hiddenSum: this.hiddenSum,
      old: { ...this.old, workers: { ...this.old.workers } },
      nu: { ...this.nu },
      events: [...this.events],
      devices: this.devices.map((x) => ({ ...x })),
      derived: { value: d.value, plain: d.plain, missing: d.missing, anchorId: d.anchor?.id ?? null },
      extra: { ...this.extra },
    }
  }
}

// ---------- formatting helpers ----------

export function describe(r: Row): string {
  if (r.kind === 'recount') return `recount → ${fmtNum((r.countedMilli ?? 0) / 1000)}`
  if (r.kind === 'import') return `CSV import → ${fmtNum((r.countedMilli ?? 0) / 1000)}`
  const sign = r.isEdit ? (r.delta >= 0 ? '+' : '−') : r.kind === 'sale' || r.kind === 'remove' ? '−' : '+'
  return `${r.kind}${r.isEdit ? ' (edit)' : ''} ${sign}${fmtNum(Math.abs(r.delta))}`
}

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const abs = Math.abs(n)
  const s = abs >= 1e6 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 }) : abs.toLocaleString('en-US', { maximumFractionDigits: 3 })
  return (n < 0 ? '−' : '') + s
}
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
export function fmtSigned(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + fmtInt(Math.abs(n))
}
export function fmtMoney(usd: number): string {
  if (usd === 0) return '$0'
  if (usd < 0.001) return `$${usd.toFixed(6)}`
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Sim clock → "Tue 15:00". Zero is Monday 00:00. */
export function fmtT(sec: number): string {
  const day = Math.floor(sec / 86400)
  const rem = ((sec % 86400) + 86400) % 86400
  const h = Math.floor(rem / 3600)
  const m = Math.floor((rem % 3600) / 60)
  const s = Math.floor(rem % 60)
  const hh = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return `${DAYS[((day % 7) + 7) % 7]} ${hh}${s ? `:${String(s).padStart(2, '0')}` : ''}`
}
export const T = (day: number, h: number, m = 0, s = 0) => day * 86400 + h * 3600 + m * 60 + s

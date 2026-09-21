import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { BUCKET_SECONDS, fmtInt, fmtMoney, fmtNum, fmtT } from '../engine/engine'
import { cost, type Snapshot } from '../engine/types'
import { LedgerStrip } from './LedgerStrip'
import { Label } from './ui'

type Line = [string, string, boolean?]

function List({ title, accent, lines, reads, writes }: { title: string; accent: string; lines: Line[]; reads: number; writes: number }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <Label className={accent}>{title}</Label>
      <dl className="mt-2 flex flex-col gap-1.5">
        {lines.map(([k, v, hot]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 text-[12.5px]">
            <dt className="text-ink-3">{k}</dt>
            <dd className={`text-right font-mono text-[12px] ${hot ? 'font-semibold text-ink' : 'text-ink-2'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex justify-between border-t border-line pt-2 font-mono text-[11.5px] text-ink-3">
        <span>
          {fmtInt(reads)} reads · {fmtInt(writes)} writes
        </span>
        <span className={`font-semibold ${accent}`}>{fmtMoney(cost(reads, writes))}</span>
      </div>
    </div>
  )
}

export function UnderTheHood({ snap }: { snap: Snapshot }) {
  const [open, setOpen] = useState(false)
  const o = snap.old
  const n = snap.nu
  const anchor = snap.rows.find((r) => r.id === snap.derived.anchorId)

  const oldLines: Line[] = [
    ['How it works', 'adds up every row, oldest first'],
    ['Background jobs', `${o.workers.pubsub === 'running' || o.workers.cron === 'running' ? 'running' : 'idle'} · ${fmtInt(o.replayRuns)} runs so far`],
    ['Last to write the number', o.lastWriter === 'pubsub' || o.lastWriter === 'cron' ? 'background job' : o.lastWriter, o.lastWriter.startsWith('Till')],
    ['Writes to the record (10 s)', `${fmtInt(o.docWrites)} · limit ≈ 10`, o.docWrites > 10],
  ]
  const newLines: Line[] = [
    ['How it works', 'checkpoint + sales since it'],
    ['Checkpoint', anchor ? `${fmtNum((anchor.countedMilli ?? 0) / 1000)} at ${fmtT(anchor.eventTime)}` : 'none yet'],
    ['Unlabelled rows', snap.derived.missing ? String(snap.derived.missing) : 'none', snap.derived.missing > 0],
    ['Flagged as impossible', n.quarantined ? String(n.quarantined) : 'none', n.quarantined > 0],
    [`Recalculations (grouped per ${BUCKET_SECONDS} s)`, `${n.recomputes} run · ${n.dedupes} merged`],
    ['Stray writes caught', String(n.foreignWrites), n.foreignFlag],
    ['Out-of-date results rejected', String(n.guardRejects)],
  ]

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-line px-6 py-4 text-left transition-colors hover:bg-panel sm:px-8"
      >
        <span>
          <span className="block text-[14px] font-semibold text-ink">Under the hood</span>
          <span className="block text-[13px] text-ink-3">The ledger, how each system works, and what it cost.</span>
        </span>
        <ChevronDown size={17} className={`shrink-0 text-ink-3 transition-transform group-hover:text-ink ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <LedgerStrip rows={snap.rows} hiddenCount={snap.hiddenCount} anchorId={snap.derived.anchorId} devices={snap.devices} />
          <div className="grid gap-3 md:grid-cols-2">
            <List title="Today’s system" accent="text-old" lines={oldLines} reads={o.reads} writes={o.writes} />
            <List title="New design" accent="text-new" lines={newLines} reads={n.reads} writes={n.writes} />
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <Label>Server log</Label>
            <div className="mt-2 flex flex-col font-mono text-[11px] leading-[18px]">
              {snap.events.length === 0 && <span className="text-ink-3">nothing yet</span>}
              {snap.events
                .slice(-10)
                .reverse()
                .map((l, i) => (
                  <div key={`${l.t}-${i}`} className="flex gap-3">
                    <span className="w-[76px] shrink-0 text-ink-3">{fmtT(l.t)}</span>
                    <span className={`w-12 shrink-0 ${l.lane === 'old' ? 'text-old' : l.lane === 'new' ? 'text-new' : 'text-ink-3'}`}>
                      {l.lane === 'old' ? 'today' : l.lane === 'new' ? 'new' : 'ledger'}
                    </span>
                    <span className="text-ink-2">{l.text}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

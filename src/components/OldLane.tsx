import { motion } from 'framer-motion'
import { Loader2, RotateCw } from 'lucide-react'
import { fmtInt } from '../engine/engine'
import type { OldState } from '../engine/types'
import { Odometer } from './Odometer'
import { Chip, Label, Panel } from './ui'

function Worker({ name, state }: { name: string; state: 'idle' | 'running' }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10.5px] ${
        state === 'running' ? 'border-old bg-old-soft text-old-ink' : 'border-line bg-panel-2 text-ink-3'
      }`}
    >
      {state === 'running' ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
      {name}
      <span className="ml-auto">{state}</span>
    </div>
  )
}

export function OldLane({ old, rowCount }: { old: OldState; rowCount: number }) {
  const bars = 44
  const hot = old.docWrites
  const hotPct = Math.min(100, (hot / 20) * 100)
  const hotTone = hot <= 5 ? 'bg-good' : hot <= 10 ? 'bg-warn' : 'bg-bad'
  return (
    <Panel data-fx="lane-old" className="flex min-h-0 flex-col gap-2.5 border-t-4 border-t-old p-3">
      <div>
        <Label className="text-old">Today</Label>
        <div className="text-[15px] font-bold leading-5 tracking-tight">Chronological replay</div>
        <div className="text-[11px] text-ink-3">two pipelines, four writers, last write wins</div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Worker name="PubSub" state={old.workers.pubsub} />
        <Worker name="Cron" state={old.workers.cron} />
      </div>

      {/* replay strip */}
      <div className="relative overflow-hidden rounded-md border border-line bg-panel-2 p-2">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-ink-3">replay, 1 read per row</span>
          <span className="shrink-0 font-mono text-[10px] text-ink-3">{fmtInt(rowCount)} rows</span>
        </div>
        <div className="flex h-9 items-end gap-[2px]">
          {Array.from({ length: bars }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-[1px] bg-old/35"
              style={{ height: `${35 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
        {old.replayRuns > 0 && (
          <motion.div
            key={old.replayRuns}
            className="scanline pointer-events-none absolute inset-y-0 w-10"
            initial={{ left: '-12%' }}
            animate={{ left: '104%' }}
            transition={{ duration: 1.1, ease: 'linear' }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <Label>Doc reads</Label>
          <div className="tnum font-mono text-base font-bold text-old">
            <Odometer value={old.reads} />
          </div>
        </div>
        <div>
          <Label>Replays</Label>
          <div className="tnum font-mono text-base font-bold">
            <Odometer value={old.replayRuns} />
          </div>
        </div>
        <div>
          <Label>Last writer</Label>
          <div className="mt-0.5">
            <Chip tone={old.lastWriter.startsWith('POS') ? 'bad' : old.lastWriter === 'console' ? 'warn' : 'old'}>{old.lastWriter}</Chip>
          </div>
        </div>
        <div>
          <Label>Field writes</Label>
          <div className="tnum font-mono text-base font-bold">
            <Odometer value={old.writes} />
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <Label className="truncate">Item doc writes · 10 s</Label>
          <span className="shrink-0 font-mono text-[10px] text-ink-3">cap ≈ 10</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <motion.div className={`h-full ${hotTone}`} animate={{ width: `${hotPct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </div>
    </Panel>
  )
}

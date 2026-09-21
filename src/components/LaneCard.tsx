import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtInt, fmtMoney, fmtNum } from '../engine/engine'
import { cost, type LogLine } from '../engine/types'
import { Odometer } from './Odometer'
import { Label } from './ui'

export type StationState = 'muted' | 'active' | 'good' | 'warn' | 'bad'
export interface Station {
  label: string
  value: ReactNode
  state?: StationState
  /** 0..1 progress bar under the value (the debounce bucket) */
  progress?: number
}

const stateCls: Record<StationState, string> = {
  muted: 'text-ink-3',
  active: 'text-ink',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

export function LaneCard({
  tone,
  eyebrow,
  title,
  value,
  truth,
  last,
  stations,
  reads,
  writes,
}: {
  tone: 'old' | 'new'
  eyebrow: string
  title: string
  value: number
  truth: number
  last?: LogLine
  stations: Station[]
  reads: number
  writes: number
}) {
  const ok = Math.abs(value - truth) < 0.0005
  const garbage = !Number.isFinite(value) || Math.abs(value) > 1e6
  const accent = tone === 'old' ? 'text-old' : 'text-new'
  const lastTone = last?.tone === 'bad' ? 'text-bad' : last?.tone === 'good' ? 'text-good' : last?.tone === 'warn' ? 'text-warn' : 'text-ink-2'
  return (
    <section className={`flex flex-col rounded-2xl border bg-panel shadow-panel ${tone === 'old' ? 'border-t-old' : 'border-t-new'} border-line border-t-4`}>
      <div className="px-5 pt-4">
        <Label className={accent}>{eyebrow}</Label>
        <div className="text-[14px] font-semibold tracking-tight text-ink-2">{title}</div>
      </div>

      <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-4">
        <motion.div
          key={`${value}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`tnum font-mono font-bold leading-none tracking-tight ${accent} ${garbage ? 'text-[26px]' : 'text-[56px]'}`}
        >
          <Odometer value={value} />
        </motion.div>
        <motion.div
          key={String(ok)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}
        >
          {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
          {ok ? 'matches shelf' : `off by ${fmtNum(Math.abs(value - truth))}`}
        </motion.div>      </div>

      <div className="min-h-[44px] border-y border-line bg-panel-2/60 px-5 py-2.5">
        <Label className="mb-0.5">Last thing that happened</Label>
        <motion.div key={last?.text ?? 'none'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`font-mono text-[11.5px] leading-4 ${lastTone}`}>
          {last?.text ?? 'nothing yet'}
        </motion.div>
      </div>

      <dl className="flex flex-col gap-2 px-5 py-3">
        {stations.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[12px] text-ink-3">{s.label}</dt>
              <dd className={`text-right font-mono text-[11.5px] font-medium ${stateCls[s.state ?? 'muted']}`}>{s.value}</dd>
            </div>
            {s.progress !== undefined && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                <motion.div className={tone === 'old' ? 'h-full bg-old' : 'h-full bg-new'} animate={{ width: `${s.progress * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            )}
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-baseline justify-between border-t border-line px-5 py-2.5 font-mono text-[11px] text-ink-3">
        <span>
          {fmtInt(reads)} reads · {fmtInt(writes)} writes
        </span>
        <span className={`font-semibold ${accent}`}>{fmtMoney(cost(reads, writes))}</span>
      </div>
    </section>
  )
}

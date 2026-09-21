import { motion } from 'framer-motion'
import { Check, Package, X } from 'lucide-react'
import { fmtNum } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import { useCue } from '../fx/useCue'
import { Odometer } from './Odometer'
import { Label } from './ui'

function Tile({
  id,
  label,
  sub,
  value,
  truth,
  tone,
}: {
  id?: string
  label: string
  sub: string
  value: number
  truth?: number
  tone: 'ink' | 'old' | 'new'
}) {
  const { shakeKey, pulse } = useCue(id ?? `none-${label}`)
  const ok = truth === undefined ? null : Math.abs(value - truth) < 0.0005
  const color = tone === 'old' ? 'text-old' : tone === 'new' ? 'text-new' : 'text-ink'
  const garbage = !Number.isFinite(value) || Math.abs(value) > 1e6
  return (
    <motion.div
      data-fx={id}
      key={`${shakeKey}-${pulse?.key ?? 0}`}
      animate={
        shakeKey
          ? { x: [0, -7, 7, -5, 5, -2, 0] }
          : pulse
            ? { boxShadow: ['0 0 0 0 rgba(0,0,0,0)', `0 0 0 8px color-mix(in oklab, var(--${pulse.tone}) 30%, transparent)`, '0 0 0 0 rgba(0,0,0,0)'] }
            : {}
      }
      transition={{ duration: shakeKey ? 0.45 : 1.1 }}
      className={`relative flex min-w-0 flex-1 flex-col rounded-xl border bg-panel px-4 py-3 shadow-panel ${
        ok === false ? 'border-bad' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className={tone === 'old' ? 'text-old' : tone === 'new' ? 'text-new' : ''}>{label}</Label>
          <div className="text-[11px] text-ink-3">{sub}</div>
        </div>
        {ok !== null && (
          <motion.span
            key={String(ok)}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'
            }`}
          >
            {ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
            {ok ? 'matches shelf' : `off by ${fmtNum(Math.abs(value - (truth ?? 0)))}`}
          </motion.span>
        )}
        {ok === null && <Package size={16} className="text-ink-3" />}
      </div>
      <div className={`tnum mt-1 font-mono font-bold leading-none tracking-tight ${color} ${garbage ? 'text-xl' : 'text-4xl'}`}>
        <Odometer value={value} />
      </div>
    </motion.div>
  )
}

export function TruthStrip({ snap }: { snap: Snapshot }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <Tile label="Shelf" sub="physical truth" value={snap.truth} tone="ink" />
      <Tile id="field-old" label="Today shows" sub="stocks[variant], replay" value={snap.old.value} truth={snap.truth} tone="old" />
      <Tile id="field-new" label="Proposed shows" sub="stocks[variant], one writer" value={snap.nu.value} truth={snap.truth} tone="new" />
    </div>
  )
}

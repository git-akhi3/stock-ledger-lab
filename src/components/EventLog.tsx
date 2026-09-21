import { AnimatePresence, motion } from 'framer-motion'
import { fmtT } from '../engine/engine'
import type { LogLine } from '../engine/types'
import { Label } from './ui'

export function EventLog({ events }: { events: LogLine[] }) {
  const last = events.slice(-6).reverse()
  const toneCls = (t?: LogLine['tone']) =>
    t === 'bad' ? 'text-bad' : t === 'good' ? 'text-good' : t === 'warn' ? 'text-warn' : t === 'muted' ? 'text-ink-3' : 'text-ink-2'
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 shadow-panel">
      <Label className="mb-1.5">Server log</Label>
      <div className="flex flex-col gap-0.5 font-mono text-[10.5px] leading-4">
        <AnimatePresence initial={false}>
          {last.map((l, i) => (
            <motion.div
              key={`${l.t}-${l.text}-${events.length - i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: i === 0 ? 1 : 0.7 - i * 0.08, x: 0 }}
              className="flex gap-2"
            >
              <span className="w-[70px] shrink-0 text-ink-3">{fmtT(l.t)}</span>
              <span className={`w-9 shrink-0 font-semibold ${l.lane === 'old' ? 'text-old' : l.lane === 'new' ? 'text-new' : 'text-ink-3'}`}>{l.lane}</span>
              <span className={`truncate ${toneCls(l.tone)}`}>{l.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {last.length === 0 && <span className="text-ink-3">quiet</span>}
      </div>
    </div>
  )
}

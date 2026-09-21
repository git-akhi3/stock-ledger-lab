import { AnimatePresence, motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { describe, fmtInt, fmtNum, fmtSigned, fmtT } from '../engine/engine'
import type { Row } from '../engine/types'
import { useCue } from '../fx/useCue'
import { Label } from './ui'

const SHOW = 7

function Stamp({ r }: { r: Row }) {
  if (r.kind === 'recount' || r.kind === 'import') {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-new px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
        <MapPin size={10} /> anchor {fmtNum((r.countedMilli ?? 0) / 1000)}
      </span>
    )
  }
  if (r.quarantined) {
    return <span className="rounded-sm border border-bad px-1.5 py-0.5 font-mono text-[10px] font-semibold text-bad">quarantined · 0</span>
  }
  if (r.normalizedMilli === null) {
    return <span className="rounded-sm border border-dashed border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">unstamped</span>
  }
  return (
    <motion.span
      key={r.normalizedMilli}
      initial={{ scale: 1.7, rotate: -10, opacity: 0 }}
      animate={{ scale: 1, rotate: -2, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className="inline-block rounded-sm border-2 border-new px-1.5 py-0.5 font-mono text-[10px] font-bold text-new"
      title="normalizedMilli, stamped by the server"
    >
      {fmtSigned(r.normalizedMilli)}
    </motion.span>
  )
}

export function LedgerTape({ rows, hiddenCount, anchorId }: { rows: Row[]; hiddenCount: number; anchorId: string | null }) {
  const { pulse } = useCue('ledger')
  const visible = rows.slice(-SHOW)
  const earlier = hiddenCount + rows.length - visible.length
  return (
    <div className="flex min-h-[320px] flex-col xl:min-h-0">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <Label>Ledger · activity/</Label>
        <span className="font-mono text-[10.5px] text-ink-3">{fmtInt(hiddenCount + rows.length)} rows</span>
      </div>
      <motion.div
        data-fx="ledger"
        key={pulse?.key}
        animate={pulse ? { boxShadow: ['0 0 0 0 rgba(0,0,0,0)', `0 0 0 6px color-mix(in oklab, var(--${pulse.tone}) 35%, transparent)`, '0 0 0 0 rgba(0,0,0,0)'] } : {}}
        transition={{ duration: 1.2 }}
        className="receipt relative flex min-h-0 flex-1 flex-col rounded-sm shadow-panel"
      >
        <div className="receipt-edge top" />
        <div className="px-3 pt-2 text-center font-mono text-[9.5px] leading-3 text-paper-ink/50">
          <div className="font-semibold tracking-[0.14em] text-paper-ink/70">CORNER MARKET</div>
          <div>items/oat-milk-1l/activity</div>
          <div className="mt-1 border-b border-dashed border-paper-line" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-px px-3 pb-2 pt-1">
          {earlier > 0 && (
            <div className="mb-1 border-b border-dashed border-paper-line pb-1 text-center font-mono text-[10px] text-paper-ink/50">
              ⋯ {fmtInt(earlier)} earlier rows
            </div>
          )}
          <AnimatePresence initial={false}>
            {visible.map((r) => {
              const isAnchor = r.id === anchorId
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: -14, clipPath: 'inset(0 0 100% 0)' }}
                  animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  data-fx={isAnchor ? 'anchor' : undefined}
                  className={`flex items-center gap-2 border-b border-dotted border-paper-line py-1.5 ${isAnchor ? 'bg-new/8' : ''}`}
                >
                  <div className="w-[62px] shrink-0 font-mono text-[10px] leading-3 text-paper-ink/60">{fmtT(r.eventTime)}</div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-mono text-[11.5px] font-medium ${r.quarantined ? 'text-bad' : 'text-paper-ink'}`}>
                      {describe(r)}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-paper-ink/55">
                      <span>{r.deviceId === 'console' ? 'console' : `POS ${r.deviceId.toUpperCase()}`}</span>
                      {r.serverTime === null && <span className="text-warn">no serverTime</span>}
                      {r.note && <span className={r.note === 'overflow' ? 'text-bad' : 'text-warn'}>{r.note}</span>}
                    </div>
                  </div>
                  <Stamp r={r} />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        <div className="receipt-edge" />
      </motion.div>
    </div>
  )
}

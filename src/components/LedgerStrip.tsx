import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, WifiOff } from 'lucide-react'
import { describe, fmtInt, fmtNum, fmtSigned, fmtT } from '../engine/engine'
import type { DeviceState, Row } from '../engine/types'
import { Label } from './ui'

const SHOW = 6

function Stamp({ r }: { r: Row }) {
  if (r.kind === 'recount' || r.kind === 'import') return null
  if (r.quarantined) return <span className="text-bad">quarantined · 0</span>
  if (r.normalizedMilli === null) return <span className="text-warn">unstamped</span>
  return <span className="text-new">stamped {fmtSigned(r.normalizedMilli)}</span>
}

export function LedgerStrip({ rows, hiddenCount, anchorId, devices }: { rows: Row[]; hiddenCount: number; anchorId: string | null; devices: DeviceState[] }) {
  const visible = rows.slice(-SHOW)
  const earlier = hiddenCount + rows.length - visible.length
  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-3 shadow-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <Label>Ledger</Label>
          <span className="font-mono text-[11px] text-ink-3">{fmtInt(hiddenCount + rows.length)} rows · append-only · newest on the right</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {devices.map((d) => (
            <span key={d.id} className="flex items-center gap-1 font-mono text-[11px] text-ink-3">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.online ? 'bg-good' : 'bg-warn'}`} />
              {d.label}
              {!d.online && <WifiOff size={10} className="text-warn" />}
              {d.held > 0 && <span className="text-warn">· {fmtInt(d.held)} held</span>}
              {d.cached !== null && <span className={d.cached < 0 ? 'text-bad' : 'text-warn'}>· cache {fmtNum(d.cached)}</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="thin-scroll mt-2.5 flex items-stretch gap-2 overflow-x-auto pb-1">
        {earlier > 0 && (
          <div className="flex shrink-0 items-center rounded-lg border border-dashed border-line px-3 font-mono text-[11px] text-ink-3">
            {fmtInt(earlier)} earlier
          </div>
        )}
        <AnimatePresence initial={false}>
          {visible.map((r, i) => {
            const isAnchor = r.id === anchorId
            const newest = i === visible.length - 1
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className={`receipt flex w-[150px] shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 ${
                  isAnchor ? 'border-new' : newest ? 'border-ink/40' : 'border-paper-line'
                }`}
              >
                <div className="font-mono text-[10px] text-paper-ink/55">{fmtT(r.eventTime)}</div>
                <div className={`flex items-center gap-1 font-mono text-[12px] font-semibold ${r.quarantined ? 'text-bad' : isAnchor ? 'text-new' : 'text-paper-ink'}`}>
                  {isAnchor && <MapPin size={11} />}
                  {describe(r)}
                </div>
                <div className="font-mono text-[10px] text-paper-ink/55">
                  {r.deviceId === 'console' ? 'console' : `POS ${r.deviceId.toUpperCase()}`}
                  {r.note && <span className={r.note === 'overflow' ? 'text-bad' : 'text-warn'}> · {r.note}</span>}
                </div>
                <div className="font-mono text-[10px]">
                  <Stamp r={r} />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </section>
  )
}

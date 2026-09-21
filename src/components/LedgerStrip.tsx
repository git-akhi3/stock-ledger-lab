import { MapPin } from 'lucide-react'
import { describe, fmtInt, fmtNum, fmtT } from '../engine/engine'
import type { DeviceState, Row } from '../engine/types'
import { Label } from './ui'

const SHOW = 6

function tag(r: Row) {
  if (r.kind === 'recount' || r.kind === 'import') return <span className="text-new">checkpoint</span>
  if (r.quarantined) return <span className="text-bad">flagged · counts as 0</span>
  if (r.normalizedMilli === null) return <span className="text-warn">no label</span>
  const v = r.normalizedMilli / 1000
  return <span className="text-new">label {v > 0 ? '+' : '−'}{fmtNum(Math.abs(v))}</span>
}

export function LedgerStrip({ rows, hiddenCount, anchorId, devices }: { rows: Row[]; hiddenCount: number; anchorId: string | null; devices: DeviceState[] }) {
  const visible = rows.slice(-SHOW)
  const earlier = hiddenCount + rows.length - visible.length
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <Label>Ledger</Label>
          <span className="text-[12px] text-ink-3">every stock movement, newest on the right · {fmtInt(hiddenCount + rows.length)} rows</span>
        </div>
        <div className="flex flex-wrap gap-x-3 text-[12px] text-ink-3">
          {devices.map((d) => (
            <span key={d.id} className="flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${d.online ? 'bg-good' : 'bg-warn'}`} />
              {d.label}
              {!d.online && ' (no signal)'}
            </span>
          ))}
        </div>
      </div>
      <div className="thin-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
        {earlier > 0 && <div className="flex shrink-0 items-center rounded-lg border border-dashed border-line px-3 text-[12px] text-ink-3">{fmtInt(earlier)} earlier</div>}
        {visible.map((r) => (
          <div key={r.id} className={`receipt flex w-[150px] shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 ${r.id === anchorId ? 'border-new' : 'border-paper-line'}`}>
            <div className="font-mono text-[10.5px] text-paper-ink/55">{fmtT(r.eventTime)}</div>
            <div className="flex items-center gap-1 font-mono text-[12px] font-semibold">
              {r.id === anchorId && <MapPin size={11} className="text-new" />}
              {describe(r)}
            </div>
            <div className="font-mono text-[10.5px] text-paper-ink/55">
              {r.deviceId === 'console' ? 'back office' : `till ${r.deviceId.toUpperCase()}`}
              {r.note && ` · ${r.note}`}
            </div>
            <div className="font-mono text-[10.5px]">{tag(r)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

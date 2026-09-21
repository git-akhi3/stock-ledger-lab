import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { fmtInt } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import type { Params } from '../scenarios/types'
import { Label } from './ui'

const MONTHLY_OLD_READS = 5_050_000_000
const MONTHLY_OLD_USD = (MONTHLY_OLD_READS / 100_000) * 0.06
const MONTHLY_NEW_USD = 50

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  hint: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] font-semibold">
          {label}
        </label>
        <span className="tnum font-mono text-[11px] text-new">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="mt-1 text-[10.5px] leading-4 text-ink-3">{hint}</div>
    </div>
  )
}

export function Sandbox({
  params,
  onChange,
  snap,
  onClose,
}: {
  params: Params
  onChange: (p: Params) => void
  snap: Snapshot | null
  onClose: () => void
}) {
  const s = params.scale
  const avgTasksPerSec = (3_000_000 * s) / 2_592_000
  const peakTasksPerSec = avgTasksPerSec * 10
  const queuePct = Math.min(100, (peakTasksPerSec / 1500) * 100)
  const queueTone = peakTasksPerSec < 300 ? 'bg-good' : peakTasksPerSec < 500 ? 'bg-warn' : 'bg-bad'
  const buckets: [string, number][] = [
    ['Legacy overwrite', snap?.extra.legacyOverwrite ?? 0],
    ['Late row (in flight)', snap?.extra.lateRow ?? 0],
    ['Recount boundary', snap?.extra.recountBoundary ?? 0],
    ['Duplicate delivery', snap?.extra.duplicateDelivery ?? 0],
    ['Re-send', snap?.extra.resend ?? 0],
    ['Unexplained', snap?.extra.unexplained ?? 0],
  ]
  const maxB = Math.max(1, ...buckets.map((b) => b[1]))

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="thin-scroll flex h-full w-full flex-col gap-5 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-panel"
      aria-label="Sandbox"
    >
      <div className="flex items-center justify-between">
        <div>
          <Label>Sandbox</Label>
          <div className="text-[13px] font-semibold">Ask “what if” with a slider</div>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-panel-2" aria-label="Close sandbox">
          <X size={16} />
        </button>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[12px] font-semibold">Fleet scale</span>
          <span className="font-mono text-[11px] text-ink-3">{fmtInt(5_000_000 * s)} writes / mo</span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-panel-2 p-1">
          {([1, 10, 100] as const).map((v) => (
            <button
              key={v}
              onClick={() => onChange({ ...params, scale: v })}
              aria-pressed={s === v}
              className={`rounded-md py-1.5 font-mono text-[12px] font-semibold transition-colors ${s === v ? 'bg-ink text-ground' : 'text-ink-2 hover:bg-panel'}`}
            >
              {v}×
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-panel-2 p-2.5">
            <Label className="text-old">Today / mo</Label>
            <div className="tnum mt-0.5 font-mono text-lg font-bold text-old">${fmtInt(MONTHLY_OLD_USD * s)}</div>
            <div className="text-[10px] leading-3 text-ink-3">grows with history</div>
          </div>
          <div className="rounded-lg border border-line bg-panel-2 p-2.5">
            <Label className="text-new">Proposed / mo</Label>
            <div className="tnum mt-0.5 font-mono text-lg font-bold text-new">${fmtInt(MONTHLY_NEW_USD * s)}</div>
            <div className="text-[10px] leading-3 text-ink-3">flat per row ÷ 1,000</div>
          </div>
        </div>
        <div className="mt-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium">What breaks first: Cloud Tasks dispatch</span>
            <span className="tnum font-mono text-[10.5px] text-ink-3">peak ≈ {fmtInt(peakTasksPerSec)}/s · default cap 500/s</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <motion.div className={`h-full ${queueTone}`} animate={{ width: `${queuePct}%` }} />
          </div>
          <div className="mt-1 text-[10.5px] leading-4 text-ink-3">
            {peakTasksPerSec < 500
              ? 'Inside the default queue limit. Cost is not the constraint.'
              : 'Past the default queue limit: raise it or split across queues. Hand-applied config — goes in the runbook.'}
          </div>
        </div>
      </div>

      <Slider
        id="skew"
        label="Client clock skew"
        value={params.clockSkewHours}
        min={0}
        max={6}
        step={0.5}
        format={(v) => `+${v} h`}
        onChange={(v) => onChange({ ...params, clockSkewHours: v })}
        hint="Scenario 3. Past +3 h the late sale is stamped after the anchor and gets subtracted twice — the design’s honest limit."
      />

      <Slider
        id="burst"
        label="Offline burst size"
        value={params.burstSize}
        min={50}
        max={2000}
        step={50}
        format={(v) => `${fmtInt(v)} rows`}
        onChange={(v) => onChange({ ...params, burstSize: v })}
        hint="Scenario 2. Old cost scales with rows × rows; new cost scales with rows ÷ 1,000."
      />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[12px] font-semibold">Shadow-mode buckets</span>
          <span className="font-mono text-[10.5px] text-ink-3">this run</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {buckets.map(([name, n]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-[120px] shrink-0 text-[11px] text-ink-2">{name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.div className={`h-full ${name === 'Unexplained' ? 'bg-bad' : 'bg-new'}`} animate={{ width: `${(n / maxB) * 100}%` }} />
              </div>
              <span className="tnum w-5 text-right font-mono text-[11px]">{n}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[10.5px] leading-4 text-ink-3">
          Every disagreement with the legacy number gets a reason. The gate to go live is “unexplained” staying under 0.1 %. Run Chaos mode to fill these.
        </div>
      </div>

      {snap && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-line bg-panel-2 p-2.5">
          {[
            ['Foreign writes caught', snap.nu.foreignWrites],
            ['Guard rejections', snap.nu.guardRejects],
            ['Tasks deduped', snap.nu.dedupes],
            ['Rows quarantined', snap.nu.quarantined],
            ['Alerts fired', snap.nu.alerts],
            ['Unstamped rows', snap.derived.missing],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="text-[10px] leading-3 text-ink-3">{k}</div>
              <div className="tnum font-mono text-[13px] font-semibold">{v as number}</div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-auto text-[10.5px] leading-4 text-ink-3">Changing a slider restarts the current scenario with the new parameters.</p>
    </motion.aside>
  )
}

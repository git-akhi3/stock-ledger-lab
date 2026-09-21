import { motion } from 'framer-motion'
import { Monitor, Smartphone, WifiOff } from 'lucide-react'
import type { DeviceState } from '../engine/types'
import { fmtInt, fmtNum } from '../engine/engine'
import { useCue } from '../fx/useCue'
import { Chip, Label, Panel } from './ui'

function DeviceCard({ d }: { d: DeviceState }) {
  const { pulse } = useCue(`dev-${d.id}`)
  const Icon = d.kind === 'pos' ? Smartphone : Monitor
  const dots = Math.min(d.held, 14)
  return (
    <motion.div
      data-fx={`dev-${d.id}`}
      key={pulse?.key}
      animate={pulse ? { boxShadow: ['0 0 0 0 rgba(0,0,0,0)', `0 0 0 6px color-mix(in oklab, var(--${pulse.tone}) 30%, transparent)`, '0 0 0 0 rgba(0,0,0,0)'] } : {}}
      transition={{ duration: 1.2 }}
      className={`relative rounded-lg border bg-panel-2 px-3 py-2.5 ${d.online ? 'border-line' : 'border-dashed border-warn'}`}
    >
      <div className="flex items-center gap-2">
        <div className={`grid h-7 w-7 place-items-center rounded-md ${d.online ? 'bg-ground text-ink-2' : 'bg-warn-soft text-warn'}`}>
          <Icon size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-4">{d.label}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-3">
            {d.online ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-good" /> online
              </>
            ) : (
              <>
                <WifiOff size={11} /> offline
              </>
            )}
          </div>
        </div>
      </div>
      {(d.held > 0 || d.cached !== null) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {d.held > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-[3px]">
                {Array.from({ length: dots }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-warn"
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.08 }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10.5px] text-warn">{fmtInt(d.held)} held</span>
            </div>
          )}
          {d.cached !== null && (
            <Chip tone={d.cached < 0 ? 'bad' : 'warn'} title="Absolute stock value this legacy client believes and will push on reconnect">
              cache {fmtNum(d.cached)}
            </Chip>
          )}
        </div>
      )}
    </motion.div>
  )
}

export function DevicesPanel({ devices }: { devices: DeviceState[] }) {
  return (
    <Panel className="flex min-h-0 flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <Label>Writers</Label>
        <span className="text-[10.5px] text-ink-3">offline-first</span>
      </div>
      <div className="flex flex-col gap-2">
        {devices.map((d) => (
          <DeviceCard key={d.id} d={d} />
        ))}
      </div>
      <p className="mt-auto text-[11px] leading-4 text-ink-3">
        Clients append ledger rows. Today they also push an absolute stock value; the new design lets them only append.
      </p>
    </Panel>
  )
}

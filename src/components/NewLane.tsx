import { motion } from 'framer-motion'
import { CheckCircle2, MapPin, ShieldCheck, Stamp, Timer, XCircle } from 'lucide-react'
import { BUCKET_SECONDS, fmtNum, fmtT } from '../engine/engine'
import type { NewState, Row, Snapshot } from '../engine/types'
import { Odometer } from './Odometer'
import { Chip, Label, Panel } from './ui'

function Station({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-new">{icon}</span>
        <span className="truncate text-[11.5px] font-semibold">{title}</span>
        {right && <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>}
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

export function NewLane({ nu, derived, anchor }: { nu: NewState; derived: Snapshot['derived']; anchor: Row | null }) {
  const ghostDiffers = Math.abs(derived.plain - derived.value) > 0.0005
  const hot = nu.docWrites
  const hotPct = Math.min(100, (hot / 20) * 100)
  const hotTone = hot <= 5 ? 'bg-good' : hot <= 10 ? 'bg-warn' : 'bg-bad'
  return (
    <Panel data-fx="lane-new" className="flex min-h-0 flex-col gap-1.5 border-t-4 border-t-new p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className="text-new">Proposed</Label>
          <div className="text-[15px] font-bold leading-5 tracking-tight">Sum of deltas, one writer</div>
          <div className="truncate text-[11px] text-ink-3">stamp · bucket · sum since anchor · guard</div>
        </div>
        <motion.div
          key={String(nu.invariantOk)}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold ${
            nu.invariantOk ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'
          }`}
          title="stocks[variant] == anchor + Σ normalizedMilli since anchor"
        >
          {nu.invariantOk ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          invariant
        </motion.div>
      </div>

      <Station
        icon={<Stamp size={13} />}
        title="onWrite · normalize"
        right={
          <>
            {derived.missing > 0 && <Chip tone="warn">{derived.missing} unstamped</Chip>}
            {nu.quarantined > 0 && <Chip tone="bad">{nu.quarantined} quarantined</Chip>}
            {derived.missing === 0 && nu.quarantined === 0 && <span className="font-mono text-[10px] text-ink-3">all stamped</span>}
          </>
        }
      />

      <Station icon={<Timer size={13} />} title={`Cloud Task · ${BUCKET_SECONDS} s bucket`}>
        <div className="mb-1 font-mono text-[10px] text-ink-3">
          {nu.recomputes} fired · {nu.dedupes} deduped
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <motion.div
            key={`${nu.queueBucket}-${nu.queuePending}`}
            className="h-full bg-new"
            initial={{ width: nu.queuePending ? '6%' : '0%' }}
            animate={{ width: nu.queuePending ? '100%' : '0%' }}
            transition={{ duration: nu.queuePending ? 4.5 : 0.2, ease: 'linear' }}
          />
        </div>
      </Station>

      <Station icon={<MapPin size={13} />} title="Anchor + Σ since">
        <div className="mb-0.5">
          {anchor ? (
            <Chip tone="new" title="latest recount / import row">
              <MapPin size={9} /> {fmtNum((anchor.countedMilli ?? 0) / 1000)} @ {fmtT(anchor.eventTime)}
            </Chip>
          ) : (
            <span className="font-mono text-[10px] text-ink-3">no anchor · full sum</span>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] text-ink-3">sum right now</span>
          <span className="tnum font-mono text-sm font-bold text-new">
            <Odometer value={derived.value} decimals={3} />
          </span>
        </div>
        {ghostDiffers && (
          <div className="mt-0.5 flex items-baseline justify-between text-[10.5px]">
            <span className="text-ink-3">plain sum, no anchor</span>
            <span className="tnum font-mono font-semibold text-bad line-through decoration-bad/60">{fmtNum(derived.plain)}</span>
          </div>
        )}
      </Station>

      <Station
        icon={<span data-fx="guard" className="inline-flex"><ShieldCheck size={13} /></span>}
        title="Monotonic guard"
        right={nu.foreignFlag ? <Chip tone="bad">foreign write</Chip> : undefined}
      >
        <div className="flex flex-wrap justify-between gap-x-2 font-mono text-[10px] text-ink-3">
          <span>computedAt {nu.computedAt >= 0 ? fmtT(nu.computedAt) : '—'}</span>
          <span>
            {nu.guardRejects} rejected · {nu.foreignWrites} foreign
          </span>
        </div>
      </Station>

      <div className="mt-auto flex items-end gap-3 pt-1">
        <div>
          <Label>Reads</Label>
          <div className="tnum font-mono text-base font-bold leading-5 text-new">
            <Odometer value={nu.reads} />
          </div>
        </div>
        <div>
          <Label>Writes</Label>
          <div className="tnum font-mono text-base font-bold leading-5">
            <Odometer value={nu.writes} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <Label className="truncate">Item doc · 10 s</Label>
            <span className="shrink-0 font-mono text-[10px] text-ink-3">cap ≈ 10</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <motion.div className={`h-full ${hotTone}`} animate={{ width: `${hotPct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>
      </div>
    </Panel>
  )
}

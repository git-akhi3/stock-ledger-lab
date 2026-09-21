import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtInt } from '../engine/engine'
import { NEW_USD, OLD_USD, QUEUE_LIMIT, peakTasksPerSec } from '../scenarios/fleet'
import { DEFAULT_PARAMS, type Params } from '../scenarios/types'


function Section({
  eyebrow,
  title,
  body,
  story,
  current,
  onShow,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  story?: { id: string; label: string }
  current: string
  onShow: (id: string) => void
  children: ReactNode
}) {
  const here = story && story.id === current
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{eyebrow}</div>
      <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-1 text-[13px] leading-[19px] text-ink-2">{body}</p>
      <div className="mt-4">{children}</div>
      {story &&
        (here ? (
          <div className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-good">
            <span className="h-1.5 w-1.5 rounded-full bg-good" /> Playing in “{story.label}” now
          </div>
        ) : (
          <button onClick={() => onShow(story.id)} className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-new hover:underline">
            See it in “{story.label}” <ArrowRight size={13} />
          </button>
        ))}
    </section>
  )
}

function Slider({
  id,
  value,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  marker,
}: {
  id: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  minLabel: string
  maxLabel: string
  marker?: { at: number; label: string }
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ background: `linear-gradient(to right, var(--new) ${pct}%, var(--line) ${pct}%)` }}
        />
        {marker && (
          <span
            className="pointer-events-none absolute top-[-3px] h-[10px] w-[2px] rounded-full bg-bad"
            style={{ left: `calc(${((marker.at - min) / (max - min)) * 100}% - 1px)` }}
            title={marker.label}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-ink-3">
        <span>{minLabel}</span>
        {marker && <span className="text-bad">{marker.label}</span>}
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

export function Sandbox({
  params,
  onChange,
  onClose,
  current,
  onShow,
}: {
  params: Params
  onChange: (p: Params) => void
  onClose: () => void
  current: string
  onShow: (id: string) => void
}) {
  const s = params.scale
  const peak = peakTasksPerSec(s)
  const queuePct = Math.min(100, (peak / (QUEUE_LIMIT * 2)) * 100)
  const over = peak >= QUEUE_LIMIT
  const changed = JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS)
  const skewed = params.clockSkewHours > 3

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="flex h-full w-full flex-col overflow-hidden border-line bg-ground shadow-panel sm:rounded-[20px] sm:border"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatif-title"
    >
      <header className="flex items-start justify-between gap-4 border-b border-line bg-panel px-6 py-5">
        <div>
          <h2 id="whatif-title" className="text-[18px] font-semibold tracking-[-0.015em]">
            What if…
          </h2>
          <p className="mt-0.5 text-[13px] leading-[19px] text-ink-2">Change the conditions and watch the stories react. Your step is kept.</p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-panel-2 hover:text-ink" aria-label="Close">
          <X size={17} />
        </button>
      </header>

      <div className="thin-scroll flex flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <Section
          eyebrow="Clock"
          title="What if a till’s clock is wrong?"
          body="The new design trusts each till’s timestamp to decide whether a sale came before or after a hand count."
          story={{ id: 'late-recount', label: 'Late sale' }}
          current={current}
          onShow={onShow}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13px] text-ink-2">Till B’s clock runs fast by</span>
            <span className={`tnum font-mono text-[15px] font-semibold ${skewed ? 'text-bad' : 'text-ink'}`}>{params.clockSkewHours} h</span>
          </div>
          <Slider
            id="skew"
            value={params.clockSkewHours}
            min={0}
            max={6}
            step={0.5}
            onChange={(v) => onChange({ ...params, clockSkewHours: v })}
            minLabel="correct"
            maxLabel="6 h fast"
            marker={{ at: 3, label: 'breaks past 3 h' }}
          />
          <p className={`mt-3 text-[12.5px] leading-[18px] ${skewed ? 'text-bad' : 'text-ink-3'}`}>
            {skewed
              ? 'The sale now looks like it happened after the count, so the new design subtracts it twice. This is its known weak spot.'
              : 'Still safe: the sale is stamped before the 6pm count, so the new design correctly ignores it.'}
          </p>
        </Section>

        <Section
          eyebrow="Offline"
          title="What if a till is offline for longer?"
          body="More saved-up sales arriving at once. Today’s cost grows with every one of them; the new design barely notices."
          story={{ id: 'offline-flush', label: 'Offline flush' }}
          current={current}
          onShow={onShow}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13px] text-ink-2">Sales waiting on the till</span>
            <span className="tnum font-mono text-[15px] font-semibold text-ink">{fmtInt(params.burstSize)}</span>
          </div>
          <Slider
            id="burst"
            value={params.burstSize}
            min={50}
            max={2000}
            step={50}
            onChange={(v) => onChange({ ...params, burstSize: v })}
            minLabel="50"
            maxLabel="2,000"
          />
        </Section>

        <Section
          eyebrow="Scale"
          title="What if there were far more shops?"
          body="Monthly cost across every shop, and the first thing that would run out of room."
          story={{ id: 'flash-sale', label: 'Flash sale' }}
          current={current}
          onShow={onShow}
        >
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-panel-2 p-1" role="radiogroup" aria-label="Scale">
            {([1, 10, 100] as const).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={s === v}
                onClick={() => onChange({ ...params, scale: v })}
                className={`rounded-lg py-2 text-[13px] font-semibold transition-colors ${s === v ? 'bg-panel text-ink shadow-panel' : 'text-ink-3 hover:text-ink'}`}
              >
                {v === 1 ? 'Today' : `${v}×`}
              </button>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-old" /> Today’s system
              </dt>
              <dd className="tnum mt-1 font-mono text-[20px] font-semibold tracking-[-0.03em] text-old">${fmtInt(OLD_USD * s)}</dd>
              <dd className="text-[11.5px] text-ink-3">per month, and rising</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-new" /> New design
              </dt>
              <dd className="tnum mt-1 font-mono text-[20px] font-semibold tracking-[-0.03em] text-new">${fmtInt(NEW_USD * s)}</dd>
              <dd className="text-[11.5px] text-ink-3">per month, roughly flat</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-medium text-ink-2">Recalculation queue at peak</span>
              <span className={`tnum font-mono ${over ? 'text-bad' : 'text-ink-3'}`}>
                {fmtInt(peak)} / {QUEUE_LIMIT} per s
              </span>
            </div>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className={`h-full rounded-full ${over ? 'bg-bad' : peak > QUEUE_LIMIT * 0.6 ? 'bg-warn' : 'bg-good'}`} animate={{ width: `${queuePct}%` }} />
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink-3/40" />
            </div>
            <p className="mt-2 text-[12.5px] leading-[18px] text-ink-3">
              {over
                ? 'Past the default limit. This breaks before cost does: raise the queue limit or split it.'
                : 'Well within the default limit. At this size, nothing is close to breaking.'}
            </p>
          </div>
        </Section>
      </div>

      <footer className="flex items-center justify-between border-t border-line bg-panel px-6 py-3.5">
        <button
          onClick={() => onChange(DEFAULT_PARAMS)}
          disabled={!changed}
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <RotateCcw size={13} /> Reset
        </button>
        <button onClick={onClose} className="h-9 rounded-lg bg-ink px-4 text-[13px] font-semibold text-ground hover:opacity-85">
          Done
        </button>
      </footer>
    </motion.aside>
  )
}

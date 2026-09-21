import { motion } from 'framer-motion'
import type { Snapshot } from '../engine/types'
import type { Beat, ScenarioDef } from '../scenarios/types'

function text(v: Beat['caption'] | Beat['detail'], s: Snapshot): string {
  if (!v) return ''
  return typeof v === 'function' ? v(s) : v
}

/** The one thing to read: scenario, step, and what is happening right now. */
export function Story({ scenario, beats, beat, snap, onGoTo }: { scenario: ScenarioDef; beats: Beat[]; beat: number; snap: Snapshot; onGoTo: (i: number) => void }) {
  const b = beats[beat]
  const many = beats.length > 12
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[22px] font-bold leading-7 tracking-tight [text-wrap:balance]">
          <span className="mr-2 font-mono text-[13px] font-bold text-ink-3">{String(scenario.n).padStart(2, '0')}</span>
          {scenario.title}
        </h1>
        <span className="text-[12.5px] text-ink-3">{scenario.tagline}</span>
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label="Steps">
        {many ? (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
            <motion.div className="h-full bg-ink" animate={{ width: `${((beat + 1) / beats.length) * 100}%` }} />
          </div>
        ) : (
          beats.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === beat}
              aria-label={`Step ${i + 1}`}
              onClick={() => onGoTo(i)}
              className={`h-1 rounded-full transition-all ${i === beat ? 'w-8 bg-ink' : i < beat ? 'w-4 bg-ink-3' : 'w-4 bg-line hover:bg-line-2'}`}
            />
          ))
        )}
        <span className="font-mono text-[11px] text-ink-3">
          step {beat + 1} of {beats.length}
        </span>
      </div>

      <motion.div key={beat} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-h-[72px] max-w-[72ch]">
        <p className="text-[18px] font-semibold leading-6 tracking-tight [text-wrap:balance]">{text(b?.caption, snap)}</p>
        {b?.detail && <p className="mt-1.5 text-[14px] leading-5 text-ink-2">{text(b.detail, snap)}</p>}
      </motion.div>
    </section>
  )
}

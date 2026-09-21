import { motion } from 'framer-motion'
import type { Snapshot } from '../engine/types'
import { say } from '../scenarios/say'
import type { Beat, ScenarioDef } from '../scenarios/types'


/** Scenario title, where you are, and the one sentence to read. */
export function Story({ scenario, beats, beat, snap }: { scenario: ScenarioDef; beats: Beat[]; beat: number; snap: Snapshot }) {
  const b = beats[beat]
  return (
    <section>
      <div className="text-[13px] text-ink-3">
        {scenario.title}
        <span className="mx-2 text-line-2">·</span>
        <span className="font-mono text-[12px]">
          step {beat + 1} of {beats.length}
        </span>
      </div>
      <motion.div key={`${scenario.id}-${beat}`} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-2 min-h-[148px] max-w-[62ch] sm:min-h-[132px]">
        <p className="text-[24px] font-bold leading-[30px] tracking-tight [text-wrap:balance]">{say(b?.caption, snap)}</p>
        {b?.detail && <p className="mt-2 text-[15px] leading-[22px] text-ink-2">{say(b.detail, snap)}</p>}
      </motion.div>
    </section>
  )
}

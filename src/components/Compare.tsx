import { motion } from 'framer-motion'
import { fmtNum } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import type { Beat } from '../scenarios/types'
import { Odometer } from './Odometer'
import { say } from '../scenarios/say'

type Status = { label: string; tone: 'good' | 'bad' | 'wait' }

function status(value: number, truth: number, busy: boolean, fixing: boolean): Status {
  const diff = Math.abs(value - truth)
  if (diff < 0.0005) return { label: 'Matches the shelf', tone: 'good' }
  if (fixing) return { label: 'Fixing…', tone: 'wait' }
  if (busy) return { label: 'Updating…', tone: 'wait' }
  return { label: `Wrong by ${fmtNum(diff)}`, tone: 'bad' }
}

const chip = { good: 'bg-good-soft text-good', bad: 'bg-bad-soft text-bad', wait: 'bg-panel-2 text-ink-2' }

function Column({
  label,
  value,
  accent,
  st,
  why,
  quiet,
}: {
  label: string
  value: number
  accent: string
  st?: Status
  why: string
  quiet?: boolean
}) {
  const garbage = !Number.isFinite(value) || Math.abs(value) > 1e6
  return (
    <div className={`flex flex-col rounded-2xl p-5 ${quiet ? 'bg-transparent' : 'border border-line bg-panel shadow-panel'}`}>
      <div className="text-[13px] font-semibold text-ink-2">{label}</div>
      <div className={`tnum mt-2 font-mono font-bold leading-none tracking-tight ${accent} ${garbage ? 'text-[26px]' : 'text-[52px]'}`}>
        <Odometer value={value} />
      </div>
      {st && (
        <motion.div key={st.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-3 self-start rounded-full px-2.5 py-1 text-[12px] font-semibold ${chip[st.tone]}`}>
          {st.label}
        </motion.div>
      )}
      <motion.p key={why} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="mt-3 text-[14px] leading-5 text-ink-2">
        {why}
      </motion.p>
    </div>
  )
}

export function Compare({ snap, beat }: { snap: Snapshot; beat: Beat }) {
  const busy = snap.old.workers.pubsub === 'running' || snap.old.workers.cron === 'running'
  const oldSt = status(snap.old.value, snap.truth, busy, false)
  const newSt = status(snap.nu.value, snap.truth, snap.nu.queuePending, snap.nu.foreignFlag)
  const fallback = (st: Status) => (st.tone === 'good' ? 'Correct.' : st.label + '.')
  return (
    <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1fr]">
      <Column label="On the shelf" value={snap.truth} accent="text-ink" why="What’s physically there." quiet />
      <Column label="Today’s system" value={snap.old.value} accent="text-old" st={oldSt} why={say(beat.old, snap) || fallback(oldSt)} />
      <Column label="New design" value={snap.nu.value} accent="text-new" st={newSt} why={say(beat.nu, snap) || fallback(newSt)} />
    </div>
  )
}

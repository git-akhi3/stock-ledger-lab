import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Loader, Pause, Play, RotateCcw, X } from 'lucide-react'
import { fmtNum } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import { say } from '../scenarios/say'
import type { Beat, ScenarioDef } from '../scenarios/types'
import { Odometer } from './Odometer'

type Tone = 'good' | 'bad' | 'wait'
type Status = { label: string; tone: Tone }

function status(value: number, truth: number, busy: boolean, fixing: boolean): Status {
  const diff = Math.abs(value - truth)
  if (diff < 0.0005) return { label: 'Matches the shelf', tone: 'good' }
  if (fixing) return { label: 'Fixing', tone: 'wait' }
  if (busy) return { label: 'Updating', tone: 'wait' }
  return { label: `Wrong by ${fmtNum(diff)}`, tone: 'bad' }
}

const statusCls: Record<Tone, string> = { good: 'text-good', bad: 'text-bad', wait: 'text-ink-3' }
const StatusIcon = ({ tone }: { tone: Tone }) =>
  tone === 'good' ? <Check size={13} strokeWidth={2.75} /> : tone === 'bad' ? <X size={13} strokeWidth={2.75} /> : <Loader size={13} strokeWidth={2.5} />

function Column({ label, dot, value, numCls, st, why }: { label: string; dot: string; value: number; numCls: string; st?: Status; why: string }) {
  const garbage = !Number.isFinite(value) || Math.abs(value) > 1e6
  const wrong = st?.tone === 'bad'
  return (
    <div className={`relative flex flex-col px-6 py-6 transition-colors duration-300 sm:px-7 ${wrong ? 'bg-bad-soft/60' : ''}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className={`tnum mt-4 font-mono font-semibold leading-none tracking-[-0.04em] ${numCls} ${garbage ? 'text-[24px] tracking-[-0.02em]' : 'text-[60px]'}`}>
        <Odometer value={value} />
      </div>
      <div className="mt-4 h-5">
        {st ? (
          <motion.div key={st.label} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-1.5 text-[13px] font-semibold ${statusCls[st.tone]}`}>
            <StatusIcon tone={st.tone} />
            {st.label}
          </motion.div>
        ) : (
          <div className="text-[13px] font-medium text-ink-3">Physical count</div>
        )}
      </div>
      <motion.p key={why} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-3 text-[14px] leading-[21px] text-ink-2">
        {why}
      </motion.p>
    </div>
  )
}

export function Stage({
  scenario,
  beats,
  beat,
  snap,
  playing,
  onPrev,
  onNext,
  onRestart,
  onTogglePlay,
  onGoTo,
}: {
  scenario: ScenarioDef
  beats: Beat[]
  beat: number
  snap: Snapshot
  playing: boolean
  onPrev: () => void
  onNext: () => void
  onRestart: () => void
  onTogglePlay: () => void
  onGoTo: (i: number) => void
}) {
  const b = beats[beat]
  const last = beat >= beats.length - 1
  const chaos = scenario.id === 'chaos'
  const busy = snap.old.workers.pubsub === 'running' || snap.old.workers.cron === 'running'
  const oldSt = status(snap.old.value, snap.truth, busy, false)
  const newSt = status(snap.nu.value, snap.truth, snap.nu.queuePending, snap.nu.foreignFlag)
  const fallback = (st: Status) => (st.tone === 'good' ? 'Correct.' : `${st.label}.`)

  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-panel shadow-panel">
      <div className="px-6 pb-7 pt-6 sm:px-8">
        {/* top row: where you are + controls, pinned so they never move */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 text-[12.5px] text-ink-3">
            <span className="font-medium text-ink-2">{scenario.title}</span>
            <span className="mx-2 text-line-2">/</span>
            <span className="tnum whitespace-nowrap">
              Step {beat + 1} of {beats.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {chaos && (
              <button
                onClick={onTogglePlay}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-panel-2 hover:text-ink"
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
                {playing ? 'Pause' : 'Play'}
              </button>
            )}
            <button
              onClick={onPrev}
              disabled={beat === 0}
              aria-label="Previous step"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-panel-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={last ? onRestart : onNext}
              className="flex h-9 items-center gap-2 rounded-lg bg-ink pl-4 pr-3.5 text-[13px] font-semibold text-ground transition-opacity hover:opacity-85"
            >
              {last ? (
                <>
                  Start over <RotateCcw size={14} />
                </>
              ) : (
                <>
                  Next <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* progress */}
        <div className="mt-5 flex gap-1" role="tablist" aria-label="Steps">
          {beats.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === beat}
              aria-label={`Step ${i + 1}`}
              onClick={() => onGoTo(i)}
              className="group h-4 flex-1 py-[6px]"
            >
              <span className={`block h-full rounded-full transition-colors ${i <= beat ? 'bg-ink' : 'bg-line group-hover:bg-line-2'}`} />
            </button>
          ))}
        </div>

        {/* the one thing to read */}
        <motion.div
          key={`${scenario.id}-${beat}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mt-6 min-h-[124px] max-w-[60ch]"
        >
          <h2 className="text-[26px] font-semibold leading-[32px] tracking-[-0.02em] text-ink [text-wrap:balance]">{say(b?.caption, snap)}</h2>
          {b?.detail && <p className="mt-2.5 text-[15.5px] leading-[24px] text-ink-2 [text-wrap:pretty]">{say(b.detail, snap)}</p>}
        </motion.div>
      </div>

      <div className="grid border-t border-line md:grid-cols-[0.82fr_1fr_1fr] md:divide-x md:divide-y-0 divide-y divide-line">
        <Column label="On the shelf" dot="bg-ink" value={snap.truth} numCls="text-ink" why="What’s physically there." />
        <Column label="Today’s system" dot="bg-old" value={snap.old.value} numCls="text-old" st={oldSt} why={say(b?.old, snap) || fallback(oldSt)} />
        <Column label="New design" dot="bg-new" value={snap.nu.value} numCls="text-new" st={newSt} why={say(b?.nu, snap) || fallback(newSt)} />
      </div>
    </section>
  )
}

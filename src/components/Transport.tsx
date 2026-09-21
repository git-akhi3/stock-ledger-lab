import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { fmtInt, fmtMoney } from '../engine/engine'
import { cost, type Snapshot } from '../engine/types'
import type { Beat } from '../scenarios/types'
import { Label } from './ui'

function text(v: Beat['caption'] | Beat['detail'], s: Snapshot): string {
  if (!v) return ''
  return typeof v === 'function' ? v(s) : v
}

export function Transport({
  beats,
  beat,
  playing,
  snap,
  onPrev,
  onNext,
  onToggle,
  onRestart,
  onGoTo,
}: {
  beats: Beat[]
  beat: number
  playing: boolean
  snap: Snapshot
  onPrev: () => void
  onNext: () => void
  onToggle: () => void
  onRestart: () => void
  onGoTo: (i: number) => void
}) {
  const b = beats[beat]
  const caption = text(b?.caption, snap)
  const detail = text(b?.detail, snap)
  const oldCost = cost(snap.old.reads, snap.old.writes)
  const newCost = cost(snap.nu.reads, snap.nu.writes)
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line bg-panel hover:bg-panel-2 disabled:opacity-40'
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-panel lg:flex-row lg:items-center lg:gap-5">
      <div className="flex items-center gap-1.5">
        <button className={btn} onClick={onRestart} aria-label="Restart scenario" title="Restart (R)">
          <RotateCcw size={15} />
        </button>
        <button className={btn} onClick={onPrev} disabled={beat === 0} aria-label="Previous step" title="Previous (←)">
          <ChevronLeft size={16} />
        </button>
        <button
          className={`${btn} bg-ink text-ground hover:bg-ink`}
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          title="Play / pause (space)"
        >
          {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <button className={btn} onClick={onNext} disabled={beat >= beats.length - 1} aria-label="Next step" title="Next (→)">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={beat}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <div className="text-[15px] font-semibold leading-5 tracking-tight [text-wrap:balance]">{caption}</div>
            {detail && <div className="mt-0.5 text-[12.5px] leading-[18px] text-ink-2">{detail}</div>}
          </motion.div>
        </AnimatePresence>
        <div className="mt-2 flex items-center gap-1.5" role="tablist" aria-label="Steps">
          {beats.length <= 12 ? (
            beats.map((bb, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === beat}
                aria-label={`Step ${i + 1}`}
                onClick={() => onGoTo(i)}
                className={`relative h-1.5 overflow-hidden rounded-full transition-all ${i === beat ? 'w-10 bg-line-2' : 'w-4 bg-line hover:bg-line-2'}`}
              >
                {i === beat && (
                  <motion.span
                    key={`${i}-${playing}`}
                    className="absolute inset-y-0 left-0 bg-ink"
                    initial={{ width: '0%' }}
                    animate={{ width: playing ? '100%' : '0%' }}
                    transition={{ duration: playing ? bb.duration / 1000 : 0, ease: 'linear' }}
                  />
                )}
              </button>
            ))
          ) : (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full bg-ink" animate={{ width: `${((beat + 1) / beats.length) * 100}%` }} />
            </div>
          )}
          <span className="ml-1 font-mono text-[10.5px] text-ink-3">
            {beat + 1} / {beats.length}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-5 border-t border-line pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div>
          <Label className="text-old">Today, this run</Label>
          <div className="tnum font-mono text-sm font-bold text-old">{fmtMoney(oldCost)}</div>
          <div className="font-mono text-[10px] text-ink-3">
            {fmtInt(snap.old.reads)} r · {fmtInt(snap.old.writes)} w
          </div>
        </div>
        <div>
          <Label className="text-new">Proposed, this run</Label>
          <div className="tnum font-mono text-sm font-bold text-new">{fmtMoney(newCost)}</div>
          <div className="font-mono text-[10px] text-ink-3">
            {fmtInt(snap.nu.reads)} r · {fmtInt(snap.nu.writes)} w
          </div>
        </div>
      </div>
    </div>
  )
}

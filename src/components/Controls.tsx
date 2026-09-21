import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react'

export function Controls({
  beat,
  total,
  playing,
  onPrev,
  onNext,
  onToggle,
  onRestart,
}: {
  beat: number
  total: number
  playing: boolean
  onPrev: () => void
  onNext: () => void
  onToggle: () => void
  onRestart: () => void
}) {
  const last = beat >= total - 1
  const ghost = 'flex h-10 items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 text-[13px] font-medium hover:bg-panel-2 disabled:opacity-40 disabled:hover:bg-panel'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={ghost} onClick={onPrev} disabled={beat === 0}>
        <ArrowLeft size={15} /> Back
      </button>
      <button
        className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-ground shadow-panel hover:opacity-90 disabled:opacity-40"
        onClick={last ? onRestart : onNext}
      >
        {last ? (
          <>
            <RotateCcw size={15} /> Play again
          </>
        ) : (
          <>
            Next step <ArrowRight size={15} />
          </>
        )}
      </button>
      <button className={ghost} onClick={onToggle} aria-pressed={playing}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? 'Auto-playing' : 'Auto-play'}
      </button>
      <span className="ml-auto hidden font-mono text-[11px] text-ink-3 sm:block">space · ← → · R</span>
    </div>
  )
}

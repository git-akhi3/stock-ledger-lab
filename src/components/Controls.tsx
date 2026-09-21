import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react'

export function Controls({
  beat,
  total,
  playing,
  showAutoplay,
  onPrev,
  onNext,
  onToggle,
  onRestart,
}: {
  beat: number
  total: number
  playing: boolean
  showAutoplay: boolean
  onPrev: () => void
  onNext: () => void
  onToggle: () => void
  onRestart: () => void
}) {
  const last = beat >= total - 1
  return (
    <div className="flex items-center gap-2">
      <button
        className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel px-4 text-[14px] font-medium hover:bg-panel-2 disabled:opacity-40 disabled:hover:bg-panel"
        onClick={onPrev}
        disabled={beat === 0}
      >
        <ArrowLeft size={16} /> Back
      </button>
      <button
        autoFocus
        className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-ground hover:opacity-90"
        onClick={last ? onRestart : onNext}
      >
        {last ? (
          <>
            <RotateCcw size={16} /> Start over
          </>
        ) : (
          <>
            Next <ArrowRight size={16} />
          </>
        )}
      </button>
      {showAutoplay && (
        <button className="flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:text-ink" onClick={onToggle}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? 'Pause' : 'Play'}
        </button>
      )}
    </div>
  )
}

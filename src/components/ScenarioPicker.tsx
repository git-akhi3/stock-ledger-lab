import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import type { ScenarioDef } from '../scenarios/types'
import { Label } from './ui'

export function ScenarioPicker({ scenarios, current, onSelect }: { scenarios: ScenarioDef[]; current: string; onSelect: (id: string) => void }) {
  const head = scenarios.filter((s) => s.headliner)
  const rest = scenarios.filter((s) => !s.headliner && s.id !== 'chaos')
  const chaos = scenarios.find((s) => s.id === 'chaos')!
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2">Start here</Label>
        <div className="flex flex-col gap-2">
          {head.map((s) => {
            const active = s.id === current
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                aria-pressed={active}
                className={`group relative w-full rounded-xl border p-3 text-left transition-colors ${
                  active ? 'border-new bg-panel shadow-panel' : 'border-line bg-panel/60 hover:border-line-2 hover:bg-panel'
                }`}
              >
                {active && (
                  <motion.span layoutId="picker-bar" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-new" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold ${
                      active ? 'bg-new text-white' : 'bg-panel-2 text-ink-2'
                    }`}
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold leading-[18px] tracking-tight">{s.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-4 text-ink-2">{s.tagline}</div>
                    <div className="mt-1.5 text-[10.5px] leading-4 text-ink-3">
                      <span className="text-new">proves</span> {s.proves}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Label className="mb-2">More cases</Label>
        <div className="overflow-hidden rounded-xl border border-line bg-panel/60">
          {rest.map((s, i) => {
            const active = s.id === current
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-panel ${
                  i > 0 ? 'border-t border-line' : ''
                } ${active ? 'bg-panel' : ''}`}
              >
                <span className={`font-mono text-[11px] font-bold ${active ? 'text-new' : 'text-ink-3'}`}>{s.n}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12.5px] leading-4 ${active ? 'font-semibold' : 'font-medium'}`}>{s.title}</span>
                  <span className="block truncate text-[10.5px] leading-4 text-ink-3">{s.proves}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={() => onSelect(chaos.id)}
        aria-pressed={current === chaos.id}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          current === chaos.id ? 'border-bad bg-bad-soft' : 'border-dashed border-line-2 bg-panel/60 hover:border-bad hover:bg-panel'
        }`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-bad text-white">
          <Flame size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-4">{chaos.title}</span>
          <span className="block text-[11px] leading-4 text-ink-2">{chaos.tagline}</span>
        </span>
      </button>
    </div>
  )
}

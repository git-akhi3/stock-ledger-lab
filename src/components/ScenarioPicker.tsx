import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ScenarioDef } from '../scenarios/types'

export function ScenarioPicker({ scenarios, current, onSelect }: { scenarios: ScenarioDef[]; current: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const main = scenarios.filter((s) => s.headliner)
  const more = scenarios.filter((s) => !s.headliner)
  const currentMore = more.find((s) => s.id === current)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const pill = (active: boolean) =>
    `flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors ${
      active ? 'border-ink bg-ink font-semibold text-ground' : 'border-line bg-panel font-medium text-ink-2 hover:border-line-2 hover:text-ink'
    }`

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-2">
        {main.map((s) => (
          <button key={s.id} className={pill(s.id === current)} onClick={() => onSelect(s.id)} aria-pressed={s.id === current}>
            <span className="font-mono text-[11px] opacity-60">{s.n}</span>
            {s.short}
          </button>
        ))}
        <button className={pill(!!currentMore)} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {currentMore ? (
            <>
              <span className="font-mono text-[11px] opacity-60">{currentMore.n}</span>
              {currentMore.short}
            </>
          ) : (
            'More stories'
          )}
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-11 z-40 w-[min(420px,100%)] overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
          {more.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id)
                setOpen(false)
              }}
              className={`flex w-full gap-3 px-4 py-2.5 text-left hover:bg-panel-2 ${i > 0 ? 'border-t border-line' : ''} ${s.id === current ? 'bg-panel-2' : ''}`}
            >
              <span className="mt-0.5 font-mono text-[11px] text-ink-3">{s.n}</span>
              <span>
                <span className="block text-[13px] font-semibold leading-5">{s.title}</span>
                <span className="block text-[12px] leading-4 text-ink-3">{s.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

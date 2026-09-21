import { Check, ChevronDown } from 'lucide-react'
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
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const tab = (active: boolean) =>
    `relative flex h-11 shrink-0 items-center gap-2 px-1 text-[14px] transition-colors ${
      active ? 'font-semibold text-ink' : 'font-medium text-ink-3 hover:text-ink'
    }`
  const underline = <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-ink" />

  return (
    <div ref={ref} className="relative border-b border-line">
      <nav className="no-scrollbar -mb-px flex gap-6 overflow-x-auto overflow-y-hidden" aria-label="Stories">
        {main.map((s) => {
          const active = s.id === current
          return (
            <button key={s.id} className={tab(active)} onClick={() => onSelect(s.id)} aria-current={active}>
              <span className={`tnum font-mono text-[11px] ${active ? 'text-ink-3' : 'text-line-2'}`}>0{s.n}</span>
              {s.short}
              {active && underline}
            </button>
          )
        })}
        <button className={tab(!!currentMore)} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
          {currentMore ? (
            <>
              <span className="tnum font-mono text-[11px] text-ink-3">0{currentMore.n}</span>
              {currentMore.short}
            </>
          ) : (
            'More stories'
          )}
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          {currentMore && underline}
        </button>
      </nav>

      {open && (
        <div role="menu" className="absolute right-0 top-[52px] z-40 w-[min(400px,100%)] overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-panel sm:left-auto">
          {more.map((s) => {
            const active = s.id === current
            return (
              <button
                key={s.id}
                role="menuitem"
                onClick={() => {
                  onSelect(s.id)
                  setOpen(false)
                }}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-panel-2 ${active ? 'bg-panel-2' : ''}`}
              >
                <span className="tnum mt-[3px] font-mono text-[11px] text-ink-3">0{s.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold leading-5 text-ink">{s.title}</span>
                  <span className="block text-[12.5px] leading-[18px] text-ink-3">{s.tagline}</span>
                </span>
                {active && <Check size={15} className="mt-0.5 text-ink-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

import type { ScenarioDef } from '../scenarios/types'

export function ScenarioStrip({ scenarios, current, onSelect }: { scenarios: ScenarioDef[]; current: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Scenarios" className="thin-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {scenarios.map((s) => {
          const active = s.id === current
          const chaos = s.id === 'chaos'
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              title={s.title}
              className={`flex h-8 shrink-0 items-center gap-2 rounded-full border pl-1 pr-3 text-[12.5px] transition-colors ${
                active
                  ? chaos
                    ? 'border-bad bg-bad text-white'
                    : 'border-ink bg-ink text-ground'
                  : 'border-line bg-panel text-ink-2 hover:border-line-2 hover:text-ink'
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-bold ${
                  active ? 'bg-white/15' : s.headliner ? 'bg-new-soft text-new-ink' : 'bg-panel-2 text-ink-3'
                }`}
              >
                {s.n}
              </span>
              <span className={active ? 'font-semibold' : 'font-medium'}>{s.short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

import { AnimatePresence } from 'framer-motion'
import { Code2, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DevicesPanel } from './components/DevicesPanel'
import { EventLog } from './components/EventLog'
import { LedgerTape } from './components/LedgerTape'
import { NewLane } from './components/NewLane'
import { OldLane } from './components/OldLane'
import { Sandbox } from './components/Sandbox'
import { ScenarioPicker } from './components/ScenarioPicker'
import { Transport } from './components/Transport'
import { TruthStrip } from './components/TruthStrip'
import { FlightLayer } from './fx/FlightLayer'
import { usePlayer } from './player/usePlayer'
import { SCENARIOS } from './scenarios'
import { DEFAULT_PARAMS, type Params } from './scenarios/types'

type Theme = 'light' | 'dark'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('sll-theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('sll-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [sandbox, setSandbox] = useState(false)
  const player = usePlayer('first-sale', params)
  const { snap } = player

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === ' ') {
        e.preventDefault()
        player.setPlaying((p) => !p)
      } else if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
      else if (e.key === 'r' || e.key === 'R') player.restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  const anchor = snap ? (snap.rows.find((r) => r.id === snap.derived.anchorId) ?? null) : null

  return (
    <div className="flex min-h-full flex-col">
      <FlightLayer />
      <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-new text-white">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 12h10M3 8h6M3 4h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-4 tracking-tight">Stock Ledger Lab</div>
            <div className="hidden truncate text-[11px] text-ink-3 sm:block">One ledger, two designs, and everything that goes wrong between them.</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setSandbox((s) => !s)}
              aria-pressed={sandbox}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                sandbox ? 'border-new bg-new-soft text-new-ink' : 'border-line bg-panel hover:bg-panel-2'
              }`}
            >
              <SlidersHorizontal size={13} /> Sandbox
            </button>
            <button onClick={toggleTheme} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-panel hover:bg-panel-2" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <a
              href="https://github.com/git-akhi3/stock-ledger-lab"
              target="_blank"
              rel="noreferrer"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-panel hover:bg-panel-2"
              aria-label="Source on GitHub"
            >
              <Code2 size={14} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6">
        <div className={`grid gap-4 ${sandbox ? 'xl:grid-cols-[280px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[280px_minmax(0,1fr)]'} lg:grid-cols-[260px_minmax(0,1fr)]`}>
          <div className="lg:sticky lg:top-[60px] lg:self-start">
            <ScenarioPicker scenarios={SCENARIOS} current={player.scenarioId} onSelect={player.select} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {snap && (
              <>
                <div
                  className={`stage-grid grid gap-3 rounded-2xl border border-line bg-ground-2 p-3 md:grid-cols-2 ${
                    sandbox
                      ? '2xl:h-[440px] 2xl:grid-cols-[168px_232px_minmax(0,1fr)_minmax(0,1fr)]'
                      : 'xl:h-[440px] xl:grid-cols-[168px_232px_minmax(0,1fr)_minmax(0,1fr)]'
                  }`}
                >
                  <DevicesPanel devices={snap.devices} />
                  <LedgerTape rows={snap.rows} hiddenCount={snap.hiddenCount} anchorId={snap.derived.anchorId} />
                  <OldLane old={snap.old} rowCount={snap.hiddenCount + snap.rows.length} />
                  <NewLane nu={snap.nu} derived={snap.derived} anchor={anchor} />
                </div>
                <TruthStrip snap={snap} />
                <Transport
                  beats={player.beats}
                  beat={player.beat}
                  playing={player.playing}
                  snap={snap}
                  onPrev={player.prev}
                  onNext={player.next}
                  onToggle={() => player.setPlaying((p) => !p)}
                  onRestart={player.restart}
                  onGoTo={player.goTo}
                />
                <EventLog events={snap.events} />
              </>
            )}
          </div>

          <AnimatePresence>
            {sandbox && (
              <div className="fixed inset-x-4 bottom-4 top-[60px] z-40 xl:static xl:inset-auto xl:z-auto xl:h-[calc(100vh-92px)] xl:sticky xl:top-[60px]">
                <Sandbox params={params} onChange={setParams} snap={snap} onClose={() => setSandbox(false)} />
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[11px] text-ink-3 sm:px-6">
          <span>Illustrative simulation of a design document — not production data.</span>
          <span className="font-mono">reads $0.06 / 100k · writes $0.18 / 100k · aggregation 1 read per 1,000 index entries</span>
          <span className="ml-auto font-mono">space · ← → · R</span>
        </div>
      </footer>
    </div>
  )
}

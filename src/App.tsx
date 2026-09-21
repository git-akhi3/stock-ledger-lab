import { AnimatePresence } from 'framer-motion'
import { Code2, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sandbox } from './components/Sandbox'
import { ScenarioPicker } from './components/ScenarioPicker'
import { Stage } from './components/Stage'
import { UnderTheHood } from './components/UnderTheHood'
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

function Mark() {
  // a ledger: three ruled lines, the last one short
  return (
    <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-ink text-ground">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2.5 3.5h9M2.5 7h9M2.5 10.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [sandbox, setSandbox] = useState(false)
  const player = usePlayer('first-sale', params)
  const { snap } = player

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || sandbox) return
      if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player, sandbox])

  const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-ground-2 hover:text-ink'

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center gap-3 px-5 sm:px-8">
          <Mark />
          <span className="text-[14.5px] font-semibold tracking-[-0.01em]">Stock Ledger Lab</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => setSandbox(true)} className={iconBtn} aria-label="What if… settings" title="What if…">
              <SlidersHorizontal size={15} />
            </button>
            <button onClick={toggleTheme} className={iconBtn} aria-label="Toggle theme" title="Theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <a href="https://github.com/git-akhi3/stock-ledger-lab" target="_blank" rel="noreferrer" className={iconBtn} aria-label="Source code" title="Source code">
              <Code2 size={15} />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="max-w-[640px]">
          <h1 className="text-[32px] font-semibold leading-[38px] tracking-[-0.025em] [text-wrap:balance] sm:text-[38px] sm:leading-[44px]">
            Why the stock number goes wrong, and how to keep it right.
          </h1>
          <p className="mt-3 text-[16px] leading-[25px] text-ink-2 [text-wrap:pretty]">
            Pick a story and step through it. At every step, compare what each system shows with what’s really on the shelf.
          </p>
        </div>

        <div className="mt-10">
          <ScenarioPicker scenarios={SCENARIOS} current={player.scenarioId} onSelect={player.select} />
        </div>

        {snap && (
          <div className="mt-6 flex flex-col gap-6">
            <Stage
              scenario={player.scenario}
              beats={player.beats}
              beat={player.beat}
              snap={snap}
              playing={player.playing}
              onPrev={player.prev}
              onNext={player.next}
              onRestart={player.restart}
              onTogglePlay={() => player.setPlaying((p) => !p)}
              onGoTo={player.goTo}
            />
            <UnderTheHood snap={snap} />
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-2 px-5 py-5 text-[12.5px] text-ink-3 sm:px-8">
          <span>An illustrative simulation of a design document. Not real shop data.</span>
          <span className="hidden sm:inline">
            Use <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px]">←</kbd>{' '}
            <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px]">→</kbd> to step
          </span>
        </div>
      </footer>

      <AnimatePresence>
        {sandbox && (
          <div className="fixed inset-0 z-50 flex justify-end bg-ink/25 p-3 backdrop-blur-[2px]" onClick={() => setSandbox(false)}>
            <div className="h-full w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
              <Sandbox params={params} onChange={setParams} snap={snap} onClose={() => setSandbox(false)} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { AnimatePresence } from 'framer-motion'
import { Code2, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Compare } from './components/Compare'
import { Controls } from './components/Controls'
import { Sandbox } from './components/Sandbox'
import { ScenarioPicker } from './components/ScenarioPicker'
import { Story } from './components/Story'
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

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [sandbox, setSandbox] = useState(false)
  const player = usePlayer('first-sale', params)
  const { snap } = player

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'BUTTON') return
      if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  const iconBtn = 'grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-panel hover:text-ink'

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[960px] items-center gap-3 px-4 pb-2 pt-5 sm:px-6">
        <div>
          <div className="text-[17px] font-bold tracking-tight">Stock Ledger Lab</div>
          <div className="text-[13px] text-ink-3">How a shop’s stock number goes wrong today, and how the new design keeps it right.</div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button onClick={() => setSandbox((s) => !s)} className={iconBtn} aria-label="What if… settings" title="What if…">
            <SlidersHorizontal size={16} />
          </button>
          <button onClick={toggleTheme} className={iconBtn} aria-label="Toggle theme" title="Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a href="https://github.com/git-akhi3/stock-ledger-lab" target="_blank" rel="noreferrer" className={iconBtn} aria-label="Source code" title="Source code">
            <Code2 size={16} />
          </a>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-7 px-4 py-5 sm:px-6">
        <ScenarioPicker scenarios={SCENARIOS} current={player.scenarioId} onSelect={player.select} />

        {snap && (
          <>
            <div className="flex flex-col gap-5">
              <Story scenario={player.scenario} beats={player.beats} beat={player.beat} snap={snap} />
              <Controls
                beat={player.beat}
                total={player.beats.length}
                playing={player.playing}
                showAutoplay={player.scenario.id === 'chaos'}
                onPrev={player.prev}
                onNext={player.next}
                onToggle={() => player.setPlaying((p) => !p)}
                onRestart={player.restart}
              />
            </div>

            <Compare snap={snap} beat={player.beats[player.beat]} />

            <UnderTheHood snap={snap} />
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[960px] px-4 pb-6 pt-2 text-[12px] text-ink-3 sm:px-6">
        An illustrative simulation of a design document, not real shop data.
      </footer>

      <AnimatePresence>
        {sandbox && (
          <div className="fixed inset-0 z-50 flex justify-end bg-ink/20 p-3" onClick={() => setSandbox(false)}>
            <div className="h-full w-full max-w-[360px]" onClick={(e) => e.stopPropagation()}>
              <Sandbox params={params} onChange={setParams} snap={snap} onClose={() => setSandbox(false)} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

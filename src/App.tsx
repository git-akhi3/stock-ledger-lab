import { motion } from 'framer-motion'
import { Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { track } from './analytics'
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

/** Stories where a "what if" setting changes the outcome, and the question to ask. */
const HINTS: Record<string, string> = {
  'late-recount': 'What if till B’s clock is wrong?',
  'offline-flush': 'What if the till was offline for longer?',
  'flash-sale': 'What if there were 100× more shops?',
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
  const changed = JSON.stringify(params) !== JSON.stringify(DEFAULT_PARAMS)

  const openWhatIf = (source: string) => {
    setSandbox(true)
    track('what_if_opened', { source, story: player.scenarioId })
  }

  const changeParams = (p: Params) => {
    for (const k of Object.keys(p) as (keyof Params)[]) {
      if (p[k] !== params[k]) track('what_if_changed', { setting: k, value: p[k], story: player.scenarioId })
    }
    if (JSON.stringify(p) === JSON.stringify(DEFAULT_PARAMS) && changed) track('what_if_reset', { story: player.scenarioId })
    setParams(p)
  }

  const selectStory = (id: string, source: string) => {
    if (id !== player.scenarioId) track('story_selected', { story: id, from: player.scenarioId, source })
    player.select(id)
  }

  // one event per step shown, and one when a story is finished
  const lastStep = useRef('')
  useEffect(() => {
    const key = `${player.scenarioId}:${player.beat}`
    if (!snap || key === lastStep.current) return
    lastStep.current = key
    const total = player.beats.length
    track('step_viewed', { story: player.scenarioId, step: player.beat + 1, total_steps: total })
    if (player.beat === total - 1) track('story_completed', { story: player.scenarioId, total_steps: total })
  }, [player.scenarioId, player.beat, player.beats.length, snap])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sandbox) {
        if (e.key === 'Escape') setSandbox(false)
        return
      }
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player, sandbox])

  // no background scrolling behind the drawer
  useEffect(() => {
    document.body.style.overflow = sandbox ? 'hidden' : ''
  }, [sandbox])

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center gap-3 px-5 sm:px-8">
          <Mark />
          <span className="text-[14.5px] font-semibold tracking-[-0.01em]">Stock Ledger Lab</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => openWhatIf('header')}
              className="group relative flex h-9 items-center gap-2 rounded-full border border-new/30 bg-new-soft pl-2 pr-3.5 text-[13px] font-semibold text-new-ink shadow-[0_1px_0_rgb(0_0_0/0.03)] transition-colors hover:border-new/60"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-new text-white">
                <SlidersHorizontal size={12} strokeWidth={2.5} />
              </span>
              What if…
              {changed && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-ground bg-new" aria-label="Settings changed" />}
            </button>
            <button
              onClick={() => {
                toggleTheme()
                track('theme_changed', { theme: theme === 'dark' ? 'light' : 'dark' })
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-ground-2 hover:text-ink"
              aria-label="Toggle theme"
              title="Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-5 pb-28 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
        <div className="max-w-[640px]">
          <h1 className="text-[30px] font-semibold leading-[36px] tracking-[-0.025em] [text-wrap:balance] sm:text-[38px] sm:leading-[44px]">
            Why the stock number goes wrong, and how to keep it right.
          </h1>
          <p className="mt-3 text-[15.5px] leading-[24px] text-ink-2 [text-wrap:pretty] sm:text-[16px] sm:leading-[25px]">
            Pick a story and step through it. At every step, compare what each system shows with what’s really on the shelf. Use{' '}
            <button onClick={() => openWhatIf('intro')} className="font-semibold text-new-ink underline decoration-new/40 underline-offset-[3px] hover:decoration-new">
              What if…
            </button>{' '}
            to change the conditions.
          </p>
        </div>

        <div className="mt-9 sm:mt-10">
          <ScenarioPicker scenarios={SCENARIOS} current={player.scenarioId} onSelect={(id) => selectStory(id, 'tabs')} />
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
              onRestart={() => {
                track('story_restarted', { story: player.scenarioId })
                player.restart()
              }}
              onTogglePlay={() => {
                track('autoplay_toggled', { story: player.scenarioId, playing: !player.playing })
                player.setPlaying((p) => !p)
              }}
              onGoTo={player.goTo}
              hint={HINTS[player.scenarioId]}
              onHint={() => openWhatIf('story_hint')}
            />
            <UnderTheHood snap={snap} onToggle={(open) => track('under_the_hood_toggled', { open, story: player.scenarioId })} />
          </div>
        )}
      </main>

      <footer className="border-t border-line pb-20 sm:pb-0">
        <div className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-2 px-5 py-5 text-[12.5px] text-ink-3 sm:px-8">
          <span>An illustrative simulation of a design document. Not real shop data.</span>
          <span className="hidden sm:inline">
            Use <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px]">←</kbd>{' '}
            <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px]">→</kbd> to step
          </span>
        </div>
      </footer>

      {/* closes instantly on purpose: nothing should block the page while it animates away */}
      {sandbox && (
          <motion.div
            key="whatif"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px] sm:p-3"
            onClick={() => setSandbox(false)}
          >
            <div className="h-full w-full sm:max-w-[400px]" onClick={(e) => e.stopPropagation()}>
              <Sandbox
                params={params}
                onChange={changeParams}
                onClose={() => setSandbox(false)}
                current={player.scenarioId}
                onShow={(id) => {
                  selectStory(id, 'what_if')
                  setSandbox(false)
                }}
              />
            </div>
          </motion.div>
        )}
    </div>
  )
}

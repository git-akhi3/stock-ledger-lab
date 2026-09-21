import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Code2, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { LaneCard, type Station } from './components/LaneCard'
import { LedgerStrip } from './components/LedgerStrip'
import { Sandbox } from './components/Sandbox'
import { ScenarioStrip } from './components/ScenarioStrip'
import { Story } from './components/Story'
import { Label } from './components/ui'
import { BUCKET_SECONDS, fmtInt, fmtNum, fmtT } from './engine/engine'
import type { Snapshot } from './engine/types'
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

function oldStations(s: Snapshot): Station[] {
  const w = s.old.workers
  const lw = s.old.lastWriter
  return [
    { label: 'PubSub sync', value: w.pubsub === 'running' ? 'replaying every row…' : 'idle', state: w.pubsub === 'running' ? 'active' : 'muted' },
    { label: 'Cron replay', value: w.cron === 'running' ? 'replaying every row…' : 'idle', state: w.cron === 'running' ? 'active' : 'muted' },
    { label: 'Last writer to the field', value: lw, state: lw.startsWith('POS') ? 'bad' : lw === 'console' ? 'warn' : 'active' },
    {
      label: 'Writes to item doc (10 s)',
      value: `${fmtInt(s.old.docWrites)} · cap ≈ 10`,
      state: s.old.docWrites > 10 ? 'bad' : s.old.docWrites > 5 ? 'warn' : 'muted',
    },
  ]
}

function newStations(s: Snapshot): Station[] {
  const n = s.nu
  const d = s.derived
  const anchor = s.rows.find((r) => r.id === d.anchorId)
  const ghost = Math.abs(d.plain - d.value) > 0.0005
  return [
    {
      label: 'onWrite · normalize',
      value: n.quarantined > 0 ? `${n.quarantined} quarantined` : d.missing > 0 ? `${d.missing} row unstamped` : 'every row stamped',
      state: n.quarantined > 0 ? 'bad' : d.missing > 0 ? 'warn' : 'muted',
    },
    {
      label: `Cloud Task · ${BUCKET_SECONDS} s bucket`,
      value: n.queuePending ? `queued · ${n.dedupes} deduped` : `${n.recomputes} fired · ${n.dedupes} deduped`,
      state: n.queuePending ? 'active' : 'muted',
      progress: n.queuePending ? 1 : 0,
    },
    {
      label: 'Anchor',
      value: anchor ? `${fmtNum((anchor.countedMilli ?? 0) / 1000)} @ ${fmtT(anchor.eventTime)}` : 'none · full sum',
      state: anchor ? 'active' : 'muted',
    },
    ...(ghost ? [{ label: 'Plain sum, no anchor', value: `${fmtNum(d.plain)} — wrong`, state: 'bad' as const }] : []),
    {
      label: 'Monotonic guard',
      value: n.foreignFlag ? 'foreign write caught' : `${n.guardRejects} stale rejected · computedAt ${n.computedAt >= 0 ? fmtT(n.computedAt) : '—'}`,
      state: n.foreignFlag ? 'bad' : 'muted',
    },
    { label: 'Invariant', value: n.invariantOk ? 'holds' : 'broken', state: n.invariantOk ? 'good' : 'bad' },
  ]
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [sandbox, setSandbox] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
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

  const lastOld = useMemo(() => snap?.events.filter((e) => e.lane === 'old').at(-1), [snap])
  const lastNew = useMemo(() => snap?.events.filter((e) => e.lane === 'new').at(-1), [snap])

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-new text-white">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 12h10M3 8h6M3 4h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-4 tracking-tight">Stock Ledger Lab</div>
            <div className="hidden truncate text-[11px] text-ink-3 sm:block">Two ways to derive one stock number, side by side.</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setSandbox((s) => !s)}
              aria-pressed={sandbox}
              className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                sandbox ? 'border-new bg-new-soft text-new-ink' : 'border-line bg-panel hover:bg-panel-2'
              }`}
            >
              <SlidersHorizontal size={13} /> What if…
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

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 sm:px-6">
        <div className={`grid gap-5 ${sandbox ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
          <div className="flex min-w-0 flex-col gap-5">
            <ScenarioStrip scenarios={SCENARIOS} current={player.scenarioId} onSelect={player.select} />

            {snap && (
              <>
                <Story scenario={player.scenario} beats={player.beats} beat={player.beat} snap={snap} onGoTo={player.goTo} />

                <Controls
                  beat={player.beat}
                  total={player.beats.length}
                  playing={player.playing}
                  onPrev={player.prev}
                  onNext={player.next}
                  onToggle={() => player.setPlaying((p) => !p)}
                  onRestart={player.restart}
                />

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <div className="flex items-baseline gap-2 rounded-full border border-line bg-panel px-3.5 py-1.5">
                    <Label>Shelf holds</Label>
                    <span className="tnum font-mono text-[15px] font-bold">{fmtNum(snap.truth)}</span>
                    <span className="text-[11px] text-ink-3">physical truth</span>
                  </div>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <LaneCard
                    tone="old"
                    eyebrow="Today"
                    title="Replay the whole ledger, four writers race"
                    value={snap.old.value}
                    truth={snap.truth}
                    last={lastOld}
                    stations={oldStations(snap)}
                    reads={snap.old.reads}
                    writes={snap.old.writes}
                  />
                  <LaneCard
                    tone="new"
                    eyebrow="Proposed"
                    title="Sum the deltas, one guarded writer"
                    value={snap.nu.value}
                    truth={snap.truth}
                    last={lastNew}
                    stations={newStations(snap)}
                    reads={snap.nu.reads}
                    writes={snap.nu.writes}
                  />
                </div>

                <LedgerStrip rows={snap.rows} hiddenCount={snap.hiddenCount} anchorId={snap.derived.anchorId} devices={snap.devices} />

                <div>
                  <button onClick={() => setLogOpen((o) => !o)} className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink" aria-expanded={logOpen}>
                    <ChevronDown size={14} className={`transition-transform ${logOpen ? 'rotate-180' : ''}`} />
                    Server log
                  </button>
                  {logOpen && (
                    <div className="mt-2 rounded-xl border border-line bg-panel px-4 py-3 font-mono text-[11px] leading-[18px]">
                      {snap.events.length === 0 && <div className="text-ink-3">quiet</div>}
                      {snap.events
                        .slice(-14)
                        .reverse()
                        .map((l, i) => (
                          <div key={`${l.t}-${i}`} className="flex gap-3">
                            <span className="w-[76px] shrink-0 text-ink-3">{fmtT(l.t)}</span>
                            <span className={`w-10 shrink-0 font-semibold ${l.lane === 'old' ? 'text-old' : l.lane === 'new' ? 'text-new' : 'text-ink-3'}`}>{l.lane}</span>
                            <span className={l.tone === 'bad' ? 'text-bad' : l.tone === 'good' ? 'text-good' : l.tone === 'warn' ? 'text-warn' : 'text-ink-2'}>{l.text}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <AnimatePresence>
            {sandbox && (
              <div className="fixed inset-x-4 bottom-4 top-[60px] z-40 xl:sticky xl:inset-auto xl:top-[60px] xl:z-auto xl:h-[calc(100vh-92px)]">
                <Sandbox params={params} onChange={setParams} snap={snap} onClose={() => setSandbox(false)} />
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[11px] text-ink-3 sm:px-6">
          <span>Illustrative simulation of a design document, not production data.</span>
          <span className="font-mono">reads $0.06 / 100k · writes $0.18 / 100k · aggregation 1 read per 1,000 index entries</span>
        </div>
      </footer>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Engine } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import { fxBus, type FX } from '../fx/bus'
import { scenarioById } from '../scenarios'
import type { Beat, Params, ScenarioDef } from '../scenarios/types'

interface Built {
  def: ScenarioDef
  beats: Beat[]
  seed: (e: Engine) => void
}

export function usePlayer(initialId: string, params: Params) {
  const [scenarioId, setScenarioId] = useState(initialId)
  const [beat, setBeat] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const timers = useRef<number[]>([])
  const builtRef = useRef<Built | null>(null)
  const beatRef = useRef(0)

  const built = useMemo<Built>(() => {
    const def = scenarioById(scenarioId)
    const { seed, beats } = def.build(params)
    return { def, seed, beats }
  }, [scenarioId, params])
  builtRef.current = built

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t)
    timers.current = []
  }

  const publish = useCallback(() => {
    if (engineRef.current) setSnap(engineRef.current.snapshot())
  }, [])

  const runBeat = useCallback(
    (i: number, live: boolean) => {
      const e = engineRef.current!
      const b = builtRef.current!.beats[i]
      if (!b) return
      const fx: FX = live
        ? {
            emit: (c) => fxBus.emit(c),
            after: (ms, fn) => {
              const t = window.setTimeout(() => {
                fn()
                publish()
              }, ms)
              timers.current.push(t)
            },
          }
        : { emit: () => {}, after: (_ms, fn) => fn() }
      b.run(e, fx)
    },
    [publish],
  )

  /** Rebuild from scratch up to (not including) beat i, then run i live. */
  const goTo = useCallback(
    (i: number, fromScratch: boolean) => {
      clearTimers()
      const bt = builtRef.current!
      const target = Math.max(0, Math.min(i, bt.beats.length - 1))
      if (fromScratch || !engineRef.current || target <= beatRef.current) {
        const e = new Engine()
        bt.seed(e)
        engineRef.current = e
        for (let k = 0; k < target; k++) runBeat(k, false)
      } else {
        for (let k = beatRef.current + 1; k < target; k++) runBeat(k, false)
      }
      beatRef.current = target
      setBeat(target)
      runBeat(target, true)
      publish()
    },
    [runBeat, publish],
  )

  // load scenario / params change
  useEffect(() => {
    goTo(0, true)
    setPlaying(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  // autoplay
  useEffect(() => {
    if (!playing) return
    const b = built.beats[beat]
    if (!b) return
    if (beat >= built.beats.length - 1) {
      const t = window.setTimeout(() => setPlaying(false), b.duration)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => goTo(beat + 1, false), b.duration)
    return () => window.clearTimeout(t)
  }, [playing, beat, built, goTo])

  useEffect(() => () => clearTimers(), [])

  const next = useCallback(() => {
    if (beatRef.current < built.beats.length - 1) goTo(beatRef.current + 1, false)
  }, [built, goTo])
  const prev = useCallback(() => {
    if (beatRef.current > 0) goTo(beatRef.current - 1, true)
  }, [goTo])
  const restart = useCallback(() => {
    goTo(0, true)
    setPlaying(true)
  }, [goTo])
  const select = useCallback((id: string) => {
    setScenarioId(id)
  }, [])

  return {
    scenario: built.def,
    beats: built.beats,
    beat,
    playing,
    snap,
    setPlaying,
    next,
    prev,
    restart,
    goTo: (i: number) => goTo(i, true),
    select,
    scenarioId,
  }
}

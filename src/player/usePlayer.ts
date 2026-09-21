import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Engine } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import { scenarioById } from '../scenarios'
import type { Params } from '../scenarios/types'

/**
 * Steps through a scenario. Every step is applied instantly and completely,
 * so one click is exactly one change — nothing moves on its own afterwards.
 */
export function usePlayer(initialId: string, params: Params) {
  const [scenarioId, setScenarioId] = useState(initialId)
  const [beat, setBeat] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const beatRef = useRef(0)

  const built = useMemo(() => {
    const def = scenarioById(scenarioId)
    return { def, ...def.build(params) }
  }, [scenarioId, params])

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(i, built.beats.length - 1))
      let e = engineRef.current
      if (!e || target <= beatRef.current) {
        e = new Engine()
        built.seed(e)
        engineRef.current = e
        for (let k = 0; k <= target; k++) built.beats[k].run(e)
      } else {
        for (let k = beatRef.current + 1; k <= target; k++) built.beats[k].run(e)
      }
      beatRef.current = target
      setBeat(target)
      setSnap(e.snapshot())
    },
    [built],
  )

  useEffect(() => {
    engineRef.current = null
    beatRef.current = 0
    goTo(0)
    setPlaying(built.def.id === 'chaos')
  }, [built, goTo])

  useEffect(() => {
    if (!playing) return
    if (beat >= built.beats.length - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => goTo(beat + 1), built.beats[beat].duration ?? 2500)
    return () => window.clearTimeout(t)
  }, [playing, beat, built, goTo])

  const next = useCallback(() => goTo(beatRef.current + 1), [goTo])
  const prev = useCallback(() => {
    if (beatRef.current > 0) goTo(beatRef.current - 1)
  }, [goTo])
  const restart = useCallback(() => {
    engineRef.current = null
    goTo(0)
  }, [goTo])

  return {
    scenario: built.def,
    beats: built.beats,
    // for one render after switching stories the old step index can overrun the new story
    beat: Math.min(beat, built.beats.length - 1),
    playing,
    snap,
    setPlaying,
    next,
    prev,
    restart,
    goTo,
    select: setScenarioId,
    scenarioId,
  }
}

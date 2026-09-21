import type { Engine } from '../engine/engine'
import type { Snapshot } from '../engine/types'
import type { FX } from '../fx/bus'

export interface Params {
  scale: 1 | 10 | 100
  clockSkewHours: number
  burstSize: number
}

export const DEFAULT_PARAMS: Params = { scale: 1, clockSkewHours: 0, burstSize: 480 }

export interface Beat {
  /** headline shown under the stage */
  caption: string | ((s: Snapshot) => string)
  /** optional one-liner in smaller type */
  detail?: string | ((s: Snapshot) => string)
  duration: number
  run: (e: Engine, fx: FX) => void
}

export interface DeviceSeed {
  id: string
  label: string
  kind: 'pos' | 'console'
  online: boolean
  held: number
  cached: number | null
}

export interface ScenarioDef {
  id: string
  n: number
  title: string
  tagline: string
  headliner: boolean
  /** short label of what the scenario proves */
  proves: string
  build: (p: Params) => { seed: (e: Engine) => void; beats: Beat[] }
}

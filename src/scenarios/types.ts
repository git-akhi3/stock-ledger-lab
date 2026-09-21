import type { Engine } from '../engine/engine'
import type { Snapshot } from '../engine/types'

export interface Params {
  scale: 1 | 10 | 100
  clockSkewHours: number
  burstSize: number
}

export const DEFAULT_PARAMS: Params = { scale: 1, clockSkewHours: 0, burstSize: 480 }

export type Text = string | ((s: Snapshot) => string)

export interface Beat {
  /** what happened in the shop, in one sentence */
  caption: Text
  /** optional second sentence of context */
  detail?: Text
  /** why today's system shows what it shows */
  old?: Text
  /** why the new design shows what it shows */
  nu?: Text
  /** auto-play time on this step, ms */
  duration?: number
  run: (e: Engine) => void
}

export interface ScenarioDef {
  id: string
  n: number
  /** two-word label for the picker */
  short: string
  title: string
  tagline: string
  headliner: boolean
  build: (p: Params) => { seed: (e: Engine) => void; beats: Beat[] }
}

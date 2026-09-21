export type Tone = 'old' | 'new' | 'bad' | 'good' | 'warn' | 'ink'

export type Cue =
  | {
      type: 'fly'
      from: string
      to: string
      count?: number
      tone?: Tone
      stagger?: number
      /** bounce back off the target (a rejected write) */
      bounce?: boolean
      duration?: number
      size?: number
    }
  | { type: 'shake'; target: string }
  | { type: 'pulse'; target: string; tone?: Tone }
  | { type: 'burst'; at: string; tone?: Tone; count?: number }

type Listener = (cue: Cue) => void

class FxBus {
  private listeners = new Set<Listener>()
  on(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  emit(cue: Cue) {
    for (const l of this.listeners) l(cue)
  }
}

export const fxBus = new FxBus()

/** Handed to scenario beats. In "instant" mode (rebuilding state), cues are dropped and timers run at once. */
export interface FX {
  emit(cue: Cue): void
  after(ms: number, fn: () => void): void
}

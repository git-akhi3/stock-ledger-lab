import { useEffect, useState } from 'react'
import { fxBus, type Tone } from './bus'

/** Subscribe a DOM target (by data-fx id) to shake / pulse cues. */
export function useCue(target: string) {
  const [shakeKey, setShakeKey] = useState(0)
  const [pulse, setPulse] = useState<{ tone: Tone; key: number } | null>(null)
  useEffect(() => {
    return fxBus.on((c) => {
      if (c.type === 'shake' && c.target === target) setShakeKey((k) => k + 1)
      if (c.type === 'pulse' && c.target === target) setPulse((p) => ({ tone: c.tone ?? 'new', key: (p?.key ?? 0) + 1 }))
    })
  }, [target])
  return { shakeKey, pulse }
}

export const toneVar: Record<Tone, string> = {
  old: 'var(--old)',
  new: 'var(--new)',
  bad: 'var(--bad)',
  good: 'var(--good)',
  warn: 'var(--warn)',
  ink: 'var(--ink)',
}

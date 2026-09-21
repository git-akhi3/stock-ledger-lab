import { useEffect, useRef, useState } from 'react'
import { fmtNum } from '../engine/engine'

/**
 * Shows a number. Small changes tick through the in-between values so the eye
 * can follow them; big changes snap, because counting 12 → 600 is noise.
 */
export function Odometer({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  useEffect(() => {
    const from = shownRef.current
    const diff = value - from
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!Number.isFinite(value) || !Number.isFinite(from) || Math.abs(diff) > 20 || Math.abs(diff) < 1 || reduced) {
      shownRef.current = value
      setShown(value)
      return
    }
    const steps = Math.abs(Math.round(diff))
    const stepMs = Math.min(60, 360 / steps)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      const v = i >= steps ? value : from + Math.sign(diff) * i
      shownRef.current = v
      setShown(v)
      if (i >= steps) window.clearInterval(id)
    }, stepMs)
    return () => {
      window.clearInterval(id)
      shownRef.current = value
    }
  }, [value])
  return <span className={className}>{fmtNum(shown)}</span>
}

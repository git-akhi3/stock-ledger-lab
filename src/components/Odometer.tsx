import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { fmtNum } from '../engine/engine'

export function Odometer({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  const mv = useMotionValue(value)
  const spring = useSpring(mv, { stiffness: 170, damping: 22, mass: 0.6 })
  const text = useTransform(spring, (v) => {
    if (!Number.isFinite(v)) return String(v)
    const rounded = decimals ? Number(v.toFixed(decimals)) : Math.round(v)
    return fmtNum(rounded)
  })
  useEffect(() => {
    const cur = mv.get()
    if (!Number.isFinite(value) || Math.abs(value - cur) > 100_000) {
      mv.jump(value)
      spring.jump(value)
    } else {
      mv.set(value)
    }
  }, [value, mv, spring])
  return <motion.span className={className}>{text}</motion.span>
}

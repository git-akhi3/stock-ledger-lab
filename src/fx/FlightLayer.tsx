import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { fxBus, type Tone } from './bus'
import { toneVar } from './useCue'

interface Particle {
  id: number
  xs: number[]
  ys: number[]
  color: string
  size: number
  duration: number
  delay: number
  bounce: boolean
}
interface Spark {
  id: number
  x: number
  y: number
  color: string
  dx: number
  dy: number
}

function center(id: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-fx="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function arc(a: { x: number; y: number }, b: { x: number; y: number }, wobble: number) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const bend = Math.min(90, len * 0.25) * wobble
  const cx = mx + nx * bend
  const cy = my + ny * bend
  const xs: number[] = []
  const ys: number[] = []
  const N = 8
  for (let i = 0; i <= N; i++) {
    const t = i / N
    xs.push((1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x)
    ys.push((1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y)
  }
  return { xs, ys }
}

export function FlightLayer() {
  const [particles, setParticles] = useState<Particle[]>([])
  const [sparks, setSparks] = useState<Spark[]>([])
  const seq = useRef(0)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return fxBus.on((c) => {
      if (reduced.current) return
      if (c.type === 'fly') {
        const a = center(c.from)
        const b = center(c.to)
        if (!a || !b) return
        const count = Math.min(c.count ?? 1, 48)
        const color = toneVar[(c.tone ?? 'ink') as Tone]
        const batch: Particle[] = []
        for (let i = 0; i < count; i++) {
          const wobble = (Math.random() - 0.5) * 2 * (count > 1 ? 1.4 : 0.8)
          const jitterA = { x: a.x + (Math.random() - 0.5) * 18, y: a.y + (Math.random() - 0.5) * 18 }
          const jitterB = { x: b.x + (Math.random() - 0.5) * 26, y: b.y + (Math.random() - 0.5) * 26 }
          const { xs, ys } = arc(jitterA, jitterB, wobble)
          batch.push({
            id: ++seq.current,
            xs,
            ys,
            color,
            size: c.size ?? 8,
            duration: (c.duration ?? 800) / 1000,
            delay: (i * (c.stagger ?? 0)) / 1000,
            bounce: !!c.bounce,
          })
        }
        setParticles((p) => [...p, ...batch])
        const ttl = (c.duration ?? 800) + count * (c.stagger ?? 0) + 900
        window.setTimeout(() => {
          const ids = new Set(batch.map((x) => x.id))
          setParticles((p) => p.filter((x) => !ids.has(x.id)))
        }, ttl)
      }
      if (c.type === 'burst') {
        const at = center(c.at)
        if (!at) return
        const color = toneVar[(c.tone ?? 'new') as Tone]
        const n = c.count ?? 10
        const batch: Spark[] = []
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4
          const dist = 26 + Math.random() * 22
          batch.push({ id: ++seq.current, x: at.x, y: at.y, color, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist })
        }
        setSparks((s) => [...s, ...batch])
        window.setTimeout(() => {
          const ids = new Set(batch.map((x) => x.id))
          setSparks((s) => s.filter((x) => !ids.has(x.id)))
        }, 900)
      }
    })
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      <AnimatePresence>
        {particles.map((p) => {
          const last = p.xs.length - 1
          const xs = p.bounce ? [...p.xs, p.xs[last] * 0.6 + p.xs[0] * 0.4] : p.xs
          const ys = p.bounce ? [...p.ys, p.ys[last] * 0.6 + p.ys[0] * 0.4] : p.ys
          return (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                background: p.color,
                boxShadow: `0 0 0 3px color-mix(in oklab, ${p.color} 25%, transparent), 0 0 14px ${p.color}`,
              }}
              initial={{ x: xs[0], y: ys[0], opacity: 0, scale: 0.4 }}
              animate={{
                x: xs,
                y: ys,
                opacity: p.bounce ? [0, 1, 1, 1, 1, 1, 1, 1, 1, 0] : [0, 1, 1, 1, 1, 1, 1, 1, 0.9],
                scale: p.bounce ? [0.4, 1, 1, 1, 1, 1, 1, 1, 1.3, 0.2] : [0.4, 1, 1, 1, 1, 1, 1, 1, 0.6],
              }}
              transition={{ duration: p.duration * (p.bounce ? 1.5 : 1), delay: p.delay, ease: 'easeInOut' }}
            />
          )
        })}
        {sparks.map((s) => (
          <motion.div
            key={s.id}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: s.color, left: s.x, top: s.y }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: s.dx, y: s.dy, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

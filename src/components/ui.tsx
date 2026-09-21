import type { ReactNode } from 'react'

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3 ${className}`}>{children}</div>
}

export function Chip({
  children,
  tone = 'ink',
  className = '',
  title,
}: {
  children: ReactNode
  tone?: 'ink' | 'old' | 'new' | 'bad' | 'good' | 'warn'
  className?: string
  title?: string
}) {
  const map = {
    ink: 'bg-panel-2 text-ink-2 border-line',
    old: 'bg-old-soft text-old-ink border-transparent',
    new: 'bg-new-soft text-new-ink border-transparent',
    bad: 'bg-bad-soft text-bad border-transparent',
    good: 'bg-good-soft text-good border-transparent',
    warn: 'bg-warn-soft text-warn border-transparent',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-medium leading-4 ${map[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Panel({ children, className = '', ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <section className={`rounded-xl border border-line bg-panel shadow-panel ${className}`} {...rest}>
      {children}
    </section>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'old' | 'new' | 'bad' | 'good' }) {
  const color = tone === 'old' ? 'text-old' : tone === 'new' ? 'text-new' : tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-ink'
  return (
    <div className="flex flex-col gap-0.5">
      <Label>{label}</Label>
      <div className={`tnum font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  )
}

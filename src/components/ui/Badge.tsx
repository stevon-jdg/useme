import type { ReactNode } from 'react'

type Tone = 'neutral' | 'red' | 'yellow' | 'green' | 'dark'

const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink border-line',
  red: 'bg-brand-red-soft text-brand-red-dark border-brand-red/30',
  yellow: 'bg-brand-yellow-soft text-ink border-brand-yellow',
  green: 'bg-success-soft text-success border-success/30',
  dark: 'bg-ink text-white border-ink',
}

/** Small status label. Always carries text, so it never relies on color alone. */
export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}

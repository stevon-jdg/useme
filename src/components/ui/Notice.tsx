import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'error'

const tones: Record<Tone, { box: string; icon: ReactNode; label: string }> = {
  info: {
    box: 'border-line bg-surface text-ink',
    icon: <Info className="size-5 shrink-0" aria-hidden="true" />,
    label: 'Note',
  },
  success: {
    box: 'border-success/30 bg-success-soft text-ink',
    icon: <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />,
    label: 'Success',
  },
  warning: {
    box: 'border-brand-yellow bg-warning-soft text-ink',
    icon: <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />,
    label: 'Heads up',
  },
  error: {
    box: 'border-brand-red/40 bg-brand-red-soft text-ink',
    icon: <AlertTriangle className="size-5 shrink-0 text-brand-red" aria-hidden="true" />,
    label: 'Problem',
  },
}

/** Status message. The label is visible text, so meaning never depends on color alone. */
export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { box, icon, label } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-control border p-3.5 text-sm ${box}`}>
      {icon}
      <div>
        <p className="font-semibold">{label}</p>
        <div className="mt-0.5 text-ink-soft">{children}</div>
      </div>
    </div>
  )
}

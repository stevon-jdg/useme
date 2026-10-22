import { FlaskConical } from 'lucide-react'

/** Shown on any screen whose data is sample data, not real records. */
export function DemoBanner({ children }: { children?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-control border border-dashed border-ink/40 bg-brand-yellow-soft px-3 py-2 text-sm">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Demo data.</strong> {children ?? 'These records are samples for design review, not real activity.'}
      </p>
    </div>
  )
}

import { Hammer } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { Card } from './Card'

/** Honest placeholder for a screen that belongs to a later phase. It has no fake controls. */
export function ComingSoon({ title, phase, children }: { title: string; phase: string; children?: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} />
      <Card className="flex items-start gap-3">
        <Hammer className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden="true" />
        <div>
          <p className="font-semibold">Under development</p>
          <p className="mt-1 text-sm text-ink-soft">
            {children ?? 'This screen is not built yet.'} Planned for {phase}.
          </p>
        </div>
      </Card>
    </div>
  )
}

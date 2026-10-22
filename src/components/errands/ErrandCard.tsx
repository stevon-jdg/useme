import { ArrowRight, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { getCategory, getTransport } from '@/features/errands/catalog'
import { DEMO_STATUS_LABEL, type DemoErrand } from '@/lib/demo/demoData'
import { formatNaira } from '@/lib/formatting/money'

export function ErrandCard({
  errand,
  amount,
  amountLabel,
  action,
}: {
  errand: DemoErrand
  amount: number
  amountLabel: string
  action?: React.ReactNode
}) {
  const category = getCategory(errand.category)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{category.label}</p>
          <h3 className="mt-0.5 text-base font-bold">{errand.title}</h3>
        </div>
        <Badge tone={errand.status === 'completed' ? 'green' : errand.status === 'searching' ? 'yellow' : 'dark'}>
          {DEMO_STATUS_LABEL[errand.status]}
        </Badge>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
        <MapPin className="size-4 shrink-0" aria-hidden="true" />
        {errand.pickupArea}
        {errand.destinationArea ? (
          <>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            {errand.destinationArea}
          </>
        ) : null}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {errand.distanceKm} km · {getTransport(errand.transport).label}
        </p>
        <p className="text-right">
          <span className="block text-xs text-ink-soft">{amountLabel}</span>
          <span className="text-lg font-extrabold tabular-nums">{formatNaira(amount)}</span>
        </p>
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  )
}

import { formatNaira } from '@/lib/formatting/money'
import type { PriceBreakdown as Breakdown } from '@/features/pricing/pricing'

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${strong ? 'font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-ink-soft'}>{label}</dt>
      <dd className="tabular-nums">{formatNaira(value)}</dd>
    </div>
  )
}

/** Itemised estimate. The shopping budget is shown on its own line below the service total. */
export function PriceBreakdown({ price }: { price: Breakdown }) {
  return (
    <div>
      <dl className="divide-y divide-line text-sm">
        <Row label="Base fee" value={price.baseFee} />
        <Row label="Distance" value={price.distanceCharge} />
        <Row label="Task fee" value={price.taskFee} />
        {price.extraStopsCharge > 0 ? <Row label="Extra stops" value={price.extraStopsCharge} /> : null}
        <Row label="Platform fee" value={price.platformFee} />
      </dl>
      <div className="mt-2 rounded-control bg-brand-yellow-soft px-3 text-base">
        <dl>
          <Row label="Estimated service cost" value={price.serviceTotal} strong />
        </dl>
      </div>
      {price.shoppingBudget > 0 ? (
        <dl className="mt-2 px-3 text-sm">
          <Row label="Shopping budget (separate, paid to the runner for items)" value={price.shoppingBudget} />
        </dl>
      ) : null}
    </div>
  )
}

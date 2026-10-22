import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatNaira } from '@/lib/formatting/money'
import { fetchEarnings } from './dispatchApi'

export function EarningsPage() {
  const { configured } = useAuth()
  const q = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings, enabled: configured })
  const e = q.data

  const rows = [
    { label: 'Today', value: formatNaira(e?.today_net_kobo ?? 0), sub: `${e?.today_jobs ?? 0} errands` },
    { label: 'Last 7 days', value: formatNaira(e?.week_net_kobo ?? 0), sub: '' },
    { label: 'All time', value: formatNaira(e?.total_net_kobo ?? 0), sub: `${e?.total_jobs ?? 0} errands` },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Earnings" subtitle="What you keep after UseMe's fee." />
      {q.error ? <Notice tone="error">We could not load your earnings.</Notice> : null}
      {rows.map((r) => (
        <Card key={r.label} className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-soft">{r.label}</p>
            {r.sub ? <p className="text-xs text-ink-soft">{r.sub}</p> : null}
          </div>
          <p className="text-2xl font-extrabold tabular-nums">{r.value}</p>
        </Card>
      ))}
      <Card>
        <p className="text-sm text-ink-soft">Rating</p>
        <p className="text-xl font-extrabold">{e?.rating_avg ? `${e.rating_avg} ★ from ${e.rating_count} rating${e.rating_count === 1 ? '' : 's'}` : 'No ratings yet'}</p>
      </Card>
      <Notice tone="info">Customers pay cash for now. The fee UseMe takes is tracked, and payouts and fee settlement come with the payments phase.</Notice>
    </div>
  )
}

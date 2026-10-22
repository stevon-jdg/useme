import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchMyErrands, OPEN_STATUSES, STATUS_LABEL } from '@/features/errands/rideApi'
import { formatNaira } from '@/lib/formatting/money'

export function HistoryPage() {
  const { configured } = useAuth()
  const errands = useQuery({ queryKey: ['my-errands'], queryFn: fetchMyErrands, enabled: configured })

  return (
    <div className="space-y-4">
      <PageHeader title="Your errands" subtitle="Open errands first, then past ones." />
      {!configured ? <Notice tone="info">Not connected to Supabase yet.</Notice> : null}
      {errands.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {errands.error ? <Notice tone="error">We could not load your errands. Check your connection and try again.</Notice> : null}
      {errands.data && errands.data.length === 0 ? (
        <Card className="space-y-2 text-center">
          <p className="font-semibold">No errands yet.</p>
          <Link to="/app/errands/new" className="font-semibold text-brand-red underline">Request your first runner</Link>
        </Card>
      ) : null}
      {[...(errands.data ?? [])]
        .sort((a, b) => Number(OPEN_STATUSES.includes(b.status)) - Number(OPEN_STATUSES.includes(a.status)))
        .map((e) => (
          <Link key={e.id} to={`/app/errands/${e.id}`} className="block">
            <Card className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{e.title}</p>
                <p className="text-sm text-ink-soft">
                  {new Date(e.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · {e.pickup_area ?? 'Pickup'}
                  {e.destination_area ? ` to ${e.destination_area}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums">{formatNaira(e.agreed_fare_kobo ?? e.suggested_fare_kobo)}</p>
                <Badge tone={e.status === 'completed' ? 'green' : e.status === 'cancelled' ? 'neutral' : 'yellow'}>{STATUS_LABEL[e.status]}</Badge>
              </div>
            </Card>
          </Link>
        ))}
    </div>
  )
}

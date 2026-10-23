import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { STATUS_LABEL, OPEN_STATUSES } from '@/features/errands/rideApi'
import { db, unwrap } from '@/lib/supabase/db'
import { formatNaira } from '@/lib/formatting/money'

type Row = {
  id: string
  title: string
  status: keyof typeof STATUS_LABEL
  pickup_area: string | null
  destination_area: string | null
  suggested_fare_kobo: number
  agreed_fare_kobo: number | null
  created_at: string
  cancelled_reason: string | null
}

async function fetchAllErrands(): Promise<Row[]> {
  return unwrap(
    await db()
      .from('errands')
      .select('id, title, status, pickup_area, destination_area, suggested_fare_kobo, agreed_fare_kobo, created_at, cancelled_reason')
      .order('created_at', { ascending: false })
      .limit(200),
  ) as Row[]
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

export function AdminErrandsPage() {
  const { configured } = useAuth()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const errands = useQuery({ queryKey: ['admin-errands'], queryFn: fetchAllErrands, enabled: configured, refetchInterval: 15000 })

  const rows = (errands.data ?? []).filter((e) =>
    filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(e.status) : e.status === filter,
  )

  return (
    <div className="space-y-4">
      <PageHeader title="Errands" subtitle="Latest 200 errands across the platform." />
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter errands">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              filter === f.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {errands.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {errands.error ? <Notice tone="error">We could not load errands.</Notice> : null}
      {errands.data && rows.length === 0 ? <Card className="text-center text-ink-soft">Nothing here.</Card> : null}
      {rows.map((e) => (
        <Card key={e.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{e.title}</p>
            <p className="truncate text-sm text-ink-soft">
              {new Date(e.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
              {e.pickup_area ?? 'Pickup'}
              {e.destination_area ? ` to ${e.destination_area}` : ''}
            </p>
            {e.cancelled_reason ? <p className="truncate text-xs text-ink-soft">{e.cancelled_reason}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold tabular-nums">{formatNaira(e.agreed_fare_kobo ?? e.suggested_fare_kobo)}</p>
            <Badge tone={e.status === 'completed' ? 'green' : e.status === 'cancelled' ? 'neutral' : 'yellow'}>{STATUS_LABEL[e.status]}</Badge>
          </div>
        </Card>
      ))}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatNaira } from '@/lib/formatting/money'
import { db, unwrap } from '@/lib/supabase/db'

type Log = {
  id: number
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

async function load() {
  const client = db()
  const logs = unwrap(
    await client.from('audit_logs').select('id, actor_id, action, target_type, target_id, details, created_at').order('id', { ascending: false }).limit(100),
  ) as Log[]
  const ids = [...new Set(logs.map((l) => l.actor_id).filter((x): x is string => Boolean(x)))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const rows = unwrap(await client.from('profiles').select('id, full_name').in('id', ids)) as { id: string; full_name: string }[]
    rows.forEach((r) => names.set(r.id, r.full_name))
  }
  return { logs, names }
}

const LABEL: Record<string, string> = {
  pricing_update: 'Changed pricing',
  pricing_insert: 'Added a price',
  pricing_delete: 'Removed a price',
  settlement_recorded: 'Recorded a runner payment',
  report_resolved: 'Resolved a report',
}

function describe(l: Log): string {
  const d = l.details as { old?: Record<string, unknown> | null; new?: Record<string, unknown> | null; amount_kobo?: number }
  if (l.action === 'settlement_recorded' && typeof d.amount_kobo === 'number') return formatNaira(d.amount_kobo)
  if (l.action === 'pricing_update' && d.old && d.new) {
    const changes = Object.keys(d.new)
      .filter((k) => JSON.stringify(d.new?.[k]) !== JSON.stringify(d.old?.[k]))
      .map((k) => `${k.replace(/_kobo$/, '').replace(/_/g, ' ')}: ${String(d.old?.[k])} to ${String(d.new?.[k])}${k.endsWith('_kobo') ? ' kobo' : ''}`)
    return changes.join(', ')
  }
  return ''
}

export function AdminActivityPage() {
  const { configured } = useAuth()
  const q = useQuery({ queryKey: ['admin-activity'], queryFn: load, enabled: configured, refetchInterval: 30000 })

  return (
    <div className="space-y-4">
      <PageHeader title="Activity" subtitle="Latest 100 admin actions." />
      {q.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {q.error ? <Notice tone="error">We could not load the activity log.</Notice> : null}
      {q.data && q.data.logs.length === 0 ? <Card className="text-center text-ink-soft">Nothing yet.</Card> : null}
      {(q.data?.logs ?? []).map((l) => {
        const detail = describe(l)
        return (
          <Card key={l.id} className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">{LABEL[l.action] ?? l.action.replace(/_/g, ' ')}</p>
              <p className="shrink-0 text-xs text-ink-soft">
                {new Date(l.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <p className="text-sm text-ink-soft">
              {(l.actor_id && q.data?.names.get(l.actor_id)) || 'System'} · {l.target_type.replace(/_/g, ' ')}
              {l.target_id ? ` ${l.target_id.length > 12 ? l.target_id.slice(0, 8) : l.target_id}` : ''}
            </p>
            {detail ? <p className="break-words text-sm">{detail}</p> : null}
          </Card>
        )
      })}
    </div>
  )
}

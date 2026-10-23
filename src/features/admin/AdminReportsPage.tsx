import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchReports, REASONS, resolveReport, type AdminReport } from '@/features/support/supportApi'

function ReportCard({ r, onDone }: { r: AdminReport; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolve() {
    setBusy(true)
    setError(null)
    try {
      await resolveReport(r.id, note)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve this report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{r.errand_title}</p>
          <p className="text-sm text-ink-soft">
            {r.reporter_role}: {r.reporter_name}
            {r.reporter_phone ? ` · ${r.reporter_phone}` : ''}
          </p>
        </div>
        <Badge tone={r.status === 'open' ? 'yellow' : 'green'}>{r.status === 'open' ? 'Open' : 'Resolved'}</Badge>
      </div>
      <p className="text-sm font-semibold">{REASONS.find((x) => x.id === r.reason)?.label ?? r.reason}</p>
      {r.details ? <p className="break-words text-sm">{r.details}</p> : null}
      <p className="text-xs text-ink-soft">
        {new Date(r.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      {r.status === 'resolved' ? (
        <p className="rounded-xl bg-black/5 p-2 text-sm">{r.resolution_note}</p>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={600}
            rows={2}
            placeholder="How was this resolved?"
            aria-label="Resolution note"
            className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-base"
          />
          {error ? <p className="text-sm text-brand-red" role="alert">{error}</p> : null}
          <Button fullWidth loading={busy} onClick={() => void resolve()}>Mark resolved</Button>
        </div>
      )}
    </Card>
  )
}

export function AdminReportsPage() {
  const { configured } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-reports'], queryFn: fetchReports, enabled: configured, refetchInterval: 30000 })
  const open = (q.data ?? []).filter((r) => r.status === 'open').length

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle={q.data ? `${open} open` : 'Problems customers and runners have reported.'} />
      {q.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {q.error ? <Notice tone="error">We could not load reports.</Notice> : null}
      {q.data && q.data.length === 0 ? <Card className="text-center text-ink-soft">No reports.</Card> : null}
      {(q.data ?? []).map((r) => (
        <ReportCard key={r.id} r={r} onDone={() => void qc.invalidateQueries({ queryKey: ['admin-reports'] })} />
      ))}
    </div>
  )
}

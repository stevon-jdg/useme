import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import type { RunnerStatus } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'
import { DOCUMENT_LABEL, STATUS_INFO } from '@/features/runner/status'
import { signedDocumentUrl } from '@/services/files/uploadFile'
import { fetchApplications, reviewRunner, verifyCapability, type ApplicationRow, type ReviewDecision } from './adminApi'

const applicationsKey = ['admin', 'applications'] as const

const FILTERS: { id: string; label: string; statuses: RunnerStatus[] | null }[] = [
  { id: 'todo', label: 'To review', statuses: ['submitted', 'under_review', 'more_info_required'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'closed', label: 'Rejected or suspended', statuses: ['rejected', 'suspended'] },
  { id: 'all', label: 'All', statuses: null },
]

type Action = { decision: ReviewDecision; label: string; needsNote: boolean; variant?: 'primary' | 'secondary' | 'dark' }

const ACTIONS: Partial<Record<RunnerStatus, Action[]>> = {
  submitted: [
    { decision: 'under_review', label: 'Start review', needsNote: false, variant: 'dark' },
    { decision: 'approved', label: 'Approve', needsNote: false },
    { decision: 'more_info_required', label: 'Ask for more', needsNote: true, variant: 'secondary' },
    { decision: 'rejected', label: 'Reject', needsNote: true, variant: 'secondary' },
  ],
  under_review: [
    { decision: 'approved', label: 'Approve', needsNote: false },
    { decision: 'more_info_required', label: 'Ask for more', needsNote: true, variant: 'secondary' },
    { decision: 'rejected', label: 'Reject', needsNote: true, variant: 'secondary' },
  ],
  approved: [{ decision: 'suspended', label: 'Suspend', needsNote: true, variant: 'secondary' }],
  suspended: [{ decision: 'reinstated', label: 'Reinstate', needsNote: false }],
}

export function AdminRunnersPage() {
  const { configured } = useAuth()
  const [filterId, setFilterId] = useState('todo')
  const applications = useQuery({ queryKey: applicationsKey, queryFn: fetchApplications, enabled: configured })

  if (!configured) {
    return (
      <div className="space-y-4">
        <PageHeader title="Runner applications" />
        <Notice tone="warning">This screen needs the app to be connected to Supabase.</Notice>
      </div>
    )
  }

  const filter = FILTERS.find((item) => item.id === filterId) ?? FILTERS[0]
  const rows = (applications.data ?? []).filter((row) => !filter?.statuses || filter.statuses.includes(row.status))

  return (
    <div className="space-y-4">
      <PageHeader title="Runner applications" subtitle="Check the documents yourself before you approve anyone." />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === filterId}
            onClick={() => setFilterId(item.id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              item.id === filterId ? 'border-ink bg-ink text-white' : 'border-line bg-surface'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {applications.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {applications.error ? (
        <>
          <Notice tone="error">Could not load applications. {(applications.error as Error).message}</Notice>
          <Button onClick={() => void applications.refetch()}>Try again</Button>
        </>
      ) : null}
      {!applications.isLoading && !applications.error && rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-4 text-sm text-ink-soft">Nothing here.</p>
      ) : null}

      {rows.map((row) => (
        <ApplicationCard key={row.user_id} row={row} />
      ))}
    </div>
  )
}

function ApplicationCard({ row }: { row: ApplicationRow }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const info = STATUS_INFO[row.status]
  const actions = ACTIONS[row.status] ?? []

  async function decide(action: Action) {
    if (action.needsNote && note.trim().length < 3) {
      setError('Write a note first. The runner sees it.')
      return
    }
    if (
      (action.decision === 'approved' || action.decision === 'rejected' || action.decision === 'suspended') &&
      !window.confirm(`${action.label} ${row.legal_name}?`)
    ) {
      return
    }
    setBusy(action.decision)
    setError(null)
    try {
      await reviewRunner(row.user_id, action.decision, note)
      setNote('')
      await queryClient.invalidateQueries({ queryKey: applicationsKey })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleCapability(transportId: string, verified: boolean) {
    setBusy(`cap-${transportId}`)
    setError(null)
    try {
      await verifyCapability(row.user_id, transportId, verified)
      await queryClient.invalidateQueries({ queryKey: applicationsKey })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function openDocument(path: string) {
    // Open the tab first so the browser does not block it after the await.
    const tab = window.open('about:blank', '_blank')
    try {
      const url = await signedDocumentUrl(path)
      if (tab) tab.location.href = url
    } catch (err) {
      tab?.close()
      setError((err as Error).message)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{row.legal_name}</h2>
          <p className="text-sm text-ink-soft">
            {row.profile?.phone ?? 'No phone'} · born {row.date_of_birth}
          </p>
        </div>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>

      <p className="text-sm">
        <span className="text-ink-soft">Emergency contact: </span>
        {row.emergency_contact_name ?? 'none'} {row.emergency_contact_phone ?? ''}
      </p>

      <div>
        <p className="text-sm font-semibold">Transport</p>
        <ul className="mt-1 space-y-1">
          {row.capabilities.map((cap) => (
            <li key={cap.transport_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {cap.transport_id}
                {cap.plate_number ? ` · ${cap.plate_number}` : ''}
                {' · '}
                {cap.verified_at ? 'checked' : 'not checked'}
              </span>
              {row.status === 'approved' ? (
                <Button
                  variant="secondary"
                  loading={busy === `cap-${cap.transport_id}`}
                  onClick={() => void toggleCapability(cap.transport_id, !cap.verified_at)}
                >
                  {cap.verified_at ? 'Withdraw check' : 'Mark as checked'}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold">Documents</p>
        {row.documents.length === 0 ? (
          <p className="text-sm text-ink-soft">None uploaded.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {row.documents.map((doc) => (
              <li key={doc.id}>
                <Button variant="dark" onClick={() => void openDocument(doc.storage_path)}>
                  Open {DOCUMENT_LABEL[doc.kind] ?? doc.kind}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-ink-soft">Links expire after one minute. Opening a document is not logged yet.</p>
      </div>

      {row.review_note ? (
        <p className="rounded-control bg-canvas p-3 text-sm">
          <span className="font-semibold">Last note: </span>
          {row.review_note}
        </p>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {actions.length > 0 ? (
        <div className="space-y-3">
          {actions.some((action) => action.needsNote) ? (
            <label className="block text-sm font-medium">
              Note to the runner (needed to ask for more, reject or suspend)
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-control border border-line bg-surface px-3 py-2 text-base"
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.decision}
                variant={action.variant ?? 'primary'}
                loading={busy === action.decision}
                disabled={busy !== null}
                onClick={() => void decide(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  )
}

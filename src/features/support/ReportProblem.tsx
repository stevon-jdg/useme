import { Flag } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { reportProblem, REASONS } from './supportApi'

export function ReportProblem({ errandId }: { errandId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REASONS[0].id)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await reportProblem(errandId, reason, details)
      setDone(true)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your report.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Notice tone="success">Report sent. The UseMe team will look into it.</Notice>

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-ink-soft underline"
      >
        <Flag className="size-4" aria-hidden="true" />
        Report a problem
      </button>
    )
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Report a problem</h2>
      <label className="block space-y-1 text-sm font-semibold">
        What happened?
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base font-normal"
        >
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        Details (optional)
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={600}
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-base font-normal"
        />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button fullWidth loading={busy} onClick={() => void send()}>Send report</Button>
      </div>
    </Card>
  )
}

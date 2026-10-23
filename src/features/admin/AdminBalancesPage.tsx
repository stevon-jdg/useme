import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchRunnerBalances, recordSettlement, type RunnerBalance } from '@/features/wallet/walletApi'
import { formatNaira, nairaToKobo } from '@/lib/formatting/money'

function Row({ r, onDone }: { r: RunnerBalance; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const naira = Number(amount)
    if (!Number.isFinite(naira) || naira <= 0) {
      setError('Enter an amount above zero.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await recordSettlement(r.runner_id, nairaToKobo(naira), note)
      setAmount('')
      setNote('')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{r.full_name}</p>
          <p className="text-sm text-ink-soft">{r.phone ?? 'No phone'} · {r.jobs} errands</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-soft">Owes</p>
          <p className="text-xl font-extrabold tabular-nums">{formatNaira(r.owed_kobo)}</p>
        </div>
      </div>
      <p className="text-xs text-ink-soft">Fees earned {formatNaira(r.commission_kobo)} · Paid {formatNaira(r.settled_kobo)}</p>
      {r.owed_kobo > 0 ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount received (₦)"
              aria-label={`Amount received from ${r.full_name}`}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
            />
            <Button onClick={submit} loading={busy}>Record</Button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Note (optional)"
            aria-label="Note"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
          />
          {error ? <p className="text-sm text-brand-red" role="alert">{error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">All settled.</p>
      )}
    </Card>
  )
}

export function AdminBalancesPage() {
  const { configured } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['admin-balances'], queryFn: fetchRunnerBalances, enabled: configured })

  return (
    <div className="space-y-4">
      <PageHeader title="Runner balances" subtitle="Fees runners owe UseMe from cash errands." />
      {q.isLoading ? <p className="text-ink-soft" role="status">Loading…</p> : null}
      {q.error ? <Notice tone="error">We could not load balances.</Notice> : null}
      {q.data && q.data.length === 0 ? <Card className="text-center text-ink-soft">No completed errands yet.</Card> : null}
      {(q.data ?? []).map((r) => (
        <Row key={r.runner_id} r={r} onDone={() => void qc.invalidateQueries({ queryKey: ['admin-balances'] })} />
      ))}
    </div>
  )
}

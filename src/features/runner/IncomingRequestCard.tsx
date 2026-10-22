import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { formatNaira } from '@/lib/formatting/money'
import { fetchIncoming, respondToDispatch, type IncomingRequest } from './dispatchApi'

const REASONS: Record<string, string> = {
  expired: 'That request ran out of time.',
  gone: 'That request is no longer available.',
  busy: 'You are already on an errand.',
  unavailable: 'You are not available for that request.',
}

/** The pop-up a runner gets. One request at a time, with a countdown. Ignoring it passes it to the next runner. */
export function IncomingRequestCard({ onAccepted }: { onAccepted: (errandId: string) => void }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [left, setLeft] = useState(0)

  const incoming = useQuery({ queryKey: ['incoming'], queryFn: fetchIncoming, refetchInterval: 2500 })
  const req: IncomingRequest | null = incoming.data ?? null
  const received = useRef(0)

  useEffect(() => {
    if (!req) return
    received.current = Date.now()
    setLeft(req.seconds_left)
    const t = window.setInterval(() => {
      const remaining = Math.max(0, req.seconds_left - Math.floor((Date.now() - received.current) / 1000))
      setLeft(remaining)
    }, 250)
    return () => window.clearInterval(t)
  }, [req?.dispatch_id, req?.seconds_left]) // eslint-disable-line react-hooks/exhaustive-deps

  async function answer(accept: boolean) {
    if (!req) return
    setBusy(accept ? 'accept' : 'decline')
    setNotice(null)
    try {
      const r = await respondToDispatch(req.dispatch_id, accept)
      if (r.accepted && r.errand_id) onAccepted(r.errand_id)
      else if (!accept && r.reason === 'declined') setNotice(null)
      else setNotice(REASONS[r.reason ?? ''] ?? 'That request is no longer available.')
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusy(null)
      await queryClient.invalidateQueries({ queryKey: ['incoming'] })
    }
  }

  if (!req) {
    return (
      <div className="space-y-3">
        {notice ? <Notice tone="info">{notice}</Notice> : null}
        {incoming.error ? <Notice tone="warning">Cannot check for requests right now. Retrying.</Notice> : null}
        <p className="rounded-card border border-dashed border-line p-6 text-center text-ink-soft" role="status">
          You are online. Requests near you appear here. Keep this screen open.
        </p>
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, (left / Math.max(1, 20)) * 100))
  return (
    <section aria-label="Incoming request" className="overflow-hidden rounded-card border-2 border-brand-red bg-surface shadow-card">
      <div className="h-2 bg-line" role="timer" aria-label={`${left} seconds left to answer`}>
        <div className="h-full bg-brand-red transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">New request</p>
            <h2 className="text-lg font-extrabold">{req.title}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums">{formatNaira(req.runner_earning_kobo)}</p>
            <p className="text-xs text-ink-soft">your earning</p>
          </div>
        </div>
        <ol className="space-y-1 text-sm">
          <li><span className="mr-2 inline-block size-2.5 rounded-full bg-success" aria-hidden="true" />{req.pickup_area ?? 'Pickup'} <span className="text-ink-soft">· {req.pickup_km} km away</span></li>
          {req.destination_area ? <li><span className="mr-2 inline-block size-2.5 rounded-full bg-brand-red" aria-hidden="true" />{req.destination_area} <span className="text-ink-soft">· trip {req.trip_km} km</span></li> : null}
        </ol>
        <p className="text-sm text-ink-soft">
          {req.extra_stops > 0 ? `${req.extra_stops} extra stop${req.extra_stops > 1 ? 's' : ''}. ` : ''}
          {req.has_budget ? 'You will buy items for the customer. ' : ''}Exact addresses show after you accept.
        </p>
        {notice ? <Notice tone="info">{notice}</Notice> : null}
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" loading={busy === 'decline'} disabled={busy !== null} onClick={() => void answer(false)}>Decline</Button>
          <Button size="lg" fullWidth loading={busy === 'accept'} disabled={busy !== null || left === 0} onClick={() => void answer(true)}>
            Accept · {left}s
          </Button>
        </div>
      </div>
    </section>
  )
}

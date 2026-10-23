import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { formatNaira } from '@/lib/formatting/money'
import type { MapMarker } from '@/components/map/MapView'
import { useAuth } from '@/features/auth/AuthProvider'
import { ChatPanel } from '@/features/errands/ChatPanel'
import { ReportProblem } from '@/features/support/ReportProblem'
import { advanceErrand, completeErrand, getRunnerJob, releaseErrand } from './dispatchApi'

const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  assigned: { to: 'heading_to_pickup', label: 'Start heading to pickup' },
  heading_to_pickup: { to: 'arrived_at_pickup', label: "I've arrived at pickup" },
  arrived_at_pickup: { to: 'in_progress', label: 'Collected, start trip' },
}

export function ActiveJobCard({ errandId, onDone }: { errandId: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [reason, setReason] = useState('')

  const job = useQuery({ queryKey: ['runner-job', errandId], queryFn: () => getRunnerJob(errandId), refetchInterval: 5000 })
  const j = job.data

  const markers = useMemo<MapMarker[]>(() => {
    if (!j) return []
    const list: MapMarker[] = [{ id: 'p', kind: 'pickup', position: { lat: j.pickup_lat, lng: j.pickup_lng }, label: 'Pickup' }]
    if (j.destination_lat !== null && j.destination_lng !== null) list.push({ id: 'd', kind: 'destination', position: { lat: j.destination_lat, lng: j.destination_lng }, label: 'Destination' })
    return list
  }, [j])

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await queryClient.invalidateQueries({ queryKey: ['runner-job', errandId] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const ok = await completeErrand(errandId, code.trim())
      if (!ok) {
        setError('That code is not right. Ask the customer to read it again.')
        await queryClient.invalidateQueries({ queryKey: ['runner-job', errandId] })
      } else {
        await queryClient.invalidateQueries({ queryKey: ['earnings'] })
        onDone()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (job.isLoading) return <p className="text-center text-ink-soft" role="status">Loading your errand…</p>
  if (job.error || !j) return <Notice tone="error">We could not load your errand.</Notice>

  if (j.status === 'cancelled' || j.assignment_ended) {
    return (
      <Card className="space-y-3">
        <Notice tone="info">{j.status === 'completed' ? 'Errand completed.' : 'The customer cancelled this errand.'}</Notice>
        <Button size="lg" fullWidth onClick={onDone}>Back to requests</Button>
      </Card>
    )
  }

  const next = NEXT[j.status]
  const target = ['assigned', 'heading_to_pickup'].includes(j.status) ? { lat: j.pickup_lat, lng: j.pickup_lng } : j.destination_lat !== null && j.destination_lng !== null ? { lat: j.destination_lat, lng: j.destination_lng } : null

  return (
    <div className="space-y-3">
      <Suspense fallback={<div className="h-48 rounded-card bg-canvas" />}>
        <MapView className="h-48 overflow-hidden rounded-card" label="Map of your errand" center={{ lat: j.pickup_lat, lng: j.pickup_lng }} markers={markers} fitToMarkers={markers.length > 1} />
      </Suspense>
      <Card className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{j.status.replace(/_/g, ' ')}</p>
            <h2 className="text-lg font-extrabold">{j.title}</h2>
          </div>
          <p className="text-xl font-extrabold tabular-nums">{formatNaira(j.fare_kobo - j.commission_kobo)}</p>
        </div>
        <p className="text-sm"><span className="text-ink-soft">Pickup: </span>{j.pickup_text}</p>
        {j.destination_text ? <p className="text-sm"><span className="text-ink-soft">Drop-off: </span>{j.destination_text}</p> : null}
        {j.instructions ? <p className="text-sm"><span className="text-ink-soft">Note: </span>{j.instructions}</p> : null}
        {j.shopping_budget_kobo > 0 ? <p className="text-sm"><span className="text-ink-soft">Item budget (customer pays you): </span>{formatNaira(j.shopping_budget_kobo)}</p> : null}
        <div className="flex items-center justify-between pt-1 text-sm">
          <span>{j.customer_name}</span>
          {j.customer_phone ? (
            <a href={`tel:${j.customer_phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-success px-3 font-semibold text-white"><Phone className="size-4" aria-hidden="true" />Call</a>
          ) : null}
        </div>
        {target ? (
          <a className="text-sm font-semibold text-brand-red underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`}>Open directions in your maps app</a>
        ) : null}
      </Card>
      {user ? <ChatPanel errandId={errandId} meId={user.id} otherName={j.customer_name || 'customer'} open={!j.assignment_ended} /> : null}
      <ReportProblem errandId={errandId} />
      {error ? <Notice tone="error">{error}</Notice> : null}

      {next ? (
        <Button size="lg" fullWidth loading={busy} onClick={() => void run(() => advanceErrand(errandId, next.to))}>{next.label}</Button>
      ) : null}

      {j.status === 'in_progress' ? (
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-semibold">Delivery code from the customer</label>
          <input id="code" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full min-h-14 rounded-control border-2 border-line text-center text-3xl font-extrabold tracking-[0.5em]" />
          <Button size="lg" fullWidth loading={busy} disabled={code.length !== 4} onClick={() => void finish()}>Complete errand</Button>
        </div>
      ) : null}

      {['assigned', 'heading_to_pickup', 'arrived_at_pickup'].includes(j.status) ? (
        releasing ? (
          <div className="space-y-2">
            <input className="w-full min-h-11 rounded-control border-2 border-line px-3" placeholder="Why are you giving it back?" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setReleasing(false)}>Keep it</Button>
              <Button variant="secondary" fullWidth loading={busy} disabled={reason.trim().length < 3} onClick={() => void run(async () => { await releaseErrand(errandId, reason.trim()); onDone() })}>Give it back</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" fullWidth onClick={() => setReleasing(true)}>Can't do this errand</Button>
        )
      ) : null}
    </div>
  )
}

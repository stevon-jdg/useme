import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, Star } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { formatNaira } from '@/lib/formatting/money'
import type { MapMarker } from '@/components/map/MapView'
import { useRealtimeRefresh } from '@/lib/supabase/useRealtime'
import { getTransport } from './catalog'
import {
  advanceDispatch, cancelErrand, fetchErrand, fetchMyRating, getErrandRunner, rateErrand, STATUS_LABEL, type Errand,
} from './rideApi'

const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

const LIVE = ['assigned', 'heading_to_pickup', 'arrived_at_pickup', 'in_progress', 'awaiting_confirmation']

export function TrackErrandPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const errand = useQuery({
    queryKey: ['errand', id],
    queryFn: () => fetchErrand(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'completed' || s === 'cancelled' ? false : 10000
    },
  })
  const status = errand.data?.status
  useRealtimeRefresh('errands', `id=eq.${id}`, [['errand', id], ['errand-runner', id]], Boolean(id))

  // While searching, the customer's app keeps the search moving: it closes timed-out offers and asks the next runner.
  const progress = useQuery({
    queryKey: ['dispatch', id],
    queryFn: () => advanceDispatch(id),
    enabled: status === 'searching',
    refetchInterval: 3000,
  })

  const runner = useQuery({
    queryKey: ['errand-runner', id],
    queryFn: () => getErrandRunner(id),
    enabled: Boolean(status && status !== 'searching'),
    refetchInterval: status && LIVE.includes(status) ? 5000 : false,
  })

  async function cancel() {
    setCancelling(true)
    setActionError(null)
    try {
      await cancelErrand(id, 'Cancelled by customer')
      await queryClient.invalidateQueries({ queryKey: ['errand', id] })
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const e = errand.data
  const markers = useMemo<MapMarker[]>(() => {
    if (!e) return []
    const list: MapMarker[] = [{ id: 'p', kind: 'pickup', position: { lat: e.pickup_lat, lng: e.pickup_lng }, label: 'Pickup' }]
    if (e.destination_lat !== null && e.destination_lng !== null) {
      list.push({ id: 'd', kind: 'destination', position: { lat: e.destination_lat, lng: e.destination_lng }, label: 'Destination' })
    }
    const loc = runner.data?.location
    if (loc && runner.data?.active) list.push({ id: 'r', kind: 'runner', position: { lat: loc.lat, lng: loc.lng }, label: 'Your runner' })
    return list
  }, [e, runner.data])

  if (errand.isLoading) return <p className="p-6 text-center text-ink-soft" role="status">Loading…</p>
  if (errand.error || !e) return <Notice tone="error">We could not load this errand.</Notice>

  return (
    <div className="relative -mx-4 -my-4 flex h-[calc(100dvh-8.5rem)] min-h-[32rem] flex-col md:-mx-6 md:h-[calc(100dvh-3rem)]">
      <Suspense fallback={<div className="flex-1 bg-canvas" />}>
        <MapView className="flex-1" label="Map of your errand" center={{ lat: e.pickup_lat, lng: e.pickup_lng }} markers={markers} fitToMarkers={markers.length > 1} />
      </Suspense>

      <div className="z-[600] max-h-[70%] space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <h1 className="text-lg font-extrabold">{STATUS_LABEL[e.status]}</h1>
        {actionError ? <Notice tone="error">{actionError}</Notice> : null}

        {e.status === 'searching' ? (
          <div className="space-y-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Searching">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-red" />
            </div>
            <p className="text-sm text-ink-soft" role="status">
              {progress.data?.offered
                ? 'A nearby runner is looking at your request. If they pass, we move on to the next one.'
                : progress.data && (progress.data.nearby_runners ?? 0) === 0
                  ? 'No runner is available nearby right now. We keep trying while you wait.'
                  : 'Looking for the nearest runner…'}
            </p>
            {progress.error ? <Notice tone="warning">Connection problem. We will keep trying.</Notice> : null}
            <Button variant="secondary" size="lg" fullWidth loading={cancelling} onClick={() => void cancel()}>Cancel request</Button>
          </div>
        ) : null}

        {e.status !== 'searching' && e.status !== 'cancelled' && runner.data ? <RunnerCard runner={runner.data} /> : null}

        {LIVE.includes(e.status) ? (
          <Card className="flex items-center justify-between bg-brand-yellow-soft">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Delivery code</p>
              <p className="text-3xl font-extrabold tracking-[0.3em] tabular-nums">{e.delivery_code ?? '••••'}</p>
            </div>
            <p className="max-w-[10rem] text-right text-xs text-ink-soft">Tell the runner this code only when your errand is done.</p>
          </Card>
        ) : null}

        {e.status !== 'searching' ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{e.title} · {getTransport(e.transport_id).label}</span>
            <span className="font-bold tabular-nums">{formatNaira(e.agreed_fare_kobo ?? e.suggested_fare_kobo)}</span>
          </div>
        ) : null}

        {['assigned', 'heading_to_pickup', 'arrived_at_pickup'].includes(e.status) ? (
          <Button variant="secondary" size="lg" fullWidth loading={cancelling} onClick={() => void cancel()}>Cancel errand</Button>
        ) : null}

        {e.status === 'completed' ? <Rate errand={e} /> : null}

        {e.status === 'cancelled' ? (
          <>
            <Notice tone="info">{e.cancelled_reason ?? 'This errand was cancelled.'}</Notice>
            <Link to="/app/errands/new" className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-brand-red font-semibold text-white">Request again</Link>
          </>
        ) : null}
      </div>
    </div>
  )
}

function RunnerCard({ runner }: { runner: NonNullable<Awaited<ReturnType<typeof getErrandRunner>>> }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-orange text-lg font-extrabold text-white" aria-hidden="true">
        {runner.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{runner.name}</p>
        <p className="text-sm text-ink-soft">
          {runner.rating_avg ? `${runner.rating_avg} ★ (${runner.rating_count})` : 'New runner'} · {runner.completed_count} errands
          {runner.plate_number ? ` · ${runner.plate_number}` : ''}
        </p>
      </div>
      {runner.phone && runner.active ? (
        <a href={`tel:${runner.phone}`} className="grid size-11 place-items-center rounded-full bg-success text-white" aria-label={`Call ${runner.name}`}>
          <Phone className="size-5" aria-hidden="true" />
        </a>
      ) : null}
    </Card>
  )
}

function Rate({ errand }: { errand: Errand }) {
  const queryClient = useQueryClient()
  const existing = useQuery({ queryKey: ['rating', errand.id], queryFn: () => fetchMyRating(errand.id) })
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => setError(null), [stars])

  if (existing.data) return <Notice tone="success">Thanks. You rated this runner {existing.data} out of 5.</Notice>

  async function submit() {
    setSaving(true)
    try {
      await rateErrand(errand.id, stars, comment.trim())
      await queryClient.invalidateQueries({ queryKey: ['rating', errand.id] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="font-bold">How was your runner?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setStars(n)} className="grid size-12 place-items-center">
            <Star className={`size-8 ${n <= stars ? 'fill-brand-yellow text-brand-yellow' : 'text-line'}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <input className="w-full min-h-11 rounded-control border-2 border-line px-3" placeholder="Add a comment (optional)" maxLength={300} value={comment} onChange={(ev) => setComment(ev.target.value)} aria-label="Comment" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button size="lg" fullWidth disabled={stars === 0} loading={saving} onClick={() => void submit()}>Submit rating</Button>
    </div>
  )
}

import { Loader2, Pencil, Sparkles } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlaceField } from '@/components/map/PlaceField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { distanceKm, estimateRoadKm } from '@/lib/geo'
import { formatNaira } from '@/lib/formatting/money'
import { searchPlaces, type Place } from '@/services/geocoding/geocode'
import { getCategory, type ErrandCategoryId } from './catalog'
import { parseErrand } from './parseErrand'
import { getQuote, postErrand, type Quote } from './rideApi'
import type { LatLng, MapMarker } from '@/components/map/MapView'

const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

const JALINGO: LatLng = { lat: 8.8937, lng: 11.3596 }
type Field = 'from' | 'to'
type Stage = 'describe' | 'reading' | 'ready'

const areaOf = (place: Place, text: string) => (place.area || text.split(',')[0] || 'Jalingo').trim().slice(0, 80)

/**
 * Describe it, check From and To, find a runner. Nothing else is asked.
 * The AI writes the heading and picks the type. The fee is fixed by the server. Anything extra is agreed in the chat.
 */
export function RequestPage() {
  const navigate = useNavigate()
  const handoff = (useLocation().state ?? null) as { text?: string } | null
  const typed = handoff?.text?.trim() ?? ''

  const [stage, setStage] = useState<Stage>(typed ? 'reading' : 'describe')
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ErrandCategoryId>('custom')
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [summary, setSummary] = useState('')
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [unsafe, setUnsafe] = useState(false)

  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)

  const [pinning, setPinning] = useState<Field | null>(null)
  const [center, setCenter] = useState<LatLng>(JALINGO)
  const [locating, setLocating] = useState(false)

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const cat = getCategory(category)
  const needsTo = cat.needsDestination

  async function read(input: string) {
    setStage('reading')
    const parsed = await parseErrand(input)
    setCategory(parsed.category)
    setTitle(parsed.title)
    setSummary(parsed.summary !== parsed.title ? parsed.summary : '')
    setUnsafe(parsed.unsafe)
    setAiNote(parsed.source === 'ai' ? 'Written for the runner from your message.' : 'Taken from your message. You can change it.')
    if (parsed.pickupText) setFromText(parsed.pickupText)
    if (parsed.destinationText) setToText(parsed.destinationText)
    setStage('ready')
    // Look the places up so the map opens with them already marked.
    for (const [place, set] of [[parsed.pickupText, setFrom], [parsed.destinationText, setTo]] as const) {
      if (!place) continue
      try {
        const found = await searchPlaces(place)
        if (found[0]) set(found[0])
      } catch {
        /* the field explains itself when the person edits it */
      }
    }
  }

  const started = useRef(false)
  useEffect(() => {
    if (!typed || started.current) return
    started.current = true
    void read(typed)
  }, [typed])

  const routeKm = useMemo(() => {
    if (!from) return null
    return to ? estimateRoadKm(from, to) : 1
  }, [from, to])

  const placesReady = Boolean(from) && (!needsTo || Boolean(to))

  useEffect(() => {
    if (stage !== 'ready' || routeKm === null || !placesReady) return
    let cancelled = false
    getQuote(category, routeKm)
      .then((q) => {
        if (cancelled) return
        setQuote(q)
        setQuoteError(null)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setQuote(null)
        setQuoteError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [stage, category, routeKm, placesReady])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    if (from) list.push({ id: 'f', kind: 'pickup', position: from, label: 'From' })
    if (to) list.push({ id: 't', kind: 'destination', position: to, label: 'To' })
    return list
  }, [from, to])

  const lastPlace = useRef('')
  useEffect(() => {
    const p = to ?? from
    const key = p ? `${p.lat},${p.lng}` : ''
    if (p && key !== lastPlace.current) {
      lastPlace.current = key
      setCenter({ lat: p.lat, lng: p.lng })
    }
  }, [from, to])

  function onText(which: Field, value: string) {
    if (which === 'from') {
      setFromText(value)
      setFrom(null)
    } else {
      setToText(value)
      setTo(null)
    }
    setQuote(null)
  }

  function confirmPin() {
    if (!pinning) return
    const value = (pinning === 'from' ? fromText : toText).trim()
    const place: Place = { label: value || 'Pinned location', area: value.split(',')[0] || 'Jalingo', lat: center.lat, lng: center.lng }
    if (pinning === 'from') {
      setFrom(place)
      if (!value) setFromText('Pinned location')
    } else {
      setTo(place)
      if (!value) setToText('Pinned location')
    }
    setPinning(null)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const ready = quote !== null && title.trim().length >= 3 && placesReady && !unsafe

  async function request() {
    if (!from || routeKm === null || !ready) return
    if (to && distanceKm(from, to) < 0.05) return setError('From and To are the same spot.')
    setPosting(true)
    setError(null)
    try {
      const id = await postErrand({
        category,
        title: title.trim(),
        description: summary.trim().slice(0, 600),
        pickupText: fromText.trim() || from.label,
        pickupArea: areaOf(from, fromText),
        pickup: { lat: from.lat, lng: from.lng },
        destinationText: toText.trim() || to?.label || '',
        destinationArea: to ? areaOf(to, toText) : '',
        destination: to ? { lat: to.lat, lng: to.lng } : null,
        routeKm,
      })
      navigate(`/app/errands/${id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setPosting(false)
    }
  }

  return (
    <div className="relative -mx-5 -mb-28 -mt-8 flex h-[calc(100dvh-4rem)] min-h-[34rem] flex-col md:-mx-4 md:mb-0 md:mt-0 md:h-[calc(100dvh-3rem)]">
      <Suspense fallback={<div className="grid flex-1 place-items-center bg-canvas text-ink-soft">Loading map…</div>}>
        <MapView
          className="min-h-40 flex-1"
          label={pinning ? 'Map. Drag to choose the spot under the pin.' : 'Map of your errand route'}
          center={center}
          markers={markers}
          centerPin={pinning ? (pinning === 'from' ? 'pickup' : 'destination') : null}
          onCenterChange={setCenter}
          fitToMarkers={!pinning && markers.length > 1}
        />
      </Suspense>

      {pinning ? (
        <button type="button" onClick={useMyLocation} disabled={locating} className="absolute right-3 top-3 z-[600] rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-card">
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
      ) : null}

      <div className="z-[600] max-h-[80%] space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-4 pb-24 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:pb-4">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />

        {stage === 'describe' ? (
          <>
            <h1 className="text-lg font-extrabold">What do you need?</h1>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600} autoFocus rows={4} placeholder="Describe your errand here..." aria-label="Describe your errand" className="w-full resize-none rounded-2xl border-2 border-line p-4 text-base focus:border-brand-red focus:outline-none" />
            <Button size="lg" fullWidth disabled={text.trim().length < 3} onClick={() => void read(text.trim())}>Continue</Button>
          </>
        ) : stage === 'reading' ? (
          <div className="flex items-center gap-3 py-6" role="status">
            <Loader2 className="size-6 animate-spin text-brand-red" aria-hidden="true" />
            <p className="font-semibold">Reading your request…</p>
          </div>
        ) : pinning ? (
          <>
            <h1 className="text-lg font-extrabold">{pinning === 'from' ? 'Where does it start?' : 'Where should it go?'}</h1>
            <p className="text-sm text-ink-soft">Drag the map so the pin sits on the exact spot.</p>
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setPinning(null)}>Cancel</Button>
              <Button size="lg" fullWidth onClick={confirmPin}>Set {pinning === 'from' ? 'From' : 'To'} here</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-control bg-brand-yellow-soft p-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <input autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} onBlur={() => setEditingTitle(false)} aria-label="Heading for the runner" className="min-h-10 w-full rounded-control border-2 border-line bg-surface px-2 font-bold" />
                ) : (
                  <p className="font-bold">{title}</p>
                )}
                {summary ? <p className="mt-1 line-clamp-3 text-sm">{summary}</p> : null}
                {aiNote ? <p className="mt-1 text-xs text-ink-soft">{aiNote}</p> : null}
              </div>
              <button type="button" onClick={() => setEditingTitle(true)} aria-label="Edit heading" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-black/5">
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </div>
            {unsafe ? <Notice tone="error">We cannot help with this request. UseMe runners only do lawful, safe errands.</Notice> : null}

            <PlaceField label={needsTo ? 'From' : 'Where should the runner go?'} dot="green" text={fromText} place={from} onText={(t) => onText('from', t)} onPlace={(p) => setFrom(p)} onPin={() => setPinning('from')} />
            <PlaceField label={needsTo ? 'To' : 'Deliver to (if needed)'} dot="red" text={toText} place={to} onText={(t) => onText('to', t)} onPlace={(p) => setTo(p)} onPin={() => setPinning('to')} />

            {quoteError ? <Notice tone="error">{quoteError}</Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}

            <div className="flex items-end justify-between rounded-control bg-brand-yellow-soft px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Service fee</p>
                <p className="text-2xl font-extrabold tabular-nums">{quote && placesReady ? formatNaira(quote.suggested_fare_kobo) : '—'}</p>
              </div>
              <p className="text-right text-xs text-ink-soft">{routeKm && placesReady ? `About ${routeKm} km (estimated)` : 'Choose the places to see the fee'}</p>
            </div>
            <p className="text-xs text-ink-soft">This is the fixed service fee. If your errand needs more money, like paying for items, you agree that with your runner in the chat.</p>

            <Button size="lg" fullWidth loading={posting} disabled={!ready} onClick={() => void request()}>
              {quote && placesReady ? `Find a runner · ${formatNaira(quote.suggested_fare_kobo)}` : 'Find a runner'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

import { Loader2, Sparkles } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PlaceField } from '@/components/map/PlaceField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { distanceKm, estimateRoadKm } from '@/lib/geo'
import { formatNaira, nairaToKobo } from '@/lib/formatting/money'
import { searchPlaces, type Place } from '@/services/geocoding/geocode'
import { ERRAND_CATEGORIES, TRANSPORT_TYPES, getCategory, getTransport, type ErrandCategoryId, type TransportId } from './catalog'
import { parseErrand } from './parseErrand'
import { getQuote, postErrand, type Quote } from './rideApi'
import type { LatLng, MapMarker } from '@/components/map/MapView'

const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

const JALINGO: LatLng = { lat: 8.8937, lng: 11.3596 }

type Step = 'places' | 'details'
type Field = 'from' | 'to'

const field =
  'w-full min-h-11 rounded-control border-2 border-line bg-surface px-3 text-base focus:border-brand-red focus:outline-none'

const areaOf = (place: Place, text: string) => (place.area || text.split(',')[0] || 'Jalingo').trim().slice(0, 80)

/**
 * Describe it, check From and To, see the fixed price, request.
 * What the customer typed on the home screen is read by the AI, which fills the heading, the type and the places.
 */
export function RequestPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const handoff = (useLocation().state ?? null) as { text?: string } | null
  const typed = handoff?.text?.trim() ?? ''
  const presetType = ERRAND_CATEGORIES.find((c) => c.id === params.get('type'))?.id

  const [step, setStep] = useState<Step>('places')
  const [reading, setReading] = useState(Boolean(typed))
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [unsafe, setUnsafe] = useState(false)

  const [category, setCategory] = useState<ErrandCategoryId>(presetType ?? 'pickup_delivery')
  const [transport, setTransport] = useState<TransportId>('keke')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [budget, setBudget] = useState('')
  const [stops, setStops] = useState(0)

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

  // Read what the customer typed, once. The AI fills the form. Nothing is sent until they press Request.
  const started = useRef(false)
  useEffect(() => {
    if (!typed || started.current) return
    started.current = true
    void (async () => {
      const parsed = await parseErrand(typed)
      setCategory(presetType ?? parsed.category)
      setTitle(parsed.title)
      setDescription(parsed.summary !== parsed.title ? parsed.summary : '')
      setStops(parsed.extraStops)
      if (parsed.budgetNaira && getCategory(parsed.category).allowsBudget) setBudget(String(parsed.budgetNaira))
      setUnsafe(parsed.unsafe)
      setAiNote(parsed.source === 'ai' ? 'Understood from your message. Check it is right.' : 'Filled in from your message. Please check the details.')
      if (parsed.pickupText) setFromText(parsed.pickupText)
      if (parsed.destinationText) setToText(parsed.destinationText)
      setReading(false)
      // Look the places up so the map opens with them already marked.
      for (const [text, set] of [[parsed.pickupText, setFrom], [parsed.destinationText, setTo]] as const) {
        if (!text) continue
        try {
          const found = await searchPlaces(text)
          if (found[0]) set(found[0])
        } catch {
          /* the field shows its own message when the person edits it */
        }
      }
    })()
  }, [typed, presetType])

  const routeKm = useMemo(() => {
    if (!from) return null
    return to && needsTo ? estimateRoadKm(from, to) : 1
  }, [from, to, needsTo])
  const tooFar = routeKm !== null && routeKm > getTransport(transport).maxKm

  useEffect(() => {
    if (step !== 'details' || routeKm === null || tooFar) return
    let cancelled = false
    getQuote(category, transport, routeKm, stops)
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
  }, [step, category, transport, routeKm, stops, tooFar])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    if (from) list.push({ id: 'f', kind: 'pickup', position: from, label: 'From' })
    if (to && needsTo) list.push({ id: 't', kind: 'destination', position: to, label: 'To' })
    return list
  }, [from, to, needsTo])

  // When a place is chosen the map moves to it.
  const lastPlace = useRef<string>('')
  useEffect(() => {
    const p = to ?? from
    const key = p ? `${p.lat},${p.lng}` : ''
    if (p && key !== lastPlace.current) {
      lastPlace.current = key
      setCenter({ lat: p.lat, lng: p.lng })
    }
  }, [from, to])

  function setPlace(which: Field, place: Place | null) {
    if (which === 'from') setFrom(place)
    else setTo(place)
  }

  function onText(which: Field, text: string) {
    if (which === 'from') setFromText(text)
    else setToText(text)
    // Editing the words clears the old match, so a stale pin can never be sent.
    setPlace(which, null)
  }

  function confirmPin() {
    if (!pinning) return
    const text = (pinning === 'from' ? fromText : toText).trim()
    const label = text || 'Pinned location'
    setPlace(pinning, { label, area: text.split(',')[0] || 'Jalingo', lat: center.lat, lng: center.lng })
    if (!text) (pinning === 'from' ? setFromText : setToText)('Pinned location')
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

  function toDetails() {
    if (!from) return setError('Choose where it starts. Pick a match from the list, or place the pin.')
    if (needsTo && !to) return setError('Choose where it goes. Pick a match from the list, or place the pin.')
    if (needsTo && to && distanceKm(from, to) < 0.05) return setError('From and To are the same spot.')
    setError(null)
    setStep('details')
  }

  const budgetNaira = Number(budget.replace(/,/g, ''))
  const budgetKobo = cat.allowsBudget && budget.trim() !== '' && Number.isFinite(budgetNaira) && budgetNaira > 0 ? nairaToKobo(budgetNaira) : 0
  const ready = quote !== null && title.trim().length >= 3 && Boolean(from) && (!needsTo || Boolean(to)) && !tooFar && !unsafe

  async function request() {
    if (!from || routeKm === null || !ready) return
    setPosting(true)
    setError(null)
    try {
      const id = await postErrand({
        category,
        title: title.trim(),
        description: description.trim().slice(0, 600),
        instructions: instructions.trim(),
        pickupText: fromText.trim() || from.label,
        pickupArea: areaOf(from, fromText),
        pickup: { lat: from.lat, lng: from.lng },
        destinationText: toText.trim() || to?.label || '',
        destinationArea: to ? areaOf(to, toText) : '',
        destination: needsTo && to ? { lat: to.lat, lng: to.lng } : null,
        transport,
        routeKm,
        extraStops: stops,
        shoppingBudgetKobo: budgetKobo,
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
          className="min-h-48 flex-1"
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

      <div className="z-[600] max-h-[78%] space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-4 pb-24 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:pb-4">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />

        {reading ? (
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
        ) : step === 'places' ? (
          <>
            {title ? (
              <div className="flex items-start gap-2 rounded-control bg-brand-yellow-soft p-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold">{title}</p>
                  {aiNote ? <p className="text-xs text-ink-soft">{aiNote}</p> : null}
                </div>
              </div>
            ) : null}
            {unsafe ? <Notice tone="error">We cannot help with this request. UseMe runners only do lawful, safe errands.</Notice> : null}
            <h1 className="text-lg font-extrabold">{needsTo ? 'From and to' : 'Where should the runner go?'}</h1>
            <PlaceField label={needsTo ? 'From' : 'Place'} dot="green" text={fromText} place={from} onText={(t) => onText('from', t)} onPlace={(p) => setFrom(p)} onPin={() => setPinning('from')} />
            {needsTo ? <PlaceField label="To" dot="red" text={toText} place={to} onText={(t) => onText('to', t)} onPlace={(p) => setTo(p)} onPin={() => setPinning('to')} /> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button size="lg" fullWidth onClick={toDetails} disabled={unsafe}>Continue</Button>
          </>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Errand type">
              {ERRAND_CATEGORIES.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)} className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold ${category === c.id ? 'border-brand-red bg-brand-red-soft' : 'border-line'}`}>
                  {c.shortLabel}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Transport">
              {TRANSPORT_TYPES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={transport === t.id} onClick={() => setTransport(t.id)} className={`rounded-control border-2 px-1 py-2 text-xs font-bold ${transport === t.id ? 'border-brand-red bg-brand-red-soft' : 'border-line'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tooFar ? <Notice tone="warning">This trip is about {routeKm} km, longer than {getTransport(transport).label} runners cover ({getTransport(transport).maxKm} km). Pick another transport.</Notice> : null}

            <input className={field} placeholder="Heading for the runner" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Heading for the runner" />
            <textarea className={`${field} py-2`} rows={3} maxLength={600} placeholder="Details for the runner (items, quantities, who to ask for)" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Details for the runner" />
            {cat.allowsBudget ? (
              <input className={field} inputMode="numeric" placeholder="Shopping budget in naira (paid to the runner for items)" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Shopping budget in naira" />
            ) : null}
            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="stops" className="text-ink-soft">Extra stops</label>
              <select id="stops" className="min-h-11 rounded-control border-2 border-line bg-surface px-2" value={stops} onChange={(e) => setStops(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <input className={field} placeholder="Other instructions (optional)" value={instructions} maxLength={400} onChange={(e) => setInstructions(e.target.value)} aria-label="Other instructions" />

            {quoteError ? <Notice tone="error">{quoteError}</Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}

            <div className="flex items-end justify-between rounded-control bg-brand-yellow-soft px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Fixed price</p>
                <p className="text-2xl font-extrabold tabular-nums">{quote ? formatNaira(quote.suggested_fare_kobo) : '—'}</p>
              </div>
              <p className="text-right text-xs text-ink-soft">
                About {routeKm ?? '—'} km (estimated)
                {budgetKobo > 0 ? <><br />+ {formatNaira(budgetKobo)} for items</> : null}
              </p>
            </div>
            <p className="text-xs text-ink-soft">The distance is estimated from the map until route lookup is connected. The price is set by the server and does not change after you request.</p>

            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep('places')}>Places</Button>
              <Button size="lg" fullWidth loading={posting} disabled={!ready} onClick={() => void request()}>
                {quote ? `Request runner · ${formatNaira(quote.suggested_fare_kobo)}` : 'Request runner'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

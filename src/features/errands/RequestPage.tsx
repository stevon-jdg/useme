import { ArrowLeft, Loader2, Pencil, Sparkles, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PlaceField } from '@/components/map/PlaceField'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { distanceKm, estimateRoadKm } from '@/lib/geo'
import { formatNaira } from '@/lib/formatting/money'
import { reverseGeocode, type Place } from '@/services/geocoding/geocode'
import { resolvePlace } from '@/services/geocoding/resolvePlace'
import { ERRAND_CATEGORIES, getCategory, type ErrandCategoryId } from './catalog'
import { inferCategory, titleFrom } from './inferCategory'
import { parseErrand } from './parseErrand'
import { getQuote, postErrand, type Quote } from './rideApi'
import type { LatLng, MapMarker } from '@/components/map/MapView'

const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

const JALINGO: LatLng = { lat: 8.8937, lng: 11.3596 }
type Field = 'from' | 'to'

const PLACEHOLDER: Record<ErrandCategoryId, string> = {
  pickup_delivery: 'e.g. Pick up a parcel from Roadblock Park and deliver it to Sabon Gari',
  shopping: 'e.g. Buy a phone charger at the electronics shop in the main market and bring it to my house',
  market_run: 'e.g. Buy tomatoes and pepper at the market and bring them to my house',
  queue_collection: 'e.g. Queue at the bank for me and collect my statement',
  custom: 'e.g. Go to the school and collect my child\'s result',
}

const areaOf = (place: Place, text: string) => (place.area || text.split(',')[0] || 'Jalingo').trim().slice(0, 80)
const isCategory = (v: string | null): v is ErrandCategoryId => ERRAND_CATEGORIES.some((c) => c.id === v)

/**
 * Describe it in your own words. The AI writes the heading, finds the places and marks them for you.
 * You check From and To, or tap the pin to choose on the map. The fee is fixed by the server.
 * Anything extra, like paying for items, is agreed with the runner in the chat.
 */
export function RequestPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const handoff = (location.state ?? null) as { text?: string } | null
  const typed = handoff?.text?.trim() ?? ''
  const typeParam = params.get('type')
  const chosen: ErrandCategoryId | null = isCategory(typeParam) && typeParam !== 'custom' ? typeParam : null

  const [text, setText] = useState(typed)
  const [aiCategory, setAiCategory] = useState<ErrandCategoryId | null>(null)
  const [stage, setStage] = useState<'describe' | 'reading' | 'ready'>(typed ? 'reading' : 'describe')
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftText, setDraftText] = useState('')
  const [summary, setSummary] = useState('')
  const [unsafe, setUnsafe] = useState(false)

  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [alts, setAlts] = useState<Record<Field, Place[]>>({ from: [], to: [] })
  const [wantsMe, setWantsMe] = useState<Record<Field, boolean>>({ from: false, to: false })
  // A field the person has edited themselves is never overwritten by a later AI reading.
  const edited = useRef<Record<Field, boolean>>({ from: false, to: false })

  const [pinning, setPinning] = useState<Field | null>(null)
  const [center, setCenter] = useState<LatLng>(JALINGO)
  const [locating, setLocating] = useState<Field | 'pin' | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  const category: ErrandCategoryId = chosen ?? aiCategory ?? inferCategory(text)
  const needsTo = getCategory(category).needsDestination

  async function fill(which: Field, phrase: string | null, isMe: boolean) {
    if (edited.current[which]) return
    const setText2 = which === 'from' ? setFromText : setToText
    const setPlace = which === 'from' ? setFrom : setTo
    setWantsMe((w) => ({ ...w, [which]: isMe }))
    setAlts((a) => ({ ...a, [which]: [] }))
    if (isMe || !phrase) {
      if (isMe) {
        setText2('')
        setPlace(null)
      }
      return
    }
    setText2(phrase)
    setPlace(null)
    try {
      const r = await resolvePlace(phrase)
      if (edited.current[which]) return
      if (r.best) {
        setPlace(r.best)
        setText2(r.best.label)
      } else {
        setAlts((a) => ({ ...a, [which]: r.alternatives }))
      }
    } catch {
      /* the field explains itself when the person edits it */
    }
  }

  async function read(input: string, keepTitle?: string) {
    const value = input.trim()
    if (value.length < 3) return
    setStage('reading')
    setError(null)
    const parsed = await parseErrand(value)
    setText(value)
    setAiCategory(parsed.category)
    setTitle(keepTitle || parsed.title)
    setSummary(parsed.summary !== parsed.title ? parsed.summary : '')
    setUnsafe(parsed.unsafe)
    setStage('ready')
    await Promise.all([fill('from', parsed.pickupText, parsed.pickupIsMe), fill('to', parsed.destinationText, parsed.destinationIsMe)])
  }

  const started = useRef(false)
  useEffect(() => {
    if (!typed || started.current) return
    started.current = true
    void read(typed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed])

  const routeKm = useMemo(() => {
    if (!from) return null
    return to ? estimateRoadKm(from, to) : 1
  }, [from, to])

  const placesReady = Boolean(from) && (!needsTo || Boolean(to))

  useEffect(() => {
    if (routeKm === null || !placesReady) {
      setQuote(null)
      return
    }
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
  }, [category, routeKm, placesReady])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    if (from) list.push({ id: 'f', kind: 'pickup', position: from, label: 'From' })
    if (to) list.push({ id: 't', kind: 'destination', position: to, label: 'To' })
    return list
  }, [from, to])

  function onText(which: Field, value: string) {
    edited.current[which] = true
    setWantsMe((w) => ({ ...w, [which]: false }))
    setAlts((a) => ({ ...a, [which]: [] }))
    if (which === 'from') {
      setFromText(value)
      setFrom(null)
    } else {
      setToText(value)
      setTo(null)
    }
  }

  function onPlace(which: Field, p: Place) {
    edited.current[which] = true
    setAlts((a) => ({ ...a, [which]: [] }))
    setWantsMe((w) => ({ ...w, [which]: false }))
    if (which === 'from') setFrom(p)
    else setTo(p)
  }

  function locate(): Promise<LatLng | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError('This phone cannot share its location. Type the place, or choose it on the map.')
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          setLocationError('We could not get your location. Allow location for this site, or type the place.')
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  async function useMyLocation(which: Field) {
    setLocationError(null)
    setLocating(which)
    const here = await locate()
    if (here) {
      const named = await reverseGeocode(here.lat, here.lng)
      const place: Place = named ?? { label: 'My current location', area: 'Jalingo', lat: here.lat, lng: here.lng }
      onPlace(which, place)
      if (which === 'from') setFromText(place.label)
      else setToText(place.label)
    }
    setLocating(null)
  }

  function openPin(which: Field) {
    const current = which === 'from' ? from : to
    const other = which === 'from' ? to : from
    setCenter(current ? { lat: current.lat, lng: current.lng } : other ? { lat: other.lat, lng: other.lng } : JALINGO)
    setLocationError(null)
    setPinning(which)
  }

  async function recenterOnMe() {
    setLocating('pin')
    const here = await locate()
    if (here) setCenter(here)
    setLocating(null)
  }

  async function confirmPin() {
    if (!pinning) return
    const which = pinning
    setNaming(true)
    const named = await reverseGeocode(center.lat, center.lng)
    const typedName = (which === 'from' ? fromText : toText).trim()
    const label = typedName || named?.label || 'Spot chosen on the map'
    const place: Place = { label, area: named?.area || label.split(',')[0] || 'Jalingo', lat: center.lat, lng: center.lng }
    onPlace(which, place)
    if (which === 'from') setFromText(label)
    else setToText(label)
    setNaming(false)
    setPinning(null)
  }

  function startEdit() {
    setDraftTitle(title)
    setDraftText(text)
    setEditing(true)
  }

  function finishEdit() {
    setEditing(false)
    const nextText = draftText.trim()
    const nextTitle = draftTitle.trim()
    if (nextText.length >= 3 && nextText !== text.trim()) {
      // The details changed, so read them again. A heading the person typed themselves is kept.
      void read(nextText, nextTitle !== title ? nextTitle : undefined)
    } else if (nextTitle.length >= 3) {
      setTitle(nextTitle)
    }
  }

  const ready = quote !== null && text.trim().length >= 3 && placesReady && !unsafe

  async function request() {
    if (!from || routeKm === null || !ready) return
    if (to && distanceKm(from, to) < 0.05) return setError('From and To are the same spot.')
    setPosting(true)
    setError(null)
    try {
      const id = await postErrand({
        category,
        title: (title.trim() || titleFrom(text)).slice(0, 80),
        description: (summary.trim() || text.trim()).slice(0, 600),
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
    <div className="relative z-10 -mb-[var(--nav-h)] flex min-h-0 flex-1 flex-col md:mb-0 md:h-[calc(100dvh-3rem)] md:flex-none">
      <div className="relative h-[36%] min-h-40 max-h-80 shrink-0 overflow-hidden bg-canvas md:h-64 md:rounded-2xl">
        <button type="button" onClick={() => (location.key === 'default' ? navigate('/app') : navigate(-1))} aria-label="Go back" className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[600] grid size-11 place-items-center rounded-full bg-surface shadow-card">
          <ArrowLeft className="size-6" aria-hidden="true" />
        </button>
        <Suspense fallback={<div className="grid size-full place-items-center text-sm text-ink-soft">Loading map…</div>}>
          <MapView className="size-full" label="Map of your errand route" center={center} markers={markers} fitToMarkers={markers.length > 0} interactive={false} />
        </Suspense>
      </div>

      <div className="relative z-10 -mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-t-3xl bg-surface px-5 pb-4 pt-5 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] md:mt-0 md:rounded-none md:px-0 md:shadow-none">
        {stage === 'describe' ? (
          <section className="space-y-2" aria-labelledby="describe-heading">
            <h2 id="describe-heading" className="text-base font-medium">What should the runner do?</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              rows={4}
              autoFocus
              placeholder={PLACEHOLDER[category]}
              aria-label="Describe your errand"
              className="w-full resize-none rounded-2xl border-2 border-line bg-surface/90 p-3 text-base placeholder:text-ink-soft/60 focus:border-brand-red focus:outline-none"
            />
            <p className="text-xs text-ink-soft">Say what you need and where, in your own words. We will find the places for you.</p>
          </section>
        ) : stage === 'reading' ? (
          <div className="flex items-center gap-3 py-8" role="status">
            <Loader2 className="size-6 animate-spin text-brand-red" aria-hidden="true" />
            <p className="font-semibold">Reading your request and finding the places…</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#cfeed6] bg-[#eefaf0] p-2.5">
              {editing ? (
                <div className="space-y-2">
                  <label className="block space-y-1 text-xs font-semibold">
                    Heading for the runner
                    <input value={draftTitle} maxLength={80} onChange={(e) => setDraftTitle(e.target.value)} className="min-h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-sm font-semibold" />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold">
                    What should the runner do?
                    <textarea value={draftText} maxLength={600} rows={3} onChange={(e) => setDraftText(e.target.value)} className="w-full resize-none rounded-xl border-2 border-line bg-surface p-3 text-sm font-normal" />
                  </label>
                  <Button fullWidth onClick={finishEdit}>Done</Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{title}</p>
                    {summary ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{summary}</p> : null}
                  </div>
                  <button type="button" onClick={startEdit} aria-label="Edit the errand" className="-my-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-black/5">
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            {unsafe ? <Notice tone="error">We cannot help with this request. UseMe runners only do lawful, safe errands.</Notice> : null}

            <section aria-label="Route" className="space-y-3">
              <PlaceField
                label="From"
                dot="green"
                text={fromText}
                place={from}
                placeholder="Where does it start?"
                alternatives={alts.from}
                offerMyLocation={wantsMe.from || !from}
                locating={locating === 'from'}
                onText={(t) => onText('from', t)}
                onPlace={(p) => onPlace('from', p)}
                onPin={() => openPin('from')}
                onUseMyLocation={() => void useMyLocation('from')}
              />
              <PlaceField
                label={needsTo ? 'To' : 'To (only if something must be delivered)'}
                dot="red"
                text={toText}
                place={to}
                placeholder="Where should it go?"
                alternatives={alts.to}
                offerMyLocation={wantsMe.to}
                locating={locating === 'to'}
                onText={(t) => onText('to', t)}
                onPlace={(p) => onPlace('to', p)}
                onPin={() => openPin('to')}
                onUseMyLocation={() => void useMyLocation('to')}
              />
            </section>
            {locationError ? <Notice tone="warning">{locationError}</Notice> : null}
            <p className="text-[11px] text-ink-soft">Extra costs, like paying for items, are agreed with your runner in chat.</p>
            {quoteError ? <Notice tone="error">{quoteError}</Notice> : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(var(--nav-h)+0.75rem)] md:px-0 md:pb-3">
        {stage === 'ready' ? (
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Service fee</p>
              <p className="text-xl font-extrabold leading-tight tabular-nums">{quote && placesReady ? formatNaira(quote.suggested_fare_kobo) : '—'}</p>
              <p className="text-[10px] text-ink-soft">{routeKm && placesReady ? `About ${routeKm} km` : 'Pick the places'}</p>
            </div>
            <Button size="lg" fullWidth loading={posting} disabled={!ready || editing} onClick={() => void request()}>
              Find a runner
            </Button>
          </div>
        ) : (
          <Button size="lg" fullWidth loading={stage === 'reading'} disabled={stage === 'reading' || text.trim().length < 3} onClick={() => void read(text)}>
            <Sparkles className="size-5" aria-hidden="true" />
            Continue
          </Button>
        )}
      </div>

      {pinning ? createPortal(
        <div className="fixed inset-0 z-[1000] flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Choose on the map">
          <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <h2 className="text-lg font-medium">{pinning === 'from' ? 'Where does it start?' : 'Where should it go?'}</h2>
            <button type="button" onClick={() => setPinning(null)} aria-label="Close map" className="grid size-10 place-items-center rounded-full bg-white/10">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Suspense fallback={<div className="grid h-full place-items-center bg-canvas text-ink-soft">Loading map…</div>}>
              <MapView className="size-full" label="Map. Drag to put the pin on the spot." center={center} markers={markers.filter((m) => m.id !== (pinning === 'from' ? 'f' : 't'))} centerPin={pinning === 'from' ? 'pickup' : 'destination'} onCenterChange={setCenter} />
            </Suspense>
            <button type="button" onClick={() => void recenterOnMe()} disabled={locating === 'pin'} className="absolute left-3 top-3 z-[800] rounded-full bg-surface px-4 py-2 text-sm font-semibold shadow-card">
              {locating === 'pin' ? 'Finding you…' : 'Use my location'}
            </button>
          </div>
          <div className="space-y-3 rounded-t-3xl bg-surface p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            <p className="text-sm text-ink-soft">Drag the map so the pin sits on the exact spot.</p>
            {locationError ? <p className="text-sm text-brand-red-dark">{locationError}</p> : null}
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setPinning(null)}>Cancel</Button>
              <Button size="lg" fullWidth loading={naming} onClick={() => void confirmPin()}>
                Set {pinning === 'from' ? 'From' : 'To'} here
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

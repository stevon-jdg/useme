import { Check, Crosshair, Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { searchPlaces, type Place } from '@/services/geocoding/geocode'

type Props = {
  /** Short word shown above the box: From or To. */
  label: string
  text: string
  place: Place | null
  placeholder: string
  /** Colour of the dot that matches the pin on the map. */
  dot: 'green' | 'red'
  /** Other places the AI or search thought the person might mean. Shown as one-tap choices. */
  alternatives?: Place[]
  /** Shows a "use where I am now" shortcut. */
  offerMyLocation?: boolean
  locating?: boolean
  onText: (text: string) => void
  onPlace: (place: Place) => void
  onPin: () => void
  onUseMyLocation?: () => void
}

/** One row of the route card. Type a place and pick a match, tap a suggestion, use your location, or place it on the map. */
export function PlaceField({ label, text, place, placeholder, dot, alternatives = [], offerMyLocation, locating, onText, onPlace, onPin, onUseMyLocation }: Props) {
  const id = useId()
  const [options, setOptions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [searched, setSearched] = useState(false)
  const skip = useRef(false)

  useEffect(() => {
    // Picking a match changes the text too. That change should not start another search.
    if (skip.current) {
      skip.current = false
      return
    }
    if (place || text.trim().length < 3) {
      setOptions([])
      setSearched(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setFailed(false)
      searchPlaces(/jalingo/i.test(text) ? text : `${text} Jalingo`, controller.signal)
        .then((list) => {
          setOptions(list)
          setSearched(true)
          setOpen(true)
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setFailed(true)
        })
        .finally(() => setLoading(false))
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [text, place])

  function choose(p: Place) {
    skip.current = true
    onText(p.label)
    onPlace(p)
    setOpen(false)
  }

  const suggestions = !place ? alternatives : []

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <span className={`size-3.5 shrink-0 rounded-full ${dot === 'green' ? 'bg-success' : 'bg-brand-red'}`} aria-hidden="true" />
        <div className="relative min-w-0 flex-1">
          <label htmlFor={id} className="block text-xs font-medium text-ink-soft">{label}</label>
          <input
            id={id}
            value={text}
            onChange={(e) => onText(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={`${id}-list`}
            className="w-full truncate bg-transparent pr-7 text-base font-medium placeholder:font-normal placeholder:text-ink-soft/60 focus:outline-none"
          />
          <span className="pointer-events-none absolute bottom-0.5 right-0 text-ink-soft">
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : place ? <Check className="size-4 text-success" aria-hidden="true" /> : null}
          </span>
        </div>
        <button type="button" onClick={onPin} aria-label={`Choose ${label.toLowerCase()} on the map`} className="grid size-11 shrink-0 place-items-center rounded-full bg-black/5 hover:bg-black/10">
          <MapPin className="size-5" aria-hidden="true" />
        </button>
      </div>

      {open && options.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-[700] mt-1 max-h-56 overflow-auto rounded-control border border-line bg-surface shadow-card">
          {options.map((o) => (
            <li key={`${o.lat}${o.lng}${o.label}`} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)} className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-black/5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {offerMyLocation && !place ? (
        <button type="button" onClick={onUseMyLocation} disabled={locating} className="mt-2 ml-6 inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-yellow-soft px-4 text-sm font-semibold">
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Crosshair className="size-4" aria-hidden="true" />}
          {locating ? 'Finding you…' : 'Use where I am now'}
        </button>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-2 ml-6">
          <p className="mb-1 text-xs text-ink-soft">Did you mean?</p>
          <ul className="flex flex-col gap-1">
            {suggestions.map((o) => (
              <li key={`${o.lat}${o.lng}${o.label}`}>
                <button type="button" onClick={() => choose(o)} className="flex min-h-10 w-full items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm hover:border-brand-red">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!place && searched && options.length === 0 && !loading && suggestions.length === 0 ? (
        <p className="mt-1 ml-6 text-xs text-brand-red-dark">We could not find that. Try another spelling, or tap the pin to choose it on the map.</p>
      ) : null}
      {failed ? <p className="mt-1 ml-6 text-xs text-brand-red-dark">Place search is not reachable. Tap the pin to choose it on the map.</p> : null}
    </div>
  )
}

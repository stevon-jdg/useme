import { Check, Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { searchPlaces, type Place } from '@/services/geocoding/geocode'

type Props = {
  label: string
  text: string
  place: Place | null
  placeholder?: string
  /** Colour of the dot that matches the pin on the map. */
  dot: 'green' | 'red'
  onText: (text: string) => void
  onPlace: (place: Place) => void
  onPin: () => void
}

/** Type a place and pick from the matches, or press the pin button and place it on the map. */
export function PlaceField({ label, text, place, placeholder, dot, onText, onPlace, onPin }: Props) {
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
      searchPlaces(text, controller.signal)
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

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-block size-3 rounded-full ${dot === 'green' ? 'bg-success' : 'bg-brand-red'}`} aria-hidden="true" />
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            value={text}
            onChange={(e) => onText(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder ?? 'Type a place, street or landmark'}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={`${id}-list`}
            className="min-h-12 w-full rounded-control border-2 border-line bg-surface px-3 pr-10 text-base focus:border-brand-red focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : place ? <Check className="size-5 text-success" aria-hidden="true" /> : null}
          </span>
        </div>
        <button type="button" onClick={onPin} aria-label={`Set ${label.toLowerCase()} on the map`} className="grid size-12 shrink-0 place-items-center rounded-control border-2 border-line bg-surface hover:border-brand-red">
          <MapPin className="size-5" aria-hidden="true" />
        </button>
      </div>

      {open && options.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 z-[700] mt-1 max-h-56 overflow-auto rounded-control border border-line bg-surface shadow-card">
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

      {place ? <p className="mt-1 text-xs text-ink-soft">Found: {place.label}</p> : null}
      {!place && searched && options.length === 0 && !loading ? (
        <p className="mt-1 text-xs text-brand-red-dark">No match for that. Try another spelling, or press the pin button to place it on the map.</p>
      ) : null}
      {failed ? <p className="mt-1 text-xs text-brand-red-dark">Place search is not reachable. Use the pin button to place it on the map.</p> : null}
    </div>
  )
}

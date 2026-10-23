import { useCallback, useEffect, useRef, useState } from 'react'
import { reverseGeocode } from '@/services/geocoding/geocode'

export type PlaceState =
  | { status: 'loading'; label: string | null }
  | { status: 'ready'; label: string }
  | { status: 'denied' }
  | { status: 'unavailable' }

const KEY = 'useme.currentPlace'
const FRESH_MS = 10 * 60 * 1000

type Saved = { label: string; at: number }

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Saved) : null
    return v && typeof v.label === 'string' && typeof v.at === 'number' ? v : null
  } catch {
    return null
  }
}

function save(label: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ label, at: Date.now() } satisfies Saved))
  } catch {
    /* storage can be blocked. The place still shows. */
  }
}

/** Where the person is right now, as a street or area name. Shows the last known place at once, then refreshes it. */
export function useCurrentPlace(): PlaceState & { refresh: () => void } {
  const saved = useRef(readSaved())
  const [state, setState] = useState<PlaceState>(() =>
    saved.current ? { status: 'ready', label: saved.current.label } : { status: 'loading', label: null },
  )

  const refresh = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable' })
      return
    }
    setState((s) => (s.status === 'ready' ? s : { status: 'loading', label: null }))
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const named = await reverseGeocode(latitude, longitude)
        const label = named ? named.label : `Near ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
        save(label)
        setState({ status: 'ready', label })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ status: 'denied' })
        else setState((s) => (s.status === 'ready' ? s : { status: 'unavailable' }))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }, [])

  useEffect(() => {
    if (saved.current && Date.now() - saved.current.at < FRESH_MS) return
    refresh()
  }, [refresh])

  return { ...state, refresh }
}

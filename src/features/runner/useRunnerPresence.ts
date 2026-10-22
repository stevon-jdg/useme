import { useEffect, useRef, useState } from 'react'
import { sendLocation } from './dispatchApi'

export type PresenceState = 'off' | 'starting' | 'sharing' | 'denied' | 'unsupported' | 'error'

const MIN_GAP_MS = 10_000
const HEARTBEAT_MS = 45_000

/**
 * While the runner is online, shares their position with the server so the nearest-runner match works.
 * A web page can only do this while the app is open in the foreground. The screen says so.
 */
export function useRunnerPresence(online: boolean): PresenceState {
  const [state, setState] = useState<PresenceState>('off')
  const last = useRef<{ lat: number; lng: number; acc: number | null; at: number } | null>(null)

  useEffect(() => {
    if (!online) {
      setState('off')
      last.current = null
      return
    }
    if (!navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('starting')

    const push = async (lat: number, lng: number, acc: number | null) => {
      last.current = { lat, lng, acc, at: Date.now() }
      try {
        await sendLocation(lat, lng, acc)
        setState('sharing')
      } catch {
        setState('error')
      }
    }

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (last.current && Date.now() - last.current.at < MIN_GAP_MS) return
        void push(pos.coords.latitude, pos.coords.longitude, Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null)
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    // A runner who is standing still still needs a fresh timestamp.
    const beat = window.setInterval(() => {
      const l = last.current
      if (l && Date.now() - l.at >= HEARTBEAT_MS) void push(l.lat, l.lng, l.acc)
    }, 15_000)

    return () => {
      navigator.geolocation.clearWatch(watch)
      window.clearInterval(beat)
    }
  }, [online])

  return state
}

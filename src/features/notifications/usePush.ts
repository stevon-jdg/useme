import { useCallback, useEffect, useState } from 'react'
import { callRpc } from '@/lib/supabase/rpc'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on' | 'working'

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function usePush() {
  const [state, setState] = useState<PushState>(() => (!supported() ? 'unsupported' : !PUBLIC_KEY ? 'unconfigured' : 'off'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported() || !PUBLIC_KEY) return
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [])

  const enable = useCallback(async () => {
    if (!supported() || !PUBLIC_KEY) return
    setError(null)
    setState('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }))
      const json = sub.toJSON()
      await callRpc('save_push_subscription', {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys?.p256dh ?? '',
        p_auth: json.keys?.auth ?? '',
      })
      setState('on')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn notifications on.')
      setState('off')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('working')
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await callRpc('delete_push_subscription', { p_endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState('off')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn notifications off.')
      setState('on')
    }
  }, [])

  return { state, error, enable, disable }
}

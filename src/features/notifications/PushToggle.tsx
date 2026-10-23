import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { usePush } from './usePush'

const HINT = {
  unsupported: 'This browser cannot show notifications. On iPhone, add UseMe to your Home Screen first.',
  unconfigured: 'Notifications are not set up yet.',
  blocked: 'Notifications are blocked. Allow them for this site in your browser settings.',
  off: 'Get a buzz for new requests and chat messages, even when the app is closed.',
  on: 'Notifications are on for this device.',
  working: 'One moment…',
} as const

export function PushToggle({ audience }: { audience: 'runner' | 'customer' }) {
  const { state, error, enable, disable } = usePush()
  if (state === 'unconfigured') return null
  const hint = state === 'off' && audience === 'customer' ? 'Get a buzz when your runner accepts or messages you.' : HINT[state]

  return (
    <Card className="flex items-center gap-3">
      {state === 'on' ? <Bell className="size-6 shrink-0 text-brand-red" aria-hidden="true" /> : <BellOff className="size-6 shrink-0 text-ink-soft" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Notifications</p>
        <p className="text-sm text-ink-soft">{hint}</p>
        {error ? <p className="text-sm text-brand-red" role="alert">{error}</p> : null}
      </div>
      {state === 'off' ? <Button onClick={() => void enable()}>Turn on</Button> : null}
      {state === 'on' ? <Button variant="secondary" onClick={() => void disable()}>Turn off</Button> : null}
    </Card>
  )
}

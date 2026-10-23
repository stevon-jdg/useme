import { ArrowLeft, Bell, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CourierMark } from '@/components/illustrations/CourierMark'
import { MapLines } from '@/components/illustrations/MapLines'
import { useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'

const TYPE_TITLE: Record<string, string> = {
  pickup_delivery: 'Pickup & Delivery',
  shopping: 'Shopping',
  market_run: 'Market Run',
  queue_collection: 'Queue & Collection',
  custom: 'Personal Errand',
}

function titleFor(pathname: string, type: string | null): string {
  if (pathname === '/app/errands/new') return (type && TYPE_TITLE[type]) || 'New errand'
  if (pathname.startsWith('/app/errands/')) return 'Your errand'
  if (pathname === '/app/history') return 'Errands'
  if (pathname === '/app/wallet') return 'Wallet'
  if (pathname === '/app/account') return 'Profile'
  if (pathname === '/app/runner-application') return 'Become a runner'
  return ''
}

/** Dark map-textured header. The home screen shows your name and place, other screens keep it short. */
export function CustomerTopBar() {
  const { account } = useAccount()
  const { user } = useAuth()
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [bell, setBell] = useState(false)
  const home = pathname === '/app'
  const title = titleFor(pathname, params.get('type'))
  // "default" is the first page of this visit. Going back from there would leave the app, so go home.
  const goBack = () => (key === 'default' ? navigate('/app') : navigate(-1))
  const first = account?.fullName?.trim().split(/\s+/)[0] ?? user?.email?.split('@')[0] ?? ''

  return (
    <header className={`relative overflow-hidden bg-ink px-5 text-white md:hidden pb-9 pt-3`}>
      <MapLines className="pointer-events-none absolute inset-0 size-full text-white/[0.07]" />
      <div className="relative flex justify-center">
        <CourierMark className="h-9" />
      </div>
      {home ? (
        <div className="relative mt-2 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium">{first}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/45">
              <MapPin className="size-3.5 shrink-0 text-brand-red" aria-hidden="true" />
              Jalingo, Taraba State
            </p>
          </div>
          <button type="button" onClick={() => setBell((v) => !v)} aria-label="Notifications" aria-expanded={bell} className="grid size-10 place-items-center rounded-full text-white/40 hover:text-white/70">
            <Bell className="size-6" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="relative mt-2 flex items-center gap-2">
          <button type="button" onClick={goBack} aria-label="Go back" className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <ArrowLeft className="size-6" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-medium">{title}</h1>
          <button type="button" onClick={() => setBell((v) => !v)} aria-label="Notifications" aria-expanded={bell} className="grid size-10 shrink-0 place-items-center rounded-full text-white/40 hover:text-white/70">
            <Bell className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
      {bell ? (
        <div role="status" className="absolute right-4 top-16 z-30 w-64 rounded-card bg-surface p-4 text-sm text-ink shadow-card">
          No notifications yet. Updates about your errands show on each errand for now.
        </div>
      ) : null}
    </header>
  )
}

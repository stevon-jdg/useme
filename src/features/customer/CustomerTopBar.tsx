import { Bell, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CourierMark } from '@/components/illustrations/CourierMark'
import { MapLines } from '@/components/illustrations/MapLines'
import { useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'

/** Dark map-textured header. The home screen shows your name and place, other screens keep it short. */
export function CustomerTopBar() {
  const { account } = useAccount()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [bell, setBell] = useState(false)
  const home = pathname === '/app'
  const first = account?.fullName?.trim().split(/\s+/)[0] ?? user?.email?.split('@')[0] ?? ''

  return (
    <header className={`relative overflow-hidden bg-ink px-5 text-white md:hidden ${home ? 'pb-9 pt-3' : 'pb-8 pt-3'}`}>
      <MapLines className="pointer-events-none absolute inset-0 size-full text-white/[0.07]" />
      <div className="relative flex justify-center">
        <CourierMark className="h-8" />
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
        <button type="button" onClick={() => setBell((v) => !v)} aria-label="Notifications" aria-expanded={bell} className="absolute right-4 top-3 grid size-10 place-items-center rounded-full text-white/40 hover:text-white/70">
          <Bell className="size-5" aria-hidden="true" />
        </button>
      )}
      {bell ? (
        <div role="status" className="absolute right-4 top-16 z-30 w-64 rounded-card bg-surface p-4 text-sm text-ink shadow-card">
          No notifications yet. Updates about your errands show on each errand for now.
        </div>
      ) : null}
    </header>
  )
}

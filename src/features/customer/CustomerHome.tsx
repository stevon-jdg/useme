import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Briefcase, Package, ShoppingBasket, ShoppingCart, ClipboardList, type LucideIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { type ErrandCategoryId } from '@/features/errands/catalog'
import { fetchMyErrands, OPEN_STATUSES, STATUS_LABEL } from '@/features/errands/rideApi'
import { formatNaira } from '@/lib/formatting/money'

const QUICK: { label: string; type: ErrandCategoryId; icon: LucideIcon; color: string }[] = [
  { label: 'Pickup & Delivery', type: 'pickup_delivery', icon: Package, color: 'text-brand-orange' },
  { label: 'Shopping', type: 'shopping', icon: ShoppingCart, color: 'text-[#3d9be9]' },
  { label: 'Market Run', type: 'market_run', icon: ShoppingBasket, color: 'text-brand-red' },
  { label: 'Personal', type: 'custom', icon: Briefcase, color: 'text-[#43b02a]' },
]

const EXAMPLE: Record<string, string> = {
  pickup_delivery: 'e.g. Pick up a parcel from Roadblock Park and deliver it to Sabon Gari',
  shopping: 'e.g. Buy a phone charger from the electronics shop in the main market',
  market_run: 'e.g. Buy tomatoes and pepper at the market and bring them to my house',
  custom: 'e.g. Queue at the bank for me, or any other personal errand',
}

const CATEGORY_ICON: Record<ErrandCategoryId, { icon: LucideIcon; color: string }> = {
  pickup_delivery: { icon: Package, color: 'text-brand-orange' },
  shopping: { icon: ShoppingCart, color: 'text-[#3d9be9]' },
  market_run: { icon: ShoppingBasket, color: 'text-brand-red' },
  queue_collection: { icon: ClipboardList, color: 'text-brand-orange' },
  custom: { icon: Briefcase, color: 'text-[#43b02a]' },
}

export function CustomerHome() {
  const { configured } = useAuth()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [hint, setHint] = useState('Describe your errand here...')
  const box = useRef<HTMLTextAreaElement>(null)
  const errands = useQuery({ queryKey: ['my-errands'], queryFn: fetchMyErrands, enabled: configured, refetchInterval: 15000 })

  // Open errands first, then the most recent ones.
  const list = [...(errands.data ?? [])]
    .sort((a, b) => Number(OPEN_STATUSES.includes(b.status)) - Number(OPEN_STATUSES.includes(a.status)))
    .slice(0, 4)

  function start() {
    const value = text.trim()
    if (!value) return
    navigate('/app/errands/new', { state: { text: value } })
  }

  return (
    <div className="relative z-10 space-y-8">
      <section aria-labelledby="need-heading" className="space-y-3">
        <h2 id="need-heading" className="text-lg">Tell us what you need?</h2>
        <div className="relative">
          <textarea
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={600}
            placeholder={hint}
            aria-label="Describe your errand"
            className="h-44 w-full resize-none rounded-2xl border-2 border-line bg-surface/90 p-4 pb-14 text-base placeholder:text-ink-soft/60 focus:border-brand-red focus:outline-none"
          />
          {text.trim() ? (
            <button type="button" onClick={start} className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-red px-5 font-semibold text-white hover:bg-brand-red-dark">
              Continue
              <ArrowRight className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="quick-heading" className="space-y-3">
        <h2 id="quick-heading" className="text-lg">Quick Actions</h2>
        <ul className="grid grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <li key={q.label}>
              <button type="button" onClick={() => { setHint(EXAMPLE[q.type] ?? hint); box.current?.focus() }} className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-ink/30 bg-surface/90 p-1 text-center text-[11px] leading-tight">
                <q.icon className={`size-9 ${q.color}`} strokeWidth={1.6} aria-hidden="true" />
                {q.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="errands-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="errands-heading" className="text-lg">Your Errands</h2>
          {(errands.data?.length ?? 0) > 4 ? <Link to="/app/history" className="text-sm font-semibold text-brand-red">View all</Link> : null}
        </div>
        {!configured ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-soft">Connect Supabase to see your errands.</p>
        ) : errands.isLoading ? (
          <p className="text-sm text-ink-soft" role="status">Loading…</p>
        ) : errands.error ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-brand-red-dark">We could not load your errands. Check your connection.</p>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/90 p-4 text-sm text-ink-soft">No errands yet. Describe what you need above.</p>
        ) : (
          list.map((e) => {
            const { icon: Icon, color } = CATEGORY_ICON[e.category_id]
            const open = OPEN_STATUSES.includes(e.status)
            return (
              <Link key={e.id} to={`/app/errands/${e.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface/95 px-4 py-5">
                <Icon className={`size-10 shrink-0 ${color}`} strokeWidth={1.6} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg">{e.title}</span>
                  <span className="block text-xs text-ink-soft">{e.route_km ? `${e.route_km} km` : e.pickup_area ?? ''}{open ? ` · ${STATUS_LABEL[e.status]}` : e.status === 'cancelled' ? ' · Cancelled' : ''}</span>
                  <span className="block text-lg font-semibold tabular-nums">{formatNaira(e.agreed_fare_kobo ?? e.suggested_fare_kobo)}</span>
                </span>
              </Link>
            )
          })
        )}
      </section>
    </div>
  )
}

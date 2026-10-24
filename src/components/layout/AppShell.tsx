import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BottomNav, type NavItem } from '@/components/layout/BottomNav'
import { MapLines } from '@/components/illustrations/MapLines'
import { Logo } from '@/components/ui/Logo'
import { Notice } from '@/components/ui/Notice'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { useAuth } from '@/features/auth/AuthProvider'

export type { NavItem }

/**
 * Signed-in layout. Bottom tab bar on phones, sidebar from the md breakpoint up.
 * The same shell serves customer, runner and admin, only the nav items change.
 */
export function AppShell({ items, area, topBar, bare = false }: { items: NavItem[]; area: string; topBar?: ReactNode; bare?: boolean }) {
  const { user, signOut, configured } = useAuth()

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]" style={{ ['--nav-h' as string]: 'calc(4rem + env(safe-area-inset-bottom))' }}>
      <aside className="hidden border-r border-line bg-surface p-4 md:flex md:flex-col">
        <Logo variant="stacked" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">{area}</p>
        <nav aria-label={`${area} navigation`} className="mt-2 flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold ${
                  isActive ? 'bg-brand-red-soft text-brand-red-dark' : 'text-ink hover:bg-black/5'
                }`
              }
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {user ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold text-ink-soft hover:bg-black/5"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </aside>

      <div className={`flex min-w-0 flex-col ${topBar || bare ? 'h-dvh md:h-auto md:min-h-dvh' : ''}`}>
        {bare ? null : topBar ?? (
          <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Logo />
          <div className="flex items-center gap-1">
          {user ? <NotificationBell className="text-ink-soft hover:bg-black/5" /> : null}
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="grid size-11 place-items-center rounded-control text-ink-soft hover:bg-black/5"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          </div>
        </header>
        )}

        <main
          className={`relative mx-auto w-full max-w-3xl space-y-4 px-4 pt-5 md:pb-10 ${
            bare
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden !px-0 !pt-0 pb-[var(--nav-h)] md:block md:flex-none md:overflow-visible md:!px-4 md:!pt-5'
              : topBar
              ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-t-[1.75rem] bg-surface px-5 pb-[var(--nav-h)] pt-6 -mt-6 md:mt-0 md:block md:flex-none md:overflow-visible md:rounded-none md:px-4 md:pt-5'
              : 'pb-28'
          }`}
        >
          {topBar ? <MapLines className="pointer-events-none fixed inset-x-0 top-0 -z-0 size-full text-black/[0.035] md:hidden" /> : null}
          {!configured ? (
            <Notice tone="warning">
              Preview mode. The app is not connected to Supabase, so nothing here is saved and every screen uses sample
              data.
            </Notice>
          ) : null}
          <Outlet />
        </main>
      </div>

      <BottomNav items={items} area={area} />
    </div>
  )
}

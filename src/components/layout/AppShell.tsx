import { LogOut, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { MapLines } from '@/components/illustrations/MapLines'
import { Logo } from '@/components/ui/Logo'
import { Notice } from '@/components/ui/Notice'
import { useAuth } from '@/features/auth/AuthProvider'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

/**
 * Signed-in layout. Bottom tab bar on phones, sidebar from the md breakpoint up.
 * The same shell serves customer, runner and admin, only the nav items change.
 */
export function AppShell({ items, area, topBar }: { items: NavItem[]; area: string; topBar?: ReactNode }) {
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

      <div className={`flex min-w-0 flex-col ${topBar ? 'h-dvh md:h-auto md:min-h-dvh' : ''}`}>
        {topBar ?? (
          <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Logo />
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
        </header>
        )}

        <main
          className={`relative mx-auto w-full max-w-3xl space-y-4 px-4 pt-5 md:pb-10 ${
            topBar
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

      <nav
        aria-label={`${area} navigation`}
        className="fixed inset-x-0 bottom-0 z-20 flex bg-ink pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-1 items-center justify-center ${isActive ? 'text-brand-yellow' : 'text-brand-yellow/50'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="size-8" strokeWidth={2.25} aria-hidden="true" />
                {isActive ? <span className="absolute bottom-2 h-1 w-1 rounded-full bg-brand-yellow" aria-hidden="true" /> : null}
                <span className="sr-only">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

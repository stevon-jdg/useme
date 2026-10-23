import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

/**
 * Phone tab bar, fixed to the bottom edge. Every look of it lives in this one file,
 * so a new design only has to change the classes here.
 * It is --nav-h tall (set on the app shell), which is the space screens keep clear above it.
 */
export function BottomNav({ items, area }: { items: NavItem[]; area: string }) {
  // Admin has many tabs. Smaller targets keep them all on one row at 320px.
  const compact = items.length > 5
  return (
    <nav
      aria-label={`${area} navigation`}
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-[1.5rem] bg-ink pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.22)] md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className="group relative flex h-16 items-center justify-center outline-none"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-0 h-1 rounded-b-full bg-brand-yellow transition-all duration-200 motion-reduce:transition-none ${
                      isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`grid ${compact ? 'size-9' : 'size-12'} place-items-center rounded-2xl transition-all duration-200 group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-brand-yellow motion-reduce:transition-none ${
                      isActive ? 'bg-brand-yellow/15 text-brand-yellow' : 'text-brand-yellow/50 group-hover:text-brand-yellow/80'
                    }`}
                  >
                    <item.icon className={compact ? 'size-5' : 'size-7'} strokeWidth={isActive ? 2.25 : 1.9} aria-hidden="true" />
                  </span>
                  <span className="sr-only">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

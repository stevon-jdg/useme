import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Bell, Flag, MessageCircle, Package, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { timeAgo } from '@/lib/formatting/timeAgo'
import { useRealtimeRefresh } from '@/lib/supabase/useRealtime'
import { fetchNotifications, markRead, type AppNotification } from './notificationsApi'

const ICON: Record<string, LucideIcon> = { errand: Package, message: MessageCircle, dispatch: Zap, runner: BadgeCheck, report: Flag }

/** Bell with an unread badge. Opens a list of what happened, newest first. Works for every signed-in person. */
export function NotificationBell({ className = '' }: { className?: string }) {
  const { user, configured } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const enabled = configured && Boolean(user)

  const list = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications, enabled, refetchInterval: 60000 })
  useRealtimeRefresh('notifications', user ? `user_id=eq.${user.id}` : undefined, [['notifications']], enabled)

  const items = list.data ?? []
  const unread = items.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function read(ids?: number[]) {
    // Show the change at once, then confirm with the server.
    qc.setQueryData<AppNotification[]>(['notifications'], (old) =>
      old?.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    try {
      await markRead(ids)
    } finally {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    }
  }

  function openItem(n: AppNotification) {
    setOpen(false)
    if (!n.read_at) void read([n.id])
    if (n.link) navigate(n.link)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={`relative grid size-10 place-items-center rounded-full ${className}`}
      >
        <Bell className="size-6" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-[1.1rem] text-white" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[1000]">
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-black/30" />
              <section
                role="dialog"
                aria-label="Notifications"
                className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+3.5rem)] mx-auto flex max-h-[70dvh] max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-card md:right-6 md:left-auto md:mx-0 md:w-96"
              >
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-base font-bold">Notifications</h2>
                  {unread > 0 ? (
                    <button type="button" onClick={() => void read()} className="min-h-9 text-sm font-semibold text-brand-red">
                      Mark all read
                    </button>
                  ) : null}
                </header>
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {list.isLoading ? <li className="px-4 py-6 text-sm text-ink-soft" role="status">Loading…</li> : null}
                  {list.error ? <li className="px-4 py-6 text-sm text-brand-red-dark">We could not load notifications.</li> : null}
                  {!list.isLoading && !list.error && items.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-ink-soft">Nothing yet. Updates about your errands show up here.</li>
                  ) : null}
                  {items.map((n) => {
                    const Icon = ICON[n.kind] ?? Bell
                    return (
                      <li key={n.id} className="border-b border-line last:border-0">
                        <button type="button" onClick={() => openItem(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/5 ${n.read_at ? '' : 'bg-brand-yellow-soft/60'}`}>
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ink text-brand-yellow">
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className={`text-sm ${n.read_at ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                              <span className="shrink-0 text-[11px] text-ink-soft">{timeAgo(n.created_at)}</span>
                            </span>
                            {n.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{n.body}</span> : null}
                          </span>
                          {!n.read_at ? <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-red" aria-label="Unread" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

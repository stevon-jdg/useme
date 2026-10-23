import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DemoBanner } from '@/components/ui/DemoBanner'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { accountKey, useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRealtimeRefresh } from '@/lib/supabase/useRealtime'
import { formatNaira } from '@/lib/formatting/money'
import { PushToggle } from '@/features/notifications/PushToggle'
import { ActiveJobCard } from './ActiveJobCard'
import { fetchActiveErrandId, fetchEarnings } from './dispatchApi'
import { IncomingRequestCard } from './IncomingRequestCard'
import { setAvailability } from './runnerApi'
import { useRunnerPresence } from './useRunnerPresence'

const PRESENCE_TEXT = {
  off: '',
  starting: 'Finding your position…',
  sharing: 'Sharing your location while this screen is open.',
  denied: 'Location is blocked. Allow it in your browser settings, or you will not receive requests.',
  unsupported: 'This device cannot share its location, so you cannot receive requests.',
  error: 'Could not send your location. Check your connection.',
} as const

export function RunnerDashboard() {
  const { user, configured } = useAuth()
  const { account } = useAccount()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const available = configured ? (pending ?? Boolean(account?.runner?.available)) : false
  const presence = useRunnerPresence(configured && available)

  useRealtimeRefresh('errand_dispatches', user ? `runner_id=eq.${user.id}` : undefined, [['incoming']], configured && available)
  useRealtimeRefresh('errand_assignments', user ? `runner_id=eq.${user.id}` : undefined, [['active-errand', user?.id], ['runner-job']], configured && Boolean(user))

  const active = useQuery({
    queryKey: ['active-errand', user?.id],
    queryFn: () => fetchActiveErrandId(user!.id),
    enabled: configured && Boolean(user),
    refetchInterval: 8000,
  })
  const earnings = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings, enabled: configured && Boolean(user) })

  async function toggle(next: boolean) {
    setSaving(true)
    setPending(next)
    setError(null)
    try {
      await setAvailability(next)
      await queryClient.invalidateQueries({ queryKey: accountKey(user?.id) })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(null)
      setSaving(false)
    }
  }

  const activeId = active.data ?? null

  return (
    <div className="space-y-5">
      <PageHeader title="Runner" subtitle="Go online to get requests near you." />
      {!configured ? <DemoBanner>Not connected to Supabase. Going online needs the database.</DemoBanner> : null}
      {configured ? <PushToggle audience="runner" /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {activeId ? (
        <ActiveJobCard
          errandId={activeId}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ['active-errand', user?.id] })
            void queryClient.invalidateQueries({ queryKey: ['incoming'] })
          }}
        />
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green" icon={<BadgeCheck className="size-3.5" aria-hidden="true" />}>Verified</Badge>
              <span className="text-sm text-ink-soft">{account?.fullName ?? ''}</span>
            </div>
            <label className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-control border-2 border-line px-4">
              <span className="text-lg font-extrabold">{available ? 'You are online' : 'You are offline'}</span>
              <input type="checkbox" role="switch" checked={available} disabled={saving || !configured} onChange={(e) => void toggle(e.target.checked)} className="size-7 accent-brand-red" />
            </label>
            {available && PRESENCE_TEXT[presence] ? (
              <p className={`flex items-start gap-2 text-sm ${presence === 'sharing' || presence === 'starting' ? 'text-ink-soft' : 'font-semibold text-brand-red-dark'}`} role="status">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {PRESENCE_TEXT[presence]}
              </p>
            ) : null}
            {available ? <p className="text-xs text-ink-soft">Requests only reach you while UseMe is open on this phone. Background alerts need the installed app, which comes later.</p> : null}
          </Card>

          {available ? (
            <IncomingRequestCard
              onAccepted={() => {
                void queryClient.invalidateQueries({ queryKey: ['active-errand', user?.id] })
              }}
            />
          ) : null}
        </>
      )}

      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-2 text-lg font-bold">Today</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Earned', value: formatNaira(earnings.data?.today_net_kobo ?? 0) },
            { label: 'Errands', value: String(earnings.data?.today_jobs ?? 0) },
            { label: 'Rating', value: earnings.data?.rating_avg ? String(earnings.data.rating_avg) : '–' },
          ].map((stat) => (
            <Card key={stat.label} className="p-3 text-center">
              <p className="text-xs text-ink-soft">{stat.label}</p>
              <p className="mt-1 text-lg font-extrabold tabular-nums">{stat.value}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

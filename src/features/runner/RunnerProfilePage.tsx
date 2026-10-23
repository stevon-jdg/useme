import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { accountKey, useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'
import { PushToggle } from '@/features/notifications/PushToggle'
import { db, unwrap } from '@/lib/supabase/db'
import { fetchEarnings } from './dispatchApi'

type Capability = { transport_id: string; verified_at: string | null; transport_categories: { label: string } | null }

async function fetchCapabilities(userId: string): Promise<Capability[]> {
  return unwrap(
    await db().from('runner_capabilities').select('transport_id, verified_at, transport_categories(label)').eq('runner_id', userId),
  ) as unknown as Capability[]
}

export function RunnerProfilePage() {
  const { user, configured, signOut } = useAuth()
  const { account } = useAccount()
  const qc = useQueryClient()
  const earnings = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings, enabled: configured })
  const caps = useQuery({
    queryKey: ['capabilities', user?.id],
    queryFn: () => fetchCapabilities(user!.id),
    enabled: configured && Boolean(user),
  })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setName(account?.fullName ?? '')
    setPhone(account?.phone ?? '')
  }, [account?.fullName, account?.phone])

  const changed = name.trim() !== (account?.fullName ?? '') || phone.trim() !== (account?.phone ?? '')

  async function save() {
    if (!user) return
    if (name.trim().length < 2) {
      setMessage({ tone: 'error', text: 'Enter your full name.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      unwrap(await db().from('profiles').update({ full_name: name.trim(), phone: phone.trim() === '' ? null : phone.trim() }).eq('id', user.id))
      await qc.invalidateQueries({ queryKey: accountKey(user.id) })
      setMessage({ tone: 'success', text: 'Saved.' })
    } catch {
      setMessage({ tone: 'error', text: 'Could not save. Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  const e = earnings.data

  return (
    <div className="space-y-4">
      <PageHeader title="Runner profile" />
      <Card className="flex items-center gap-4">
        <div className="grid size-16 place-items-center rounded-full bg-brand-yellow text-2xl font-extrabold" aria-hidden="true">
          {(account?.fullName ?? 'R').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{account?.fullName ?? 'Runner'}</p>
          <p className="truncate text-sm text-ink-soft">{user?.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">{account?.runner?.status === 'approved' ? 'Approved' : (account?.runner?.status ?? 'Runner')}</Badge>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Star className="size-4 fill-brand-yellow text-brand-yellow" aria-hidden="true" />
              {e?.rating_avg ? `${e.rating_avg} (${e.rating_count})` : 'No ratings yet'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-2xl font-extrabold tabular-nums">{e?.total_jobs ?? 0}</p>
          <p className="text-sm text-ink-soft">Errands done</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold">{account?.runner?.tier ?? 'verified'}</p>
          <p className="text-sm text-ink-soft">Tier</p>
        </div>
      </Card>

      {(caps.data ?? []).length > 0 ? (
        <Card className="space-y-2">
          <h2 className="font-bold">How you travel</h2>
          <ul className="flex flex-wrap gap-2">
            {(caps.data ?? []).map((c) => (
              <li key={c.transport_id}>
                <Badge tone={c.verified_at ? 'green' : 'yellow'}>
                  {c.transport_categories?.label ?? c.transport_id}
                  {c.verified_at ? '' : ' · pending check'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="font-bold">Your details</h2>
        <label className="block space-y-1 text-sm font-semibold">
          Full name
          <input
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            maxLength={80}
            autoComplete="name"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base font-normal"
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          Phone
          <input
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            inputMode="tel"
            maxLength={20}
            autoComplete="tel"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base font-normal"
          />
        </label>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Button onClick={() => void save()} loading={saving} disabled={!changed} fullWidth>
          Save changes
        </Button>
      </Card>

      <PushToggle audience="runner" />

      <Link to="/app" className="flex min-h-14 items-center justify-center rounded-card border border-line bg-surface px-4 font-semibold shadow-card">
        Switch to customer
      </Link>
      <Button variant="secondary" size="lg" fullWidth onClick={() => void signOut()}>
        <LogOut className="size-5" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  )
}

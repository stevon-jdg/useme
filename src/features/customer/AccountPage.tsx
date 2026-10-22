import { Briefcase, LogOut, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { isAdminRole, useAccount } from '@/features/account/useAccount'
import { useAuth } from '@/features/auth/AuthProvider'

export function AccountPage() {
  const { account } = useAccount()
  const { user, signOut } = useAuth()
  const roles = account?.roles ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" />
      <Card className="flex items-center gap-4">
        <div className="grid size-16 place-items-center rounded-full bg-brand-yellow text-2xl font-extrabold" aria-hidden="true">
          {(account?.fullName ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{account?.fullName ?? 'Your account'}</p>
          <p className="truncate text-sm text-ink-soft">{user?.email}</p>
          {account?.phone ? <p className="text-sm text-ink-soft">{account.phone}</p> : null}
        </div>
      </Card>
      <ul className="space-y-2">
        <li>
          <Link to={roles.includes('runner') ? '/runner' : '/app/runner-application'} className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 font-semibold shadow-card">
            <Briefcase className="size-5 text-brand-red" aria-hidden="true" />
            {roles.includes('runner') ? 'Switch to runner' : 'Earn as a runner'}
          </Link>
        </li>
        {isAdminRole(roles) ? (
          <li>
            <Link to="/admin" className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 font-semibold shadow-card">
              <ShieldCheck className="size-5 text-brand-red" aria-hidden="true" />
              Admin
            </Link>
          </li>
        ) : null}
      </ul>
      <Button variant="secondary" size="lg" fullWidth onClick={() => void signOut()}>
        <LogOut className="size-5" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  )
}

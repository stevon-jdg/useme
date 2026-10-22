import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAccount } from '@/features/account/useAccount'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import type { AppRole } from '@/lib/supabase/types'

/**
 * Shows an area only to people holding one of the roles. This is a courtesy for the interface.
 * Real protection is Row Level Security: a person who reaches a screen they should not still
 * gets no data from the database.
 */
export function RequireRole({ roles, fallback }: { roles: AppRole[]; fallback?: ReactNode }) {
  const { account, loading, error, refetch } = useAccount()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <Loader2 className="size-8 animate-spin text-brand-red" aria-hidden="true" />
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <Notice tone="error">We could not load your account. {error?.message}</Notice>
        <Button onClick={() => void refetch()}>Try again</Button>
      </div>
    )
  }

  if (account.suspended) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <Notice tone="error">This account is suspended. Contact UseMe support if you think this is a mistake.</Notice>
      </div>
    )
  }

  if (!roles.some((role) => account.roles.includes(role))) {
    return (
      fallback ?? (
        <div className="mx-auto max-w-md space-y-3 p-4">
          <Notice tone="warning">Your account does not have access to this area.</Notice>
          <ButtonLink to="/app">Back to your account</ButtonLink>
        </div>
      )
    )
  }

  return <Outlet />
}

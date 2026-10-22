import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { db, unwrap } from '@/lib/supabase/db'

export type AppRole = 'customer' | 'runner' | 'admin' | 'super_admin'

export type RunnerStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type Account = {
  fullName: string
  phone: string | null
  suspended: boolean
  roles: AppRole[]
  runner: { status: RunnerStatus; reviewNote: string | null; tier: string; available: boolean } | null
}

/** Sample account for `npm run dev` without Supabase, so every screen can be reviewed. */
const PREVIEW_ACCOUNT: Account = {
  fullName: 'Preview user',
  phone: null,
  suspended: false,
  roles: ['customer', 'runner', 'admin'],
  runner: { status: 'approved', reviewNote: null, tier: 'verified', available: false },
}

async function loadAccount(userId: string): Promise<Account> {
  const client = db()
  const [profile, roles, runner] = await Promise.all([
    client.from('profiles').select('full_name, phone, suspended_at').eq('id', userId).single(),
    client.from('user_roles').select('role').eq('user_id', userId),
    client.from('runner_profiles').select('status, review_note, tier, available').eq('user_id', userId).maybeSingle(),
  ])

  const profileRow = unwrap(profile) as { full_name: string; phone: string | null; suspended_at: string | null }
  const roleRows = unwrap(roles) as { role: AppRole }[]
  const runnerRow = unwrap(runner) as {
    status: RunnerStatus
    review_note: string | null
    tier: string
    available: boolean
  } | null

  return {
    fullName: profileRow.full_name,
    phone: profileRow.phone,
    suspended: profileRow.suspended_at !== null,
    roles: roleRows.map((row) => row.role),
    runner: runnerRow
      ? { status: runnerRow.status, reviewNote: runnerRow.review_note, tier: runnerRow.tier, available: runnerRow.available }
      : null,
  }
}

export const accountKey = (userId: string | undefined) => ['account', userId] as const

/** Roles and profile for the signed-in user. This only decides what to show. The database decides what is allowed. */
export function useAccount() {
  const { user, configured } = useAuth()
  const preview = !configured && import.meta.env.DEV

  const query = useQuery({
    queryKey: accountKey(user?.id),
    queryFn: () => loadAccount(user?.id as string),
    enabled: Boolean(user) && configured,
  })

  return {
    account: preview ? PREVIEW_ACCOUNT : (query.data ?? null),
    loading: preview ? false : query.isLoading,
    error: preview ? null : (query.error as Error | null),
    refetch: query.refetch,
  }
}

export function isAdminRole(roles: AppRole[]): boolean {
  return roles.includes('admin') || roles.includes('super_admin')
}

import { db, unwrap } from '@/lib/supabase/db'
import type { RunnerStatus } from '@/features/account/useAccount'

export type ApplicationRow = {
  user_id: string
  legal_name: string
  date_of_birth: string
  status: RunnerStatus
  submitted_at: string | null
  review_note: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  profile: { full_name: string; phone: string | null } | null
  capabilities: { transport_id: string; plate_number: string | null; verified_at: string | null }[]
  documents: { id: string; kind: string; storage_path: string }[]
}

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const client = db()
  const runners = unwrap(
    await client
      .from('runner_profiles')
      .select('user_id, legal_name, date_of_birth, status, submitted_at, review_note, emergency_contact_name, emergency_contact_phone')
      .neq('status', 'draft')
      .order('submitted_at', { ascending: true, nullsFirst: false }),
  ) as Omit<ApplicationRow, 'profile' | 'capabilities' | 'documents'>[]

  if (runners.length === 0) return []
  const ids = runners.map((row) => row.user_id)

  const [profiles, capabilities, documents] = await Promise.all([
    client.from('profiles').select('id, full_name, phone').in('id', ids),
    client.from('runner_capabilities').select('runner_id, transport_id, plate_number, verified_at').in('runner_id', ids),
    client.from('runner_documents').select('id, runner_id, kind, storage_path').in('runner_id', ids),
  ])
  const profileRows = unwrap(profiles) as { id: string; full_name: string; phone: string | null }[]
  const capabilityRows = unwrap(capabilities) as (ApplicationRow['capabilities'][number] & { runner_id: string })[]
  const documentRows = unwrap(documents) as (ApplicationRow['documents'][number] & { runner_id: string })[]

  return runners.map((row) => ({
    ...row,
    profile: profileRows.find((p) => p.id === row.user_id) ?? null,
    capabilities: capabilityRows.filter((c) => c.runner_id === row.user_id),
    documents: documentRows.filter((d) => d.runner_id === row.user_id),
  }))
}

export type ReviewDecision = 'under_review' | 'approved' | 'more_info_required' | 'rejected' | 'suspended' | 'reinstated'

export async function reviewRunner(runnerId: string, decision: ReviewDecision, note: string): Promise<void> {
  unwrap(
    await db().rpc('admin_review_runner', {
      p_runner: runnerId,
      p_decision: decision,
      p_note: note.trim() === '' ? null : note.trim(),
    }),
  )
}

export async function verifyCapability(runnerId: string, transportId: string, verified: boolean): Promise<void> {
  unwrap(
    await db().rpc('admin_verify_capability', { p_runner: runnerId, p_transport: transportId, p_verified: verified }),
  )
}

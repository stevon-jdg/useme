import { db, unwrap } from '@/lib/supabase/db'

export type ServiceArea = { id: string; name: string }

export type RunnerDocument = { id: string; kind: string; created_at: string }

export type SavedApplication = {
  legal_name: string
  date_of_birth: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_consent_at: string | null
  conduct_accepted_at: string | null
  transports: { transport_id: string; plate_number: string | null }[]
}

export async function fetchServiceArea(): Promise<ServiceArea> {
  const rows = unwrap(
    await db().from('service_areas').select('id, name').eq('active', true).order('name').limit(1),
  ) as ServiceArea[]
  const area = rows[0]
  if (!area) throw new Error('No service area is active yet.')
  return area
}

export async function fetchSavedApplication(userId: string): Promise<SavedApplication | null> {
  const client = db()
  const profile = unwrap(
    await client
      .from('runner_profiles')
      .select('legal_name, date_of_birth, emergency_contact_name, emergency_contact_phone, emergency_consent_at, conduct_accepted_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ) as Omit<SavedApplication, 'transports'> | null
  if (!profile) return null

  const transports = unwrap(
    await client.from('runner_capabilities').select('transport_id, plate_number').eq('runner_id', userId),
  ) as SavedApplication['transports']
  return { ...profile, transports }
}

export async function fetchMyDocuments(userId: string): Promise<RunnerDocument[]> {
  return unwrap(
    await db()
      .from('runner_documents')
      .select('id, kind, created_at')
      .eq('runner_id', userId)
      .order('created_at', { ascending: false }),
  ) as RunnerDocument[]
}

export type SaveApplicationInput = {
  legalName: string
  dateOfBirth: string
  serviceAreaId: string
  emergencyName: string
  emergencyPhone: string
  emergencyConsent: boolean
  conductAccepted: boolean
  transports: string[]
  plates: Record<string, string>
}

export async function saveApplication(input: SaveApplicationInput): Promise<void> {
  unwrap(
    await db().rpc('save_runner_application', {
      p_legal_name: input.legalName,
      p_date_of_birth: input.dateOfBirth,
      p_service_area_id: input.serviceAreaId,
      p_emergency_name: input.emergencyName,
      p_emergency_phone: input.emergencyPhone,
      p_emergency_consent: input.emergencyConsent,
      p_conduct_accepted: input.conductAccepted,
      p_transports: input.transports,
      p_plates: input.plates,
    }),
  )
}

export async function registerDocument(kind: string, storagePath: string): Promise<void> {
  unwrap(await db().rpc('register_runner_document', { p_kind: kind, p_storage_path: storagePath }))
}

export async function submitApplication(): Promise<void> {
  unwrap(await db().rpc('submit_runner_application'))
}

export async function setAvailability(available: boolean): Promise<void> {
  unwrap(await db().rpc('set_runner_availability', { p_available: available }))
}

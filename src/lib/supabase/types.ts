/** Row shapes for the tables the app reads. Kept by hand until generated types are added. */

export type AppRole = 'customer' | 'runner' | 'admin' | 'super_admin'

export type VerificationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type DocumentKind = 'id_document' | 'selfie' | 'vehicle_licence' | 'vehicle_registration'

export type RunnerProfileRow = {
  user_id: string
  legal_name: string
  date_of_birth: string
  service_area_id: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_consent_at: string | null
  conduct_accepted_at: string | null
  status: VerificationStatus
  submitted_at: string | null
  reviewed_at: string | null
  review_note: string | null
  available: boolean
  tier: 'verified' | 'trusted' | 'elite'
}

export type RunnerCapabilityRow = {
  runner_id: string
  transport_id: string
  plate_number: string | null
  verified_at: string | null
}

export type RunnerDocumentRow = {
  id: string
  runner_id: string
  kind: DocumentKind
  storage_path: string
  created_at: string
}

export type TransportCategoryRow = {
  id: string
  label: string
  max_km: number
  requires_vehicle_check: boolean
  active: boolean
}

export type ServiceAreaRow = {
  id: string
  slug: string
  name: string
  active: boolean
}

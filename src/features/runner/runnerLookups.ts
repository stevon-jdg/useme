import { db, unwrap } from '@/lib/supabase/db'

export type TransportOption = { id: string; label: string; requires_vehicle_check: boolean }

export async function fetchTransportOptions(): Promise<TransportOption[]> {
  return unwrap(
    await db().from('transport_categories').select('id, label, requires_vehicle_check').eq('active', true).order('max_km'),
  ) as TransportOption[]
}

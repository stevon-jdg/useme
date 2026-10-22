import { db, unwrap } from '@/lib/supabase/db'
import { callRpc } from '@/lib/supabase/rpc'

export type IncomingRequest = {
  dispatch_id: string
  errand_id: string
  category_id: string
  title: string
  pickup_area: string | null
  destination_area: string | null
  pickup_lat: number
  pickup_lng: number
  destination_lat: number | null
  destination_lng: number | null
  trip_km: number
  pickup_km: number
  fare_kobo: number
  runner_earning_kobo: number
  extra_stops: number
  has_budget: boolean
  expires_at: string
  seconds_left: number
}

export type RunnerJob = {
  id: string
  status: 'assigned' | 'heading_to_pickup' | 'arrived_at_pickup' | 'in_progress' | 'awaiting_confirmation' | 'completed' | 'cancelled' | 'disputed' | 'searching'
  title: string
  instructions: string | null
  pickup_text: string
  pickup_lat: number
  pickup_lng: number
  destination_text: string | null
  destination_lat: number | null
  destination_lng: number | null
  route_km: number
  extra_stops: number
  shopping_budget_kobo: number
  fare_kobo: number
  commission_kobo: number
  customer_name: string
  customer_phone: string | null
  assignment_ended: boolean
  code_attempts: number
}

export type EarningsSummary = {
  today_jobs: number
  today_net_kobo: number
  week_net_kobo: number
  total_jobs: number
  total_net_kobo: number
  rating_avg: number | null
  rating_count: number
} | null

export async function fetchIncoming(): Promise<IncomingRequest | null> {
  const rows = await callRpc<IncomingRequest[] | null>('get_my_dispatch')
  return rows?.[0] ?? null
}

export const respondToDispatch = (dispatchId: string, accept: boolean) =>
  callRpc<{ accepted: boolean; reason?: string; errand_id?: string }>('respond_to_dispatch', { p_dispatch: dispatchId, p_accept: accept })

export const sendLocation = (lat: number, lng: number, accuracy: number | null) =>
  callRpc<void>('update_runner_location', { p_lat: lat, p_lng: lng, p_accuracy_m: accuracy })

export const getRunnerJob = (id: string) => callRpc<RunnerJob>('get_runner_job', { p_errand: id })
export const advanceErrand = (id: string, next: string) => callRpc<void>('advance_errand', { p_errand: id, p_next: next })
export const completeErrand = (id: string, code: string) => callRpc<boolean>('complete_errand', { p_errand: id, p_code: code })
export const releaseErrand = (id: string, reason: string) => callRpc<void>('release_errand', { p_errand: id, p_reason: reason })
export const fetchEarnings = () => callRpc<EarningsSummary>('runner_earnings_summary')

/** The errand this runner is doing now, if any. */
export async function fetchActiveErrandId(userId: string): Promise<string | null> {
  const rows = unwrap(
    await db().from('errand_assignments').select('errand_id').eq('runner_id', userId).is('ended_at', null).limit(1),
  ) as { errand_id: string }[]
  return rows[0]?.errand_id ?? null
}

import { db, unwrap } from '@/lib/supabase/db'
import { callRpc } from '@/lib/supabase/rpc'
import type { ErrandCategoryId, TransportId } from './catalog'

export type Quote = {
  base_fee_kobo: number
  distance_charge_kobo: number
  task_fee_kobo: number
  extra_stops_charge_kobo: number
  runner_fee_kobo: number
  platform_fee_kobo: number
  suggested_fare_kobo: number
  distance_km: number
}

export type ErrandStatus =
  | 'searching'
  | 'assigned'
  | 'heading_to_pickup'
  | 'arrived_at_pickup'
  | 'in_progress'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type Errand = {
  id: string
  status: ErrandStatus
  category_id: ErrandCategoryId
  title: string
  transport_id: TransportId
  pickup_text: string
  pickup_area: string | null
  pickup_lat: number
  pickup_lng: number
  destination_text: string | null
  destination_area: string | null
  destination_lat: number | null
  destination_lng: number | null
  route_km: number
  suggested_fare_kobo: number
  agreed_fare_kobo: number | null
  delivery_code: string | null
  cancelled_reason: string | null
  created_at: string
}

export type DispatchProgress = {
  status: ErrandStatus
  offered: boolean
  runners_tried: number
  nearby_runners: number | null
}

export type AssignedRunner = {
  runner_id: string
  name: string
  phone: string | null
  tier: string
  transport_id: TransportId
  plate_number: string | null
  rating_avg: number | null
  rating_count: number
  completed_count: number
  fare_kobo: number
  active: boolean
  location: { lat: number; lng: number; updated_at: string } | null
}

export type PostErrandInput = {
  category: ErrandCategoryId
  title: string
  description: string
  instructions: string
  pickupText: string
  pickupArea: string
  pickup: { lat: number; lng: number }
  destinationText: string
  destinationArea: string
  destination: { lat: number; lng: number } | null
  transport: TransportId
  routeKm: number
  extraStops: number
  shoppingBudgetKobo: number
}

const COLUMNS =
  'id, status, category_id, title, transport_id, pickup_text, pickup_area, pickup_lat, pickup_lng, destination_text, destination_area, destination_lat, destination_lng, route_km, suggested_fare_kobo, agreed_fare_kobo, delivery_code, cancelled_reason, created_at'

export function getQuote(category: ErrandCategoryId, transport: TransportId, km: number, extraStops: number) {
  return callRpc<Quote>('calculate_quote', {
    p_category: category,
    p_transport: transport,
    p_distance_km: km,
    p_extra_stops: extraStops,
  })
}

export function postErrand(input: PostErrandInput) {
  return callRpc<string>('post_errand', {
    p_category_id: input.category,
    p_title: input.title,
    p_description: input.description || null,
    p_instructions: input.instructions || null,
    p_pickup_text: input.pickupText,
    p_pickup_area: input.pickupArea,
    p_pickup_lat: input.pickup.lat,
    p_pickup_lng: input.pickup.lng,
    p_destination_text: input.destination ? input.destinationText : null,
    p_destination_area: input.destination ? input.destinationArea : null,
    p_destination_lat: input.destination?.lat ?? null,
    p_destination_lng: input.destination?.lng ?? null,
    p_transport_id: input.transport,
    p_route_km: input.routeKm,
    p_extra_stops: input.extraStops,
    p_shopping_budget_kobo: input.shoppingBudgetKobo,
  })
}

export const advanceDispatch = (errandId: string) => callRpc<DispatchProgress>('advance_dispatch', { p_errand: errandId })
export const cancelErrand = (errandId: string, reason: string) => callRpc<void>('cancel_errand', { p_errand: errandId, p_reason: reason })
export const getErrandRunner = (errandId: string) => callRpc<AssignedRunner | null>('get_errand_runner', { p_errand: errandId })
export const rateErrand = (errandId: string, stars: number, comment: string) =>
  callRpc<void>('rate_errand', { p_errand: errandId, p_stars: stars, p_comment: comment || null })

export async function fetchErrand(id: string): Promise<Errand | null> {
  return unwrap(await db().from('errands').select(COLUMNS).eq('id', id).maybeSingle()) as Errand | null
}

export async function fetchMyErrands(): Promise<Errand[]> {
  return unwrap(await db().from('errands').select(COLUMNS).order('created_at', { ascending: false }).limit(30)) as Errand[]
}

export async function fetchMyRating(errandId: string): Promise<number | null> {
  const row = unwrap(await db().from('ratings').select('stars').eq('errand_id', errandId).maybeSingle()) as { stars: number } | null
  return row?.stars ?? null
}

export const OPEN_STATUSES: ErrandStatus[] = ['searching', 'assigned', 'heading_to_pickup', 'arrived_at_pickup', 'in_progress', 'awaiting_confirmation']

export const STATUS_LABEL: Record<ErrandStatus, string> = {
  searching: 'Finding your runner',
  assigned: 'Runner accepted',
  heading_to_pickup: 'Runner is heading to pickup',
  arrived_at_pickup: 'Runner has arrived at pickup',
  in_progress: 'On the way to the destination',
  awaiting_confirmation: 'Waiting for confirmation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Under review',
}

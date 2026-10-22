/**
 * SAMPLE DATA for design review. None of this is real. Every screen that imports it
 * must show <DemoBanner />. This file is deleted screen by screen as real queries land.
 */
import type { ErrandCategoryId, TransportId } from '@/features/errands/catalog'

export type DemoErrandStatus = 'searching' | 'assigned' | 'to_pickup' | 'in_progress' | 'completed'

export type DemoErrand = {
  id: string
  category: ErrandCategoryId
  title: string
  status: DemoErrandStatus
  pickupArea: string
  destinationArea: string | null
  distanceKm: number
  serviceTotal: number
  runnerEarnings: number
  transport: TransportId
}

export const DEMO_STATUS_LABEL: Record<DemoErrandStatus, string> = {
  searching: 'Searching for a runner',
  assigned: 'Runner assigned',
  to_pickup: 'Runner heading to pickup',
  in_progress: 'In progress',
  completed: 'Completed',
}

export const DEMO_CUSTOMER_ERRANDS: DemoErrand[] = [
  {
    id: 'demo-1',
    category: 'shopping',
    title: 'Groceries for the week',
    status: 'to_pickup',
    pickupArea: 'Jalingo Main Market',
    destinationArea: 'Mayo Gwoi',
    distanceKm: 2.4,
    serviceTotal: 185500,
    runnerEarnings: 165600,
    transport: 'keke',
  },
  {
    id: 'demo-2',
    category: 'pickup_delivery',
    title: 'Parcel to Government House',
    status: 'completed',
    pickupArea: 'Barade',
    destinationArea: 'Government House area',
    distanceKm: 3.1,
    serviceTotal: 132000,
    runnerEarnings: 117900,
    transport: 'motorcycle',
  },
]

export const DEMO_RUNNER_JOBS: DemoErrand[] = [
  {
    id: 'demo-job-1',
    category: 'pickup_delivery',
    title: 'Deliver documents',
    status: 'searching',
    pickupArea: 'Jalingo Central',
    destinationArea: 'Government House area',
    distanceKm: 2.1,
    serviceTotal: 118700,
    runnerEarnings: 106000,
    transport: 'keke',
  },
  {
    id: 'demo-job-2',
    category: 'market_run',
    title: 'Tomatoes and pepper',
    status: 'searching',
    pickupArea: 'Jalingo Main Market',
    destinationArea: 'Sabon Gari',
    distanceKm: 1.8,
    serviceTotal: 112000,
    runnerEarnings: 100000,
    transport: 'walking',
  },
  {
    id: 'demo-job-3',
    category: 'queue_collection',
    title: 'Collect parcel from the park',
    status: 'searching',
    pickupArea: 'Motor Park',
    destinationArea: null,
    distanceKm: 3.2,
    serviceTotal: 155000,
    runnerEarnings: 138400,
    transport: 'motorcycle',
  },
]

/**
 * Static catalog of errand categories and transport types.
 * In Phase 4 these move to database tables (errand_categories, transport_categories)
 * so administrators can edit them. The ids here match the ids planned for those rows.
 */

export type ErrandCategoryId = 'pickup_delivery' | 'shopping' | 'market_run' | 'queue_collection' | 'custom'

export type TransportId = 'walking' | 'bicycle' | 'keke' | 'motorcycle' | 'car'

export type ErrandCategory = {
  id: ErrandCategoryId
  label: string
  shortLabel: string
  description: string
  /** Whether the customer needs to give a destination. A shopping run may only need one address. */
  needsPickup: boolean
  needsDestination: boolean
  /** Whether the customer can set a shopping budget for this category. */
  allowsBudget: boolean
}

export const ERRAND_CATEGORIES: readonly ErrandCategory[] = [
  {
    id: 'pickup_delivery',
    label: 'Pickup and delivery',
    shortLabel: 'Pickup',
    description: 'Collect something from one place and drop it at another.',
    needsPickup: true,
    needsDestination: true,
    allowsBudget: false,
  },
  {
    id: 'shopping',
    label: 'Shopping',
    shortLabel: 'Shopping',
    description: 'A runner buys items for you and brings them to you.',
    needsPickup: true,
    needsDestination: true,
    allowsBudget: true,
  },
  {
    id: 'market_run',
    label: 'Market run',
    shortLabel: 'Market',
    description: 'Provisions and produce from the market, delivered to you.',
    needsPickup: true,
    needsDestination: true,
    allowsBudget: true,
  },
  {
    id: 'queue_collection',
    label: 'Queue and collection',
    shortLabel: 'Queue',
    description: 'Wait in line or collect an item on your behalf.',
    needsPickup: true,
    needsDestination: false,
    allowsBudget: false,
  },
  {
    id: 'custom',
    label: 'Personal or business errand',
    shortLabel: 'Other',
    description: 'Something else that is lawful and safe. Describe it clearly.',
    needsPickup: true,
    needsDestination: false,
    allowsBudget: false,
  },
]

export function getCategory(id: ErrandCategoryId): ErrandCategory {
  const category = ERRAND_CATEGORIES.find((item) => item.id === id)
  if (!category) throw new Error(`Unknown errand category: ${id}`)
  return category
}

export type TransportType = {
  id: TransportId
  label: string
  /** Longest job this transport type is offered. Admin-editable in Phase 8. */
  maxKm: number
}

export const TRANSPORT_TYPES: readonly TransportType[] = [
  { id: 'walking', label: 'Walking', maxKm: 3 },
  { id: 'bicycle', label: 'Bicycle', maxKm: 6 },
  { id: 'keke', label: 'Keke', maxKm: 15 },
  { id: 'motorcycle', label: 'Motorcycle', maxKm: 20 },
  { id: 'car', label: 'Car', maxKm: 30 },
]

export function getTransport(id: TransportId): TransportType {
  const transport = TRANSPORT_TYPES.find((item) => item.id === id)
  if (!transport) throw new Error(`Unknown transport type: ${id}`)
  return transport
}

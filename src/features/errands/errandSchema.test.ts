import { describe, expect, it } from 'vitest'
import { errandSchema, type ErrandFormValues } from './errandSchema'

const valid: ErrandFormValues = {
  category: 'pickup_delivery',
  title: 'Deliver documents',
  description: '',
  pickup: 'Jalingo Central Market',
  destination: 'Government House',
  transport: 'keke',
  distanceKm: '2.4',
  extraStops: '0',
  shoppingBudget: '',
  instructions: '',
}

describe('errandSchema', () => {
  it('accepts a valid errand', () => {
    expect(errandSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a destination for pickup and delivery', () => {
    expect(errandSchema.safeParse({ ...valid, destination: '' }).success).toBe(false)
  })

  it('does not require a destination for queue errands', () => {
    const result = errandSchema.safeParse({ ...valid, category: 'queue_collection', destination: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a distance beyond what the transport type covers', () => {
    const result = errandSchema.safeParse({ ...valid, transport: 'walking', distanceKm: '6' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing or zero distance', () => {
    expect(errandSchema.safeParse({ ...valid, distanceKm: '' }).success).toBe(false)
    expect(errandSchema.safeParse({ ...valid, distanceKm: '0' }).success).toBe(false)
  })

  it('rejects an oversized shopping budget', () => {
    const result = errandSchema.safeParse({ ...valid, category: 'shopping', shoppingBudget: '90000' })
    expect(result.success).toBe(false)
  })

  it('rejects too many extra stops', () => {
    expect(errandSchema.safeParse({ ...valid, extraStops: '9' }).success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { inferCategory, titleFrom } from './inferCategory'

describe('inferCategory', () => {
  it('finds market runs', () => expect(inferCategory('Buy tomatoes and pepper at the market')).toBe('market_run'))
  it('finds shopping', () => expect(inferCategory('Please buy me a charger')).toBe('shopping'))
  it('finds queues', () => expect(inferCategory('Queue at the bank for me')).toBe('queue_collection'))
  it('finds deliveries', () => expect(inferCategory('Deliver this parcel to my sister')).toBe('pickup_delivery'))
  it('falls back to a custom errand', () => expect(inferCategory('Water my plants')).toBe('custom'))
})

describe('titleFrom', () => {
  it('uses the first sentence', () => expect(titleFrom('Pick up my parcel. It is small.')).toBe('Pick up my parcel'))
  it('shortens long text to 80 characters', () => expect(titleFrom('a'.repeat(200)).length).toBeLessThanOrEqual(80))
})

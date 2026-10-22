import { describe, expect, it } from 'vitest'
import { calculatePrice } from './pricing'

describe('calculatePrice', () => {
  it('matches the worked example: keke, 2.4 km, pickup and delivery', () => {
    const price = calculatePrice({ category: 'pickup_delivery', transport: 'keke', distanceKm: 2.4 })
    expect(price.baseFee).toBe(50000)
    expect(price.distanceCharge).toBe(36000)
    expect(price.taskFee).toBe(20000)
    expect(price.runnerFee).toBe(106000)
    expect(price.platformFee).toBe(12700)
    expect(price.serviceTotal).toBe(118700)
  })

  it('keeps the shopping budget out of the service total', () => {
    const without = calculatePrice({ category: 'shopping', transport: 'keke', distanceKm: 3 })
    const withBudget = calculatePrice({
      category: 'shopping',
      transport: 'keke',
      distanceKm: 3,
      shoppingBudget: 500000,
    })
    expect(withBudget.serviceTotal).toBe(without.serviceTotal)
    expect(withBudget.shoppingBudget).toBe(500000)
  })

  it('adds a charge for each extra stop', () => {
    const one = calculatePrice({ category: 'market_run', transport: 'walking', distanceKm: 1, extraStops: 1 })
    const three = calculatePrice({ category: 'market_run', transport: 'walking', distanceKm: 1, extraStops: 3 })
    expect(three.extraStopsCharge - one.extraStopsCharge).toBe(20000)
  })

  it('applies the platform fee minimum on small jobs', () => {
    const price = calculatePrice(
      { category: 'pickup_delivery', transport: 'walking', distanceKm: 0 },
      {
        transport: { walking: { baseFee: 10000, perKm: 0 } } as never,
        taskFee: { pickup_delivery: 0 } as never,
        extraStopFee: 0,
        platformFeePercent: 12,
        platformFeeMinimum: 10000,
        minimumRunnerFee: 0,
      },
    )
    expect(price.platformFee).toBe(10000)
  })

  it('never goes below the minimum runner fee', () => {
    const price = calculatePrice({ category: 'pickup_delivery', transport: 'walking', distanceKm: 0 })
    expect(price.runnerFee).toBeGreaterThanOrEqual(50000)
  })

  it('returns whole naira on every line', () => {
    const price = calculatePrice({ category: 'custom', transport: 'bicycle', distanceKm: 1.37 })
    for (const value of [price.distanceCharge, price.platformFee, price.serviceTotal]) {
      expect(value % 100).toBe(0)
    }
  })

  it('rejects invalid input', () => {
    expect(() => calculatePrice({ category: 'custom', transport: 'keke', distanceKm: -1 })).toThrow()
    expect(() => calculatePrice({ category: 'custom', transport: 'keke', distanceKm: Number.NaN })).toThrow()
    expect(() => calculatePrice({ category: 'custom', transport: 'keke', distanceKm: 1, extraStops: 1.5 })).toThrow()
    expect(() =>
      calculatePrice({ category: 'custom', transport: 'keke', distanceKm: 1, shoppingBudget: 10.5 }),
    ).toThrow()
  })
})

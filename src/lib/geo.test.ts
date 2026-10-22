import { describe, expect, it } from 'vitest'
import { distanceKm, estimateRoadKm } from './geo'

describe('geo', () => {
  it('measures about 2.4 km for 0.0216 degrees of latitude', () => {
    const km = distanceKm({ lat: 8.8937, lng: 11.3596 }, { lat: 8.8937 + 0.0216, lng: 11.3596 })
    expect(km).toBeGreaterThan(2.3)
    expect(km).toBeLessThan(2.5)
  })
  it('estimates road distance above the straight line, never zero', () => {
    const a = { lat: 8.8937, lng: 11.3596 }
    expect(estimateRoadKm(a, a)).toBe(0.1)
    const b = { lat: 8.9137, lng: 11.3596 }
    expect(estimateRoadKm(a, b)).toBeGreaterThan(distanceKm(a, b))
  })
})

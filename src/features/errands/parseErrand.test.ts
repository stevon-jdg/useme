import { describe, expect, it } from 'vitest'
import { basicParse, fromRaw } from './parseErrand'

describe('basicParse', () => {
  it('finds from and to', () => {
    const p = basicParse('Pick up my parcel from Hammanyero to Sabon Gari. Handle with care')
    expect(p.pickupText).toBe('Hammanyero')
    expect(p.destinationText).toBe('Sabon Gari')
    expect(p.category).toBe('pickup_delivery')
    expect(p.source).toBe('basic')
  })
  it('finds only a destination', () => expect(basicParse('Please deliver this envelope to the airport road office').destinationText).toContain('airport road office'))
  it('never invents places', () => {
    const p = basicParse('Water my plants')
    expect(p.pickupText).toBeNull()
    expect(p.destinationText).toBeNull()
  })
  it('reads a budget in naira', () => expect(basicParse('Buy rice, I will give you ₦5,000').budgetNaira).toBe(5000))
})

describe('fromRaw', () => {
  it('keeps only valid values', () => {
    const p = fromRaw({ category: 'nonsense', title: ' ', extra_stops: 99, budget_naira: -5 }, 'Buy me bread')
    expect(p.category).toBe('custom')
    expect(p.title).toBe('Buy me bread')
    expect(p.extraStops).toBe(5)
    expect(p.budgetNaira).toBeNull()
    expect(p.source).toBe('ai')
  })
})

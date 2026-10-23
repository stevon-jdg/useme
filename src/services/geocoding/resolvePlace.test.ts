import { describe, expect, it } from 'vitest'
import { isConfident, placeQueries } from './resolvePlace'

const place = (label: string) => ({ label, area: label, lat: 8.9, lng: 11.36 })

describe('placeQueries', () => {
  it('adds the town when it is missing', () => expect(placeQueries('Roadblock park')).toContain('Roadblock park Jalingo'))
  it('does not add the town twice', () => expect(placeQueries('Roadblock Jalingo').filter((q) => /jalingo jalingo/i.test(q))).toHaveLength(0))
  it('drops filler words in a later phrase', () => expect(placeQueries('the shop near Barade').some((q) => /^shop Barade/i.test(q))).toBe(true))
  it('ignores very short text', () => expect(placeQueries('a')).toEqual([]))
})

describe('isConfident', () => {
  it('trusts a single result', () => expect(isConfident('anything', [place('Roadblock, Jalingo')])).toBe(true))
  it('trusts a name that matches', () => expect(isConfident('Roadblock', [place('Roadblock, Jalingo'), place('Roadblock Mile 6')])).toBe(true))
  it('does not trust a loose match', () => expect(isConfident('market', [place('Central Market, Jalingo'), place('Mile 6 Market')])).toBe(false))
  it('has no confidence in nothing', () => expect(isConfident('x', [])).toBe(false))
})

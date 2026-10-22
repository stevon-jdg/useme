import { describe, expect, it } from 'vitest'
import { mapGeoapify, mapPhoton } from './geocode'

describe('mapPhoton', () => {
  it('turns features into places with coordinates in the right order', () => {
    const places = mapPhoton({
      features: [
        { geometry: { coordinates: [11.36, 8.89] }, properties: { name: 'Jalingo Main Market', district: 'Sabon Gari', city: 'Jalingo' } },
        { geometry: { coordinates: [11.36, 8.89] }, properties: { name: 'Jalingo Main Market', district: 'Sabon Gari', city: 'Jalingo' } },
        { geometry: { coordinates: [1] }, properties: { name: 'broken' } },
        { geometry: { coordinates: [11.4, 8.9] }, properties: {} },
      ],
    })
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({ lat: 8.89, lng: 11.36, area: 'Sabon Gari' })
    expect(places[0]?.label).toContain('Jalingo Main Market')
  })
  it('copes with an empty answer', () => expect(mapPhoton({})).toEqual([]))
})

describe('mapGeoapify', () => {
  it('reads lat and lon', () => {
    const places = mapGeoapify({ features: [{ properties: { formatted: 'Hammanyero, Jalingo', suburb: 'Hammanyero', lat: 8.9, lon: 11.37 } }, { properties: {} }] })
    expect(places).toEqual([{ label: 'Hammanyero, Jalingo', area: 'Hammanyero', lat: 8.9, lng: 11.37 }])
  })
})

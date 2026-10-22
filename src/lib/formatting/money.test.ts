import { describe, expect, it } from 'vitest'
import { formatNaira, koboToNaira, nairaToKobo } from './money'

describe('money', () => {
  it('converts naira to integer kobo with rounding', () => {
    expect(nairaToKobo(1500)).toBe(150000)
    expect(nairaToKobo(10.555)).toBe(1056)
  })

  it('converts kobo back to naira', () => {
    expect(koboToNaira(150000)).toBe(1500)
  })

  it('formats whole naira without decimals', () => {
    expect(formatNaira(150000)).toContain('1,500')
    expect(formatNaira(150000)).not.toContain('.')
  })

  it('formats kobo when present', () => {
    expect(formatNaira(150050)).toContain('1,500.50')
  })

  it('rejects non-integer kobo', () => {
    expect(() => formatNaira(10.5)).toThrow()
    expect(() => koboToNaira(10.5)).toThrow()
  })

  it('rejects non-finite naira', () => {
    expect(() => nairaToKobo(Number.NaN)).toThrow()
  })
})

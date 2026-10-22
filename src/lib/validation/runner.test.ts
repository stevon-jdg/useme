import { describe, expect, it } from 'vitest'
import { ageOn, runnerApplicationSchema } from './runner'

const valid = {
  legalName: 'Ibrahim Musa',
  dateOfBirth: '1995-05-10',
  emergencyName: 'Amina Musa',
  emergencyPhone: '08031234567',
  emergencyConsent: true,
  conductAccepted: true,
  transports: ['walking'],
  plates: {},
}

describe('runnerApplicationSchema', () => {
  it('accepts a complete application', () => {
    expect(runnerApplicationSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects someone under 18', () => {
    const year = new Date().getUTCFullYear() - 16
    expect(runnerApplicationSchema.safeParse({ ...valid, dateOfBirth: `${year}-01-01` }).success).toBe(false)
  })

  it('requires consent and the code of conduct', () => {
    expect(runnerApplicationSchema.safeParse({ ...valid, emergencyConsent: false }).success).toBe(false)
    expect(runnerApplicationSchema.safeParse({ ...valid, conductAccepted: false }).success).toBe(false)
  })

  it('requires at least one transport type', () => {
    expect(runnerApplicationSchema.safeParse({ ...valid, transports: [] }).success).toBe(false)
  })

  it('rejects a bad emergency phone number', () => {
    expect(runnerApplicationSchema.safeParse({ ...valid, emergencyPhone: '123' }).success).toBe(false)
  })
})

describe('ageOn', () => {
  it('counts a birthday that has not happened yet this year', () => {
    expect(ageOn('2000-12-31', new Date('2026-06-01T00:00:00Z'))).toBe(25)
    expect(ageOn('2000-01-01', new Date('2026-06-01T00:00:00Z'))).toBe(26)
  })

  it('treats the birthday itself as the new age', () => {
    expect(ageOn('2008-10-21', new Date('2026-10-21T00:00:00Z'))).toBe(18)
    expect(ageOn('2008-10-22', new Date('2026-10-21T00:00:00Z'))).toBe(17)
  })
})

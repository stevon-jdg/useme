import { describe, expect, it } from 'vitest'
import { nigerianPhone, registerSchema } from './auth'

describe('nigerianPhone', () => {
  it.each(['08031234567', '+2348031234567', '0803 123 4567', '2348031234567', '07012345678'])(
    'accepts %s',
    (value) => {
      expect(nigerianPhone.safeParse(value).success).toBe(true)
    },
  )

  it.each(['12345', '0603123456', '080312345', 'abcdefghijk'])('rejects %s', (value) => {
    expect(nigerianPhone.safeParse(value).success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = {
    fullName: 'Amina Yusuf',
    email: 'amina@example.com',
    phone: '08031234567',
    password: 'longenough1',
    confirmPassword: 'longenough1',
  }

  it('accepts valid input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'different1' })
    expect(result.success).toBe(false)
  })

  it('rejects short passwords', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' })
    expect(result.success).toBe(false)
  })
})

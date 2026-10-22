import { z } from 'zod'

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address')

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer')

/**
 * Nigerian mobile numbers, accepted as 0803 000 0000 or +234 803 000 0000.
 * Spaces and dashes are ignored. This is a format check only, it does not
 * prove the number belongs to the person.
 */
export const nigerianPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^(?:\+234|234|0)[789][01]\d{8}$/.test(value), {
    message: 'Enter a valid Nigerian phone number',
  })

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    email,
    phone: nigerianPhone,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const forgotPasswordSchema = z.object({ email })

export type LoginValues = z.input<typeof loginSchema>
export type RegisterValues = z.input<typeof registerSchema>
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>

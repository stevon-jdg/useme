import { z } from 'zod'
import { nigerianPhone } from './auth'

const MIN_AGE = 18

function ageOn(dateOfBirth: string, today: Date): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`)
  let age = today.getUTCFullYear() - dob.getUTCFullYear()
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export const runnerApplicationSchema = z
  .object({
    legalName: z.string().trim().min(3, 'Enter your full legal name').max(120),
    dateOfBirth: z
      .string()
      .min(1, 'Enter your date of birth')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date')
      .refine((value) => ageOn(value, new Date()) >= MIN_AGE, `Runners must be at least ${MIN_AGE} years old`),
    emergencyName: z.string().trim().min(2, 'Enter your emergency contact name').max(120),
    emergencyPhone: nigerianPhone,
    emergencyConsent: z.boolean().refine((value) => value, 'We need your agreement to keep this contact'),
    conductAccepted: z.boolean().refine((value) => value, 'Accept the code of conduct to continue'),
    transports: z.array(z.string()).min(1, 'Choose at least one way you will travel'),
    plates: z.record(z.string(), z.string()),
  })

export type RunnerApplicationValues = z.input<typeof runnerApplicationSchema>

export { ageOn }

import { z } from 'zod'
import { getCategory, getTransport, type ErrandCategoryId } from './catalog'

const categoryIds = ['pickup_delivery', 'shopping', 'market_run', 'queue_collection', 'custom'] as const
const transportIds = ['walking', 'bicycle', 'keke', 'motorcycle', 'car'] as const

/** Parses a text input into a number, or NaN when empty or invalid. */
export function parseNumber(value: string | undefined): number {
  const text = (value ?? '').trim().replace(/,/g, '')
  return text === '' ? Number.NaN : Number(text)
}

/**
 * Number inputs stay as strings in the form so partial typing never fights the user.
 * They are converted with parseNumber() when the price is calculated.
 */
export const errandSchema = z
  .object({
    category: z.enum(categoryIds),
    title: z.string().trim().min(3, 'Give the errand a short title').max(80, 'Keep the title under 80 characters'),
    description: z.string().trim().max(600, 'Keep the description under 600 characters'),
    pickup: z.string().trim().max(160),
    destination: z.string().trim().max(160),
    transport: z.enum(transportIds),
    distanceKm: z.string(),
    extraStops: z.string(),
    shoppingBudget: z.string(),
    instructions: z.string().trim().max(400, 'Keep instructions under 400 characters'),
  })
  .superRefine((values, ctx) => {
    const category = getCategory(values.category as ErrandCategoryId)

    if (category.needsPickup && values.pickup.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['pickup'], message: 'Say where the runner should go or collect from' })
    }
    if (category.needsDestination && values.destination.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Say where the runner should deliver to' })
    }

    const distance = parseNumber(values.distanceKm)
    const maxKm = getTransport(values.transport).maxKm
    if (Number.isNaN(distance) || distance <= 0) {
      ctx.addIssue({ code: 'custom', path: ['distanceKm'], message: 'Enter the approximate distance in km' })
    } else if (distance > maxKm) {
      ctx.addIssue({
        code: 'custom',
        path: ['distanceKm'],
        message: `${getTransport(values.transport).label} runners take jobs up to ${maxKm} km. Pick a faster transport or a shorter trip.`,
      })
    }

    const stops = parseNumber(values.extraStops || '0')
    if (!Number.isInteger(stops) || stops < 0 || stops > 5) {
      ctx.addIssue({ code: 'custom', path: ['extraStops'], message: 'Enter a whole number from 0 to 5' })
    }

    if (category.allowsBudget && values.shoppingBudget.trim() !== '') {
      const budget = parseNumber(values.shoppingBudget)
      if (Number.isNaN(budget) || budget < 0 || budget > 50000) {
        ctx.addIssue({
          code: 'custom',
          path: ['shoppingBudget'],
          message: 'Enter an amount from ₦0 to ₦50,000. Larger budgets need a Trusted runner and are not available yet.',
        })
      }
    }
  })

export type ErrandFormValues = z.input<typeof errandSchema>

import type { Kobo } from '@/lib/formatting/money'
import type { ErrandCategoryId, TransportId } from '@/features/errands/catalog'

/**
 * Pricing engine, pure function version.
 *
 * ILLUSTRATIVE VALUES ONLY. These rates are placeholders, not validated Jalingo prices.
 * In Phase 5 this logic moves into a Postgres function that reads pricing_rules and stores
 * the result in pricing_quotes. The browser version stays only to preview a price quickly,
 * and the server result is the only one that is ever charged.
 *
 * Formula:
 *   runner fee   = base + distance charge + task fee + extra stops
 *   platform fee = percentage of runner fee, with a minimum
 *   total        = runner fee + platform fee
 * The shopping budget is never part of the total. It is returned separately.
 */

export type TransportRate = {
  baseFee: Kobo
  perKm: Kobo
}

export type PricingRules = {
  transport: Record<TransportId, TransportRate>
  taskFee: Record<ErrandCategoryId, Kobo>
  extraStopFee: Kobo
  /** Platform fee as a percentage of the runner fee, for example 12 for 12 percent. */
  platformFeePercent: number
  platformFeeMinimum: Kobo
  /** The runner fee never drops below this. */
  minimumRunnerFee: Kobo
}

export const ILLUSTRATIVE_RULES: PricingRules = {
  transport: {
    walking: { baseFee: 30000, perKm: 8000 },
    bicycle: { baseFee: 40000, perKm: 10000 },
    keke: { baseFee: 50000, perKm: 15000 },
    motorcycle: { baseFee: 50000, perKm: 15000 },
    car: { baseFee: 70000, perKm: 20000 },
  },
  taskFee: {
    pickup_delivery: 20000,
    shopping: 30000,
    market_run: 40000,
    queue_collection: 50000,
    custom: 30000,
  },
  extraStopFee: 10000,
  platformFeePercent: 12,
  platformFeeMinimum: 10000,
  minimumRunnerFee: 50000,
}

export type PriceInput = {
  category: ErrandCategoryId
  transport: TransportId
  distanceKm: number
  extraStops?: number
  /** Money the runner spends on the customer's behalf. Kept apart from the service cost. */
  shoppingBudget?: Kobo
}

export type PriceBreakdown = {
  baseFee: Kobo
  distanceCharge: Kobo
  taskFee: Kobo
  extraStopsCharge: Kobo
  runnerFee: Kobo
  platformFee: Kobo
  /** Service cost the customer pays: runner fee plus platform fee. */
  serviceTotal: Kobo
  shoppingBudget: Kobo
}

/** Rounds kobo to whole naira so every line on the receipt is a clean figure. */
function roundToNaira(kobo: number): Kobo {
  return Math.round(kobo / 100) * 100
}

export function calculatePrice(input: PriceInput, rules: PricingRules = ILLUSTRATIVE_RULES): PriceBreakdown {
  const { distanceKm } = input
  const extraStops = input.extraStops ?? 0

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error('calculatePrice: distance must be zero or more')
  }
  if (!Number.isInteger(extraStops) || extraStops < 0) {
    throw new Error('calculatePrice: extra stops must be a whole number')
  }
  const shoppingBudget = input.shoppingBudget ?? 0
  if (!Number.isInteger(shoppingBudget) || shoppingBudget < 0) {
    throw new Error('calculatePrice: shopping budget must be whole kobo, zero or more')
  }

  const rate = rules.transport[input.transport]
  const baseFee = rate.baseFee
  const distanceCharge = roundToNaira(distanceKm * rate.perKm)
  const taskFee = rules.taskFee[input.category]
  const extraStopsCharge = extraStops * rules.extraStopFee

  const runnerFee = Math.max(baseFee + distanceCharge + taskFee + extraStopsCharge, rules.minimumRunnerFee)
  const platformFee = Math.max(roundToNaira((runnerFee * rules.platformFeePercent) / 100), rules.platformFeeMinimum)

  return {
    baseFee,
    distanceCharge,
    taskFee,
    extraStopsCharge,
    runnerFee,
    platformFee,
    serviceTotal: runnerFee + platformFee,
    shoppingBudget,
  }
}

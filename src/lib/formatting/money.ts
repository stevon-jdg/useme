/**
 * Money is stored everywhere as integer kobo (1 naira = 100 kobo).
 * Only this module converts to display strings, so rounding lives in one place.
 */

export type Kobo = number

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const nairaFormatterWithKobo = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) {
    throw new Error('nairaToKobo: amount must be a finite number')
  }
  return Math.round(naira * 100)
}

export function koboToNaira(kobo: Kobo): number {
  if (!Number.isInteger(kobo)) {
    throw new Error('koboToNaira: kobo must be an integer')
  }
  return kobo / 100
}

/** Whole naira when there are no kobo, otherwise two decimals. */
export function formatNaira(kobo: Kobo): string {
  if (!Number.isInteger(kobo)) {
    throw new Error('formatNaira: kobo must be an integer')
  }
  return kobo % 100 === 0
    ? nairaFormatter.format(kobo / 100)
    : nairaFormatterWithKobo.format(kobo / 100)
}

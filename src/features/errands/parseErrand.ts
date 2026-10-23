import { supabase } from '@/lib/supabase/client'
import type { ErrandCategoryId } from './catalog'
import { inferCategory, titleFrom } from './inferCategory'

export type ParsedErrand = {
  category: ErrandCategoryId
  title: string
  summary: string
  pickupText: string | null
  destinationText: string | null
  /** True when the person means where they are, like "my house" or "here". The screen offers to use their location. */
  pickupIsMe: boolean
  destinationIsMe: boolean
  extraStops: number
  budgetNaira: number | null
  unsafe: boolean
  /** 'ai' when the AI read it, 'basic' when the simple fallback did. */
  source: 'ai' | 'basic'
}

/** "My house", "home", "here", "me": a place only the person can point to. */
export const MY_PLACE = /^(?:my[_ ]location|(?:to |at |from )?(?:my|our) (?:house|home|place|shop|office|room|compound|location)|home|here|where i am|me)$/i
export const isMyPlace = (t: string | null | undefined): boolean => Boolean(t && MY_PLACE.test(t.trim()))

const CATEGORIES: ErrandCategoryId[] = ['pickup_delivery', 'shopping', 'market_run', 'queue_collection', 'custom']

/**
 * The fallback when the AI is off or unreachable. It only understands "from X to Y" and a few keywords,
 * and it never invents places. The screen tells the person to check the details either way.
 */
export function basicParse(text: string): ParsedErrand {
  const t = text.trim()
  const end = '(?=\\s+(?:and|then|please|pls|for me|for us|before|after|because|so)\\b|[.,;\\n]|$)'
  const grab = (re: RegExp) => t.match(re)?.[1]?.trim().replace(/\s+/g, ' ') ?? null

  // "from X to Y" first, then looser phrasings people really write.
  const fromTo = t.match(new RegExp(`\\bfrom\\s+(.+?)\\s+(?:to|and (?:take|bring|deliver|drop|send) (?:it |them )?to)\\s+(.+?)${end}`, 'i'))
  let pickup = fromTo?.[1]?.trim() ?? null
  let dest = fromTo?.[2]?.trim() ?? null
  if (!pickup) pickup = grab(new RegExp(`\\b(?:pick ?up|collect|get|buy|take)\\b.*?\\b(?:from|at|in)\\s+(.+?)${end}`, 'i'))
  if (!dest) dest = grab(new RegExp(`\\b(?:deliver|bring|take|send|drop|carry)\\b.*?\\bto\\s+(.+?)${end}`, 'i'))
  if (!pickup && !dest) pickup = grab(new RegExp(`\\b(?:go to|visit|queue at|wait at|stand in line at|at)\\s+(.+?)${end}`, 'i'))
  if (dest && pickup && dest.toLowerCase() === pickup.toLowerCase()) dest = null

  const budget = t.match(/(?:₦|n|ngn)\s?([\d,]{3,9})/i)
  const pickupIsMe = isMyPlace(pickup)
  const destinationIsMe = isMyPlace(dest)
  return {
    category: inferCategory(t),
    title: titleFrom(t),
    summary: t.slice(0, 600),
    pickupText: pickupIsMe ? null : pickup,
    destinationText: destinationIsMe ? null : dest,
    pickupIsMe,
    destinationIsMe,
    extraStops: 0,
    budgetNaira: budget?.[1] ? Number(budget[1].replace(/,/g, '')) || null : null,
    unsafe: false,
    source: 'basic',
  }
}

type Raw = {
  category?: string
  title?: string | null
  summary?: string | null
  pickup_text?: string | null
  destination_text?: string | null
  extra_stops?: number
  budget_naira?: number | null
  unsafe?: boolean
}

export function fromRaw(raw: Raw, original: string): ParsedErrand {
  const category = CATEGORIES.includes(raw.category as ErrandCategoryId) ? (raw.category as ErrandCategoryId) : 'custom'
  return {
    category,
    title: raw.title?.trim() || titleFrom(original),
    summary: raw.summary?.trim() || original.slice(0, 600),
    pickupText: isMyPlace(raw.pickup_text) ? null : raw.pickup_text?.trim() || null,
    destinationText: isMyPlace(raw.destination_text) ? null : raw.destination_text?.trim() || null,
    pickupIsMe: isMyPlace(raw.pickup_text),
    destinationIsMe: isMyPlace(raw.destination_text),
    extraStops: Number.isInteger(raw.extra_stops) ? Math.min(5, Math.max(0, raw.extra_stops as number)) : 0,
    budgetNaira: typeof raw.budget_naira === 'number' && raw.budget_naira > 0 ? raw.budget_naira : null,
    unsafe: raw.unsafe === true,
    source: 'ai',
  }
}

/** Reads the errand with the AI Edge Function, falling back to the basic reader on any failure. */
export async function parseErrand(text: string): Promise<ParsedErrand> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('parse-errand', { body: { text } })
      if (!error && data && !data.error) return fromRaw(data as Raw, text)
      if (error) console.warn('[parse-errand]', error.message)
    } catch (e) {
      console.warn('[parse-errand]', e)
    }
  }
  return basicParse(text)
}

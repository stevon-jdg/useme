import { supabase } from '@/lib/supabase/client'
import type { ErrandCategoryId } from './catalog'
import { inferCategory, titleFrom } from './inferCategory'

export type ParsedErrand = {
  category: ErrandCategoryId
  title: string
  summary: string
  pickupText: string | null
  destinationText: string | null
  extraStops: number
  budgetNaira: number | null
  unsafe: boolean
  /** 'ai' when the AI read it, 'basic' when the simple fallback did. */
  source: 'ai' | 'basic'
}

const CATEGORIES: ErrandCategoryId[] = ['pickup_delivery', 'shopping', 'market_run', 'queue_collection', 'custom']

/**
 * The fallback when the AI is off or unreachable. It only understands "from X to Y" and a few keywords,
 * and it never invents places. The screen tells the person to check the details either way.
 */
export function basicParse(text: string): ParsedErrand {
  const t = text.trim()
  const fromTo = t.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:[.,;\n]|$)/i)
  const toOnly = t.match(/\b(?:deliver|bring|take|send|drop)\b.*?\bto\s+(.+?)(?:[.,;\n]|$)/i)
  const budget = t.match(/(?:₦|n|ngn)\s?([\d,]{3,9})/i)
  return {
    category: inferCategory(t),
    title: titleFrom(t),
    summary: t.slice(0, 600),
    pickupText: fromTo?.[1]?.trim() ?? null,
    destinationText: fromTo?.[2]?.trim() ?? toOnly?.[1]?.trim() ?? null,
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
    pickupText: raw.pickup_text?.trim() || null,
    destinationText: raw.destination_text?.trim() || null,
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

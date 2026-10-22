import type { ErrandCategoryId } from './catalog'

const RULES: { id: ErrandCategoryId; words: RegExp }[] = [
  { id: 'market_run', words: /\b(market|provisions?|tomato(es)?|peppers?|vegetables?|onions?|yam|groceries|foodstuff|fish|meat)\b/i },
  { id: 'shopping', words: /\b(buy|purchase|shop(ping)?|get me|pharmacy|drugs?|supermarket|store)\b/i },
  { id: 'queue_collection', words: /\b(queue|line up|stand in line|wait in line|collect|register|registration|bank|atm|office)\b/i },
  { id: 'pickup_delivery', words: /\b(deliver(y)?|drop( off)?|pick ?up|send|take|parcel|package|dispatch|bring)\b/i },
]

/** Guesses the errand type from what the person typed. The person can change it on the next screen. */
export function inferCategory(text: string): ErrandCategoryId {
  for (const rule of RULES) if (rule.words.test(text)) return rule.id
  return 'custom'
}

/** First sentence or line, trimmed to the 80 characters a title can hold. */
export function titleFrom(text: string): string {
  const first = text.trim().split(/[\n.!?]/)[0]?.trim() ?? ''
  if (first.length <= 80) return first
  return first.slice(0, 77).trimEnd() + '…'
}

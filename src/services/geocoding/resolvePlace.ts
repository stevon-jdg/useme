import { searchPlaces, type Place } from './geocode'

const FILLER = /\b(the|a|an|my|our|near|opposite|behind|beside|besides|around|close to|inside|along|at|in|by|junction|area)\b/gi

/** Turns what a person typed into a few search phrases, most exact first. Local places often need "Jalingo" added. */
export function placeQueries(text: string): string[] {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (raw.length < 3) return []
  const plain = raw.replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
  const withTown = (s: string) => (/jalingo/i.test(s) ? s : `${s} Jalingo`)
  const list = [raw, withTown(raw), plain, withTown(plain)].filter((s) => s.length >= 3)
  return [...new Set(list.map((s) => s.toLowerCase()))].map((lower) => list.find((s) => s.toLowerCase() === lower) as string)
}

/** A match is confident when it is the only result, or its name is what the person typed. */
export function isConfident(text: string, results: Place[]): boolean {
  if (results.length === 0) return false
  if (results.length === 1) return true
  const typed = text.toLowerCase().replace(FILLER, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const first = (results[0]?.label.split(',')[0] ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  return typed.length >= 3 && first.length >= 3 && (first === typed || (first.length >= 5 && typed.includes(first)))
}

export type Resolved = { best: Place | null; alternatives: Place[]; confident: boolean }

/** Finds the places a typed phrase could mean. Tries several phrasings so people do not need exact spelling. */
export async function resolvePlace(text: string, signal?: AbortSignal): Promise<Resolved> {
  for (const query of placeQueries(text)) {
    const results = await searchPlaces(query, signal)
    if (results.length > 0) {
      const confident = isConfident(text, results)
      return { best: confident ? (results[0] ?? null) : null, alternatives: results.slice(0, 4), confident }
    }
  }
  return { best: null, alternatives: [], confident: false }
}

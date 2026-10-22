import { supabase } from './client'

/** Error codes our database functions raise on purpose. Their message is written for people. */
const READABLE_CODES = new Set(['42501', '22023', '55000', 'P0002', '28000', '23514'])

/**
 * Calls a database function and turns failures into an Error with a message a person can read.
 * Messages raised on purpose by our functions pass through. Anything else stays generic.
 */
export async function callRpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('The app is not connected to Supabase yet.')
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    console.error(`[rpc] ${name} failed`, error)
    if (error.code && READABLE_CODES.has(error.code)) throw new Error(error.message)
    if (/failed to fetch|network/i.test(error.message)) {
      throw new Error('Could not reach the server. Check your connection and try again.')
    }
    throw new Error(import.meta.env.DEV ? `Something went wrong: ${error.message}` : 'Something went wrong. Please try again.')
  }
  return data as T
}

/** Same idea for plain table reads and writes that return a Supabase error object. */
export function readableError(error: { message: string } | null | undefined): Error | null {
  if (!error) return null
  console.error('[supabase]', error)
  if (/failed to fetch|network/i.test(error.message)) {
    return new Error('Could not reach the server. Check your connection and try again.')
  }
  return new Error(import.meta.env.DEV ? error.message : 'Something went wrong. Please try again.')
}

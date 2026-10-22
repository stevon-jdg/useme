import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './client'

/** Returns the client, or throws a clear error when the app has no Supabase values. */
export function db(): SupabaseClient {
  if (!supabase) {
    throw new Error('The app is not connected to Supabase. Add the values to .env.local and restart.')
  }
  return supabase
}

/** Turns a failed Supabase call into an Error. Database messages are written to be shown to people. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

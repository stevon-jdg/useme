import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True only when both public Supabase values are present in the environment. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The anon key is public by design. Data is protected by Row Level Security,
 * never by hiding this key. The service role key must never appear in this app.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

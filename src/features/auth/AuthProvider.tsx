import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; message: string }

type AuthContextValue = {
  session: Session | null
  user: User | null
  /** True until the first session check finishes, so guards do not flash a redirect. */
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (input: { email: string; password: string; fullName: string; phone: string }) => Promise<AuthResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message: 'The app is not connected to Supabase yet. Add the values in .env.local and restart.',
}

/** Turns Supabase error text into something a customer can act on. */
function friendlyAuthMessage(raw: string): string {
  console.error('[auth] Supabase said:', raw)
  const text = raw.toLowerCase()
  if (text.includes('invalid login credentials')) return 'The email or password is not correct.'
  if (text.includes('email not confirmed')) return 'Confirm your email first, then sign in. Check your inbox.'
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'Too many attempts or emails sent. Wait a while and try again.'
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  // In dev, show the real reason so setup problems are easy to find. Production keeps it generic.
  return import.meta.env.DEV ? `Something went wrong: ${raw}` : 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .catch((error: unknown) => {
        console.error('[auth] could not read session', error)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,

      async signIn(email, password) {
        if (!supabase) return NOT_CONFIGURED
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, message: friendlyAuthMessage(error.message) }
        return { ok: true }
      },

      async signUp({ email, password, fullName, phone }) {
        if (!supabase) return NOT_CONFIGURED
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (error) return { ok: false, message: friendlyAuthMessage(error.message) }
        // With email confirmation switched on, Supabase returns a user but no session.
        return { ok: true, needsEmailConfirmation: !data.session }
      },

      async signOut() {
        if (!supabase) return
        const { error } = await supabase.auth.signOut()
        if (error) console.error('[auth] sign out failed', error)
      },

      async requestPasswordReset(email) {
        if (!supabase) return NOT_CONFIGURED
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        })
        if (error) return { ok: false, message: friendlyAuthMessage(error.message) }
        return { ok: true }
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

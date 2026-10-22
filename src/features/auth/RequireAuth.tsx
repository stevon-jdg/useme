import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * Route guard for signed-in screens. This is a convenience for the user only.
 * Real protection is Row Level Security in the database, never this component.
 */
export function RequireAuth() {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
        <Loader2 className="size-8 animate-spin text-brand-red" aria-hidden="true" />
      </div>
    )
  }

  // Preview mode for design review: only in `npm run dev`, only while Supabase is not configured.
  // A production build never takes this branch, so it cannot expose anything.
  if (!configured && import.meta.env.DEV) {
    return <Outlet />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

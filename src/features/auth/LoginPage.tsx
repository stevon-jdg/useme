import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { TextField } from '@/components/ui/TextField'
import { loginSchema, type LoginValues } from '@/lib/validation/auth'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { signIn, user, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const destination = (location.state as { from?: string } | null)?.from ?? '/app'

  if (user) return <Navigate to={destination} replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await signIn(values.email, values.password)
    if (result.ok) {
      navigate(destination, { replace: true })
    } else {
      setFormError(result.message)
    }
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to request errands or see your jobs."
      footer={
        <>
          New to UseMe?{' '}
          <Link to="/register" className="font-semibold text-brand-red underline">
            Create an account
          </Link>
        </>
      }
    >
      {!configured ? (
        <Notice tone="warning">
          Sign-in is not available yet because the app is not connected to Supabase. See the README for setup.
        </Notice>
      ) : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-red underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!configured}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}

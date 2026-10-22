import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { TextField } from '@/components/ui/TextField'
import { registerSchema, type RegisterValues } from '@/lib/validation/auth'
import { useAuth } from './AuthProvider'

export function RegisterPage() {
  const { signUp, user, configured } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  if (user && !confirmEmailSentTo) return <Navigate to="/app" replace />

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const parsed = registerSchema.parse(values)
    const result = await signUp({
      email: parsed.email,
      password: parsed.password,
      fullName: parsed.fullName,
      phone: parsed.phone,
    })
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    if (result.needsEmailConfirmation) {
      setConfirmEmailSentTo(parsed.email)
    } else {
      navigate('/app', { replace: true })
    }
  })

  if (confirmEmailSentTo) {
    return (
      <AuthLayout title="Check your email">
        <Notice tone="success">
          We sent a confirmation link to <strong>{confirmEmailSentTo}</strong>. Open it, then sign in.
        </Notice>
        <Link to="/login" className="inline-block font-semibold text-brand-red underline">
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account to request errands. You can apply to become a runner later."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-red underline">
            Sign in
          </Link>
        </>
      }
    >
      {!configured ? (
        <Notice tone="warning">
          Registration is not available yet because the app is not connected to Supabase. See the README.
        </Notice>
      ) : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Phone number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          hint="Used for delivery coordination. It is not shown to runners until a job is assigned."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!configured}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}

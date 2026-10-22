import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { TextField } from '@/components/ui/TextField'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validation/auth'
import { useAuth } from './AuthProvider'

export function ForgotPasswordPage() {
  const { requestPasswordReset, configured } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await requestPasswordReset(values.email)
    if (result.ok) {
      setSentTo(values.email)
    } else {
      setFormError(result.message)
    }
  })

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send a reset link."
      footer={
        <Link to="/login" className="font-semibold text-brand-red underline">
          Back to sign in
        </Link>
      }
    >
      {!configured ? (
        <Notice tone="warning">Password reset is not available until the app is connected to Supabase.</Notice>
      ) : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {sentTo ? (
        <Notice tone="success">
          If an account exists for <strong>{sentTo}</strong>, a reset link is on its way.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!configured}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

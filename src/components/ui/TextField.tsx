import { forwardRef, useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

/**
 * Labelled input with an inline error. Works with react-hook-form's register().
 * The error is linked with aria-describedby so screen readers announce it.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const hasMessage = Boolean(error || hint)

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={[
          'block min-h-12 w-full rounded-control border bg-surface px-3.5 text-base text-ink',
          'placeholder:text-ink-soft/70',
          error ? 'border-brand-red' : 'border-line',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {hasMessage ? (
        <p id={messageId} className={error ? 'text-sm font-medium text-brand-red' : 'text-sm text-ink-soft'}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  )
})

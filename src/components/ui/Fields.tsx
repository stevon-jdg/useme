import { forwardRef, useId, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const control =
  'block w-full rounded-control border bg-surface px-3.5 text-base text-ink placeholder:text-ink-soft/70'

type Shared = { label: string; error?: string; hint?: string }

export const TextAreaField = forwardRef<HTMLTextAreaElement, Shared & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, error, hint, id, ...rest }, ref) {
    const generated = useId()
    const inputId = id ?? generated
    const messageId = `${inputId}-message`
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`${control} min-h-24 py-3 ${error ? 'border-brand-red' : 'border-line'}`}
          {...rest}
        />
        {error || hint ? (
          <p id={messageId} className={error ? 'text-sm font-medium text-brand-red' : 'text-sm text-ink-soft'}>
            {error ?? hint}
          </p>
        ) : null}
      </div>
    )
  },
)

export const SelectField = forwardRef<HTMLSelectElement, Shared & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, id, children, ...rest }, ref) {
    const generated = useId()
    const inputId = id ?? generated
    const messageId = `${inputId}-message`
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={`${control} min-h-12 ${error ? 'border-brand-red' : 'border-line'}`}
          {...rest}
        >
          {children}
        </select>
        {error || hint ? (
          <p id={messageId} className={error ? 'text-sm font-medium text-brand-red' : 'text-sm text-ink-soft'}>
            {error ?? hint}
          </p>
        ) : null}
      </div>
    )
  },
)

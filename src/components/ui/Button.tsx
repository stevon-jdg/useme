import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60 select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-red text-white hover:bg-brand-red-dark',
  secondary: 'border-2 border-brand-red bg-surface text-brand-red hover:bg-brand-red-soft',
  dark: 'bg-ink text-white hover:bg-black',
  ghost: 'text-ink hover:bg-black/5',
}

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
}

function classes(variant: Variant, size: Size, fullWidth: boolean, extra?: string) {
  return [base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', extra ?? '']
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  /** Shows a spinner and blocks repeat clicks while a request is running. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes(variant, size, fullWidth, className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

type ButtonLinkProps = LinkProps & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={classes(variant, size, fullWidth, className)} {...rest} />
}

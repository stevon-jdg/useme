import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <header className="mb-8">
        <Link to="/" aria-label="UseMe Courier Service home">
          <Logo variant="stacked" />
        </Link>
      </header>
      <main className="flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-ink-soft">{subtitle}</p> : null}
        <div className="mt-6 space-y-4">{children}</div>
      </main>
      {footer ? <footer className="mt-8 pb-2 text-center text-sm text-ink-soft">{footer}</footer> : null}
    </div>
  )
}

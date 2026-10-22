import type { HTMLAttributes } from 'react'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['rounded-card border border-line bg-surface p-4 shadow-card', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}

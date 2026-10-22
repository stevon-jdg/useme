type LogoProps = {
  /** "stacked" shows the tagline-free wordmark with the full name beneath it. */
  variant?: 'inline' | 'stacked'
}

/** Speed-lines runner mark plus the UseMe wordmark. Original artwork, not the concept image. */
export function Logo({ variant = 'inline' }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="UseMe Courier Service">
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#D9272E" />
        <path d="M10 24h18M6 33h16M12 42h14" stroke="#FFC928" strokeWidth="4" strokeLinecap="round" />
        <circle cx="44" cy="17" r="6" fill="#fff" />
        <path
          d="M42 26l-9 12 8 4-4 12M42 26l9 7 6-2M41 42l9 4"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="leading-none">
        <span className="block text-xl font-extrabold tracking-tight text-ink">
          Use<span className="text-brand-red">Me</span>
        </span>
        {variant === 'stacked' ? (
          <span className="mt-1 block text-xs font-medium text-ink-soft">Courier Service</span>
        ) : null}
      </span>
    </span>
  )
}

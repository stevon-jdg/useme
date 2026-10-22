/** Faint street-map texture used behind the header and the white sheet. Decorative; colour comes from the text colour. */
export function MapLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M-10 90 L410 40" strokeWidth="9" />
        <path d="M-10 250 C120 220 240 300 410 230" strokeWidth="7" />
        <path d="M-10 430 L410 380" strokeWidth="10" />
        <path d="M60 -10 L110 610" strokeWidth="8" />
        <path d="M250 -10 C230 200 300 400 280 610" strokeWidth="9" />
        <path d="M370 -10 L330 610" strokeWidth="6" />
        <path d="M-10 160 L300 130 M-10 340 L400 320 M-10 520 L400 560" strokeWidth="3" />
        <path d="M150 -10 L190 610 M20 -10 L-10 200 M330 140 L410 330" strokeWidth="3" />
        <path d="M110 300 L250 270 M120 480 L270 460 M180 80 L340 110" strokeWidth="2.5" />
      </g>
    </svg>
  )
}

/** Yellow running courier with a parcel and speed swoosh. Original artwork for the UseMe mark. */
export function CourierMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden="true" focusable="false">
      <path d="M4 50 C20 44 36 46 52 54" stroke="#ffc928" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M14 38 h20 M8 30 h14" stroke="#ffc928" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
      <circle cx="58" cy="12" r="7" fill="#ffc928" />
      <path d="M56 22 l-12 16 l10 5 l-5 14" stroke="#ffc928" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M56 22 l9 9 l10 -4" stroke="#ffc928" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M54 43 l12 6 l2 9" stroke="#ffc928" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="70" y="16" width="18" height="15" rx="2.5" fill="#ffc928" />
      <path d="M70 22 h18" stroke="#171717" strokeWidth="2" opacity="0.5" />
    </svg>
  )
}

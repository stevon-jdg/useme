/** Original flat illustration: a courier on a scooter with a parcel. Decorative only. */
export function CourierRider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 170" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="112" cy="156" rx="92" ry="8" fill="#171717" opacity="0.12" />
      {/* parcels on the rack */}
      <rect x="26" y="70" width="44" height="40" rx="4" fill="#F47721" />
      <rect x="26" y="70" width="44" height="9" rx="3" fill="#d9611a" />
      <rect x="44" y="70" width="8" height="40" fill="#ffc928" opacity="0.9" />
      {/* scooter body */}
      <path d="M62 112 h66 l16 -34 h14 a6 6 0 0 1 6 6 v6 h-12 l-14 38 H70 z" fill="#d9272e" />
      <rect x="64" y="118" width="86" height="9" rx="4" fill="#171717" />
      <path d="M144 78 l8 -22 h14" stroke="#171717" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="168" cy="56" r="5" fill="#ffc928" />
      {/* wheels */}
      <circle cx="62" cy="134" r="18" fill="#171717" />
      <circle cx="62" cy="134" r="8" fill="#e6e6e1" />
      <circle cx="160" cy="134" r="18" fill="#171717" />
      <circle cx="160" cy="134" r="8" fill="#e6e6e1" />
      {/* rider */}
      <path d="M96 112 l-6 -28 a10 10 0 0 1 10 -12 h14 a10 10 0 0 1 10 10 l-4 30 z" fill="#2f4f8f" />
      <path d="M118 90 l26 -2 l4 7 l-28 6 z" fill="#2f4f8f" />
      <path d="M104 112 l-4 26 h12 l8 -26 z" fill="#1f2d4d" />
      <rect x="104" y="42" width="20" height="30" rx="8" fill="#d9272e" />
      <path d="M100 56 a18 18 0 0 1 36 0 v6 h-36 z" fill="#d9272e" />
      <circle cx="118" cy="62" r="11" fill="#8a5a3c" />
      <path d="M118 52 a18 18 0 0 1 18 10 h-28 a18 18 0 0 1 10 -10 z" fill="#d9272e" />
      <rect x="114" y="58" width="22" height="5" rx="2" fill="#ffc928" />
    </svg>
  )
}

import type { ReactElement } from 'react'

// Mirrors resources/icon.svg — inlined (rather than referenced via <img>) so
// its `currentColor` stroke picks up the surrounding text color and adapts
// to light/dark theme automatically.
export function AppLogo(): ReactElement {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 8 H40 L54 22 V50 A6 6 0 0 1 48 56 H16 A6 6 0 0 1 10 50 V14 A6 6 0 0 1 16 8 Z" />
      <circle cx={40} cy={18} r={3} />
      <rect x={19} y={25} width={26} height={18} rx={3} />
      <path d="M25 25l2-4h10l2 4" />
      <circle cx={32} cy={34} r={5} />
    </svg>
  )
}

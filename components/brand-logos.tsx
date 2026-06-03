'use client'

// Brand logo marks for the theme picker, taken from each project's
// official logo:
// - Hono: the orange→red flame (hono.dev/images/logo.svg)
// - Barefoot.js: the footprint pads from barefootjs.dev/static/logo.svg
// - piconic: the "p" glyph from the piconic wordmark, in brand green
//
// viewBoxes are padded to roughly square so a square sizing class
// (e.g. `size-4`) doesn't distort them.

interface BrandLogoProps {
  className?: string
}

export function HonoLogo({ className = '' }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-11 0 98 98"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="koma-hono-flame" x2="0%" y2="100%">
          <stop stop-color="#ff8844" />
          <stop offset="100%" stop-color="#ff3300" />
        </linearGradient>
      </defs>
      <path
        fill="url(#koma-hono-flame)"
        d="m11 25 7 9s9-18 22-34c17 20 36 48 36 64 0 20-19 34-37 34C17 98 0 81 0 61c0-6 3-24 11-36Z"
      />
      <path fill="#ff9955" d="M39 21c47 51 14 66 0 66-11 0-51-11 0-66Z" />
    </svg>
  )
}

export function BarefootLogo({ className = '' }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 2 42 42"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M8.5495 25.7868C10.758 25.195 11.9088 22.3281 11.1197 19.3833C10.3307 16.4386 7.9006 14.5312 5.6921 15.1229C3.4836 15.7147 2.3328 18.5816 3.1218 21.5264C3.9109 24.4711 6.3409 26.3785 8.5495 25.7868Z" />
      <path d="M17.48 23.74C19.2411 23.4925 20.382 21.2524 20.0285 18.7366C19.6749 16.2208 17.9607 14.382 16.1996 14.6295C14.4386 14.877 13.2976 17.1171 13.6511 19.6329C14.0047 22.1487 15.719 23.9875 17.48 23.74Z" />
      <path d="M24.84 25.12C26.3643 25.12 27.6 23.2665 27.6 20.98C27.6 18.6935 26.3643 16.84 24.84 16.84C23.3157 16.84 22.08 18.6935 22.08 20.98C22.08 23.2665 23.3157 25.12 24.84 25.12Z" />
      <path d="M31.4721 27.8934C32.6042 28.0525 33.7226 26.7539 33.9701 24.9929C34.2176 23.2318 33.5004 21.6752 32.3683 21.5161C31.2362 21.357 30.1178 22.6556 29.8703 24.4167C29.6228 26.1777 30.34 27.7343 31.4721 27.8934Z" />
      <path d="M36.5024 32.2108C37.3612 32.4409 38.3507 31.5334 38.7123 30.1837C39.0739 28.834 38.6709 27.5534 37.812 27.3232C36.9531 27.0931 35.9637 28.0006 35.602 29.3503C35.2404 30.7 35.6435 31.9807 36.5024 32.2108Z" />
    </svg>
  )
}

export function PiconicLogo({ className = '' }: BrandLogoProps) {
  // piconic-ai/public/favicon.svg — a solid brand-green disc.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill="#00b769" />
    </svg>
  )
}

export function P2BHausLogo({ className = '' }: BrandLogoProps) {
  // P2B Haus brand icon (the golden tilde mark), served from /public.
  return (
    <img
      src="/p2bhaus.webp"
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-[4px] object-cover ${className}`}
    />
  )
}

// 和柄 preset marks — drawn motifs (not brands): a cherry blossom, a bowl of
// whisked matcha, and a sumi-ink brush dot. Tinted to each preset's palette.

export function SakuraLogo({ className = '' }: BrandLogoProps) {
  // Five-petal cherry blossom, each petal a rounded teardrop with a notched
  // tip, rotated 72° around the centre.
  const petal = 'M50 50 C40 30 40 14 50 6 C60 14 60 30 50 50 Z'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <g fill="#f48fb1">
        <path d={petal} />
        <path d={petal} transform="rotate(72 50 50)" />
        <path d={petal} transform="rotate(144 50 50)" />
        <path d={petal} transform="rotate(216 50 50)" />
        <path d={petal} transform="rotate(288 50 50)" />
      </g>
      <circle cx="50" cy="50" r="7" fill="#e0578a" />
    </svg>
  )
}

export function MatchaLogo({ className = '' }: BrandLogoProps) {
  // A tea bowl holding a disc of whisked matcha.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M18 46 H82 A32 32 0 0 1 18 46 Z" fill="#5f7d36" />
      <ellipse cx="50" cy="46" rx="32" ry="8" fill="#94ad62" />
    </svg>
  )
}

export function SumiLogo({ className = '' }: BrandLogoProps) {
  // A single sumi-ink brush dot — an off-round blot, as if pressed onto washi.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        fill="#1b1a17"
        d="M50 12 C72 12 86 28 86 50 C86 74 70 88 48 88 C26 88 14 70 14 48 C14 26 30 12 50 12 Z"
      />
    </svg>
  )
}

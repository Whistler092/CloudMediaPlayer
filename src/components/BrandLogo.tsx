import type { ReactNode } from 'react'
import type { BrandLogoVariant } from '../config/brandLogoVariant'
import { BRAND_LOGO_VARIANT } from '../config/brandLogoVariant'

type Props = {
  size?: number
  className?: string
  /** Si se indica, el icono es reconocible por lectores de pantalla (p. ej. login). */
  accessibleName?: string
  /** Por defecto toma `BRAND_LOGO_VARIANT` en `src/config/brandLogoVariant.ts`. */
  variant?: BrandLogoVariant
}

function MarkCloudPlay() {
  return (
    <>
      <path
        className="brand-logo__cloud"
        d="M9.2 23.5c-2.9 0-5.2-2.3-5.2-5.1 0-2.4 1.6-4.4 3.9-5 .5-3.1 3.3-5.4 6.6-5.4 2.5 0 4.7 1.3 5.9 3.2 1-.4 2-.6 3.1-.6 4.2 0 7.6 3.1 7.9 7.1 2 .4 3.6 2.2 3.6 4.3 0 2.4-2 4.4-4.4 4.4H9.2z"
      />
      <path className="brand-logo__play" d="M13 11.5v9l7.5-4.5L13 11.5z" />
    </>
  )
}

function MarkStream() {
  return (
    <>
      <rect className="brand-logo__frame" x="4.5" y="4.5" width="23" height="23" rx="5.5" ry="5.5" />
      <rect className="brand-logo__bar" x="8.5" y="17" width="3.4" height="9" rx="1" />
      <rect className="brand-logo__bar" x="14.3" y="11" width="3.4" height="15" rx="1" />
      <rect className="brand-logo__bar" x="20.1" y="14" width="3.4" height="12" rx="1" />
    </>
  )
}

function MarkRingPlay() {
  return (
    <>
      <circle className="brand-logo__ring-circle" cx="16" cy="16" r="10.75" />
      <path className="brand-logo__play" d="M13.8 11.8v8.4l7-4.2-7-4.2z" />
    </>
  )
}

function MarkMusic() {
  return (
    <g transform="translate(2.25 2) scale(1.12)">
      <path
        className="brand-logo__music-stem"
        fill="none"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 18.25V5.25l12-2.25v13"
      />
      <circle className="brand-logo__music-dot" cx="6" cy="18.25" r="2.85" />
      <circle className="brand-logo__music-dot" cx="18" cy="16" r="2.85" />
    </g>
  )
}

export function BrandLogo({ size = 28, className, accessibleName, variant = BRAND_LOGO_VARIANT }: Props) {
  const decorative = !accessibleName
  const v = variant

  let inner: ReactNode
  switch (v) {
    case 'cloud-play':
      inner = <MarkCloudPlay />
      break
    case 'stream':
      inner = <MarkStream />
      break
    case 'ring-play':
      inner = <MarkRingPlay />
      break
    case 'music':
      inner = <MarkMusic />
      break
    default:
      inner = <MarkStream />
  }

  return (
    <svg
      className={['brand-logo', `brand-logo--${v}`, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative}
      aria-label={accessibleName}
    >
      {inner}
    </svg>
  )
}

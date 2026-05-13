/** Marca visual: nube + reproducción (música en la nube), sin depender de assets externos. */
export function BrandLogo({
  size = 28,
  className,
  accessibleName,
}: {
  size?: number
  className?: string
  /** Si se indica, el icono es reconocible por lectores de pantalla (p. ej. login). */
  accessibleName?: string
}) {
  const decorative = !accessibleName
  return (
    <svg
      className={['brand-logo', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative}
      aria-label={accessibleName}
    >
      <path
        className="brand-logo__cloud"
        d="M9.2 23.5c-2.9 0-5.2-2.3-5.2-5.1 0-2.4 1.6-4.4 3.9-5 .5-3.1 3.3-5.4 6.6-5.4 2.5 0 4.7 1.3 5.9 3.2 1-.4 2-.6 3.1-.6 4.2 0 7.6 3.1 7.9 7.1 2 .4 3.6 2.2 3.6 4.3 0 2.4-2 4.4-4.4 4.4H9.2z"
      />
      <path className="brand-logo__play" d="M13 11.5v9l7.5-4.5L13 11.5z" />
    </svg>
  )
}

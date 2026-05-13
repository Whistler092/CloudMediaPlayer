/**
 * Variantes del icono de marca (`BrandLogo`).
 *
 * Cambia `BRAND_LOGO_VARIANT` para comparar en la app:
 * - `cloud-play` — nube + triángulo play (original).
 * - `stream` — marco redondeado + barras tipo ecualizador / “streaming”.
 * - `ring-play` — círculo + play centrado, muy legible a tamaño chico.
 * - `music` — nota con pauta (estilo reproductor clásico, simplificado).
 */
export const BRAND_LOGO_VARIANTS = ['cloud-play', 'stream', 'ring-play', 'music'] as const
export type BrandLogoVariant = (typeof BRAND_LOGO_VARIANTS)[number]

export const BRAND_LOGO_VARIANT: BrandLogoVariant = 'stream'

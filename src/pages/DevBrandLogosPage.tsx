import { BrandLogo } from '../components/BrandLogo'
import { BRAND_LOGO_VARIANTS, type BrandLogoVariant } from '../config/brandLogoVariant'

const BLURB: Record<BrandLogoVariant, string> = {
  'cloud-play': 'Nube + play (referencia “en la nube”).',
  stream: 'Marco + barras; sensación streaming / ecualizador.',
  'ring-play': 'Aro + play; muy claro en tamaño pequeño.',
  music: 'Nota con pauta; guiño a reproductor de música clásico.',
}

export function DevBrandLogosPage() {
  return (
    <div className="dev-brand-layout">
      <div className="page dev-brand-logos-page">
      <h1>Variantes del icono de marca</h1>
      <p className="page-lead">
        Solo en desarrollo. Para usar uno en la app, edita{' '}
        <code>BRAND_LOGO_VARIANT</code> en <code>src/config/brandLogoVariant.ts</code>.
      </p>
      <ul className="dev-brand-logos-grid">
        {BRAND_LOGO_VARIANTS.map((v) => (
          <li key={v} className="dev-brand-logos-card">
            <BrandLogo variant={v} size={56} />
            <div className="dev-brand-logos-meta">
              <code className="dev-brand-logos-key">{v}</code>
              <p className="muted small">{BLURB[v]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
    </div>
  )
}

// Banner angosto debajo del header. `text`/`visible` vienen de Apariencia
// (StorefrontConfig.shippingText/showAnnouncementBar) — los defaults acá
// abajo son solo para páginas que todavía no pasan esos props.
const DEFAULT_TEXT = 'Envíos gratis en compras mayores a $30.000 · Cambios en 30 días'

export function AnnouncementBar({ text, visible = true }: { text?: string | null; visible?: boolean }) {
  const contenido = text?.trim() || DEFAULT_TEXT
  if (!visible) return null
  return (
    <div style={{
      height: 40, display: 'grid', placeItems: 'center',
      background: 'linear-gradient(90deg, #1D4ED8, #3B82F6, #1D4ED8)',
      backgroundSize: '200% 100%',
      color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
      padding: '0 16px', textAlign: 'center',
    }}>
      ✦&nbsp;&nbsp;{contenido}&nbsp;&nbsp;✦
    </div>
  )
}

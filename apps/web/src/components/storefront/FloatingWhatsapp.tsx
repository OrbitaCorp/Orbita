// Botón flotante de WhatsApp — gateado por el toggle "WhatsApp flotante" de
// Apariencia (StorefrontConfig.showWhatsapp) y por si el negocio cargó un
// número real en Configuración → Contacto.

import { openWpp } from '@/lib/storefront/utils'

type Props = { wpp: string; visible: boolean }

export function FloatingWhatsapp({ wpp, visible }: Props) {
  if (!visible || !wpp) return null
  return (
    <button
      onClick={() => openWpp(wpp, 'Hola! Quería hacer una consulta.')}
      aria-label="Escribinos por WhatsApp"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 60,
        width: 56, height: 56, borderRadius: '50%',
        background: '#25D366', border: 'none', cursor: 'pointer',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 8px 24px rgba(37,211,102,0.45)',
        transition: 'transform 150ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
      </svg>
    </button>
  )
}

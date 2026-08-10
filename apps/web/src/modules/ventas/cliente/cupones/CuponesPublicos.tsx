import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Tag, Copy, Check, ArrowRight, Calendar, ShoppingBag } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { getStorefrontConfig, getStorefrontCoupons, toTiendaConfig, toCupon, type StorefrontConfigResponse } from '@/lib/storefront/api'
import type { Cupon } from '@/lib/storefront/types'
import { fmt } from '@/lib/storefront/utils'

export default function CuponesPublicos() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [cupones, setCupones] = useState<Cupon[]>([])
  const [cargando, setCargando] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    getStorefrontCoupons(slug)
      .then((rows) => setCupones(rows.map(toCupon)))
      .catch(() => setCupones([]))
      .finally(() => setCargando(false))
  }, [slug])

  function copiar(codigo: string) {
    navigator.clipboard.writeText(codigo).catch(() => {})
    setCopiado(codigo)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-cup-wrap { padding: 16px 16px 48px !important; }
          .sf-cup-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
      <AnnouncementBar text={config?.appearance?.shippingText} visible={config?.appearance?.showAnnouncementBar ?? true} />

      <div className="sf-cup-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Cupones' }]} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <Tag size={18} color="#fff" strokeWidth={2} />
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
                Cupones disponibles
              </h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
              {cupones.length} cupones activos · Copiá el código y aplicalo en el carrito
            </p>
          </div>
          <button
            onClick={() => router.push(`${base}/carrito`)}
            style={{
              height: 40, padding: '0 18px', borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Ir al carrito <ArrowRight size={13} />
          </button>
        </div>

        {/* Estados vacío / cargando */}
        {cargando && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-muted)', padding: '40px 0' }}>Cargando cupones…</p>
        )}
        {!cargando && cupones.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)', borderRadius: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>No hay cupones disponibles por ahora</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Volvé más tarde: la tienda puede publicar nuevas promociones.</div>
          </div>
        )}

        {/* Grid */}
        {!cargando && cupones.length > 0 && (
        <div className="sf-cup-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {cupones.map(cup => {
            const copiando  = copiado === cup.codigo
            const descLabel = cup.tipo === 'porcentaje' ? `${cup.valor}% OFF` : `${fmt(cup.valor)} OFF`
            const accent    = cup.tipo === 'porcentaje' && cup.valor >= 20 ? '#DC2626'
                            : cup.tipo === 'porcentaje' ? '#7C3AED' : '#059669'
            return (
              <div
                key={cup.codigo}
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
                }}
              >
                {/* Franja superior */}
                <div style={{
                  background: `${accent}12`,
                  borderBottom: `1px solid ${accent}22`,
                  padding: '12px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    height: 28, padding: '0 12px', borderRadius: 999,
                    background: accent, color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: '"Geist Mono", monospace',
                  }}>
                    {descLabel}
                  </span>
                  {cup.categorias && (
                    <span style={{
                      height: 24, padding: '0 10px', borderRadius: 999,
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      fontSize: 11, fontWeight: 600, color: 'var(--color-body)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <ShoppingBag size={10} /> {cup.categorias.join(', ')}
                    </span>
                  )}
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', margin: '0 0 14px', lineHeight: 1.5 }}>
                    {cup.descripcion}
                  </p>

                  {/* Código + copiar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <div style={{
                      flex: 1,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'var(--color-surface)',
                      border: `1.5px dashed ${accent}55`,
                      fontSize: 16, fontWeight: 700, color: accent,
                      fontFamily: '"Geist Mono", monospace', letterSpacing: '0.06em',
                    }}>
                      {cup.codigo}
                    </div>
                    <button
                      onClick={() => copiar(cup.codigo)}
                      style={{
                        height: 44, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: copiando ? '#059669' : accent, color: '#fff',
                        fontSize: 13, fontWeight: 600, flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        transition: 'background 200ms',
                      }}
                    >
                      {copiando
                        ? <><Check size={13} /> Copiado</>
                        : <><Copy size={13} /> Copiar</>}
                    </button>
                  </div>

                  {/* Condiciones */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {cup.minCompra ? (
                      <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShoppingBag size={10} /> Mínimo {fmt(cup.minCompra)}
                      </span>
                    ) : null}
                    {cup.vencimiento && (
                      <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={10} /> Vence {cup.vencimiento}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Footer info */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-subtle)', marginTop: 32 }}>
          Los cupones no son acumulables entre sí. Sujetos a disponibilidad y condiciones de cada promoción.
        </p>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}

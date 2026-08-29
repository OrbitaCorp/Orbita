import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Tag, Calendar, Copy, Check, ArrowRight } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Skeleton, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { fmt } from '@/lib/storefront/utils'
import {
  getStorefrontConfig, getStorefrontExclusiveDiscount, toTiendaConfig, toCupon,
  StorefrontApiError, type StorefrontConfigResponse,
} from '@/lib/storefront/api'
import type { Cupon } from '@/lib/storefront/types'

export default function DescuentoExclusivo() {
  const router = useRouter()
  const { slug, codigo } = router.query as { slug: string; codigo: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [deal, setDeal]         = useState<Cupon | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copiado, setCopiado]   = useState(false)

  useEffect(() => {
    if (!slug || !codigo) return
    let cancelado = false
    setCargando(true)
    getStorefrontExclusiveDiscount(slug, codigo)
      .then(c => { if (!cancelado) setDeal(toCupon(c)) })
      .catch(err => { if (!cancelado) setErrorMsg(err instanceof StorefrontApiError ? err.message : 'Este cupón no existe o ya expiró.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, codigo])

  function copiarCodigo() {
    if (!deal) return
    navigator.clipboard.writeText(deal.codigo).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 32px', textAlign: 'center' }} aria-hidden="true">
          <SkeletonCircle size={72} style={{ margin: '0 auto 20px' }} />
          <SkeletonText width={220} height={22} delay={40} style={{ margin: '0 auto 12px', borderRadius: 6 }} />
          <SkeletonText width={280} height={12} delay={70} style={{ margin: '0 auto 28px' }} />
          <Skeleton width="100%" height={64} radius={12} delay={110} />
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
          <Tag size={32} strokeWidth={1.2} color="var(--color-muted)" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Enlace no válido</h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, maxWidth: 340 }}>{errorMsg}</p>
        <button
          className="ds-hover"
          onClick={() => router.push(`${base}/catalogo`)}
          style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600 }}
        >
          Ver catálogo
        </button>
      </div>
    )
  }

  const etiquetaValor = deal.tipo === 'porcentaje' ? `${deal.valor}%` : fmt(deal.valor)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 1024px) {
          .sf-deal-banner { padding: 36px 28px !important; }
          .sf-deal-pct    { font-size: 56px !important; }
        }
        @media (max-width: 768px) {
          .sf-deal-wrap   { padding: 16px 16px 48px !important; }
          .sf-deal-banner { padding: 28px 20px !important; }
          .sf-deal-pct    { font-size: 48px !important; }
          .sf-deal-body   { flex-direction: column !important; gap: 24px !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

      {/* ── Banner exclusivo ── */}
      <div
        className="sf-deal-banner"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 55%, #7C3AED 100%)',
          padding: '52px 48px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse 55% 70% at 85% 50%, rgba(167,139,250,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', pointerEvents: 'none' }} />

        <div className="sf-deal-body" style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 52 }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div className="sf-deal-pct" style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.04em' }}>
              {etiquetaValor}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.70)', marginTop: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              OFF
            </div>
          </div>

          <div style={{ width: 1, height: 80, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', marginBottom: 12 }}>
              <Sparkles size={11} color="#C4B5FD" strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cupón exclusivo</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {deal.descripcion}
            </h1>
            {deal.minCompra && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: '0 0 18px', lineHeight: 1.6 }}>
                Válido en compras a partir de {fmt(deal.minCompra)}.
              </p>
            )}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
              {deal.vencimiento && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <Calendar size={12} /> Vence el {deal.vencimiento}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                <Tag size={12} /> Válido en {deal.categorias ? deal.categorias.join(', ') : 'toda la tienda'}
              </div>
            </div>

            {/* Código + copiar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 340 }}>
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.10)', border: '1.5px dashed rgba(255,255,255,0.35)',
                fontSize: 16, fontWeight: 700, color: '#fff',
                fontFamily: '"Geist Mono", monospace', letterSpacing: '0.06em',
              }}>
                {deal.codigo}
              </div>
              <button
                className="ds-hover"
                onClick={copiarCodigo}
                style={{
                  height: 44, padding: '0 16px', borderRadius: 8, border: 'none',
                  background: copiado ? '#059669' : '#fff', color: copiado ? '#fff' : '#4C1D95',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'background 200ms',
                }}
              >
                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sf-deal-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Cupón exclusivo' }]} />
        <p style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 560 }}>
          {tienda.nombre ? `${tienda.nombre} te compartió este cupón. ` : ''}Copiá el código y pegalo en el checkout para obtener {etiquetaValor} de descuento en tu próxima compra.
        </p>
        <button
          className="ds-hover"
          onClick={() => router.push(`${base}/catalogo`)}
          style={{
            height: 48, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          Ir de compras <ArrowRight size={16} />
        </button>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}

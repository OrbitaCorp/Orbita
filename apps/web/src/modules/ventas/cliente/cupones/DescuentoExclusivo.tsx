import { useState } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Tag, Calendar, Grid, List } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { TIENDA, PRODUCTOS, DESCUENTOS_EXCLUSIVOS } from '@/lib/storefront/mock'
import type { Producto } from '@/lib/storefront/types'

export default function DescuentoExclusivo() {
  const router = useRouter()
  const { slug, codigo } = router.query as { slug: string; codigo: string }
  const base = `/tienda/${slug}`

  const [orden,    setOrden]    = useState('relevancia')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const deal = DESCUENTOS_EXCLUSIVOS.find(d => d.codigo === codigo)

  if (!deal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
          <Tag size={32} strokeWidth={1.2} color="var(--color-muted)" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Enlace no válido</h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>Este descuento no existe o ya expiró.</p>
        <button
          onClick={() => router.push(`${base}/catalogo`)}
          style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
        >
          Ver catálogo
        </button>
      </div>
    )
  }

  // Aplicar el descuento a todos los productos
  const productosConDescuento: Producto[] = PRODUCTOS.map(p => ({
    ...p,
    precio:    deal.tipo === 'porcentaje'
                 ? Math.round(p.precio * (1 - deal.valor / 100))
                 : Math.max(0, p.precio - deal.valor),
    precioAnt: p.precio,
    badge:     deal.tipo === 'porcentaje' ? `−${deal.valor}%` : null,
  }))

  const ordenados = [...productosConDescuento].sort((a, b) => {
    if (orden === 'precio-asc')  return a.precio - b.precio
    if (orden === 'precio-desc') return b.precio - a.precio
    return 0
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 1024px) {
          .sf-deal-banner { padding: 36px 28px !important; }
          .sf-deal-pct    { font-size: 56px !important; }
        }
        @media (max-width: 768px) {
          .sf-deal-wrap   { padding: 16px 16px 48px !important; }
          .sf-deal-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .sf-deal-banner { padding: 28px 20px !important; }
          .sf-deal-pct    { font-size: 48px !important; }
          .sf-deal-body   { flex-direction: column !important; gap: 24px !important; }
        }
        @media (max-width: 480px) {
          .sf-deal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <StorefrontHeader tienda={TIENDA} />

      {/* ── Banner exclusivo ── */}
      <div
        className="sf-deal-banner"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 55%, #7C3AED 100%)',
          padding: '52px 48px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Destellos de fondo */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse 55% 70% at 85% 50%, rgba(167,139,250,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', pointerEvents: 'none' }} />

        <div
          className="sf-deal-body"
          style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 52 }}
        >
          {/* % grande */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div
              className="sf-deal-pct"
              style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.04em' }}
            >
              {deal.tipo === 'porcentaje' ? `${deal.valor}%` : `$${(deal.valor / 1000).toLocaleString('es-AR')}k`}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.70)', marginTop: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              OFF
            </div>
          </div>

          {/* Divisor */}
          <div style={{ width: 1, height: 80, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', marginBottom: 12 }}>
              <Sparkles size={11} color="#C4B5FD" strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Descuento exclusivo</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {deal.nombre}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: '0 0 18px', lineHeight: 1.6, maxWidth: 480 }}>
              {deal.descripcion}
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {deal.vencimiento && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <Calendar size={12} /> Vence el {deal.vencimiento}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                <Tag size={12} /> Válido en {deal.categorias ? deal.categorias.join(', ') : 'toda la tienda'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Catálogo con precios exclusivos ── */}
      <div className="sf-deal-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Descuento exclusivo' }]} />

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>{ordenados.length}</strong> productos con precio exclusivo aplicado
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={orden}
              onChange={e => setOrden(e.target.value)}
              style={{ height: 36, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
            >
              <option value="relevancia">Más relevantes</option>
              <option value="precio-asc">Precio: menor a mayor</option>
              <option value="precio-desc">Precio: mayor a menor</option>
            </select>
            <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              {([['grid', <Grid key="g" size={14} />], ['list', <List key="l" size={14} />]] as const).map(([mode, icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as 'grid' | 'list')}
                  style={{ width: 36, height: 36, background: viewMode === mode ? 'var(--color-surface)' : 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sf-deal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {ordenados.map(p => <ProductCard key={p.id} producto={p} />)}
        </div>
      </div>

      <StorefrontFooter tienda={TIENDA} slug={slug} />
    </div>
  )
}

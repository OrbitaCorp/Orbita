import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Filter, Grid, List } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { CARRITO_INICIAL } from '@/lib/storefront/mock'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import {
  getStorefrontConfig, getStorefrontCategories, getStorefrontProducts,
  toTiendaConfig, toProducto,
  type StorefrontConfigResponse, type StorefrontCategoryItem,
} from '@/lib/storefront/api'

// Talle/rango de precio quedan decorativos (ya lo eran en el mock: sin
// onChange real) — filtrar por variante/opción no está soportado todavía por
// el endpoint público. Ver PENDIENTES.md.
const TALLES = ['XS','S','M','L','XL','XXL']
const LIMIT = 12

export default function Catalogo() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  const [categorias, setCategorias] = useState<StorefrontCategoryItem[]>([])
  const [catActivaId, setCatActivaId] = useState<string | null>(null)
  const [orden, setOrden] = useState('relevancia')
  const [soloStock, setSoloStock] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    Promise.all([getStorefrontConfig(slug), getStorefrontCategories(slug)])
      .then(([cfg, cats]) => { if (!cancelado) { setConfig(cfg); setCategorias(cats) } })
      .catch(() => {})
    return () => { cancelado = true }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    setCargando(true)
    getStorefrontProducts(slug, { categoryId: catActivaId ?? undefined, page, limit: LIMIT })
      .then(r => {
        if (cancelado) return
        setProductos(r.data.map(toProducto))
        setTotal(r.total)
      })
      .catch(() => { if (!cancelado) { setProductos([]); setTotal(0) } })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, catActivaId, page])

  const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const visibles = (soloStock ? productos.filter(p => p.stock) : productos)
    .slice()
    .sort((a, b) => {
      if (orden === 'precio-asc') return a.precio - b.precio
      if (orden === 'precio-desc') return b.precio - a.precio
      return 0
    })

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function seleccionarCategoria(id: string | null) {
    setCatActivaId(id)
    setPage(1)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-cat-wrap        { padding: 16px !important; }
          .sf-cat-title       { font-size: 26px !important; }
          .sf-cat-layout      { grid-template-columns: 1fr !important; }
          .sf-cat-sidebar     { position: static !important; display: none; }
          .sf-cat-sidebar.open{ display: block !important; }
          .sf-cat-grid        { grid-template-columns: repeat(2, 1fr) !important; }
          .sf-cat-filter-btn  { display: inline-flex !important; }
        }
        @media (max-width: 400px) {
          .sf-cat-grid { grid-template-columns: 1fr !important; }
        }
        .sf-cat-filter-btn { display: none; }
      `}</style>
      <StorefrontHeader tienda={tienda} carrito={CARRITO_INICIAL} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} />
      <AnnouncementBar />
      <div className="sf-cat-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Catálogo' }]} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className="sf-cat-title" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)', margin: 0 }}>Catálogo</h1>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Toda nuestra selección actual</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          <button onClick={() => seleccionarCategoria(null)} style={{ height: 36, padding: '0 16px', borderRadius: 999, background: catActivaId === null ? 'var(--color-text)' : 'var(--color-bg)', color: catActivaId === null ? 'var(--color-bg)' : 'var(--color-body)', border: `1px solid ${catActivaId === null ? 'var(--color-text)' : 'var(--color-border)'}`, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}>
            Todas
          </button>
          {categorias.map(c => {
            const active = catActivaId === c.id
            return (
              <button key={c.id} onClick={() => seleccionarCategoria(c.id)} style={{ height: 36, padding: '0 16px', borderRadius: 999, background: active ? 'var(--color-text)' : 'var(--color-bg)', color: active ? 'var(--color-bg)' : 'var(--color-body)', border: `1px solid ${active ? 'var(--color-text)' : 'var(--color-border)'}`, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 150ms' }}>
                {c.name}
              </button>
            )
          })}
        </div>

        <button className="sf-cat-filter-btn" onClick={() => setFiltrosOpen(o => !o)} style={{ marginBottom: 16, height: 38, padding: '0 16px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignItems: 'center', gap: 8 }}>
          <Filter size={14} strokeWidth={1.5} /> {filtrosOpen ? 'Ocultar filtros' : 'Filtros'}
        </button>
        <div className="sf-cat-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, alignItems: 'flex-start' }}>
          <aside className={`sf-cat-sidebar${filtrosOpen ? ' open' : ''}`} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, position: 'sticky', top: 76 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              <Filter size={14} strokeWidth={1.5} /> Filtros
            </div>
            <FilterGroup title="Categoría">
              {categorias.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)', padding: '4px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={catActivaId === c.id}
                    onChange={() => seleccionarCategoria(catActivaId === c.id ? null : c.id)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  {c.name}
                  <span style={{ color: 'var(--color-subtle)', marginLeft: 'auto', fontSize: 11, fontFamily: '"Geist Mono", monospace' }}>{c.productCount}</span>
                </label>
              ))}
            </FilterGroup>
            <FilterGroup title="Precio">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['Desde', 'Hasta'].map(ph => (
                  <input
                    key={ph}
                    placeholder={ph}
                    type="number"
                    min={0}
                    style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 6, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, fontFamily: '"Geist Mono", monospace', outline: 'none', minWidth: 0 }}
                  />
                ))}
              </div>
            </FilterGroup>
            <FilterGroup title="Talle">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TALLES.map(s => <button key={s} style={{ width: 36, height: 32, borderRadius: 6, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{s}</button>)}
              </div>
            </FilterGroup>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)', paddingTop: 16, borderTop: '1px solid var(--color-border)', marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={soloStock} onChange={e => setSoloStock(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
              Solo en stock
            </label>
          </aside>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                <strong style={{ color: 'var(--color-text)' }}>{total}</strong> productos
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select value={orden} onChange={e => setOrden(e.target.value)} style={{ height: 36, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}>
                  <option value="relevancia">Más relevantes</option>
                  <option value="precio-asc">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                </select>
                <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {([['grid', <Grid key="g" size={14} />], ['list', <List key="l" size={14} />]] as const).map(([mode, icon]) => (
                    <button key={mode} onClick={() => setViewMode(mode)} style={{ width: 36, height: 36, background: viewMode === mode ? 'var(--color-surface)' : 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>
            {!cargando && visibles.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
                No hay productos para mostrar todavía.
              </div>
            ) : (
              <div className="sf-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {visibles.map(p => <ProductCard key={p.id} producto={p} />)}
              </div>
            )}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 40 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)} style={{ minWidth: 36, height: 36, padding: '0 12px', borderRadius: 8, background: n === page ? 'var(--color-text)' : 'var(--color-bg)', color: n === page ? 'var(--color-bg)' : 'var(--color-body)', border: `1px solid ${n === page ? 'var(--color-text)' : 'var(--color-border)'}`, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <StorefrontFooter tienda={tienda} slug={slug} />
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

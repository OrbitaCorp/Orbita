import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Grid, List, Tag, TrendingUp, Search, ChevronDown, Check, SlidersHorizontal, X } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { SkeletonProductGrid, SkeletonText } from '@/design-system/components/Skeleton'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import {
  getStorefrontConfig, getStorefrontCategories, getStorefrontProducts,
  toTiendaConfig, toProducto,
  type StorefrontConfigResponse, type StorefrontCategoryItem, type StorefrontSort,
} from '@/lib/storefront/api'

const LIMIT = 12
// Fijo en 4 columnas (tablet/desktop) — antes era auto-fill con un mínimo
// de 168px, así que el número real de columnas variaba según el ancho de
// pantalla (5, 6...). El mobile sigue resolviéndose aparte con el media
// query de abajo (2 columnas).
const GRID_COLUMNS = 'repeat(4, 1fr)'

// Categoría con su profundidad en el árbol (0 = raíz) — se arma acá porque
// el backend devuelve la lista plana con parentId (ver listCategories() en
// storefront.service.ts), no hace falta tocar nada del lado del servidor
// para mostrar las subcategorías anidadas bajo su categoría madre.
type CategoriaNodo = StorefrontCategoryItem & { depth: number }

function construirArbolCategorias(cats: StorefrontCategoryItem[]): CategoriaNodo[] {
  const porPadre = new Map<string | null, StorefrontCategoryItem[]>()
  for (const c of cats) {
    const key = c.parentId
    if (!porPadre.has(key)) porPadre.set(key, [])
    porPadre.get(key)!.push(c)
  }
  const out: CategoriaNodo[] = []
  function visitar(padreId: string | null, depth: number) {
    for (const c of porPadre.get(padreId) ?? []) {
      out.push({ ...c, depth })
      visitar(c.id, depth + 1)
    }
  }
  visitar(null, 0)
  return out
}

export default function Catalogo() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  const [categorias, setCategorias] = useState<StorefrontCategoryItem[]>([])
  const [catsCargando, setCatsCargando] = useState(true)
  // Multi-select — antes era un solo id (catActivaId). El backend ya acepta
  // varios ids separados por coma (ver storefront-products-query.dto.ts).
  const [catsActivas, setCatsActivas] = useState<string[]>([])
  const [orden, setOrden] = useState<StorefrontSort>('relevancia')
  const [soloOferta, setSoloOferta] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [seccionCategoria, setSeccionCategoria] = useState(true)
  const [seccionPrecio, setSeccionPrecio] = useState(true)

  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [cargando, setCargando] = useState(true)

  // Header "Ofertas"/"Más vendidos" llegan acá como ?onSale=1 / ?sort=bestselling
  // (ver StorefrontHeader.tsx) — se toman como filtro inicial una sola vez,
  // apenas el router está listo, para no pisar lo que el usuario elija después
  // a mano en esta misma página.
  useEffect(() => {
    if (!router.isReady) return
    if (router.query.onSale === '1') setSoloOferta(true)
    if (router.query.sort === 'bestselling') setOrden('bestselling')
    if (typeof router.query.search === 'string') setBusqueda(router.query.search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    setCatsCargando(true)
    Promise.all([getStorefrontConfig(slug), getStorefrontCategories(slug)])
      .then(([cfg, cats]) => { if (!cancelado) { setConfig(cfg); setCategorias(cats) } })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCatsCargando(false) })
    return () => { cancelado = true }
  }, [slug])

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    setCargando(true)
    getStorefrontProducts(slug, {
      categoryId: catsActivas.length > 0 ? catsActivas : undefined,
      search: busqueda.trim() || undefined,
      onSale: soloOferta || undefined,
      minPrice: precioMin ? Number(precioMin) : undefined,
      maxPrice: precioMax ? Number(precioMax) : undefined,
      sort: orden,
      page,
      limit: LIMIT,
    })
      .then(r => {
        if (cancelado) return
        setProductos(r.data.map(p => toProducto(p, { showNew: config?.appearance?.showNewBadge, showOffer: config?.appearance?.showOfferBadge, showLowStock: config?.appearance?.showLowStock })))
        setTotal(r.total)
      })
      .catch(() => { if (!cancelado) { setProductos([]); setTotal(0) } })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, catsActivas, busqueda, soloOferta, precioMin, precioMax, orden, page])

  const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const arbolCategorias = construirArbolCategorias(categorias)

  // Todos vuelven a página 1 — evita quedar en "página 4 de 1" al filtrar.
  function alternarCategoria(id: string) {
    setCatsActivas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setPage(1)
  }
  function limpiarCategorias() { setCatsActivas([]); setPage(1) }
  function cambiarOferta(v: boolean) { setSoloOferta(v); setPage(1) }
  function cambiarOrden(v: StorefrontSort) { setOrden(v); setPage(1) }
  function limpiarBusqueda() { setBusqueda(''); setPage(1) }
  function aplicarPrecio() { setPage(1) }

  const hayFiltrosActivos = catsActivas.length > 0 || !!precioMin || !!precioMax

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-cat-wrap        { padding: 16px !important; }
          .sf-cat-title       { font-size: 26px !important; }
          .sf-cat-layout      { grid-template-columns: 1fr !important; }
          .sf-cat-sidebar     { position: static !important; max-height: none !important; display: none; }
          .sf-cat-sidebar.open{ display: block !important; }
          .sf-cat-grid        { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .sf-cat-filter-btn  { display: inline-flex !important; }
        }
        .sf-cat-filter-btn { display: none; }
        .sf-cat-sidebar::-webkit-scrollbar { width: 4px; }
        .sf-cat-sidebar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 999px; }
        .sf-catrow { display: flex; align-items: center; gap: 9px; padding: 6px 4px; cursor: pointer; border-radius: 6px; transition: background 120ms; }
        .sf-catrow:hover { background: var(--color-surface); }
        .sf-catchk { width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid var(--color-border-strong); flex-shrink: 0; display: grid; place-items: center; transition: background 120ms, border-color 120ms; }
        .sf-catchk.on { background: var(--color-primary); border-color: var(--color-primary); }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />
      <AnnouncementBar text={config?.appearance?.shippingText} visible={config?.appearance?.showAnnouncementBar ?? true} />
      <div className="sf-cat-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Catálogo' }]} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className="sf-cat-title" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)', margin: 0 }}>Catálogo</h1>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Toda nuestra selección actual</div>
          </div>
        </div>

        {/* Mensaje contextual — cuando se llega desde "Ofertas", "Más
            vendidos" o el buscador del header, deja explícito qué filtro
            está aplicado (el usuario puede sacarlo con los controles de abajo). */}
        {busqueda && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            <Search size={15} strokeWidth={2} />
            Resultados para &quot;{busqueda}&quot;.
            <button className="ds-link" onClick={limpiarBusqueda} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Quitar búsqueda</button>
          </div>
        )}
        {soloOferta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            <Tag size={15} strokeWidth={2} />
            Mostrando productos en oferta.
            <button className="ds-link" onClick={() => cambiarOferta(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Quitar filtro</button>
          </div>
        )}
        {orden === 'bestselling' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            <TrendingUp size={15} strokeWidth={2} />
            Mostrando los productos más vendidos.
            <button className="ds-link" onClick={() => cambiarOrden('relevancia')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Quitar filtro</button>
          </div>
        )}

        <button className="ds-hover sf-cat-filter-btn" onClick={() => setFiltrosOpen(o => !o)} style={{ marginBottom: 16, height: 38, padding: '0 16px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={14} strokeWidth={1.5} /> {filtrosOpen ? 'Ocultar filtros' : 'Filtros'} {hayFiltrosActivos && `(${catsActivas.length + (precioMin || precioMax ? 1 : 0)})`}
        </button>

        <div className="sf-cat-layout" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'flex-start' }}>
          {/* Sidebar — sticky + scroll propio: en una lista larga de productos
              nunca fuerza scrollear hasta el final del filtro para llegar al
              pie de la página (ni al revés). */}
          <aside
            className={`sf-cat-sidebar${filtrosOpen ? ' open' : ''}`}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12,
              padding: '18px 16px', position: 'sticky', top: 76,
              maxHeight: 'calc(100vh - 96px)', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Filtros</div>
              {hayFiltrosActivos && (
                <button className="ds-link" onClick={() => { limpiarCategorias(); setPrecioMin(''); setPrecioMax(''); setPage(1) }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                  Limpiar
                </button>
              )}
            </div>

            <FilterSection title="Categoría" open={seccionCategoria} onToggle={() => setSeccionCategoria(o => !o)}>
              {catsCargando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 4px' }}>
                  {[1, 2, 3, 4].map(i => <SkeletonText key={i} width={`${80 - i * 8}%`} height={11} delay={i * 60} />)}
                </div>
              ) : (
                <div>
                  <div className="sf-catrow" onClick={limpiarCategorias}>
                    <span className={`sf-catchk${catsActivas.length === 0 ? ' on' : ''}`}>
                      {catsActivas.length === 0 && <Check size={11} strokeWidth={3} color="#fff" />}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: catsActivas.length === 0 ? 700 : 500, color: 'var(--color-text)' }}>Todas las categorías</span>
                  </div>
                  {arbolCategorias.map(c => {
                    const activa = catsActivas.includes(c.id)
                    return (
                      <div
                        key={c.id}
                        className="sf-catrow"
                        onClick={() => alternarCategoria(c.id)}
                        style={{ paddingLeft: 4 + c.depth * 18, borderLeft: c.depth > 0 ? '1.5px solid var(--color-border)' : 'none', marginLeft: c.depth > 0 ? 8 : 0 }}
                      >
                        <span className={`sf-catchk${activa ? ' on' : ''}`}>
                          {activa && <Check size={11} strokeWidth={3} color="#fff" />}
                        </span>
                        <span style={{ fontSize: c.depth > 0 ? 12.5 : 13, fontWeight: activa ? 700 : 500, color: c.depth > 0 ? 'var(--color-muted)' : 'var(--color-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        <span style={{ color: 'var(--color-subtle)', fontSize: 10.5, fontFamily: '"Geist Mono", monospace' }}>{c.productCount}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </FilterSection>

            <FilterSection title="Precio" open={seccionPrecio} onToggle={() => setSeccionPrecio(o => !o)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <input
                  className="ds-field"
                  placeholder="Mín."
                  type="number"
                  min={0}
                  value={precioMin}
                  onChange={e => setPrecioMin(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, fontFamily: '"Geist Mono", monospace', outline: 'none', minWidth: 0 }}
                />
                <input
                  className="ds-field"
                  placeholder="Máx."
                  type="number"
                  min={0}
                  value={precioMax}
                  onChange={e => setPrecioMax(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, fontFamily: '"Geist Mono", monospace', outline: 'none', minWidth: 0 }}
                />
              </div>
              <button className="ds-hover" onClick={aplicarPrecio} style={{ width: '100%', height: 32, borderRadius: 7, background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Aplicar rango
              </button>
            </FilterSection>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--color-body)', paddingTop: 14, marginTop: 4, borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}>
              <span className={`sf-catchk${soloOferta ? ' on' : ''}`} onClick={() => cambiarOferta(!soloOferta)}>
                {soloOferta && <Check size={11} strokeWidth={3} color="#fff" />}
              </span>
              <span onClick={() => cambiarOferta(!soloOferta)} style={{ fontWeight: soloOferta ? 700 : 500 }}>Solo en oferta</span>
            </label>
          </aside>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                {cargando ? '···' : <strong style={{ color: 'var(--color-text)' }}>{total}</strong>} productos
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select className="ds-field" value={orden} onChange={e => cambiarOrden(e.target.value as StorefrontSort)} style={{ height: 36, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}>
                  <option value="relevancia">Más relevantes</option>
                  <option value="precio-asc">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                  <option value="bestselling">Más vendidos primero</option>
                </select>
                <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                  {([['grid', <Grid key="g" size={14} />], ['list', <List key="l" size={14} />]] as const).map(([mode, icon]) => (
                    <button key={mode} className="ds-hover" onClick={() => setViewMode(mode)} aria-label={mode === 'grid' ? 'Ver en grilla' : 'Ver en lista'} style={{ width: 36, height: 36, background: viewMode === mode ? 'var(--color-surface)' : 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chips de categorías activas — con multi-select, un chip por
                categoría es la única forma clara de ver (y sacar) cada una
                sin volver a abrir el filtro. */}
            {catsActivas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {catsActivas.map(id => {
                  const cat = categorias.find(c => c.id === id)
                  if (!cat) return null
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 6px 0 12px', borderRadius: 999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                      {cat.name}
                      <button className="ds-hover" onClick={() => alternarCategoria(id)} aria-label={`Quitar ${cat.name}`} style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--color-border)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            {cargando ? (
              <SkeletonProductGrid cantidad={LIMIT} layout={viewMode} columns={GRID_COLUMNS} />
            ) : productos.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
                No hay productos para mostrar con estos filtros.
              </div>
            ) : viewMode === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {productos.map(p => <ProductCard key={p.id} producto={p} layout="list" mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
              </div>
            ) : (
              <div className="sf-cat-grid" style={{ display: 'grid', gridTemplateColumns: GRID_COLUMNS, gap: 16 }}>
                {productos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 40 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} className="ds-hover" onClick={() => setPage(n)} style={{ minWidth: 36, height: 36, padding: '0 12px', borderRadius: 8, background: n === page ? 'var(--color-text)' : 'var(--color-bg)', color: n === page ? 'var(--color-bg)' : 'var(--color-body)', border: `1px solid ${n === page ? 'var(--color-text)' : 'var(--color-border)'}`, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}

// Sección colapsable del filtro — reemplaza el FilterGroup viejo (siempre
// abierto) por algo más parecido a la referencia que pasó el usuario:
// encabezado en mayúsculas con chevron, contenido plegable.
function FilterSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--color-border)' }}>
      <button
        className="ds-hover"
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 10px', borderRadius: 6, color: 'var(--color-subtle)' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
        <ChevronDown size={14} strokeWidth={2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && children}
    </div>
  )
}

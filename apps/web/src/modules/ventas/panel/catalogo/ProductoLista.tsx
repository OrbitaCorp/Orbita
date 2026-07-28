// src/modules/ventas/panel/catalogo/ProductoLista.tsx — Vista P1 + hub del módulo
// RBT-304: listado con búsqueda, filtros y métricas, contra la API real.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Plus, Search, Eye, Edit2, MoreVertical, Copy, Trash2, Package, Globe, AlertCircle, Wallet } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { fmtMoney } from '@/lib/utils'
import {
    panelListProducts, panelGetProductStats, panelGetCategoriesFlat,
    panelDeleteProduct, panelDuplicateProduct, panelGetProductFull,
    ApiError,
    type ApiProductRow, type ApiProductStats, type ApiCategory,
    type ApiProductFull, type ProductStatusFilter,
} from '@/lib/api'

import { StatCard } from '../_shared/StatCard'
import { CatalogoTabs, ProductoEstadoBadge } from './components/CatalogoTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import ProductoNuevo from './ProductoNuevo'
import type { EstadoProducto } from './types/catalogo.types'

const COLS = '56px 1.5fr 110px 110px 80px 90px 110px 90px'
const POR_PAGINA = 20

// El estado que ve el dueño mezcla dos cosas del backend: el status del
// producto y si le queda stock. Sin stock manda sobre "publicado" porque es lo
// que necesita accionar.
function estadoVisual(p: ApiProductRow): EstadoProducto {
    if (p.status === 'DRAFT') return 'borrador'
    return p.totalStock === 0 ? 'sin_stock' : 'publicado'
}

// Miniatura: usa la imagen real si el producto tiene una; si no, el placeholder
// de color que ya usaba el panel (derivado del id para que sea estable).
function Miniatura({ p, size = 40, radius = 8 }: { p: ApiProductRow; size?: number; radius?: number }) {
    if (p.primaryImageUrl) {
        return (
            <img
                src={p.primaryImageUrl}
                alt={p.name}
                style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, display: 'block' }}
            />
        )
    }
    const hue = [...p.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
    return <ProductoThumb hue={hue} size={size} radius={radius} />
}

// ─── Card mobile ─────────────────────────────────────────────────────────────

function ProductoCard({ p, onVer, onEditar }: { p: ApiProductRow; onVer: () => void; onEditar: () => void }) {
    const stockCol = p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-success)'
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Miniatura p={p} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{p.categoryName ?? 'Sin categoría'}</div>
                </div>
                <ProductoEstadoBadge estado={estadoVisual(p)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2 }}>Precio</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.basePrice)}</div>
                </div>
                <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2 }}>Stock</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: stockCol, fontFamily: '"Geist Mono", monospace' }}>{p.totalStock}</div>
                </div>
                <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: '6px 8px' }}>
                    <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2 }}>Variantes</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{p.variantCount}</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={onVer}    style={iconBtn}><Eye   size={14} /></button>
                <button onClick={onEditar} style={iconBtn}><Edit2 size={14} /></button>
            </div>
        </div>
    )
}

// ─── Lista (P1) ───────────────────────────────────────────────────────────────

function ListaView({ irNuevo, irEditar, onToast }: {
    irNuevo: () => void
    irEditar: (id: string) => void
    onToast: (m: string) => void
}) {
    const [busq, setBusq] = useState('')
    const [fcat, setFcat] = useState('todos')
    const [fest, setFest] = useState('todos')
    const [menu, setMenu] = useState<string | null>(null)
    // Posición calculada del botón "···" que abrió el menú (coordenadas de
    // viewport). El menú se renderiza con position:fixed usando estas
    // coordenadas — antes usaba position:absolute anclado a la fila, y como
    // la tabla tiene overflow:hidden (para las esquinas redondeadas), el
    // menú quedaba recortado y "Eliminar" (el último ítem) no se veía.
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
    const [pagina, setPagina] = useState(1)

    const [filas, setFilas] = useState<ApiProductRow[]>([])
    const [total, setTotal] = useState(0)
    const [stats, setStats] = useState<ApiProductStats | null>(null)
    const [categorias, setCategorias] = useState<ApiCategory[]>([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    // Detalle: se pide el producto completo para poder mostrar variantes e
    // imágenes, que el listado no trae.
    const [detalle, setDetalle] = useState<ApiProductFull | null>(null)
    const [cargandoDetalle, setCargandoDetalle] = useState(false)
    const [aBorrar, setABorrar] = useState<ApiProductRow | null>(null)
    const [borrando, setBorrando] = useState(false)

    // Debounce de la búsqueda: no dispara una request por tecla.
    const [busqDebounced, setBusqDebounced] = useState('')
    useEffect(() => {
        const t = setTimeout(() => { setBusqDebounced(busq); setPagina(1) }, 400)
        return () => clearTimeout(t)
    }, [busq])

    // Evita que una respuesta lenta pise a una más nueva (race de filtros).
    const pedidoRef = useRef(0)

    const cargar = useCallback(async () => {
        const miPedido = ++pedidoRef.current
        setCargando(true)
        setError('')
        try {
            const [lista, metricas] = await Promise.all([
                panelListProducts({
                    search: busqDebounced || undefined,
                    categoryId: fcat !== 'todos' ? fcat : undefined,
                    status: fest !== 'todos' ? (fest as ProductStatusFilter) : undefined,
                    page: pagina,
                    limit: POR_PAGINA,
                }),
                panelGetProductStats(),
            ])
            if (miPedido !== pedidoRef.current) return
            setFilas(lista.data)
            setTotal(lista.total)
            setStats(metricas)
        } catch (err) {
            if (miPedido !== pedidoRef.current) return
            setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos')
        } finally {
            if (miPedido === pedidoRef.current) setCargando(false)
        }
    }, [busqDebounced, fcat, fest, pagina])

    useEffect(() => { void cargar() }, [cargar])

    useEffect(() => {
        panelGetCategoriesFlat().then(setCategorias).catch(() => setCategorias([]))
    }, [])

    async function verDetalle(p: ApiProductRow) {
        setCargandoDetalle(true)
        try {
            setDetalle(await panelGetProductFull(p.id))
        } catch {
            onToast('No se pudo abrir el producto')
        } finally {
            setCargandoDetalle(false)
        }
    }

    async function duplicar(p: ApiProductRow) {
        setMenu(null)
        try {
            const copia = await panelDuplicateProduct(p.id)
            onToast(`Se duplicó como "${copia.name}"`)
            await cargar()
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo duplicar')
        }
    }

    async function confirmarBorrado() {
        if (!aBorrar) return
        setBorrando(true)
        try {
            await panelDeleteProduct(aBorrar.id)
            onToast(`"${aBorrar.name}" eliminado`)
            setABorrar(null)
            await cargar()
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo eliminar')
        } finally {
            setBorrando(false)
        }
    }

    const limpiar = () => { setBusq(''); setFcat('todos'); setFest('todos'); setPagina(1) }
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

    // Ordena las categorías para que las subcategorías aparezcan indentadas
    // debajo de su madre en el select.
    const catsOrdenadas = useMemo(() => {
        const raiz = categorias.filter(c => !c.parentId)
        return raiz.flatMap(c => [
            { ...c, nivel: 0 },
            ...categorias.filter(h => h.parentId === c.id).map(h => ({ ...h, nivel: 1 })),
        ])
    }, [categorias])

    return (
        <div className="prod-page" style={pageWrap}>
            <style>{`
                .prod-page       { padding: 24px 32px 64px; }
                .prod-kpis       { display: grid; grid-template-columns: repeat(5,1fr); gap: 12px; margin-bottom: 16px; }
                .prod-filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
                .prod-table-wrap { display: block; }
                .prod-cards-wrap { display: none; }
                @media (max-width: 1100px) {
                    .prod-kpis   { grid-template-columns: repeat(3,1fr) !important; }
                }
                @media (max-width: 768px) {
                    .prod-page       { padding: 16px 14px 48px !important; }
                    .prod-kpis       { grid-template-columns: repeat(2,1fr) !important; }
                    .prod-filter-row { flex-direction: column !important; align-items: stretch !important; }
                    .prod-filter-row select, .prod-filter-row input { width: 100%; }
                    .prod-table-wrap { display: none !important; }
                    .prod-cards-wrap { display: flex !important; flex-direction: column; gap: 10px; }
                }
                @media (max-width: 460px) {
                    .prod-kpis { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <CatalogoTabs activo="lista" />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Productos</h1>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
                        {total} producto{total === 1 ? '' : 's'}
                    </span>
                </div>
                <Button variant="primary" icon={<Plus size={16} />} onClick={irNuevo}>Crear producto</Button>
            </div>

            {/* KPIs */}
            <div className="prod-kpis">
                <StatCard label="Total"       value={stats?.total ?? 0}       icon={Package}     accent="#3B82F6" />
                <StatCard label="Publicados"  value={stats?.publicados ?? 0}  icon={Globe}       accent="#10B981" />
                <StatCard label="Sin stock"   value={stats?.sinStock ?? 0}    icon={AlertCircle} accent="#F59E0B" />
                <StatCard label="Borradores"  value={stats?.borradores ?? 0}  icon={Edit2}       accent="#64748B" />
                <StatCard label="Valor de inventario" value={stats ? fmtMoney(stats.valorInventario) : '—'} icon={Wallet} accent="#8B5CF6" />
            </div>

            {/* Filtros */}
            <Card padding="sm" style={{ padding: 10, marginBottom: 16 }}>
                <div className="prod-filter-row">
                    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                        <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar por nombre o SKU…" style={{ ...inputBase, width: '100%', height: 36, paddingLeft: 34, paddingRight: 12, fontSize: 13 }} />
                    </div>
                    <select value={fcat} onChange={e => { setFcat(e.target.value); setPagina(1) }} style={selSt}>
                        <option value="todos">Todas las categorías</option>
                        {catsOrdenadas.map(c => (
                            <option key={c.id} value={c.id}>{c.nivel === 1 ? `— ${c.name}` : c.name}</option>
                        ))}
                    </select>
                    <select value={fest} onChange={e => { setFest(e.target.value); setPagina(1) }} style={selSt}>
                        <option value="todos">Todos los estados</option>
                        <option value="PUBLISHED">Publicado</option>
                        <option value="DRAFT">Borrador</option>
                        <option value="OUT_OF_STOCK">Sin stock</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={limpiar}>Limpiar</Button>
                </div>
            </Card>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>
                    {error}
                </div>
            )}

            {/* ── DESKTOP: tabla ── */}
            <div className="prod-table-wrap" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span /><span>Producto</span><span>Categoría</span><span style={{ textAlign: 'right' }}>Precio</span><span style={{ textAlign: 'right' }}>Stock</span><span>Variantes</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acc.</span>
                </div>

                {cargando && filas.length === 0 && (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Cargando productos…</div>
                )}

                {filas.map((p, i) => {
                    const stockCol = p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-success)'
                    return (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <Miniatura p={p} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description ?? ''}</div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{p.categoryName ?? 'Sin categoría'}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(p.basePrice)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: stockCol, fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{p.totalStock}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{p.variantCount} var.</span>
                            <ProductoEstadoBadge estado={estadoVisual(p)} />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, position: 'relative' }}>
                                <button onClick={() => void verDetalle(p)} style={iconBtn} title="Ver"><Eye size={15} /></button>
                                <button onClick={() => irEditar(p.id)} style={iconBtn} title="Editar"><Edit2 size={15} /></button>
                                <button
                                    onClick={e => {
                                        if (menu === p.id) { setMenu(null); return }
                                        const r = e.currentTarget.getBoundingClientRect()
                                        setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                                        setMenu(p.id)
                                    }}
                                    style={iconBtn}
                                >
                                    <MoreVertical size={15} />
                                </button>
                                {menu === p.id && menuPos && (
                                    <>
                                        <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                                        <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 180 }}>
                                            <button onClick={() => void duplicar(p)} style={menuItem}><Copy size={14} style={{ color: 'var(--color-muted)' }} /> Duplicar</button>
                                            <button onClick={() => { setMenu(null); irEditar(p.id) }} style={menuItem}><Edit2 size={14} style={{ color: 'var(--color-muted)' }} /> Editar</button>
                                            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                            <button onClick={() => { setMenu(null); setABorrar(p) }} style={{ ...menuItem, color: 'var(--color-error)' }}><Trash2 size={14} /> Eliminar</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
                {!cargando && filas.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Sin productos para estos filtros</div>}
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="prod-cards-wrap">
                {!cargando && filas.length === 0
                    ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Sin productos para estos filtros</div>
                    : filas.map(p => (
                        <ProductoCard key={p.id} p={p} onVer={() => void verDetalle(p)} onEditar={() => irEditar(p.id)} />
                    ))
                }
            </div>

            {/* Paginado */}
            {totalPaginas > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                    <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>Anterior</Button>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Página {pagina} de {totalPaginas}</span>
                    <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>Siguiente</Button>
                </div>
            )}

            {/* Modal detalle */}
            <Modal isOpen={detalle !== null || cargandoDetalle} onClose={() => setDetalle(null)} title={detalle?.name ?? 'Cargando…'} maxWidth={640}>
                {detalle && (
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
                        <div>
                            {detalle.images.length > 0
                                ? <img src={detalle.images[0].url} alt={detalle.name} style={{ width: 200, height: 200, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                                : <ProductoThumb hue={200} size={200} radius={12} />}
                            {detalle.images.length > 1 && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                    {detalle.images.slice(1, 4).map(img => (
                                        <img key={img.id} src={img.url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{detalle.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 10 }}>{detalle.description ?? 'Sin descripción'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(detalle.basePrice)}</span>
                                {detalle.comparePrice && <span style={{ fontSize: 14, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(detalle.comparePrice)}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--color-body)', marginBottom: 10 }}>
                                Stock total:{' '}
                                <strong style={{ fontFamily: '"Geist Mono", monospace' }}>
                                    {detalle.variants.reduce((s, v) => s + v.stock.reduce((x, st) => x + st.quantity, 0), 0)}
                                </strong>
                            </div>
                            {detalle.options.length > 0 && (
                                <>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Variantes</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                                        {detalle.variants.slice(0, 12).map(v => (
                                            <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600 }}>
                                                {v.optionValues.map(ov => ov.value).join(' / ')} · {v.stock.reduce((x, st) => x + st.quantity, 0)}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                            <Button variant="primary" icon={<Edit2 size={15} />} onClick={() => { const id = detalle.id; setDetalle(null); irEditar(id) }}>Editar producto</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmación de borrado */}
            <Modal isOpen={aBorrar !== null} onClose={() => setABorrar(null)} title="Eliminar producto" maxWidth={420}>
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    ¿Seguro que querés eliminar <strong>{aBorrar?.name}</strong>?
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 8 }}>
                        Deja de aparecer en el panel y en tu tienda. Los pedidos que ya lo incluyen no se tocan.
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                    <Button variant="outline" onClick={() => setABorrar(null)}>Cancelar</Button>
                    <Button variant="primary" onClick={() => void confirmarBorrado()} disabled={borrando} style={{ background: 'var(--color-error)' }}>
                        {borrando ? 'Eliminando…' : 'Eliminar'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

export default function ProductoLista() {
    const router = useRouter()
    const { vista, editar } = router.query
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const irNuevo = () => {
        const { vista: _v, editar: _e, ...rest } = router.query
        router.push({ query: { ...rest, vista: 'nuevo' } })
    }
    const irEditar = (id: string) => {
        const { vista: _v, editar: _e, ...rest } = router.query
        router.push({ query: { ...rest, vista: 'nuevo', editar: id } })
    }
    const volver = () => {
        const { vista: _v, editar: _e, ...rest } = router.query
        router.push({ query: rest })
    }

    const content = vista === 'nuevo'
        ? <ProductoNuevo onVolver={volver} onToast={setToast} editarId={typeof editar === 'string' ? editar : undefined} />
        : <ListaView irNuevo={irNuevo} irEditar={irEditar} onToast={setToast} />

    return (
        <>
            {content}
            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant="success" title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const inputBase: React.CSSProperties = { boxSizing: 'border-box', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }
const selSt: React.CSSProperties = { height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const menuItem: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit' }

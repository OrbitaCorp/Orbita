// src/modules/ventas/panel/catalogo/ProductoLista.tsx — Vista P1 + hub del módulo
// RBT-304: listado con búsqueda, filtros y métricas, contra la API real.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Plus, Search, Edit2, MoreVertical, Copy, Trash2, Package, Globe, AlertCircle, Wallet, Download, LayoutGrid, List, ChevronLeft, ChevronRight, Star, Clock, Loader2 } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton } from '@/design-system/components/Skeleton'
import { fmtMoney, toastEsError } from '@/lib/utils'
import {
    panelListProducts, panelGetProductStats, panelGetCategoriesFlat,
    panelDeleteProduct, panelDuplicateProduct, panelToggleProductFeatured,
    ApiError,
    type ApiProductRow, type ApiProductStats, type ApiCategory,
    type ProductStatusFilter,
} from '@/lib/api'
import {
    useProductUploads, clearProductUpload, type ProductUploadState,
    useProductEdits, clearProductEdit, type ProductEditState,
} from '@/lib/productUploadTracker'

import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { StatCard } from '../_shared/StatCard'
import { ProductoEstadoBadge } from './components/CatalogoTabs'
import { ProductoThumb } from '../pedidos/components/ProductoThumb'
import ProductoNuevo from './ProductoNuevo'
import type { EstadoProducto } from './types/catalogo.types'

const COLS = '56px 1.5fr 110px 110px 80px 90px 110px 90px'
const POR_PAGINA = 10

// ─── Productos "en vuelo" (creando el registro o subiendo sus fotos) ───────
// Se dibujan como cards sueltas, sin ninguna relación con `filas` (el
// producto puede ni existir todavía en la base) — desaparecen solas cuando
// termina lib/productUploadTracker.ts, momento en el que se vuelve a pedir
// la lista para traer el producto real (con su foto de verdad, no este
// placeholder). Ver useProductUploads() en ListaView.
// Porcentaje continuo del 1 al 100 que cubre las TRES fases (antes solo
// había barra durante 'uploading' — entre que terminaba de crear el
// producto y arrancaba a subir fotos, o cuando no había fotos, no se veía
// ningún progreso, solo texto). 'creating' arranca con algo de avance ya
// cargado (no en 0 seco, se siente muerto); 'uploading' reparte el resto
// según cuántas fotos ya se intentaron; 'done' cierra en 100.
function pctDeSubida(u: ProductUploadState): number {
    if (u.phase === 'error') return 0
    if (u.phase === 'done') return 100
    if (u.phase === 'creating') return 15
    if (u.totalImages === 0) return 90
    return Math.min(25 + Math.round(((u.completed + u.failed) / u.totalImages) * 70), 95)
}
function tituloDeSubida(u: ProductUploadState): string {
    if (u.phase === 'error') return u.errorMessage ?? 'No se pudo crear el producto'
    if (u.phase === 'creating') return 'Creando producto…'
    if (u.phase === 'done') return u.failed > 0 ? 'Alguna foto no se subió' : 'Publicando…'
    return 'Subiendo fotos…'
}
// Fila mínima "de mentira" para poder reusar exactamente las mismas cards
// que ya dibujan un ApiProductRow real — nada de esto se lee mientras
// `upload` está presente (las cards lo chequean primero), son solo para que
// el tipo cierre.
function filaPendiente(u: ProductUploadState): ApiProductRow {
    return {
        id: u.tempId, name: u.name, description: null, categoryId: null,
        categoryName: u.categoryName, basePrice: u.basePrice, comparePrice: null, cost: null,
        status: u.status, isFeatured: false, totalStock: u.totalStock, variantCount: 0,
        primaryImageUrl: null, images: [], createdAt: new Date().toISOString(),
    }
}

// ─── Productos EXISTENTES cuyos cambios se están guardando en segundo plano ──
// A diferencia de `upload` (que reemplaza la card entera porque el producto
// puede ni existir todavía), acá la fila real ya está — este es solo un
// chip liviano que se superpone, sin tapar la foto ni los datos que ya se
// conocen. `spin` ya está definida en globals.css, no hace falta declararla
// de nuevo acá.
function EditandoTag({ e }: { e: ProductEditState }) {
    const esError = e.phase === 'error'
    return (
        <span
            title={esError ? e.errorMessage : undefined}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 9999,
                background: esError ? 'var(--color-error-bg)' : 'var(--color-primary-bg)',
                color: esError ? 'var(--color-error)' : 'var(--color-primary)',
                fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
            }}
        >
            {esError
                ? <AlertCircle size={11} />
                : <Loader2 size={11} style={{ animation: 'spin 800ms linear infinite' }} />}
            {esError ? 'No se pudo guardar' : 'Guardando…'}
        </span>
    )
}

// ─── Skeletons — misma forma exacta del contenido real, armados con las piezas
// del componente compartido design-system/Skeleton.tsx (clase `.skel` de
// globals.css: mismo barrido de luz y corte por prefers-reduced-motion que el
// resto del panel). ─────────────────────────────────────────────────────────

function StatCardSkeleton() {
    return (
        <Card padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Skeleton width={60} height={10} radius={8} />
                <Skeleton width={30} height={30} radius={8} />
            </div>
            <Skeleton width="55%" height={24} radius={8} style={{ marginTop: 10 }} />
        </Card>
    )
}

function ProductoGridCardSkeleton() {
    return (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            <Skeleton width="100%" height={0} radius={0} style={{ paddingTop: '100%' }} />
            <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="75%" height={13} radius={8} />
                <Skeleton width="45%" height={11} radius={8} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <Skeleton width={56} height={15} radius={8} />
                    <Skeleton width={30} height={12} radius={8} />
                </div>
            </div>
            <div style={{ height: 37, borderTop: '1px solid var(--color-border)' }} />
        </div>
    )
}

function ProductoFilaSkeleton({ ultima }: { ultima: boolean }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderBottom: ultima ? 'none' : '1px solid var(--color-border)' }}>
            <Skeleton width={40} height={40} radius={8} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton width="70%" height={12} radius={8} />
                <Skeleton width="45%" height={10} radius={8} />
            </div>
            <Skeleton width={80} height={20} radius={9999} />
            <Skeleton width={55} height={13} radius={8} style={{ marginLeft: 'auto' }} />
            <Skeleton width={30} height={13} radius={8} style={{ marginLeft: 'auto' }} />
            <Skeleton width={50} height={20} radius={9999} />
            <Skeleton width={64} height={20} radius={9999} />
            <Skeleton width={20} height={20} radius={6} style={{ marginLeft: 'auto' }} />
        </div>
    )
}

// El estado que ve el dueño mezcla dos cosas del backend: el status del
// producto y si le queda stock. Sin stock manda sobre "publicado" porque es lo
// que necesita accionar.
function estadoVisual(p: ApiProductRow): EstadoProducto {
    if (p.status === 'DRAFT') return 'borrador'
    return p.totalStock === 0 ? 'sin_stock' : 'publicado'
}

// Miniatura: usa la imagen real si el producto tiene una; si no, el placeholder
// de color que ya usaba el panel (derivado del id para que sea estable). Si
// sus fotos siguen subiendo en segundo plano (ver productUploadTracker.ts),
// un ícono de reloj en vez de la imagen — a este tamaño no entra un
// porcentaje legible, el detalle completo queda en el título.
function Miniatura({ p, size = 40, radius = 8, upload }: { p: ApiProductRow; size?: number; radius?: number; upload?: ProductUploadState }) {
    if (upload) {
        const titulo = upload.phase === 'error' ? tituloDeSubida(upload) : `${tituloDeSubida(upload)} ${pctDeSubida(upload)}%`
        return (
            <div
                title={titulo}
                style={{ width: size, height: size, borderRadius: radius, background: upload.phase === 'error' ? 'var(--color-error-bg)' : 'var(--color-surface-alt)', display: 'grid', placeItems: 'center', flexShrink: 0 }}
            >
                <Clock size={size * 0.45} strokeWidth={1.5} color={upload.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)'} />
            </div>
        )
    }
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

// ─── Card de grilla (con carrusel de imágenes) ─────────────────────────────────
// Lo que la vista en tabla no puede dar: navegar entre las fotos de un
// producto sin abrir el detalle. `p.images` ya viene en orden de preferencia
// (la principal primero, si no hay ninguna marcada cae a la primera de
// variante) — acá solo se pagina sobre ese array.
function ProductoGridCard({ p, upload, editando, creadoPorOrbi, onEditar, onDuplicar, onBorrar, onToggleFeatured }: {
    p: ApiProductRow
    upload?: ProductUploadState
    // Producto EXISTENTE guardando cambios en segundo plano (ver
    // lib/productUploadTracker.ts) — a diferencia de `upload`, la foto y los
    // datos de acá son reales, solo se deshabilitan las acciones mientras
    // tanto (ver EditandoTag).
    editando?: ProductEditState
    // Creado por Orbi en esta sesión de pestaña (ver useOrbiStore.markProductCreated) —
    // solo un aviso visual pasajero, se pierde solo al recargar la página.
    creadoPorOrbi?: boolean
    onEditar: () => void
    onDuplicar: () => void
    onBorrar: () => void
    onToggleFeatured: () => void
}) {
    const [indice, setIndice] = useState(0)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const hayFotos = p.images.length > 0
    const hayVarias = p.images.length > 1
    const stockCol = p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-muted)'
    const bloqueada = !!upload || !!editando

    function anterior(e: React.MouseEvent) {
        e.stopPropagation()
        setIndice(i => (i - 1 + p.images.length) % p.images.length)
    }
    function siguiente(e: React.MouseEvent) {
        e.stopPropagation()
        setIndice(i => (i + 1) % p.images.length)
    }

    return (
        <div
            className="ds-hover prod-grid-card"
            data-disabled={bloqueada || undefined}
            onClick={bloqueada ? undefined : onEditar}
            style={{
                background: 'var(--color-bg)',
                border: creadoPorOrbi ? '1.5px solid #8B5CF6' : '1px solid var(--color-border)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column', opacity: upload ? 0.85 : 1,
                position: 'relative',
            }}
        >
            {creadoPorOrbi && (
                <span style={{
                    position: 'absolute', top: 8, left: 8, zIndex: 1,
                    display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                    borderRadius: 9999, background: '#8B5CF6', color: 'white',
                    fontSize: 10, fontWeight: 700,
                }}>Nuevo ✦</span>
            )}
            {/* Cuadrado forzado con la técnica padding-top:100% (el % de un
                padding vertical siempre se calcula sobre el ANCHO del
                contenedor, en cualquier navegador) en vez de la propiedad
                aspect-ratio — que dejaba el tamaño de la card variar según la
                foto del carrusel en la que estuvieras parado, cuando fotos
                con relación de aspecto distinta (una vertical, otra
                horizontal) se turnaban en el mismo espacio. El overflow:hidden
                vive acá (no en la card entera) para que el menú "···" del pie
                pueda desplegarse sin que la imagen lo recorte. */}
            <div style={{ position: 'relative', width: '100%', paddingTop: '100%', background: 'var(--color-surface)', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                    {/* object-fit: contain (no cover) + un margen chico —
                        cada producto trae su foto con SU propia proporción y
                        SU propio recorte (según cómo la haya subido cada
                        negocio, o si le quitó el fondo o no), sin ningún
                        estándar entre sí. Con `cover` esa diferencia se
                        notaba mucho: una foto llenaba el cuadro entero y otra
                        quedaba chica y perdida en el medio, aunque el
                        CUADRO (el div de acá arriba, siempre 1:1) mida
                        exactamente lo mismo en las dos cards. `contain` nunca
                        recorta el producto — mismo criterio que ya se aplicó
                        en el storefront (Thumb.tsx → ProdImage) para este
                        mismo problema. */}
                    {upload ? (
                        // Producto en vuelo — todavía puede ni existir en el
                        // backend (fase 'creating', ver ProductoNuevo.tsx
                        // guardar() + lib/productUploadTracker.ts). Ocupa el
                        // mismo lugar que iría la foto — no tiene sentido
                        // mostrar carrusel/destacado todavía si no hay fotos.
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px' }}>
                            <Clock size={22} strokeWidth={1.5} color={upload.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)'} />
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: upload.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)', textAlign: 'center' }}>
                                {tituloDeSubida(upload)}{upload.phase !== 'error' ? ` · ${pctDeSubida(upload)}%` : ''}
                            </div>
                            {upload.phase !== 'error' && (
                                <div style={{ width: '70%', height: 4, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
                                    <div style={{ width: `${pctDeSubida(upload)}%`, height: '100%', background: upload.failed > 0 ? 'var(--color-warning)' : 'var(--color-primary)', transition: 'width 400ms ease' }} />
                                </div>
                            )}
                        </div>
                    ) : hayFotos
                        ? <img src={p.images[indice]} alt={p.name} style={{ position: 'absolute', inset: '6%', width: '88%', height: '88%', objectFit: 'contain', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ProductoThumb hue={[...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} size={72} radius={12} />
                        </div>}

                    {!upload && (
                        <span style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
                            {editando ? <EditandoTag e={editando} /> : <ProductoEstadoBadge estado={estadoVisual(p)} sobreImagen />}
                        </span>
                    )}

                    {/* Indicador de destacado — antes era un borde dorado
                        grueso (2.5px) alrededor de la miniatura entera, muy
                        cargado. Ahora es un badge chico en la esquina, mismo
                        lenguaje visual que el chip de estado (círculo oscuro
                        + ícono) — se nota sin gritar. La estrella "de verdad"
                        (para marcar/desmarcar) sigue en la fila de acciones
                        del pie. */}
                    {p.isFeatured && !upload && (
                        <span
                            title="Destacado"
                            style={{
                                position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%',
                                background: 'rgba(15,23,42,0.65)', display: 'grid', placeItems: 'center', pointerEvents: 'none',
                            }}
                        >
                            <Star size={11} fill="#FBBF24" color="#FBBF24" />
                        </span>
                    )}

                    {/* Carrusel: solo si hay más de una foto — es la razón de ser de la grilla */}
                    {!upload && hayVarias && (
                        <>
                            <button className="ds-hover" onClick={anterior} title="Foto anterior" style={{ ...navBtnImg, left: 6 }}><ChevronLeft size={15} /></button>
                            <button className="ds-hover" onClick={siguiente} title="Foto siguiente" style={{ ...navBtnImg, right: 6 }}><ChevronRight size={15} /></button>
                            <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(15,23,42,0.65)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, fontFamily: '"Geist Mono", monospace' }}>
                                {indice + 1}/{p.images.length}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    {p.isFeatured && <Star size={12} fill="#FBBF24" color="#FBBF24" style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.categoryName ?? 'Sin categoría'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(p.basePrice)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stockCol, fontFamily: '"Geist Mono", monospace' }}>{p.totalStock} u.</span>
                </div>
                {p.variantCount > 1 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 10.5, fontWeight: 600, width: 'fit-content', marginTop: 2 }}>
                        {p.variantCount} variantes
                    </span>
                )}
            </div>

            {/* Acciones — fila fija al pie de la card, siempre visibles (nada
                escondido detrás de un hover, mismo criterio que la fila de
                íconos de la vista en tabla). "Duplicar"/"Eliminar" quedan en
                el menú "···" para no saturar la fila con 4 íconos. Ninguna
                tiene sentido mientras el producto sigue en vuelo — capaz ni
                exista todavía del otro lado. */}
            {!upload && (
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, padding: '4px 8px', borderTop: '1px solid var(--color-border)', position: 'relative', opacity: editando ? 0.4 : 1, pointerEvents: editando ? 'none' : 'auto' }}
                    onClick={e => e.stopPropagation()}
                >
                    <button onClick={onToggleFeatured} title={p.isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'} className="prod-card-actbtn" style={cardActBtn}>
                        <Star size={14} fill={p.isFeatured ? '#FBBF24' : 'none'} color={p.isFeatured ? '#FBBF24' : 'var(--color-muted)'} />
                    </button>
                    <button onClick={onEditar} title="Editar" className="prod-card-actbtn" style={cardActBtn}><Edit2 size={14} /></button>
                    <button onClick={() => setMenuAbierto(v => !v)} title="Más acciones" className="prod-card-actbtn" style={cardActBtn}><MoreVertical size={14} /></button>

                    {menuAbierto && (
                        <>
                            <div onClick={() => setMenuAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                            <div style={{ position: 'absolute', top: '100%', right: 8, marginTop: 4, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 170 }}>
                                <button className="ds-hover" onClick={() => { setMenuAbierto(false); onDuplicar() }} style={menuItem}><Copy size={14} style={{ color: 'var(--color-muted)' }} /> Duplicar</button>
                                <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                <button className="ds-hover" onClick={() => { setMenuAbierto(false); onBorrar() }} style={{ ...menuItem, color: 'var(--color-error)' }}><Trash2 size={14} /> Eliminar</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Card mobile ─────────────────────────────────────────────────────────────

function ProductoCard({ p, upload, editando, onEditar }: { p: ApiProductRow; upload?: ProductUploadState; editando?: ProductEditState; onEditar: () => void }) {
    const stockCol = p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-success)'
    const bloqueada = !!upload || !!editando
    return (
        <div className="ds-hover prod-mobile-card" data-disabled={bloqueada || undefined} onClick={bloqueada ? undefined : onEditar} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, opacity: upload ? 0.85 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Miniatura p={p} size={44} upload={upload} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: upload?.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)' }}>
                        {upload ? `${tituloDeSubida(upload)}${upload.phase !== 'error' ? ` · ${pctDeSubida(upload)}%` : ''}` : (p.categoryName ?? 'Sin categoría')}
                    </div>
                    {upload && upload.phase !== 'error' && (
                        <div style={{ width: '100%', height: 3, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden', marginTop: 4 }}>
                            <div style={{ width: `${pctDeSubida(upload)}%`, height: '100%', background: upload.failed > 0 ? 'var(--color-warning)' : 'var(--color-primary)', transition: 'width 400ms ease' }} />
                        </div>
                    )}
                </div>
                {!upload && (editando ? <EditandoTag e={editando} /> : <ProductoEstadoBadge estado={estadoVisual(p)} />)}
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
            {!upload && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: editando ? 0.4 : 1, pointerEvents: editando ? 'none' : 'auto' }} onClick={e => e.stopPropagation()}>
                    <button onClick={onEditar} className="prod-list-actbtn" style={iconBtn}><Edit2 size={14} /></button>
                </div>
            )}
        </div>
    )
}

// ─── Lista (P1) ───────────────────────────────────────────────────────────────

function ListaView({ irNuevo, irEditar, onToast }: {
    irNuevo: () => void
    irEditar: (id: string) => void
    onToast: (m: string) => void
}) {
    // Grilla por default: deja ver las fotos reales y navegar entre ellas
    // (carrusel) cuando un producto tiene más de una — algo que la tabla no
    // puede ofrecer. La tabla queda disponible como alternativa más densa.
    const [vista, setVista] = useState<'grilla' | 'tabla'>('grilla')
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
    const [exportando, setExportando] = useState(false)
    const [error, setError] = useState('')

    const createdProductIds = useOrbiStore(s => s.createdProductIds)

    const [aBorrar, setABorrar] = useState<ApiProductRow | null>(null)
    const [borrando, setBorrando] = useState(false)

    // Productos recién creados cuyas fotos siguen subiendo en segundo plano
    // (ver ProductoNuevo.tsx guardar() + lib/productUploadTracker.ts) — un
    // Map por id para que las cards lo busquen O(1).
    const uploads = useProductUploads()
    // Productos EXISTENTES cuyos cambios se están guardando en segundo plano
    // (misma idea, pero para editar en vez de crear — ver
    // lib/productUploadTracker.ts → beginProductEdit()). A diferencia de
    // `uploads`, acá la fila real ya existe con sus datos viejos, así que se
    // busca por id para superponerle una marca liviana, no para reemplazarla
    // por una card de mentira.
    const edits = useProductEdits()
    const editsPorId = useMemo(() => new Map(edits.map(e => [e.productId, e])), [edits])

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
            // Antes se dejaba `filas` (y `total`) con lo último que había
            // cargado bien, mostrando solo un error chico arriba — si el
            // request de un filtro nuevo fallaba (ej. un 401 transitorio),
            // la tabla seguía mostrando los resultados VIEJOS/sin filtrar,
            // dando la impresión de que el filtro "no funciona".
            setFilas([])
            setTotal(0)
            setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos')
        } finally {
            if (miPedido === pedidoRef.current) setCargando(false)
        }
    }, [busqDebounced, fcat, fest, pagina])

    useEffect(() => { void cargar() }, [cargar])

    // Pide la lista otra vez SIN pasar por `cargando` (a diferencia de
    // cargar() de arriba) — para reemplazar una card "en vuelo" por la fila
    // real sin tapar toda la grilla con el skeleton de carga inicial en el
    // medio. Antes se usaba el mismo cargar() de siempre acá, y si en ese
    // momento `filas` todavía estaba vacío (ej. el primer producto del
    // negocio) el skeleton de 8 cards se metía adelante de todo un
    // instante: la card se veía "desaparecer" y recién unos segundos
    // después volvía a aparecer ya como producto real — confuso, no debería
    // notarse ningún hueco en el medio.
    const cargarSilencioso = useCallback(async () => {
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
            setFilas(lista.data)
            setTotal(lista.total)
            setStats(metricas)
        } catch {
            // Sin feedback especial acá — si esto falla, el próximo cargar()
            // "de verdad" (cambiar de filtro, paginar, etc.) reintenta solo.
        }
    }, [busqDebounced, fcat, fest, pagina])

    // Cuando una card "en vuelo" llega a fase 'done' (ver
    // lib/productUploadTracker.ts), ya terminó de crearse y de subir sus
    // fotos — recién ACÁ se pide la lista real y, una vez que ya está en
    // `filas`, se saca la entrada del tracker. El orden importa: primero
    // los datos reales, después se borra la de mentira — así el swap es
    // invisible en vez de dejar un hueco vacío entre las dos.
    const idsEnLimpiezaRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        const listos = uploads.filter(u => u.phase === 'done' && !idsEnLimpiezaRef.current.has(u.tempId))
        if (listos.length === 0) return
        for (const u of listos) idsEnLimpiezaRef.current.add(u.tempId)
        void (async () => {
            await cargarSilencioso()
            for (const u of listos) {
                clearProductUpload(u.tempId)
                idsEnLimpiezaRef.current.delete(u.tempId)
            }
        })()
    }, [uploads, cargarSilencioso])

    // Mismo patrón que arriba, para ediciones en vez de altas: cuando una
    // edición en segundo plano llega a fase 'done' (ver
    // lib/productUploadTracker.ts → finishProductEdit()), se refetchea para
    // traer los datos ya actualizados y recién ahí se saca del tracker — así
    // la fila nunca muestra ni los datos viejos "de más" ni un hueco vacío.
    // Si alguna foto nueva no se pudo subir, se avisa acá con un toast (el
    // producto en sí se guardó bien, no es un error bloqueante).
    const idsEdicionEnLimpiezaRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        const listas = edits.filter(e => e.phase === 'done' && !idsEdicionEnLimpiezaRef.current.has(e.productId))
        if (listas.length === 0) return
        for (const e of listas) idsEdicionEnLimpiezaRef.current.add(e.productId)
        void (async () => {
            await cargarSilencioso()
            for (const e of listas) {
                if (e.failedPhotos > 0) {
                    onToast(`Producto actualizado, pero ${e.failedPhotos} foto${e.failedPhotos === 1 ? '' : 's'} no se pudo subir. Editá el producto para reintentar.`)
                }
                clearProductEdit(e.productId)
                idsEdicionEnLimpiezaRef.current.delete(e.productId)
            }
        })()
    }, [edits, cargarSilencioso, onToast])

    useEffect(() => {
        panelGetCategoriesFlat().then(setCategorias).catch(() => setCategorias([]))
    }, [])


    // Exporta TODO lo que matchea los filtros actuales (no solo la página
    // visible) — pide todas las páginas en secuencia y arma un .xlsx con
    // estilo real (encabezado con color, anchos por columna, moneda
    // formateada), no un CSV disfrazado.
    async function exportarExcel() {
        setExportando(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            const todas: ApiProductRow[] = []
            let pag = 1
            const limite = 100
            while (true) {
                const res = await panelListProducts({
                    search: busqDebounced || undefined,
                    categoryId: fcat !== 'todos' ? fcat : undefined,
                    status: fest !== 'todos' ? (fest as ProductStatusFilter) : undefined,
                    page: pag,
                    limit: limite,
                })
                todas.push(...res.data)
                if (todas.length >= res.total || res.data.length === 0) break
                pag++
            }

            const wb = new ExcelJS.Workbook()
            wb.creator = 'Órbita'
            wb.created = new Date()
            const ws = wb.addWorksheet('Productos', { views: [{ state: 'frozen', ySplit: 1 }] })

            ws.columns = [
                { header: 'Nombre', key: 'nombre', width: 34 },
                { header: 'Categoría', key: 'categoria', width: 20 },
                { header: 'Precio', key: 'precio', width: 14, style: { numFmt: '"$"#,##0' } },
                { header: 'Stock', key: 'stock', width: 10 },
                { header: 'Variantes', key: 'variantes', width: 11 },
                { header: 'Estado', key: 'estado', width: 14 },
                { header: 'Creado', key: 'creado', width: 14 },
            ]

            const ESTADO_LABEL: Record<EstadoProducto, string> = { publicado: 'Publicado', borrador: 'Borrador', sin_stock: 'Sin stock' }
            for (const p of todas) {
                ws.addRow({
                    nombre: p.name,
                    categoria: p.categoryName ?? 'Sin categoría',
                    precio: p.basePrice,
                    stock: p.totalStock,
                    variantes: p.variantCount,
                    estado: ESTADO_LABEL[estadoVisual(p)],
                    creado: new Date(p.createdAt).toLocaleDateString('es-AR'),
                })
            }

            // Encabezado con estilo real: fondo, tipografía blanca, bordes finos
            // en toda la tabla — lo que pediste como "buen diseño de celdas".
            const header = ws.getRow(1)
            header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
            header.alignment = { vertical: 'middle' }
            header.height = 22

            ws.eachRow((row, i) => {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    }
                    if (i > 1) cell.alignment = { vertical: 'middle' }
                })
                if (i > 1 && i % 2 === 0) {
                    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } })
                }
            })

            const buffer = await wb.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `productos-${new Date().toISOString().slice(0, 10)}.xlsx`
            a.click()
            URL.revokeObjectURL(url)
            onToast(`${todas.length} producto${todas.length === 1 ? '' : 's'} exportado${todas.length === 1 ? '' : 's'}`)
        } catch {
            onToast('No se pudo generar el Excel')
        } finally {
            setExportando(false)
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

    // Mismo patrón que duplicar()/confirmarBorrado(): sin actualización
    // optimista, se refresca la lista entera desde el backend.
    async function toggleFeatured(p: ApiProductRow) {
        try {
            await panelToggleProductFeatured(p.id, !p.isFeatured)
            onToast(p.isFeatured ? `"${p.name}" ya no es destacado` : `"${p.name}" marcado como destacado`)
            await cargar()
        } catch (err) {
            onToast(err instanceof ApiError ? err.message : 'No se pudo actualizar')
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
                .prod-grid-wrap  { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
                .prod-card-actbtn { transition: background 120ms, color 120ms; }
                .prod-card-actbtn:hover { background: var(--color-surface-alt) !important; color: var(--color-text) !important; }
                .prod-list-actbtn { transition: background 120ms, color 120ms; }
                .prod-list-actbtn:hover { background: var(--color-surface-alt) !important; color: var(--color-text) !important; }
                /* Hover sutil de todo el módulo — antes las cards/filas de
                   producto no daban ningún feedback al pasar el mouse, solo
                   los botones de acción sueltos (de arriba). Nada de lift ni
                   sombra grande (esto es panel, no storefront): un cambio de
                   borde y un fondo apenas más claro alcanza. */
                .prod-grid-card, .prod-table-row, .prod-mobile-card { transition: border-color 140ms ease, background 140ms ease; }
                .prod-grid-card:hover, .prod-mobile-card:hover { border-color: var(--color-border-strong) !important; }
                .prod-table-row:hover { background: var(--color-surface) !important; }
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
                    .prod-grid-wrap  { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important; gap: 10px !important; }
                }
                @media (max-width: 460px) {
                    .prod-kpis { grid-template-columns: 1fr !important; }
                }
            `}</style>


            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Productos</h1>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
                        {total} producto{total === 1 ? '' : 's'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportarExcel()} disabled={exportando || total === 0}>
                        {exportando ? 'Exportando…' : 'Exportar Excel'}
                    </Button>
                    <Button variant="primary" icon={<Plus size={16} />} onClick={irNuevo}>Crear producto</Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="prod-kpis">
                {cargando && !stats ? (
                    Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCard label="Total"       value={stats?.total ?? 0}       icon={Package}     accent="#3B82F6" />
                        <StatCard label="Publicados"  value={stats?.publicados ?? 0}  icon={Globe}       accent="#10B981" />
                        <StatCard label="Sin stock"   value={stats?.sinStock ?? 0}    icon={AlertCircle} accent="#F59E0B" />
                        <StatCard label="Borradores"  value={stats?.borradores ?? 0}  icon={Edit2}       accent="#64748B" />
                        <StatCard label="Valor de inventario" value={stats ? fmtMoney(stats.valorInventario) : '-'} icon={Wallet} accent="#8B5CF6" />
                    </>
                )}
            </div>

            {/* Filtros */}
            <Card padding="sm" style={{ padding: 10, marginBottom: 16 }}>
                <div className="prod-filter-row">
                    <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                        <input className="ds-field" value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar por nombre o SKU…" style={{ ...inputBase, width: '100%', height: 36, paddingLeft: 34, paddingRight: 12, fontSize: 13 }} />
                    </div>
                    <select className="ds-field" value={fcat} onChange={e => { setFcat(e.target.value); setPagina(1) }} style={selSt}>
                        <option value="todos">Todas las categorías</option>
                        {catsOrdenadas.map(c => (
                            <option key={c.id} value={c.id}>{c.nivel === 1 ? `· ${c.name}` : c.name}</option>
                        ))}
                    </select>
                    <select className="ds-field" value={fest} onChange={e => { setFest(e.target.value); setPagina(1) }} style={selSt}>
                        <option value="todos">Todos los estados</option>
                        <option value="PUBLISHED">Publicado</option>
                        <option value="DRAFT">Borrador</option>
                        <option value="OUT_OF_STOCK">Sin stock</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={limpiar}>Limpiar</Button>
                    <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                        <button className="ds-hover" onClick={() => setVista('grilla')} title="Vista en grilla" style={{ ...vistaBtn, background: vista === 'grilla' ? 'var(--color-primary-bg)' : 'transparent', color: vista === 'grilla' ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                            <LayoutGrid size={15} />
                        </button>
                        <button className="ds-hover" onClick={() => setVista('tabla')} title="Vista en tabla" style={{ ...vistaBtn, background: vista === 'tabla' ? 'var(--color-primary-bg)' : 'transparent', color: vista === 'tabla' ? 'var(--color-primary)' : 'var(--color-muted)', borderLeft: '1px solid var(--color-border)' }}>
                            <List size={15} />
                        </button>
                    </div>
                </div>
            </Card>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>
                    {error}
                </div>
            )}

            {/* ── Vista en grilla (default) ── */}
            {vista === 'grilla' && (
                cargando && filas.length === 0 ? (
                    <div className="prod-grid-wrap">
                        {Array.from({ length: 8 }).map((_, i) => <ProductoGridCardSkeleton key={i} />)}
                    </div>
                ) : filas.length === 0 && uploads.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12 }}>Sin productos para estos filtros</div>
                ) : (
                    <div className="prod-grid-wrap">
                        {/* Productos en vuelo primero (recién creados, ver
                            useProductUploads()) — ni existen todavía en
                            `filas`, son cards sueltas armadas con sus propios
                            datos (filaPendiente()). */}
                        {uploads.map(u => (
                            <ProductoGridCard
                                key={u.tempId}
                                p={filaPendiente(u)}
                                upload={u}
                                onEditar={() => {}}
                                onDuplicar={() => {}}
                                onBorrar={() => {}}
                                onToggleFeatured={() => {}}
                            />
                        ))}
                        {filas.map(p => (
                            <ProductoGridCard
                                key={p.id}
                                p={p}
                                editando={editsPorId.get(p.id)}
                                creadoPorOrbi={createdProductIds.has(p.id)}
                                onEditar={() => irEditar(p.id)}
                                onDuplicar={() => void duplicar(p)}
                                onBorrar={() => setABorrar(p)}
                                onToggleFeatured={() => void toggleFeatured(p)}
                            />
                        ))}
                    </div>
                )
            )}

            {/* ── DESKTOP: tabla ── */}
            {vista === 'tabla' && <>
            <div className="prod-table-wrap" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span /><span>Producto</span><span>Categoría</span><span style={{ textAlign: 'right' }}>Precio</span><span style={{ textAlign: 'right' }}>Stock</span><span>Variantes</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acc.</span>
                </div>

                {cargando && filas.length === 0 && (
                    Array.from({ length: 8 }).map((_, i) => <ProductoFilaSkeleton key={i} ultima={i === 7} />)
                )}

                {/* Productos en vuelo primero — mismas columnas que una fila
                    real, sin acciones (todavía puede ni existir del otro
                    lado). Ver useProductUploads(). */}
                {uploads.map(u => (
                    <div key={u.tempId} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderBottom: '1px solid var(--color-border)', opacity: 0.85 }}>
                        <Miniatura p={filaPendiente(u)} upload={u} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: u.phase === 'error' ? 'var(--color-error)' : 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {tituloDeSubida(u)}{u.phase !== 'error' ? ` · ${pctDeSubida(u)}%` : ''}
                            </div>
                            {u.phase !== 'error' && (
                                <div style={{ width: '100%', maxWidth: 140, height: 3, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden', marginTop: 4 }}>
                                    <div style={{ width: `${pctDeSubida(u)}%`, height: '100%', background: u.failed > 0 ? 'var(--color-warning)' : 'var(--color-primary)', transition: 'width 400ms ease' }} />
                                </div>
                            )}
                        </div>
                        <span />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(u.basePrice)}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{u.totalStock}</span>
                        <span /><span /><span />
                    </div>
                ))}

                {filas.map((p, i) => {
                    const stockCol = p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-success)'
                    const editandoFila = editsPorId.get(p.id)
                    const creadoPorOrbi = createdProductIds.has(p.id)
                    return (
                        <div key={p.id} className="prod-table-row" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none', background: creadoPorOrbi ? 'rgba(139,92,246,0.06)' : 'transparent' }}>
                            <Miniatura p={p} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                    {creadoPorOrbi && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px', borderRadius: 9999, background: '#8B5CF6', color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>Nuevo ✦</span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description ?? ''}</div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{p.categoryName ?? 'Sin categoría'}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{fmtMoney(p.basePrice)}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: stockCol, fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>{p.totalStock}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{p.variantCount} var.</span>
                            {editandoFila ? <EditandoTag e={editandoFila} /> : <ProductoEstadoBadge estado={estadoVisual(p)} />}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, position: 'relative', opacity: editandoFila ? 0.4 : 1, pointerEvents: editandoFila ? 'none' : 'auto' }}>
                                <button onClick={() => void toggleFeatured(p)} className="prod-list-actbtn" style={iconBtn} title={p.isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'}>
                                    <Star size={15} fill={p.isFeatured ? '#FBBF24' : 'none'} color={p.isFeatured ? '#FBBF24' : 'var(--color-muted)'} />
                                </button>
                                <button onClick={() => irEditar(p.id)} className="prod-list-actbtn" style={iconBtn} title="Editar"><Edit2 size={15} /></button>
                                <button
                                    onClick={e => {
                                        if (menu === p.id) { setMenu(null); return }
                                        const r = e.currentTarget.getBoundingClientRect()
                                        setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
                                        setMenu(p.id)
                                    }}
                                    className="prod-list-actbtn"
                                    style={iconBtn}
                                >
                                    <MoreVertical size={15} />
                                </button>
                                {menu === p.id && menuPos && (
                                    <>
                                        <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                                        <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 180 }}>
                                            <button className="ds-hover" onClick={() => void duplicar(p)} style={menuItem}><Copy size={14} style={{ color: 'var(--color-muted)' }} /> Duplicar</button>
                                            <button className="ds-hover" onClick={() => { setMenu(null); irEditar(p.id) }} style={menuItem}><Edit2 size={14} style={{ color: 'var(--color-muted)' }} /> Editar</button>
                                            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                            <button className="ds-hover" onClick={() => { setMenu(null); setABorrar(p) }} style={{ ...menuItem, color: 'var(--color-error)' }}><Trash2 size={14} /> Eliminar</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
                {!cargando && filas.length === 0 && uploads.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Sin productos para estos filtros</div>}
            </div>

            {/* ── MOBILE: cards ── */}
            <div className="prod-cards-wrap">
                {!cargando && filas.length === 0 && uploads.length === 0
                    ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Sin productos para estos filtros</div>
                    : <>
                        {uploads.map(u => (
                            <ProductoCard key={u.tempId} p={filaPendiente(u)} upload={u} onEditar={() => {}} />
                        ))}
                        {filas.map(p => (
                            <ProductoCard key={p.id} p={p} editando={editsPorId.get(p.id)} onEditar={() => irEditar(p.id)} />
                        ))}
                    </>
                }
            </div>
            </>}

            {/* Paginado */}
            {totalPaginas > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                    <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>Anterior</Button>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>Página {pagina} de {totalPaginas}</span>
                    <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>Siguiente</Button>
                </div>
            )}

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
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
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
const cardActBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const vistaBtn: React.CSSProperties = { width: 32, height: 32, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const navBtnImg: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.55)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }

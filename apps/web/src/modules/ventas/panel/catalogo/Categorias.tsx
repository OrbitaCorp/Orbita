// src/modules/ventas/panel/catalogo/Categorias.tsx — Vista P3 (rediseñada)
// Árbol jerárquico con íconos profesionales (lucide-react), sin emojis.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { adminPath, currentSlug } from '@/lib/tenant'
import { toastEsError } from '@/lib/utils'
import { Plus, Edit2, Trash2, ChevronRight, Eye, EyeOff, Tag } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton } from '@/design-system/components/Skeleton'
// ICON_MAP/CatIcon se movieron a catIcons.tsx (2026-08-25) para que el
// storefront (Inicio.tsx) también pueda dibujar el ícono real de cada
// categoría, no solo este panel.
import { CAT_ICONS, CAT_COLORS, CatIcon, slugify, type CatIconKey } from './catIcons'
import { ImgUploader } from '@/modules/ventas/panel/configuracion/components/apariencia/ImgUploader'
import {
    panelGetCategoryTree, panelCreateCategory, panelUpdateCategory, panelDeleteCategory,
    panelUploadStorefrontImage,
    ApiError, type ApiCategoryNode,
} from '@/lib/api'
import type { CatNode } from './types/catalogo.types'

// ─── Helpers árbol ─────────────────────────────────────────────────────────────

function treeMap(tree: CatNode[], id: string, fn: (c: CatNode) => CatNode): CatNode[] {
    return tree.map(c => c.id === id ? fn(c) : { ...c, subcategorias: treeMap(c.subcategorias, id, fn) })
}
function treeFind(tree: CatNode[], id: string, path: string[] = []): { cat: CatNode; path: string[] } | null {
    for (const c of tree) {
        if (c.id === id) return { cat: c, path: [...path, c.nombre] }
        const r = treeFind(c.subcategorias, id, [...path, c.nombre])
        if (r) return r
    }
    return null
}
function countAll(tree: CatNode[]): number {
    return tree.reduce((s, c) => s + 1 + countAll(c.subcategorias), 0)
}

// El árbol viene del backend (GET /categories ya lo devuelve anidado); acá solo
// se traduce a la forma que usa esta pantalla.
function aCatNode(n: ApiCategoryNode): CatNode {
    return {
        id: n.id,
        nombre: n.name,
        slug: n.slug,
        icono: n.icon ?? 'tag',
        color: n.color ?? '#3B82F6',
        imagen: n.imageUrl ?? null,
        productos: n.productCount,
        activa: n.isActive,
        subcategorias: n.children.map(aCatNode),
    }
}

interface ModalState { parentId?: string | null; parentNombre?: string; edit?: CatNode }

// ─── Skeleton — misma forma exacta del contenido real, con las piezas del
// componente compartido design-system/Skeleton.tsx (clase `.skel` de
// globals.css: mismo barrido de luz y corte por prefers-reduced-motion que el
// resto del panel). ─────────────────────────────────────────────────────────

// Mezcla niveles 0/1 para que se note que es un árbol (mismo indent/tamaño
// de ícono que renderCat), no una lista plana.
const FILAS_SKELETON: { nivel: 0 | 1; ancho: number }[] = [
    { nivel: 0, ancho: 130 }, { nivel: 1, ancho: 100 }, { nivel: 1, ancho: 90 },
    { nivel: 0, ancho: 110 }, { nivel: 0, ancho: 150 }, { nivel: 1, ancho: 95 },
]

function CategoriaFilaSkeleton({ nivel, ancho }: { nivel: 0 | 1; ancho: number }) {
    const indent = nivel * 24
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px 12px 10px ${indent + 12}px` }}>
            <span style={{ width: 14 }} />
            <Skeleton width={nivel === 0 ? 34 : 26} height={nivel === 0 ? 34 : 26} radius={nivel === 0 ? 9 : 7} style={{ flexShrink: 0 }} />
            <Skeleton width={ancho} height={12} radius={8} />
            <div style={{ flex: 1 }} />
            <Skeleton width={46} height={17} radius={9999} />
        </div>
    )
}

// ─── Categorias page ───────────────────────────────────────────────────────────

export default function Categorias() {
    const router = useRouter()
    const [arbol, setArbol] = useState<CatNode[]>([])
    const [exp, setExp]     = useState<string[]>([])
    const [selId, setSelId] = useState<string | null>(null)
    const [modal, setModal] = useState<ModalState | null>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [guardando, setGuardando] = useState(false)

    const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }
    const sel = selId ? treeFind(arbol, selId) : null

    const cargar = useCallback(async () => {
        setCargando(true)
        try {
            const tree = await panelGetCategoryTree()
            setArbol(tree.map(aCatNode))
            // Arranca con las raíces abiertas para que se vea la jerarquía.
            setExp(prev => prev.length ? prev : tree.map(t => t.id))
            setError('')
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías')
        } finally {
            setCargando(false)
        }
    }, [])

    useEffect(() => { void cargar() }, [cargar])

    const verProductos = () => {
        // Path real (criterio del Sidebar): query.seccion/moduloPadre dejaron
        // de existir con el catch-all [...slug] y este botón no navegaba.
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        void router.push(adminPath(negocioId, 'ventas', 'catalogo'))
    }

    const toggle = (id: string) => setExp(x => x.includes(id) ? x.filter(i => i !== id) : [...x, id])

    // El backend rechaza con 422 si la categoría todavía tiene productos o
    // subcategorías; ese mensaje se muestra tal cual.
    const remove = async (id: string) => {
        try {
            await panelDeleteCategory(id)
            if (selId === id) setSelId(null)
            notify('Categoría eliminada')
            await cargar()
        } catch (err) {
            notify(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría')
        }
    }

    // Guarda los cambios del editor lateral (nombre, ícono, color, visibilidad).
    const guardarSeleccionada = async () => {
        if (!sel) return
        setGuardando(true)
        try {
            await panelUpdateCategory(sel.cat.id, {
                name: sel.cat.nombre,
                slug: sel.cat.slug,
                icon: sel.cat.icono,
                color: sel.cat.color,
                imageUrl: sel.cat.imagen,
                isActive: sel.cat.activa,
            })
            notify('Categoría guardada')
            await cargar()
        } catch (err) {
            notify(err instanceof ApiError ? err.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    // Recursivo con props correctas. `isLast` indica si `c` es el último
    // hermano dentro de su grupo — determina si el trazo vertical del
    // conector sigue de largo (hay más hermanos abajo) o corta en "L" acá.
    const renderCat = (c: CatNode, nivel = 0, isLast = true) => {
        const isExp = exp.includes(c.id)
        const hasSub = c.subcategorias.length > 0
        const isSel = selId === c.id
        const indent = nivel * 24
        // x del trazo: alineado a la columna del ícono/chevron del padre
        // (nivel - 1), para que se vea como que "cuelga" de él.
        const connX = (nivel - 1) * 24 + 22

        return (
            <div key={c.id} style={{ position: 'relative' }}>
                {nivel > 0 && (
                    <>
                        {/* Trazo vertical: viene del padre y sigue de largo si hay más hermanos después de este */}
                        <div style={{
                            position: 'absolute', left: connX, top: 0,
                            ...(isLast ? { height: 21 } : { bottom: 0 }),
                            width: 1, background: 'var(--color-border)', pointerEvents: 'none',
                        }} />
                        {/* Codo horizontal hacia el chevron/ícono de esta fila */}
                        <div style={{ position: 'absolute', left: connX, top: 21, width: indent + 12 - connX, height: 1, background: 'var(--color-border)', pointerEvents: 'none' }} />
                    </>
                )}
                <div
                    className="cat-row"
                    onClick={() => setSelId(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px 12px 10px ${indent + 12}px`, borderRadius: 8, cursor: 'pointer', background: isSel ? 'var(--color-primary-bg)' : 'transparent', transition: 'background 120ms' }}
                >
                    <button
                        className="ds-hover"
                        data-disabled={!hasSub || undefined}
                        onClick={e => { e.stopPropagation(); hasSub && toggle(c.id) }}
                        style={{ width: 20, height: 20, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', transform: (isExp && hasSub) ? 'rotate(90deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }}
                    >
                        {hasSub ? <ChevronRight size={14} strokeWidth={1.8} /> : <span style={{ width: 14 }} />}
                    </button>

                    {c.imagen ? (
                        <span style={{ width: nivel === 0 ? 34 : 26, height: nivel === 0 ? 34 : 26, borderRadius: nivel === 0 ? 9 : 7, flexShrink: 0, overflow: 'hidden', opacity: c.activa ? 1 : 0.5 }}>
                            <img src={c.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </span>
                    ) : (
                        <span style={{ width: nivel === 0 ? 34 : 26, height: nivel === 0 ? 34 : 26, borderRadius: nivel === 0 ? 9 : 7, background: c.activa ? `${c.color}22` : 'var(--color-surface-alt)', color: c.activa ? c.color : 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                            <CatIcon icono={c.icono} size={nivel === 0 ? 16 : 13} />
                        </span>
                    )}

                    <span style={{ flex: 1, fontSize: nivel === 0 ? 14 : 13, fontWeight: nivel === 0 ? 600 : 500, color: c.activa ? 'var(--color-text)' : 'var(--color-muted)', opacity: c.activa ? 1 : 0.65, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nombre}
                    </span>

                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', border: '1px solid var(--color-border)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {c.productos} prod.
                    </span>
                    {hasSub && (
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {c.subcategorias.length} sub
                        </span>
                    )}

                    <div className="cat-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 120ms', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="ds-hover" title="Agregar subcategoría" onClick={() => setModal({ parentId: c.id, parentNombre: c.nombre })} style={catBtn}><Plus size={12} strokeWidth={2.2} /></button>
                        <button className="ds-hover" title="Editar" onClick={() => setModal({ edit: c })} style={catBtn}><Edit2 size={12} strokeWidth={1.8} /></button>
                        <button className="ds-hover" title="Eliminar" onClick={() => void remove(c.id)} style={{ ...catBtn, color: 'var(--color-error)' }}><Trash2 size={12} strokeWidth={1.8} /></button>
                    </div>
                </div>

                {isExp && hasSub && (
                    <div>
                        {c.subcategorias.map((s, i) => renderCat(s, nivel + 1, i === c.subcategorias.length - 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="cat-page" style={pageWrap}>
            <style>{`
                .cat-page  { padding: 24px 32px 64px; }
                .cat-grid  { display: grid; grid-template-columns: minmax(0,60%) minmax(0,40%); gap: 20px; align-items: start; }
                .cat-row:hover .cat-actions { opacity: 1 !important; }
                .cat-row:hover { background: var(--color-surface) !important; }
                @media (max-width: 768px) {
                    .cat-page { padding: 16px 14px 48px !important; }
                    .cat-grid { grid-template-columns: minmax(0,1fr) !important; }
                }
            `}</style>


            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Categorías</h1>
                    {cargando ? (
                        <Skeleton width={60} height={24} radius={9999} />
                    ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{countAll(arbol)} total</span>
                    )}
                </div>
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setModal({ parentId: null })}>Nueva categoría</Button>
            </div>

            <div className="cat-grid">
                {/* ── Árbol ── */}
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Árbol de categorías</span>
                        {cargando ? (
                            <Skeleton width={50} height={11} radius={8} />
                        ) : (
                            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{arbol.length} raíces</span>
                        )}
                    </div>
                    <div style={{ padding: '8px 4px' }}>
                        {cargando ? (
                            FILAS_SKELETON.map((f, i) => <CategoriaFilaSkeleton key={i} nivel={f.nivel} ancho={f.ancho} />)
                        ) : error ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-error)', fontSize: 13 }}>
                                {error}
                            </div>
                        ) : arbol.length === 0 ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                                <Tag size={28} strokeWidth={1.4} style={{ opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
                                Sin categorías. Creá la primera.
                            </div>
                        ) : arbol.map(c => renderCat(c))}
                    </div>
                </div>

                {/* ── Editor ── */}
                {sel ? (
                    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80 }}>
                        {/* Header editor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                            {sel.cat.imagen ? (
                                <span style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, overflow: 'hidden' }}>
                                    <img src={sel.cat.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </span>
                            ) : (
                                <span style={{ width: 36, height: 36, borderRadius: 9, background: `${sel.cat.color}22`, color: sel.cat.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <CatIcon icono={sel.cat.icono} size={16} />
                                </span>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.cat.nombre}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{sel.path.join(' › ')}</div>
                            </div>
                        </div>

                        <div style={{ padding: '16px' }}>
                            <EditorField label="Nombre" value={sel.cat.nombre} onChange={v => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, nombre: v })))} />
                            <EditorField label="Slug" value={sel.cat.slug} mono onChange={v => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, slug: v })))} />

                            {/* Imagen — opcional, además del ícono/color de abajo (no en
                                vez de): con imagen cargada, la tienda la muestra a ella en
                                vez del ícono; sin imagen, sigue con ícono+color como
                                siempre. */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={cl}>Imagen (opcional)</label>
                                <div style={{ marginTop: 8 }}>
                                    <ImgUploader
                                        value={sel.cat.imagen}
                                        onChange={v => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, imagen: v })))}
                                        onUpload={file => panelUploadStorefrontImage(file, file.name).then(r => r.url)}
                                        shape="circle"
                                        size={64}
                                        formats="Si la cargás, reemplaza al ícono en la tienda"
                                    />
                                </div>
                            </div>

                            {/* Ícono picker */}
                            <label style={cl}>Ícono</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, margin: '8px 0 16px' }}>
                                {CAT_ICONS.map(key => {
                                    const a = sel.cat.icono === key
                                    return (
                                        <button key={key} className="ds-hover" onClick={() => setArbol(a2 => treeMap(a2, sel.cat.id, c => ({ ...c, icono: key })))}
                                            style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `2px solid ${a ? sel.cat.color : 'var(--color-border)'}`, background: a ? `${sel.cat.color}18` : 'var(--color-surface)', color: a ? sel.cat.color : 'var(--color-muted)', display: 'grid', placeItems: 'center', transition: 'all 120ms' }}
                                        >
                                            <CatIcon icono={key} size={14} />
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Color picker */}
                            <label style={cl}>Color</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                                {CAT_COLORS.map(col => (
                                    <button key={col} className="ds-hover" onClick={() => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, color: col })))}
                                        style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: 'none', outline: sel.cat.color === col ? `3px solid ${col}` : '2px solid transparent', outlineOffset: 2, transition: 'outline 120ms' }}
                                    />
                                ))}
                            </div>

                            {/* Visible toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 8, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>Visible en la tienda</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>Los clientes pueden ver esta categoría</div>
                                </div>
                                <Toggle on={sel.cat.activa} onClick={() => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, activa: !c.activa })))} />
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 14 }}>
                                {sel.cat.productos} productos · <button className="ds-link" onClick={verProductos} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Ver productos →</button>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button variant="primary" onClick={() => void guardarSeleccionada()} disabled={guardando}>
                                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                                </Button>
                                <Button variant="outline" onClick={() => { setSelId(null); void cargar() }}>Cancelar</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '48px 20px', textAlign: 'center', color: 'var(--color-muted)' }}>
                        <Tag size={32} strokeWidth={1.2} style={{ opacity: 0.35, marginBottom: 12 }} />
                        <div style={{ fontSize: 13 }}>Seleccioná una categoría<br />para editarla</div>
                    </div>
                )}
            </div>

            {modal && (
                <CatModal
                    modal={modal}
                    onClose={() => setModal(null)}
                    onSave={async (campos, parentId, editId) => {
                        const payload = {
                            name: campos.nombre,
                            slug: campos.slug,
                            icon: campos.icono,
                            color: campos.color,
                            imageUrl: campos.imagen,
                            isActive: campos.activa,
                        }
                        try {
                            if (editId) {
                                await panelUpdateCategory(editId, payload)
                                notify('Categoría actualizada')
                            } else {
                                await panelCreateCategory({ ...payload, parentId: parentId ?? undefined })
                                if (parentId) setExp(x => x.includes(parentId) ? x : [...x, parentId])
                                notify('Categoría creada')
                            }
                            setModal(null)
                            await cargar()
                        } catch (err) {
                            notify(err instanceof ApiError ? err.message : 'No se pudo guardar la categoría')
                        }
                    }}
                />
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EditorField({ label, value, mono, onChange }: { label: string; value: string; mono?: boolean; onChange: (v: string) => void }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={cl}>{label}</label>
            <input className="ds-field" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', height: 40, padding: '0 12px', marginTop: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
    )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <span className="ds-hover" onClick={onClick} style={{ width: 40, height: 22, borderRadius: 11, background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', border: on ? 'none' : '1px solid var(--color-border)', position: 'relative', flexShrink: 0, display: 'inline-block' }}>
            <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 21 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.15)', transition: 'left 200ms' }} />
        </span>
    )
}

type CatCampos = Pick<CatNode, 'nombre' | 'slug' | 'icono' | 'color' | 'imagen' | 'activa'>

function CatModal({ modal, onClose, onSave }: {
    modal: ModalState
    onClose: () => void
    onSave: (campos: CatCampos, parentId: string | null, editId: string | null) => Promise<void>
}) {
    const editing  = modal.edit
    const parentId = modal.parentId ?? null
    const [nombre, setNombre] = useState(editing?.nombre ?? '')
    const [icono,  setIcono]  = useState<CatIconKey>((editing?.icono as CatIconKey) ?? 'shirt')
    const [color,  setColor]  = useState(editing?.color ?? '#3B82F6')
    const [imagen, setImagen] = useState<string | null>(editing?.imagen ?? null)
    const [activa, setActiva] = useState(editing?.activa ?? true)
    const [guardando, setGuardando] = useState(false)
    const slug = slugify(nombre)

    // Guard contra doble click: sin esto, nada deshabilitaba el botón mientras
    // la petición estaba en curso — el usuario no veía ningún cambio hasta que
    // terminaba, así que podía tocarlo varias veces y disparar POSTs duplicados.
    const submit = async () => {
        if (!nombre.trim() || guardando) return
        setGuardando(true)
        try {
            await onSave({ nombre, slug, icono, color, imagen, activa }, parentId, editing ? editing.id : null)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={editing ? `Editar: ${editing.nombre}` : modal.parentNombre ? `Subcategoría de ${modal.parentNombre}` : 'Nueva categoría raíz'}
            maxWidth={440}
            footer={<>
                <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                <Button variant="primary" disabled={!nombre.trim() || guardando} onClick={() => void submit()}>
                    {guardando ? (editing ? 'Guardando…' : 'Creando…') : (editing ? 'Guardar' : 'Crear')}
                </Button>
            </>}
        >
            {modal.parentNombre && !editing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-primary-bg)', borderRadius: 8, marginBottom: 16 }}>
                    <ChevronRight size={13} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>Dentro de: <strong>{modal.parentNombre}</strong></span>
                </div>
            )}

            <EditorField label="Nombre" value={nombre} onChange={setNombre} />
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 16, marginTop: -10 }}>slug: {slug || '-'}</div>

            {/* Imagen — opcional, además del ícono/color de abajo. Con imagen
                cargada, la tienda la muestra a ella en vez del ícono. */}
            <div style={{ marginBottom: 16 }}>
                <label style={cl}>Imagen (opcional)</label>
                <div style={{ marginTop: 8 }}>
                    <ImgUploader
                        value={imagen}
                        onChange={setImagen}
                        onUpload={file => panelUploadStorefrontImage(file, file.name).then(r => r.url)}
                        shape="circle"
                        size={64}
                        formats="Si la cargás, reemplaza al ícono en la tienda"
                    />
                </div>
            </div>

            {/* Ícono picker */}
            <label style={cl}>Ícono</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, margin: '8px 0 16px' }}>
                {CAT_ICONS.map(key => {
                    const a = icono === key
                    return (
                        <button key={key} className="ds-hover" onClick={() => setIcono(key)}
                            style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `2px solid ${a ? color : 'var(--color-border)'}`, background: a ? `${color}18` : 'var(--color-surface)', color: a ? color : 'var(--color-muted)', display: 'grid', placeItems: 'center', transition: 'all 120ms' }}
                        >
                            <CatIcon icono={key} size={14} />
                        </button>
                    )
                })}
            </div>

            {/* Preview de cómo se va a ver — imagen si hay, si no el ícono */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-surface)', borderRadius: 8, marginBottom: 16 }}>
                {imagen ? (
                    <span style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, overflow: 'hidden' }}>
                        <img src={imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </span>
                ) : (
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: `${color}22`, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <CatIcon icono={icono} size={18} />
                    </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{nombre || 'Sin nombre'}</span>
            </div>

            {/* Color picker */}
            <label style={cl}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                {CAT_COLORS.map(col => (
                    <button key={col} className="ds-hover" onClick={() => setColor(col)}
                        style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: 'none', outline: color === col ? `3px solid ${col}` : '2px solid transparent', outlineOffset: 2, transition: 'outline 120ms' }}
                    />
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--color-body)' }}>Activa</span>
                <Toggle on={activa} onClick={() => setActiva(!activa)} />
            </div>
        </Modal>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const cl:      React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block' }
const catBtn:  React.CSSProperties = { width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }

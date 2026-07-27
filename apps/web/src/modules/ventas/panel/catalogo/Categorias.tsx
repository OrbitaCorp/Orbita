// src/modules/ventas/panel/catalogo/Categorias.tsx — Vista P3 (rediseñada)
// Árbol jerárquico con íconos profesionales (lucide-react), sin emojis.

import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/router'
import {
    Plus, Edit2, Trash2, ChevronRight, Tag, Package, Shirt, Layers,
    ShoppingBag, Gem, Watch, Star, Heart, LayoutGrid, Crown, Zap, Box,
    Palette, Glasses, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { CatalogoTabs } from './components/CatalogoTabs'
import { CAT_ICONS, CAT_COLORS, slugify, type CatIconKey } from './catIcons'
import {
    panelGetCategoryTree, panelCreateCategory, panelUpdateCategory, panelDeleteCategory,
    ApiError, type ApiCategoryNode,
} from '@/lib/api'
import type { CatNode } from './types/catalogo.types'

// ─── Mapa de íconos ────────────────────────────────────────────────────────────

type IconComp = ComponentType<{ size?: number; strokeWidth?: number }>

const ICON_MAP: Record<CatIconKey, IconComp> = {
    shirt:   Shirt,
    package: Package,
    tag:     Tag,
    bag:     ShoppingBag,
    layers:  Layers,
    gem:     Gem,
    watch:   Watch,
    star:    Star,
    heart:   Heart,
    grid:    LayoutGrid,
    crown:   Crown,
    zap:     Zap,
    box:     Box,
    palette: Palette,
    glasses: Glasses,
}

function CatIcon({ icono, size = 16, strokeWidth = 1.8 }: { icono: string; size?: number; strokeWidth?: number }) {
    const IC = ICON_MAP[icono as CatIconKey] ?? Tag
    return <IC size={size} strokeWidth={strokeWidth} />
}

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
        productos: n.productCount,
        activa: n.isActive,
        subcategorias: n.children.map(aCatNode),
    }
}

interface ModalState { parentId?: string | null; parentNombre?: string; edit?: CatNode }

// ─── Componente árbol fila ─────────────────────────────────────────────────────

function CatRow({
    c, nivel, exp, selId, onSelect, onToggle, onSub, onEdit, onDelete,
}: {
    c: CatNode; nivel: number; exp: string[]; selId: string | null
    onSelect: () => void; onToggle: () => void
    onSub: () => void; onEdit: () => void; onDelete: () => void
}) {
    const isExp = exp.includes(c.id)
    const hasSub = c.subcategorias.length > 0
    const isSel = selId === c.id
    const indent = nivel * 24

    return (
        <>
            <div
                className="cat-row"
                onClick={onSelect}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: `10px 12px 10px ${indent + 12}px`,
                    borderRadius: 8, cursor: 'pointer',
                    background: isSel ? 'var(--color-primary-bg)' : 'transparent',
                    transition: 'background 120ms',
                }}
            >
                {/* Expandir */}
                <button
                    onClick={e => { e.stopPropagation(); hasSub && onToggle() }}
                    style={{ width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: hasSub ? 'pointer' : 'default', display: 'grid', placeItems: 'center', transform: (isExp && hasSub) ? 'rotate(90deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }}
                >
                    {hasSub ? <ChevronRight size={14} strokeWidth={1.8} /> : <span style={{ width: 14 }} />}
                </button>

                {/* Ícono con color */}
                <span style={{ width: nivel === 0 ? 34 : 26, height: nivel === 0 ? 34 : 26, borderRadius: nivel === 0 ? 9 : 7, background: c.activa ? `${c.color}22` : 'var(--color-surface-alt)', color: c.activa ? c.color : 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                    <CatIcon icono={c.icono} size={nivel === 0 ? 16 : 13} />
                </span>

                {/* Nombre */}
                <span style={{ flex: 1, fontSize: nivel === 0 ? 14 : 13, fontWeight: nivel === 0 ? 600 : 500, color: c.activa ? 'var(--color-text)' : 'var(--color-muted)', opacity: c.activa ? 1 : 0.6, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.nombre}
                </span>

                {/* Badges */}
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', border: '1px solid var(--color-border)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {c.productos} prod.
                </span>
                {hasSub && (
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {c.subcategorias.length} sub
                    </span>
                )}

                {/* Acciones (hover) */}
                <div className="cat-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 120ms', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button title="Agregar subcategoría" onClick={onSub} style={catBtn}><Plus size={12} strokeWidth={2.2} /></button>
                    <button title="Editar" onClick={onEdit} style={catBtn}><Edit2 size={12} strokeWidth={1.8} /></button>
                    <button title="Eliminar" onClick={onDelete} style={{ ...catBtn, color: 'var(--color-error)' }}><Trash2 size={12} strokeWidth={1.8} /></button>
                </div>
            </div>

            {/* Línea conectora para subcategorías */}
            {isExp && hasSub && (
                <div style={{ position: 'relative', marginLeft: indent + 12 + 10 }}>
                    <div style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 1, background: 'var(--color-border)', pointerEvents: 'none' }} />
                    {c.subcategorias.map(s => (
                        <CatRow
                            key={s.id} c={s} nivel={nivel + 1} exp={exp} selId={selId}
                            onSelect={() => {}} onToggle={() => {}} onSub={() => {}} onEdit={() => {}} onDelete={() => {}}
                        />
                    ))}
                </div>
            )}
        </>
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
        const { negocioId, moduloPadre } = router.query
        router.push({ query: { negocioId: negocioId as string, moduloPadre: moduloPadre as string, seccion: 'catalogo' } })
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

    // Recursivo con props correctas
    const renderCat = (c: CatNode, nivel = 0) => {
        const isExp = exp.includes(c.id)
        const hasSub = c.subcategorias.length > 0
        const isSel = selId === c.id
        const indent = nivel * 24

        return (
            <div key={c.id}>
                <div
                    className="cat-row"
                    onClick={() => setSelId(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px 12px 10px ${indent + 12}px`, borderRadius: 8, cursor: 'pointer', background: isSel ? 'var(--color-primary-bg)' : 'transparent', transition: 'background 120ms' }}
                >
                    <button
                        onClick={e => { e.stopPropagation(); hasSub && toggle(c.id) }}
                        style={{ width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: hasSub ? 'pointer' : 'default', display: 'grid', placeItems: 'center', transform: (isExp && hasSub) ? 'rotate(90deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }}
                    >
                        {hasSub ? <ChevronRight size={14} strokeWidth={1.8} /> : <span style={{ width: 14 }} />}
                    </button>

                    <span style={{ width: nivel === 0 ? 34 : 26, height: nivel === 0 ? 34 : 26, borderRadius: nivel === 0 ? 9 : 7, background: c.activa ? `${c.color}22` : 'var(--color-surface-alt)', color: c.activa ? c.color : 'var(--color-muted)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                        <CatIcon icono={c.icono} size={nivel === 0 ? 16 : 13} />
                    </span>

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
                        <button title="Agregar subcategoría" onClick={() => setModal({ parentId: c.id, parentNombre: c.nombre })} style={catBtn}><Plus size={12} strokeWidth={2.2} /></button>
                        <button title="Editar" onClick={() => setModal({ edit: c })} style={catBtn}><Edit2 size={12} strokeWidth={1.8} /></button>
                        <button title="Eliminar" onClick={() => void remove(c.id)} style={{ ...catBtn, color: 'var(--color-error)' }}><Trash2 size={12} strokeWidth={1.8} /></button>
                    </div>
                </div>

                {isExp && hasSub && (
                    <div style={{ position: 'relative', marginLeft: indent + 32 }}>
                        <div style={{ position: 'absolute', left: 10, top: 0, bottom: 8, width: 1, background: 'var(--color-border)', pointerEvents: 'none' }} />
                        {c.subcategorias.map(s => renderCat(s, nivel + 1))}
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
                    .cat-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <CatalogoTabs activo="categorias" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Categorías</h1>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 9999, background: 'var(--color-surface-alt)', color: 'var(--color-muted)', fontSize: 12, fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{countAll(arbol)} total</span>
                </div>
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setModal({ parentId: null })}>Nueva categoría</Button>
            </div>

            <div className="cat-grid">
                {/* ── Árbol ── */}
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Árbol de categorías</span>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{arbol.length} raíces</span>
                    </div>
                    <div style={{ padding: '8px 4px' }}>
                        {cargando ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
                                Cargando categorías…
                            </div>
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
                            <span style={{ width: 36, height: 36, borderRadius: 9, background: `${sel.cat.color}22`, color: sel.cat.color, display: 'grid', placeItems: 'center' }}>
                                <CatIcon icono={sel.cat.icono} size={16} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.cat.nombre}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{sel.path.join(' › ')}</div>
                            </div>
                        </div>

                        <div style={{ padding: '16px' }}>
                            <EditorField label="Nombre" value={sel.cat.nombre} onChange={v => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, nombre: v })))} />
                            <EditorField label="Slug" value={sel.cat.slug} mono onChange={v => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, slug: v })))} />

                            {/* Ícono picker */}
                            <label style={cl}>Ícono</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, margin: '8px 0 16px' }}>
                                {CAT_ICONS.map(key => {
                                    const a = sel.cat.icono === key
                                    return (
                                        <button key={key} onClick={() => setArbol(a2 => treeMap(a2, sel.cat.id, c => ({ ...c, icono: key })))}
                                            style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `2px solid ${a ? sel.cat.color : 'var(--color-border)'}`, background: a ? `${sel.cat.color}18` : 'var(--color-surface)', color: a ? sel.cat.color : 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 120ms' }}
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
                                    <button key={col} onClick={() => setArbol(a => treeMap(a, sel.cat.id, c => ({ ...c, color: col })))}
                                        style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: 'none', outline: sel.cat.color === col ? `3px solid ${col}` : '2px solid transparent', outlineOffset: 2, cursor: 'pointer', transition: 'outline 120ms' }}
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
                                {sel.cat.productos} productos · <button onClick={verProductos} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Ver productos →</button>
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
                    <Toast variant="success" title={toast} onClose={() => setToast(null)} />
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
            <input value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', height: 40, padding: '0 12px', marginTop: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
    )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <span onClick={onClick} style={{ width: 40, height: 22, borderRadius: 11, background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', border: on ? 'none' : '1px solid var(--color-border)', position: 'relative', cursor: 'pointer', flexShrink: 0, display: 'inline-block' }}>
            <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 21 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.15)', transition: 'left 200ms' }} />
        </span>
    )
}

type CatCampos = Pick<CatNode, 'nombre' | 'slug' | 'icono' | 'color' | 'activa'>

function CatModal({ modal, onClose, onSave }: {
    modal: ModalState
    onClose: () => void
    onSave: (campos: CatCampos, parentId: string | null, editId: string | null) => void
}) {
    const editing  = modal.edit
    const parentId = modal.parentId ?? null
    const [nombre, setNombre] = useState(editing?.nombre ?? '')
    const [icono,  setIcono]  = useState<CatIconKey>((editing?.icono as CatIconKey) ?? 'shirt')
    const [color,  setColor]  = useState(editing?.color ?? '#3B82F6')
    const [activa, setActiva] = useState(editing?.activa ?? true)
    const slug = slugify(nombre)

    const submit = () => {
        if (!nombre.trim()) return
        onSave({ nombre, slug, icono, color, activa }, parentId, editing ? editing.id : null)
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={editing ? `Editar: ${editing.nombre}` : modal.parentNombre ? `Subcategoría de ${modal.parentNombre}` : 'Nueva categoría raíz'}
            maxWidth={440}
            footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!nombre.trim()} onClick={submit}>{editing ? 'Guardar' : 'Crear'}</Button></>}
        >
            {modal.parentNombre && !editing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--color-primary-bg)', borderRadius: 8, marginBottom: 16 }}>
                    <ChevronRight size={13} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>Dentro de: <strong>{modal.parentNombre}</strong></span>
                </div>
            )}

            <EditorField label="Nombre" value={nombre} onChange={setNombre} />
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginBottom: 16, marginTop: -10 }}>slug: {slug || '—'}</div>

            {/* Ícono picker */}
            <label style={cl}>Ícono</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6, margin: '8px 0 16px' }}>
                {CAT_ICONS.map(key => {
                    const a = icono === key
                    return (
                        <button key={key} onClick={() => setIcono(key)}
                            style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `2px solid ${a ? color : 'var(--color-border)'}`, background: a ? `${color}18` : 'var(--color-surface)', color: a ? color : 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 120ms' }}
                        >
                            <CatIcon icono={key} size={14} />
                        </button>
                    )
                })}
            </div>

            {/* Preview del ícono seleccionado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-surface)', borderRadius: 8, marginBottom: 16 }}>
                <span style={{ width: 36, height: 36, borderRadius: 9, background: `${color}22`, color, display: 'grid', placeItems: 'center' }}>
                    <CatIcon icono={icono} size={18} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{nombre || 'Sin nombre'}</span>
            </div>

            {/* Color picker */}
            <label style={cl}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                {CAT_COLORS.map(col => (
                    <button key={col} onClick={() => setColor(col)}
                        style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: 'none', outline: color === col ? `3px solid ${col}` : '2px solid transparent', outlineOffset: 2, cursor: 'pointer', transition: 'outline 120ms' }}
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

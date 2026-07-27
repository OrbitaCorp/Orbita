// Tabs del módulo catálogo. Navegan entre todas las secciones del módulo de productos.
// Tabs: Lista · Crear · Categorías · Reportes

import { useRouter } from 'next/router'

export type TabCatalogo = 'lista' | 'crear' | 'categorias' | 'reportes'

const TABS: { id: TabCatalogo; label: string }[] = [
    { id: 'lista',      label: 'Lista de productos'   },
    { id: 'crear',      label: 'Crear producto'        },
    { id: 'categorias', label: 'Categorías'            },
    { id: 'reportes',   label: 'Reportes de productos' },
]

export function CatalogoTabs({ activo }: { activo: TabCatalogo }) {
    const router = useRouter()
    const { negocioId, moduloPadre } = router.query
    const base = { negocioId: negocioId as string, moduloPadre: moduloPadre as string }

    const go = (tab: TabCatalogo) => {
        if (tab === 'lista')        router.push({ query: { ...base, seccion: 'catalogo' } })
        else if (tab === 'crear')   router.push({ query: { ...base, seccion: 'catalogo', vista: 'nuevo' } })
        else if (tab === 'categorias') router.push({ query: { ...base, seccion: 'categorias' } })
        else if (tab === 'reportes')   router.push({ query: { ...base, seccion: 'reportes', vista: 'productos' } })
    }

    return (
        <>
        <style>{`.cat-tabs{-ms-overflow-style:none;scrollbar-width:none}.cat-tabs::-webkit-scrollbar{display:none}`}</style>
        <div className="cat-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 20, overflowX: 'auto' }}>
            {TABS.map(tb => {
                const a = activo === tb.id
                return (
                    <button
                        key={tb.id}
                        onClick={() => go(tb.id)}
                        style={{
                            padding: '10px 14px', border: 'none', background: 'transparent',
                            color: a ? 'var(--color-text)' : 'var(--color-muted)',
                            fontSize: 13.5, fontWeight: a ? 600 : 500, cursor: 'pointer',
                            fontFamily: 'inherit', borderBottom: `2px solid ${a ? 'var(--color-primary)' : 'transparent'}`,
                            marginBottom: -1, whiteSpace: 'nowrap',
                        }}
                    >
                        {tb.label}
                    </button>
                )
            })}
        </div>
        </>
    )
}

// ─── Badge de estado de producto ──────────────────────────────────────────────

import type { EstadoProducto } from '../types/catalogo.types'

const ESTADO: Record<EstadoProducto, { label: string; bg: string; fg: string }> = {
    publicado: { label: 'Publicado', bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
    borrador:  { label: 'Borrador',  bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)' },
    sin_stock: { label: 'Sin stock', bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' },
}

export function ProductoEstadoBadge({ estado }: { estado: EstadoProducto }) {
    const c = ESTADO[estado]
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 9999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, width: 'fit-content' }}>{c.label}</span>
    )
}

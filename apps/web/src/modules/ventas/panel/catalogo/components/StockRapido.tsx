// src/modules/ventas/panel/catalogo/components/StockRapido.tsx
// Edición rápida de stock desde la lista de productos — sin entrar al editor
// completo. Se abre clickeando el número de stock de una fila/card.
//
// El backend no tiene un endpoint chico "solo stock": PUT /products/:id pisa
// el producto entero con el mismo shape que usa el wizard (ver
// ProductoNuevo.tsx armarPayload()). Por eso acá se trae el detalle completo
// (panelGetProductFull — lo mismo que precarga el wizard al editar), se arma
// el payload con esos mismos valores tal cual estaban, y lo único que se pisa
// es el stock de las variantes que el dueño tocó en el modal.
//
// OJO variantes: no hay "un" stock por producto cuando tiene más de una
// variante — cada combinación (talle/color/etc.) tiene el suyo. El modal
// siempre lista TODAS las variantes del producto (activas e inactivas — si
// se omite alguna en el PUT y no tiene ventas ni movimientos, el backend la
// BORRA, ver products.service.ts#update), una fila con su propio input. Con
// una sola variante (producto sin variantes reales) se ve como un único
// campo "Stock".

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import {
    panelGetProductFull, panelUpdateProduct, ApiError,
    type ApiProductFull, type UpsertProductInput,
} from '@/lib/api'

function etiquetaVariante(v: ApiProductFull['variants'][number]): string {
    return v.optionValues.length > 0 ? v.optionValues.map(ov => ov.value).join(' / ') : 'Stock'
}

// Mismo criterio que ProductoNuevo.tsx armarPayload(): se manda SIEMPRE la
// lista completa de variantes (no solo las que cambiaron) para que ninguna
// se interprete como "ya no va" del lado del backend.
function paraGuardar(full: ApiProductFull, stockPorVariante: Map<string, number>): UpsertProductInput {
    return {
        name: full.name,
        description: full.description ?? undefined,
        categoryId: full.categoryId ?? undefined,
        basePrice: full.basePrice,
        comparePrice: full.comparePrice ?? undefined,
        cost: full.cost ?? undefined,
        status: full.status,
        tagIds: full.tags.length ? full.tags.map(t => t.id) : undefined,
        specs: full.specs,
        videoUrl: full.videoUrl ?? undefined,
        options: full.options.length
            ? full.options.map(o => ({ name: o.name, values: o.values.map(v => v.value), isVisual: o.isVisual }))
            : undefined,
        variants: full.variants.map(v => ({
            id: v.id,
            sku: v.sku ?? undefined,
            price: v.price,
            comparePrice: v.comparePrice ?? undefined,
            optionValues: v.optionValues.map(ov => ov.value),
            initialStock: stockPorVariante.get(v.id) ?? (v.stock[0]?.quantity ?? 0),
            stockMin: v.stock[0]?.stockMin ?? 0,
            isActive: v.isActive,
        })),
    }
}

export function StockRapidoModal({ productoId, productoNombre, onClose, onGuardado }: {
    productoId: string
    productoNombre: string
    onClose: () => void
    // Un solo canal de texto (éxito o error) — mismo patrón que el resto del
    // hub (onToast), toastEsError() decide el color mirando el mensaje.
    onGuardado: (mensaje: string) => void
}) {
    const [full, setFull] = useState<ApiProductFull | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [valores, setValores] = useState<Record<string, string>>({})
    const [guardando, setGuardando] = useState(false)

    useEffect(() => {
        let vivo = true
        panelGetProductFull(productoId)
            .then(p => {
                if (!vivo) return
                setFull(p)
                setValores(Object.fromEntries(p.variants.map(v => [v.id, String(v.stock[0]?.quantity ?? 0)])))
            })
            .catch(e => { if (vivo) setError(e instanceof ApiError ? e.message : 'No se pudo cargar el producto') })
            .finally(() => { if (vivo) setCargando(false) })
        return () => { vivo = false }
    }, [productoId])

    // Un producto sin categoría (la suya se borró después de creado) no pasa
    // la validación del PUT (categoryId es obligatorio ahí) — se avisa acá en
    // vez de dejar que el guardado tire un error genérico.
    const sinCategoria = full !== null && !full.categoryId

    async function guardar() {
        if (!full) return
        setGuardando(true)
        try {
            const stockPorVariante = new Map(full.variants.map(v => [v.id, Number(valores[v.id]) || 0]))
            await panelUpdateProduct(full.id, paraGuardar(full, stockPorVariante))
            onGuardado(`Stock de "${full.name}" actualizado`)
            onClose()
        } catch (e) {
            onGuardado(e instanceof ApiError ? e.message : 'No se pudo actualizar el stock')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Stock — ${productoNombre}`}
            maxWidth={400}
            footer={!cargando && !error && full ? (
                <>
                    <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button variant="primary" onClick={() => void guardar()} disabled={guardando || sinCategoria}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            ) : undefined}
        >
            {cargando && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted)' }}>
                    <Loader2 size={16} style={{ animation: 'spin 800ms linear infinite' }} /> Cargando…
                </div>
            )}
            {error && !cargando && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error)' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}
            {!cargando && !error && full && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sinCategoria && (
                        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 12.5, marginBottom: 6 }}>
                            Este producto no tiene categoría asignada — abrí &quot;Editar&quot; para poder guardar cambios.
                        </div>
                    )}
                    {full.variants.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0' }}>
                            <span style={{ fontSize: 13, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{etiquetaVariante(v)}</span>
                                {!v.isActive && (
                                    <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: 'var(--color-muted)', background: 'var(--color-surface-alt)', borderRadius: 9999, padding: '1px 7px' }}>Inactiva</span>
                                )}
                            </span>
                            <input
                                className="ds-field"
                                type="text"
                                inputMode="numeric"
                                value={valores[v.id] ?? ''}
                                onChange={e => {
                                    const limpio = e.target.value.replace(/\D/g, '')
                                    setValores(prev => ({ ...prev, [v.id]: limpio }))
                                }}
                                style={{ width: 84, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}

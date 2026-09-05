// src/modules/ventas/panel/avanzado/components/TwoForOnePromoModal.tsx —
// Modal de crear/editar UNA promo "2x1 y 3x2" (RBT-675). Reusa
// ConfigLlevaXPagaY.tsx tal cual (mismo componente que el módulo de
// Descuentos ya tenía armado para BUY_X_PAY_Y, con su preview de ahorro y
// selector de producto/categoría) — acá arriba solo el esqueleto de modal
// (Toggle de activa + Guardar/Cancelar en el footer). Lo usa
// TwoForOneConfig.tsx (la pantalla de listado) tanto para "Nueva promo" como
// para "Editar" — `promo` es null en el primer caso.
import { useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Toggle } from '../../configuracion/components/ConfigControls'
import { ConfigLlevaXPagaY } from '../../descuentos/components/ConfigLlevaXPagaY'
import type { AlcanceDescuento } from '../../descuentos/types/descuentos'
import { ApiError, panelCreateTwoForOne, panelUpdateTwoForOne, type ApiTwoForOnePromo } from '@/lib/api'

const alcanceDesdeApi = (a: ApiTwoForOnePromo['alcance']): AlcanceDescuento => (a === 'CATEGORY' ? 'categoria' : 'producto')
const alcanceAApi = (a: AlcanceDescuento): ApiTwoForOnePromo['alcance'] => (a === 'categoria' ? 'CATEGORY' : 'PRODUCT')

interface Props {
    promo: ApiTwoForOnePromo | null
    onClose: () => void
    onSaved: (promo: ApiTwoForOnePromo) => void
}

export function TwoForOnePromoModal({ promo, onClose, onSaved }: Props) {
    const [activo, setActivo] = useState(promo?.isActive ?? true)
    const [llevaCantidad, setLlevaCantidad] = useState(promo ? String(promo.llevaCantidad) : '')
    const [pagaCantidad, setPagaCantidad] = useState(promo ? String(promo.pagaCantidad) : '')
    const [alcance, setAlcance] = useState<AlcanceDescuento>(promo ? alcanceDesdeApi(promo.alcance) : 'categoria')
    const [productosIds, setProductosIds] = useState<string[]>(promo?.productIds ?? [])
    const [categoriasIds, setCategoriasIds] = useState<string[]>(promo?.categoryIds ?? [])
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const llevaN = parseInt(llevaCantidad, 10) || 0
    const pagaN = parseInt(pagaCantidad, 10) || 0
    const seleccionOk = alcance === 'categoria' ? categoriasIds.length > 0 : productosIds.length > 0
    const cantidadesOk = llevaN >= 2 && pagaN >= 1 && pagaN < llevaN
    const valoresValidos = cantidadesOk && seleccionOk

    // Mismo criterio que el resto del panel: errores solo ante un estado
    // CONFLICTIVO (algo cargado que no cierra), nunca por campos todavía
    // vacíos — el modal recién abierto no debería empezar en rojo.
    const errores: Record<string, string> = {}
    if (llevaCantidad !== '' && pagaCantidad !== '' && !cantidadesOk) {
        errores.cantidades = '"Pagá" tiene que ser menor a "Llevá" (y "Llevá" al menos 2) — si no, no hay descuento.'
    }
    if (cantidadesOk && !seleccionOk) {
        errores.seleccion = alcance === 'categoria' ? 'Elegí al menos una categoría.' : 'Elegí al menos un producto.'
    }

    async function guardar() {
        if (!valoresValidos || guardando) return
        setGuardando(true)
        setError(null)
        try {
            const payload = {
                isActive: activo,
                llevaCantidad: llevaN,
                pagaCantidad: pagaN,
                alcance: alcanceAApi(alcance),
                productIds: alcance === 'producto' ? productosIds : undefined,
                categoryIds: alcance === 'categoria' ? categoriasIds : undefined,
            }
            const res = promo ? await panelUpdateTwoForOne(promo.id, payload) : await panelCreateTwoForOne(payload)
            onSaved(res)
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={promo ? 'Editar promo' : 'Nueva promo 2x1/3x2'}
            maxWidth={640}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button variant="primary" loading={guardando} disabled={!valoresValidos} onClick={guardar}>Guardar</Button>
                </>
            }
        >
            {error && (
                <div style={{ padding: '10px 12px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 14, fontSize: 12.5, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            <ConfigLlevaXPagaY
                llevaCantidad={llevaCantidad}
                pagaCantidad={pagaCantidad}
                alcance={alcance}
                productosIds={productosIds}
                categoriasIds={categoriasIds}
                onChangeLleva={setLlevaCantidad}
                onChangePaga={setPagaCantidad}
                onChangeAlcance={setAlcance}
                onChangeProductos={setProductosIds}
                onChangeCategorias={setCategoriasIds}
                errores={errores}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
                <Toggle on={activo} onChange={setActivo} />
                <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Promo activa</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, el descuento se aplica solo en el carrito y el cartel aparece en el catálogo.</div>
                </div>
            </div>
        </Modal>
    )
}

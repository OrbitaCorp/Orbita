// src/modules/ventas/panel/avanzado/TwoForOneConfig.tsx — Listado de promos
// "2x1 y 3x2" (paquete Avanzado, RBT-675).
//
// Un negocio puede tener VARIAS promos a la vez (2026-09-04 — antes era una
// sola por negocio, ver TwoForOnePromoModal.tsx para el form de crear/
// editar, que reusa ConfigLlevaXPagaY.tsx tal cual). Esta pantalla es
// puramente el listado: una fila por promo (chip coloreado con "2x1"/"3x2",
// resumen de alcance, toggle inline, Editar/Eliminar), "+ Nueva promo" y
// estado vacío — mismo esqueleto visual (Card, error banner, skeleton,
// Toast) que el resto de Avanzado.
import { useEffect, useState } from 'react'
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react'
import { Volver } from '../_shared/Volver'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle } from '../configuracion/components/ConfigControls'
import { ModalConfirmacion } from '../../_shared/components'
import { useCategoriasDescuento } from '../descuentos/hooks/useCatalogoDescuento'
import { TwoForOnePromoModal } from './components/TwoForOnePromoModal'
import {
    ApiError, panelListTwoForOne, panelToggleTwoForOne, panelDeleteTwoForOne, type ApiTwoForOnePromo,
} from '@/lib/api'
import { toastEsError } from '@/lib/utils'

// Mismo hash simple (charCodeAt reduce % 360) que ya usan ProductoThumb/
// hueFromId en el resto del código — acá para que el chip "2x1"/"3x2" del
// panel pinte siempre igual para la MISMA promo, mismo color que el chip
// "aplicado" del carrito (ver PromoChip en _shared/components).
function hueDePromo(id: string): number {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
    return h
}

export default function TwoForOneConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)
    const [promos, setPromos] = useState<ApiTwoForOnePromo[]>([])

    const [modalAbierto, setModalAbierto] = useState<'nueva' | ApiTwoForOnePromo | null>(null)
    const [aEliminar, setAEliminar] = useState<ApiTwoForOnePromo | null>(null)
    const [eliminando, setEliminando] = useState(false)
    const [toggleandoId, setToggleandoId] = useState<string | null>(null)

    // Nombres de categoría para el resumen de alcance de cada fila — una sola
    // consulta compartida (ya cacheada por el resto del panel de Descuentos),
    // no una por promo.
    const { data: categorias } = useCategoriasDescuento()

    function cargar() {
        setCargando(true)
        panelListTwoForOne()
            .then(setPromos)
            .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar las promos'))
            .finally(() => setCargando(false))
    }

    useEffect(cargar, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    async function toggle(promo: ApiTwoForOnePromo) {
        setToggleandoId(promo.id)
        try {
            const res = await panelToggleTwoForOne(promo.id)
            setPromos((prev) => prev.map((p) => (p.id === res.id ? res : p)))
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado')
        } finally {
            setToggleandoId(null)
        }
    }

    async function eliminar() {
        if (!aEliminar) return
        setEliminando(true)
        try {
            await panelDeleteTwoForOne(aEliminar.id)
            setPromos((prev) => prev.filter((p) => p.id !== aEliminar.id))
            setToast('Promo eliminada')
            setAEliminar(null)
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo eliminar')
        } finally {
            setEliminando(false)
        }
    }

    function alcanceResumen(promo: ApiTwoForOnePromo): string {
        if (promo.alcance === 'CATEGORY') {
            const nombres = promo.categoryIds.map((id) => categorias?.find((c) => c.id === id)?.name).filter((n): n is string => !!n)
            if (nombres.length === 0) return `Categoría (${promo.categoryIds.length})`
            return `Categoría: ${nombres.join(', ')}`
        }
        return `${promo.productIds.length} producto${promo.productIds.length !== 1 ? 's' : ''}`
    }

    return (
        <div style={pageWrap}>
            <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                        <Tag size={19} strokeWidth={1.8} color="var(--color-primary)" />
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>2x1 y 3x2</h1>
                </div>
                {!cargando && promos.length > 0 && (
                    <Button variant="primary" size="sm" icon={<Plus size={14} strokeWidth={2.2} />} onClick={() => setModalAbierto('nueva')}>
                        Nueva promo
                    </Button>
                )}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px', maxWidth: 640 }}>
                Promos "llevá X, pagá Y" que se aplican solas en el carrito — sin que el cliente cargue ningún código — y aparecen como cartel en la card del producto. Podés tener varias a la vez, cada una con su propio alcance.
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, maxWidth: 820, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md" style={{ maxWidth: 820 }}>
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={48} style={{ marginTop: 14 }} />
                    <SkeletonText width="100%" height={48} style={{ marginTop: 10 }} />
                </Card>
            ) : promos.length === 0 ? (
                <Card padding="md" style={{ maxWidth: 820, textAlign: 'center', padding: '40px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Todavía no creaste ninguna promo 2x1/3x2</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 18 }}>Elegí "llevá X, pagá Y" y a qué productos o categoría aplica.</div>
                    <Button variant="primary" size="sm" icon={<Plus size={14} strokeWidth={2.2} />} onClick={() => setModalAbierto('nueva')}>
                        Crear la primera
                    </Button>
                </Card>
            ) : (
                <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {promos.map((promo) => (
                        <Card key={promo.id} padding="md" style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: promo.isActive ? 1 : 0.6 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                minWidth: 52, height: 30, borderRadius: 8, padding: '0 10px',
                                fontSize: 12.5, fontWeight: 700, color: '#fff',
                                background: `oklch(0.52 0.14 ${hueDePromo(promo.id)})`,
                            }}>
                                {promo.llevaCantidad}x{promo.pagaCantidad}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {alcanceResumen(promo)}
                                </div>
                                <div style={{ fontSize: 11.5, color: promo.isActive ? 'var(--color-success)' : 'var(--color-muted)', marginTop: 2 }}>
                                    {promo.isActive ? 'Activa' : 'Inactiva'}
                                </div>
                            </div>
                            <Toggle on={promo.isActive} onChange={() => toggle(promo)} disabled={toggleandoId === promo.id} />
                            <button
                                className="ds-hover"
                                onClick={() => setModalAbierto(promo)}
                                aria-label="Editar promo"
                                title="Editar"
                                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                            >
                                <Pencil size={15} strokeWidth={1.8} />
                            </button>
                            <button
                                className="ds-hover"
                                onClick={() => setAEliminar(promo)}
                                aria-label="Eliminar promo"
                                title="Eliminar"
                                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                            >
                                <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                        </Card>
                    ))}
                </div>
            )}

            {modalAbierto && (
                <TwoForOnePromoModal
                    promo={modalAbierto === 'nueva' ? null : modalAbierto}
                    onClose={() => setModalAbierto(null)}
                    onSaved={(res) => {
                        setPromos((prev) => {
                            const existe = prev.some((p) => p.id === res.id)
                            return existe ? prev.map((p) => (p.id === res.id ? res : p)) : [...prev, res]
                        })
                        setModalAbierto(null)
                        setToast('Promo guardada')
                    }}
                />
            )}

            <ModalConfirmacion
                isOpen={!!aEliminar}
                titulo="¿Eliminar esta promo?"
                descripcion={aEliminar ? `Se deja de aplicar "${aEliminar.llevaCantidad}x${aEliminar.pagaCantidad}" en el carrito y desaparece el cartel del catálogo. No se puede deshacer.` : undefined}
                labelConfirmar="Eliminar"
                variante="danger"
                cargando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setAEliminar(null)}
            />

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }

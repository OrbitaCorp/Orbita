import { useState } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { ApiError, pauseBusiness, changeBusinessMode, panelCancelBusiness, panelReactivateFromCancellation } from '@/lib/api'
import { ErrorInline } from './comunes'
import type { ConfigGeneralState } from './useConfigGeneral'

const cajaPeligro: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px' }

// Fecha del borrado definitivo (ventana de cancelación) — sin hora, en
// español. '-' si todavía no se cargó (mismo criterio defensivo que el resto
// de la pantalla mientras `cargando` es true).
function formatFechaCorta(iso: string | null): string {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// El botoncito "¿Qué pasa si...?" de la zona peligrosa: lo tocás y se abre la
// explicación completa. Así el texto queda corto (clave en el celular) pero la
// información está toda ahí igual.
function DetalleExpandible({ pregunta, children }: { pregunta: string; children: React.ReactNode }) {
    const [abierto, setAbierto] = useState(false)
    return (
        <div style={{ marginTop: 10 }}>
            <button
                onClick={() => setAbierto(a => !a)}
                className="ds-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}
            >
                <span style={{ display: 'inline-block', transform: abierto ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>▸</span>
                {pregunta}
            </button>
            {abierto && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--color-body)', lineHeight: 1.5 }}>
                    {children}
                </ul>
            )}
        </div>
    )
}

// Zona peligrosa: pausar la tienda, pasarla a vidriera digital o eliminar el espacio.
export function SeccionPeligro({ cfg, onToast }: { cfg: ConfigGeneralState; onToast: (m: string) => void }) {
    const {
        isPaused, setIsPaused, modo, setModo, cancelledAt, setCancelledAt,
        scheduledDeletionAt, setScheduledDeletionAt, guardando, setGuardando, errores, setErrores,
    } = cfg
    const [modalPausa, setModalPausa] = useState(false)
    const [modalModo, setModalModo]   = useState(false)
    const [modalCancelar, setModalCancelar] = useState(false)

    async function confirmarPausa() {
        setModalPausa(false)
        setGuardando('pausa')
        setErrores(prev => ({ ...prev, pausa: null }))
        try {
            const r = await pauseBusiness(!isPaused)
            setIsPaused(r.isPaused)
            onToast(r.isPaused ? 'Tienda pausada' : 'Tienda reactivada')
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado'
            setErrores(prev => ({ ...prev, pausa: msg }))
        } finally {
            setGuardando(null)
        }
    }

    async function confirmarModo() {
        setModalModo(false)
        const nuevo = modo === 'FULL' ? 'SHOWCASE' : 'FULL'
        setGuardando('modo')
        setErrores(prev => ({ ...prev, modo: null }))
        try {
            const r = await changeBusinessMode(nuevo)
            setModo(r.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL')
            onToast(r.mode === 'SHOWCASE' ? 'Tu tienda ahora es una vidriera digital' : 'Tu tienda ahora es una tienda online completa')
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado'
            setErrores(prev => ({ ...prev, modo: msg }))
        } finally {
            setGuardando(null)
        }
    }

    // Cancelación voluntaria (RBT — ciclo de vida de suscripciones, 2026-09).
    // Un solo botón hace las dos cosas según el estado actual, mismo patrón
    // que confirmarPausa — el modal de arriba ya distingue el texto.
    async function confirmarCancelacion() {
        setModalCancelar(false)
        setGuardando('cancelar')
        setErrores(prev => ({ ...prev, cancelar: null }))
        try {
            if (cancelledAt) {
                await panelReactivateFromCancellation()
                setCancelledAt(null)
                setScheduledDeletionAt(null)
                onToast('Tu tienda fue reactivada')
            } else {
                const r = await panelCancelBusiness()
                setCancelledAt(new Date().toISOString())
                setScheduledDeletionAt(r.scheduledDeletionAt)
                onToast('Tu tienda quedó dada de baja')
            }
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error inesperado'
            setErrores(prev => ({ ...prev, cancelar: msg }))
        } finally {
            setGuardando(null)
        }
    }

    return (
        <>
            <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Pausar / reactivar */}
                    <div style={cajaPeligro}>
                        <div className="cfg-peligro-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 180, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-body)' }}>
                                    {isPaused ? 'Reactivar tienda' : 'Pausar tienda'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                    {isPaused
                                        ? 'Tu tienda está pausada: tus clientes no la ven.'
                                        : 'Tu tienda deja de estar visible para tus clientes. Tus datos se conservan.'}
                                </div>
                            </div>
                            <Button variant="outline" loading={guardando === 'pausa'} onClick={() => setModalPausa(true)}>
                                {isPaused ? 'Reactivar' : 'Pausar'}
                            </Button>
                        </div>
                        <DetalleExpandible pregunta="¿Qué pasa si pauso la tienda?">
                            <li>Nadie puede ver tu tienda ni comprarte mientras esté pausada.</li>
                            <li>Vos seguís entrando al panel con normalidad.</li>
                            <li>Tus datos, productos y pedidos quedan intactos.</li>
                            <li>La reactivás cuando quieras, con un click.</li>
                        </DetalleExpandible>
                        <ErrorInline msg={errores.pausa} />
                    </div>

                    {/* Modo de la tienda: completa o vidriera digital */}
                    <div style={cajaPeligro}>
                        <div className="cfg-peligro-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 180, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-body)' }}>
                                    {modo === 'SHOWCASE' ? 'Pasar a tienda online completa' : 'Pasar a vidriera digital'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                    {modo === 'SHOWCASE'
                                        ? 'Ahora mismo tu storefront es solo catálogo: reactivá el carrito y el pago online.'
                                        : 'Tu storefront pasa a ser solo catálogo: tus clientes consultan por WhatsApp, no compran desde acá.'}
                                </div>
                            </div>
                            <Button variant="outline" loading={guardando === 'modo'} onClick={() => setModalModo(true)}>
                                {modo === 'SHOWCASE' ? 'Activar tienda completa' : 'Activar vidriera digital'}
                            </Button>
                        </div>
                        <DetalleExpandible pregunta="¿Qué cambia con la vidriera digital?">
                            <li>Se saca el carrito, el pago online y el seguimiento de pedidos — tus clientes solo navegan el catálogo.</li>
                            <li>Cada producto suma un botón &quot;Consultar por WhatsApp&quot; con el mensaje ya armado (producto, variante y precio).</li>
                            <li>Se apaga la mensajería del storefront, las reseñas de producto y los cupones/descuentos online.</li>
                            <li>No podés pasar a vidriera si tenés pedidos online sin resolver — primero hay que entregarlos o cancelarlos.</li>
                            <li>Tus productos, precios y todo lo demás se conservan — es solo cómo compra el cliente.</li>
                        </DetalleExpandible>
                        <ErrorInline msg={errores.modo} />
                    </div>

                    {/* Eliminar espacio */}
                    <div style={cajaPeligro}>
                        <div className="cfg-peligro-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 180, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: cancelledAt ? 'var(--color-body)' : 'var(--color-error)' }}>
                                    {cancelledAt ? 'Reactivar espacio' : 'Eliminar espacio'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                                    {cancelledAt
                                        ? `Se elimina de forma definitiva el ${formatFechaCorta(scheduledDeletionAt)} si no la reactivás antes.`
                                        : 'Borra tu espacio con todos sus datos.'}
                                </div>
                            </div>
                            <Button variant={cancelledAt ? 'outline' : 'danger'} loading={guardando === 'cancelar'} onClick={() => setModalCancelar(true)}>
                                {cancelledAt ? 'Reactivar' : 'Eliminar'}
                            </Button>
                        </div>
                        <DetalleExpandible pregunta="¿Qué pasa si elimino mi espacio?">
                            <li>Tu tienda se pausa al instante — deja de verse para tus clientes.</li>
                            <li>Tenés 60 días para arrepentirte y recuperar todo tal cual estaba, con un click.</li>
                            <li>Pasados esos 60 días, el espacio y todos sus datos se eliminan de forma definitiva. No hay vuelta atrás después de esa fecha.</li>
                        </DetalleExpandible>
                        <ErrorInline msg={errores.cancelar} />
                    </div>

                </div>
            </Card>

            <Modal
                isOpen={modalPausa}
                onClose={() => setModalPausa(false)}
                title={isPaused ? '¿Reactivar la tienda?' : '¿Pausar la tienda?'}
                variant={isPaused ? 'default' : 'danger'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalPausa(false)}>Cancelar</Button>
                        <Button variant={isPaused ? 'primary' : 'danger'} onClick={confirmarPausa}>
                            {isPaused ? 'Sí, reactivar' : 'Sí, pausar'}
                        </Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    {isPaused
                        ? 'Tu tienda vuelve a estar visible para tus clientes.'
                        : 'Tu tienda deja de estar visible para tus clientes. Los datos se conservan y podés reactivarla cuando quieras.'}
                </div>
            </Modal>

            <Modal
                isOpen={modalModo}
                onClose={() => setModalModo(false)}
                title={modo === 'SHOWCASE' ? '¿Pasar a tienda online completa?' : '¿Pasar a vidriera digital?'}
                variant={modo === 'SHOWCASE' ? 'default' : 'danger'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalModo(false)}>Cancelar</Button>
                        <Button variant={modo === 'SHOWCASE' ? 'primary' : 'danger'} onClick={() => void confirmarModo()}>
                            {modo === 'SHOWCASE' ? 'Sí, activar tienda completa' : 'Sí, pasar a vidriera'}
                        </Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    {modo === 'SHOWCASE'
                        ? 'Volvés a vender online: carrito, pago, seguimiento de pedidos, mensajería y reseñas se reactivan.'
                        : 'El carrito, el pago online, el seguimiento de pedidos, la mensajería y las reseñas dejan de estar disponibles. Cada producto va a mostrar un botón para consultar por WhatsApp en su lugar. Si tenés pedidos online sin resolver, no vas a poder confirmar el cambio hasta entregarlos o cancelarlos.'}
                </div>
            </Modal>

            <Modal
                isOpen={modalCancelar}
                onClose={() => setModalCancelar(false)}
                title={cancelledAt ? '¿Reactivar tu espacio?' : '¿Eliminar tu espacio?'}
                variant={cancelledAt ? 'default' : 'danger'}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setModalCancelar(false)}>Volver</Button>
                        <Button variant={cancelledAt ? 'primary' : 'danger'} onClick={() => void confirmarCancelacion()}>
                            {cancelledAt ? 'Sí, reactivar' : 'Sí, eliminar'}
                        </Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    {cancelledAt
                        ? 'Tu tienda vuelve a estar visible para tus clientes, tal cual la dejaste — nada se perdió.'
                        : 'Tu tienda se pausa al instante. Vas a poder reactivarla y recuperar todo durante los próximos 60 días — pasado ese plazo, se elimina de forma definitiva.'}
                </div>
            </Modal>
        </>
    )
}

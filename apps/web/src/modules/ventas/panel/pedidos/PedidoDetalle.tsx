// src/modules/ventas/panel/pedidos/PedidoDetalle.tsx — Vista 03
// Detalle de un pedido: productos, línea de tiempo de estado, notas y cliente.
//
// (Fase 2 — Alex) Esta pantalla ya trabaja con el pedido REAL: carga el detalle
// del backend, la línea de tiempo sale del historial guardado (con fecha y hora
// de cada paso), y los botones de estado hacen el cambio de verdad — con las
// mismas reglas del backend: avanzar hacia adelante (se pueden saltear pasos
// si el negocio no fue marcando cada uno), nunca hacia atrás, y cancelar solo
// antes del envío. Si el backend rechaza un cambio, el motivo se muestra acá.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ChevronRight, Printer, Mail, Check, ChevronDown, Truck, Store, RotateCcw, X, Copy } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Modal } from '@/design-system/components/Modal'
import { Badge } from '@/design-system/components/Badge'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton, SkeletonText, SkeletonCircle } from '@/design-system/components/Skeleton'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, getOrder, sendOrderEmail, updateOrderStatus, updateOrderShipping, type ApiOrderDetail, type ApiOrderStatus, type ApiCarrier } from '@/lib/api'
import type { VistaPedido } from './components/PedidoTabs'
import { ProductoThumb } from './components/ProductoThumb'
import { ModalComprobante } from './components/ModalComprobante'
import { ModalEmail } from './components/ModalEmail'
import type { EstadoPedido } from './types/pedidos.types'

// Traducción backend ↔ pantalla (mismo criterio que la lista).
const API_A_UI: Record<ApiOrderStatus, EstadoPedido> = {
    PENDING: 'pendiente', CONFIRMED: 'confirmado', PREPARING: 'preparacion',
    SHIPPED: 'enviado', DELIVERED: 'entregado', COMPLETED: 'entregado', CANCELLED: 'cancelado',
}
const UI_A_API: Record<EstadoPedido, ApiOrderStatus> = {
    pendiente: 'PENDING', confirmado: 'CONFIRMED', preparacion: 'PREPARING',
    enviado: 'SHIPPED', entregado: 'DELIVERED', cancelado: 'CANCELLED',
}

// Las mismas reglas del backend, para mostrar solo los botones que tienen
// sentido. El primer estado de cada lista es el paso natural (el del botón
// grande); el resto son salteos hacia adelante para cuando el pedido ya está
// más avanzado en la realidad de lo que quedó marcado acá. Nunca hacia atrás.
// Cancelar solo antes de "En preparación" — a partir de ahí, cualquier
// problema se resuelve como devolución, no como cancelación.
const PERMITIDAS: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
    pendiente:   ['confirmado', 'preparacion', 'enviado', 'entregado', 'cancelado'],
    confirmado:  ['preparacion', 'enviado', 'entregado', 'cancelado'],
    preparacion: ['enviado', 'entregado'],
    enviado:     ['entregado'],
}

const ESTADO_LABEL: Record<EstadoPedido, string> = {
    pendiente:   'Pendiente',
    confirmado:  'Confirmado',
    preparacion: 'En preparación',
    enviado:     'Enviado',
    entregado:   'Entregado',
    cancelado:   'Cancelado',
}

const ACCION_LABEL: Partial<Record<EstadoPedido, string>> = {
    pendiente:   'Confirmar pedido',
    confirmado:  'Iniciar preparación',
    preparacion: 'Marcar como enviado',
    enviado:     'Marcar como entregado',
}

// El texto de la banda de acción: qué toca hacer ahora, en criollo. Abrís el
// pedido y en un segundo sabés cuál es el próximo paso (y qué efecto tiene).
const PROXIMO_HINT: Partial<Record<EstadoPedido, string>> = {
    pendiente:   'Próximo paso: confirmá el pedido — descuenta el stock y le avisa al cliente por mail.',
    confirmado:  'Próximo paso: iniciá la preparación cuando lo estés armando.',
    preparacion: 'Próximo paso: marcalo como enviado — le avisa al cliente por mail. Ya no se puede cancelar: cualquier problema se resuelve como devolución.',
    enviado:     'Próximo paso: marcalo como entregado cuando llegue.',
}

const ESTADO_COLOR: Record<EstadoPedido, string> = {
    pendiente:   '#F59E0B',
    confirmado:  '#10B981',
    preparacion: '#8B5CF6',
    enviado:     '#3B82F6',
    entregado:   '#94A3B8',
    cancelado:   '#EF4444',
}

const METODO_PAGO: Record<string, string> = {
    MERCADOPAGO: 'MercadoPago', CASH: 'Efectivo', DEBIT_CARD: 'Tarjeta de débito',
    CREDIT_CARD: 'Tarjeta de crédito', TRANSFER: 'Transferencia', QR: 'QR',
    CREDIT_NOTE: 'Nota de crédito',
}

// Solo para el <select> de este formulario — el link público de seguimiento
// (que el cliente sí usa) vive en Seguimiento.tsx, del lado storefront.
const CARRIER_LABEL: Record<ApiCarrier, string> = {
    CORREO_ARGENTINO: 'Correo Argentino', OCA: 'OCA', ANDREANI: 'Andreani', VIA_CARGO: 'Via Cargo', OTRO: 'Otro transportista',
}

const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }

function fmtFecha(iso: string): string {
    const d = new Date(iso)
    const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${d.getDate()} ${m[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// El logo real de WhatsApp (lucide no trae íconos de marcas): el path oficial
// del glifo, pintado con currentColor para que herede el verde de cada lugar.
function WhatsAppIcon({ size = 15 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )
}

interface PedidoDetalleProps {
    id: string
    ir: (vista: VistaPedido, id?: string) => void
}

export default function PedidoDetalle({ id, ir }: PedidoDetalleProps) {
    const router = useRouter()
    const { user } = useAuth()
    // Solo quien puede gestionar pedidos ve los botones de cambiar estado.
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    const [pedido,      setPedido]      = useState<ApiOrderDetail | null>(null)
    const [cargando,    setCargando]    = useState(true)
    const [errorCarga,  setErrorCarga]  = useState<string | null>(null)
    const [modal,       setModal]       = useState<null | 'comprobante' | 'email'>(null)
    const [menuAbierto, setMenuAbierto] = useState(false)
    const [guardando,   setGuardando]   = useState(false)
    const [errorCambio, setErrorCambio] = useState<string | null>(null)
    const [toast,       setToast]       = useState<string | null>(null)
    const [recarga,     setRecarga]     = useState(0)

    // Transportista + tracking — independiente del estado del pedido, se
    // puede cargar/corregir en cualquier momento. Arranca vacío y se
    // sincroniza con lo que trae el pedido apenas carga (o cambia de id).
    const [carrierSel,     setCarrierSel]     = useState<ApiCarrier | ''>('')
    const [trackingVal,    setTrackingVal]    = useState('')
    const [guardandoEnvio, setGuardandoEnvio] = useState(false)
    // Modal "¿Cómo se envía?": al marcar como Enviado pregunta si es entrega
    // local (sin seguimiento) o con transportista (pide empresa + código, que
    // viajan en el mail al cliente con el link al buscador oficial).
    const [modalEnvio, setModalEnvio] = useState(false)
    const [errorEnvio,     setErrorEnvio]     = useState<string | null>(null)

    // Carga el pedido real al entrar (o si cambia el id, o al reintentar).
    useEffect(() => {
        let cancelado = false
        setCargando(true)
        getOrder(id)
            .then(o => {
                if (cancelado) return
                // Guardia de forma: si el backend responde con otra forma (versión
                // vieja o a medio desplegar), mejor el cartel de error que una
                // pantalla rota a mitad de render.
                if (!o || !o.items || !o.payments) {
                    throw new ApiError(0, 'La respuesta del servidor llegó incompleta. Reintentá en un momento.')
                }
                setPedido(o); setErrorCarga(null)
            })
            .catch(e => {
                if (cancelado) return
                if (e instanceof ApiError && e.status === 401) setErrorCarga('No hay sesión activa. Entrá con tu cuenta para ver el pedido.')
                else if (e instanceof ApiError && e.status === 404) setErrorCarga('No encontramos este pedido.')
                else setErrorCarga('No se pudo cargar el pedido.')
            })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [id, recarga])

    // Sincroniza el formulario de envío con lo que trae el pedido — tanto en
    // la carga inicial como después de guardar (setPedido() en guardarEnvio
    // dispara este mismo efecto con los valores ya confirmados por el back).
    useEffect(() => {
        setCarrierSel((pedido?.onlineOrderDetails?.carrier as ApiCarrier | null) ?? '')
        setTrackingVal(pedido?.onlineOrderDetails?.tracking ?? '')
    }, [pedido?.onlineOrderDetails?.carrier, pedido?.onlineOrderDetails?.tracking])

    const guardarEnvio = async () => {
        if (!pedido || guardandoEnvio) return
        setGuardandoEnvio(true)
        setErrorEnvio(null)
        try {
            const actualizado = await updateOrderShipping(pedido.id, { carrier: carrierSel, tracking: trackingVal.trim() })
            setPedido(actualizado)
            setToast('Datos de envío guardados')
            setTimeout(() => setToast(null), 3000)
        } catch (e) {
            setErrorEnvio(e instanceof ApiError ? e.message : 'No se pudo guardar el envío.')
        } finally {
            setGuardandoEnvio(false)
        }
    }

    // Marcar como Enviado pasa primero por el modal de envío (local vs
    // transportista) — cualquier otro estado va directo. Los pedidos de
    // mostrador no tienen envío, así que tampoco preguntan.
    const iniciarCambio = (nuevo: EstadoPedido) => {
        if (nuevo === 'enviado' && pedido?.onlineOrderDetails) { setMenuAbierto(false); setModalEnvio(true); return }
        void cambiarEstado(nuevo)
    }

    // Con transportista: guarda empresa + código y recién ahí marca Enviado —
    // así el mail al cliente sale con el dato, no vacío.
    const enviarConTransportista = async () => {
        if (!pedido || guardandoEnvio || !carrierSel || !trackingVal.trim()) return
        setGuardandoEnvio(true)
        setErrorEnvio(null)
        try {
            await updateOrderShipping(pedido.id, { carrier: carrierSel, tracking: trackingVal.trim() })
            setModalEnvio(false)
            await cambiarEstado('enviado')
        } catch (e) {
            setErrorEnvio(e instanceof ApiError ? e.message : 'No se pudo guardar el envío.')
        } finally {
            setGuardandoEnvio(false)
        }
    }

    // El cambio de estado de verdad: si el backend lo rechaza, mostramos su motivo.
    const cambiarEstado = async (nuevo: EstadoPedido) => {
        if (!pedido || guardando) return
        setGuardando(true)
        setErrorCambio(null)
        setMenuAbierto(false)
        try {
            const actualizado = await updateOrderStatus(pedido.id, UI_A_API[nuevo])
            setPedido(actualizado)
            setToast(`Estado actualizado a "${ESTADO_LABEL[nuevo]}"`)
            setTimeout(() => setToast(null), 3000)
        } catch (e) {
            setErrorCambio(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado.')
            // Si el backend lo rechazó (422), casi siempre es porque la pantalla
            // quedó vieja (alguien ya lo cambió desde otro lado): se recarga el
            // pedido para mostrar el estado real y los botones correctos.
            if (e instanceof ApiError && e.status === 422) setRecarga(n => n + 1)
        } finally {
            setGuardando(false)
        }
    }

    const negocioId = router.query.negocioId as string

    // ── Estados de la vista ──
    // Silueta con la forma del detalle: migas + header con estado, la línea de
    // tiempo, la tabla de ítems y la tarjeta lateral del cliente/totales.
    if (cargando) {
        return (
            <div style={pageWrap} aria-hidden="true">
                <SkeletonText width={200} height={12} style={{ marginBottom: 18 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                    <SkeletonText width={160} height={24} />
                    <Skeleton width={96} height={24} radius={9999} delay={60} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    {/* Reparten el ancho con flex, NUNCA width 100% cada uno: la clase
                        .skel tiene flex-shrink 0 y cuatro bloques al 100% suman 400%
                        del ancho — la página entera se escapaba por la derecha. Es el
                        mismo arreglo que las barras del Dashboard (SkeletonBarras). */}
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} height={40} radius={8} delay={i * 70} style={{ flex: '1 1 0%', minWidth: 0, width: 'auto' }} />)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 16 }}>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                                <SkeletonCircle size={40} delay={i * 90} />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    <SkeletonText width={`${[55, 42, 60][i]}%`} height={12} delay={i * 90 + 40} />
                                    <SkeletonText width="30%" height={9} delay={i * 90 + 70} />
                                </div>
                                <SkeletonText width={70} height={13} delay={i * 90 + 100} />
                            </div>
                        ))}
                    </div>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <SkeletonText width="50%" height={12} />
                        <SkeletonText width="80%" height={11} delay={40} />
                        <SkeletonText width="65%" height={11} delay={70} />
                        <Skeleton width="100%" height={38} radius={8} delay={120} style={{ marginTop: 8 }} />
                    </div>
                </div>
            </div>
        )
    }
    if (errorCarga || !pedido) {
        return (
            <div style={pageWrap}>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, maxWidth: 520 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Ups</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>{errorCarga ?? 'No se pudo cargar el pedido.'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="primary" onClick={() => setRecarga(n => n + 1)}>Reintentar</Button>
                        <Button variant="outline" onClick={() => ir('lista')}>← Volver a la lista</Button>
                    </div>
                </div>
            </div>
        )
    }

    const estadoActual = API_A_UI[pedido.status]
    const esPOS        = pedido.channel === 'POS'
    const cliente      = pedido.customer
        ? `${pedido.customer.firstName}${pedido.customer.lastName ? ' ' + pedido.customer.lastName : ''}`
        : pedido.onlineOrderDetails?.buyerName ?? 'Sin cliente'
    const emailCliente = pedido.customer?.email ?? pedido.onlineOrderDetails?.buyerEmail ?? ''
    const telefono     = pedido.onlineOrderDetails?.buyerPhone ?? null
    const dniCliente    = pedido.onlineOrderDetails?.buyerDni ?? null
    const shippingMethod = pedido.onlineOrderDetails?.shippingMethod ?? null
    // Snapshot de dirección en texto plano (ver OnlineOrderDetails) — nunca
    // una referencia viva a un Address, así funciona igual para invitados
    // que para clientes con cuenta.
    const direccionEntrega = (() => {
        const d = pedido.onlineOrderDetails
        if (!d?.shippingStreet) return null
        const unidad = [d.shippingFloor, d.shippingDepto].filter(Boolean).join(' ')
        const calle  = unidad ? `${d.shippingStreet} (${unidad})` : d.shippingStreet
        const zona   = [d.shippingCity, d.shippingProvincia].filter(Boolean).join(', ')
        return { calle, zona: zona || null, zip: d.shippingZip ?? null, referencia: d.shippingReferencia ?? null }
    })()
    const carrierElegido = pedido.onlineOrderDetails?.carrier ?? null

    // Resumen listo para copiar o mandar por WhatsApp — antes había que armar
    // el mensaje a mano mirando cada dato por separado (productos, dirección,
    // transportista) desperdigado en distintas cards de esta misma pantalla.
    // Sin emojis a propósito: en un negocio se probó que "📍"/"🚚" llegaban
    // rotos (el signo "�" de un carácter que no se pudo decodificar) — ningún
    // otro mensaje de WhatsApp de todo el proyecto usa emoji (se revisaron
    // todos los `openWpp(...)`), así que se saca acá para quedar en línea con
    // el resto en vez de perseguir la causa exacta de la codificación.
    const mensajeWpp = (() => {
        const lineasProductos = pedido.items
            .map(it => `• ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ''} x${it.quantity}`)
            .join('\n')
        // Segmentado campo por campo (calle / ciudad / provincia / CP) en vez
        // de una sola línea larga con todo junto — a pedido puntual, más
        // fácil de leer de un vistazo que "Calle X, Ciudad, Provincia (CP)".
        const d = pedido.onlineOrderDetails
        const lineaEntrega = shippingMethod === 'DELIVERY'
            ? d?.shippingStreet
                ? [
                    'Envío a domicilio',
                    `Calle: ${d.shippingStreet}${[d.shippingFloor, d.shippingDepto].filter(Boolean).length ? ` (${[d.shippingFloor, d.shippingDepto].filter(Boolean).join(' ')})` : ''}`,
                    d.shippingCity ? `Ciudad: ${d.shippingCity}` : null,
                    d.shippingProvincia ? `Provincia: ${d.shippingProvincia}` : null,
                    d.shippingZip ? `CP: ${d.shippingZip}` : null,
                    d.shippingReferencia ? `Referencia: ${d.shippingReferencia}` : null,
                    carrierElegido ? `Transportista: ${CARRIER_LABEL[carrierElegido]}` : null,
                  ].filter(l => l !== null).join('\n')
                : 'Envío a domicilio (todavía sin dirección cargada)'
            : shippingMethod === 'PICKUP'
                ? 'Retira en el local'
                : null
        return [
            `Hola ${cliente}! Te escribimos por tu pedido #${pedido.orderNumber}:`,
            '',
            lineasProductos,
            lineaEntrega ? `\n${lineaEntrega}` : null,
            `\nTotal: ${fmtMoney(pedido.total)}`,
        ].filter(l => l !== null).join('\n')
    })()
    const linkWpp = telefono ? `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWpp)}` : null

    async function copiarResumen() {
        try {
            await navigator.clipboard.writeText(mensajeWpp)
        } catch {
            return // clipboard no disponible — sin feedback, no rompe nada
        }
        setToast('Resumen del pedido copiado')
        setTimeout(() => setToast(null), 3000)
    }

    // La línea de tiempo real: para cada paso busco su fecha en el historial guardado.
    const fechaDe = (st: ApiOrderStatus) => pedido.statusHistory.find(hh => hh.status === st)?.createdAt
    const PASOS: { st: ApiOrderStatus; label: string }[] = [
        { st: 'PENDING',   label: 'Pedido recibido' },
        { st: 'CONFIRMED', label: 'Confirmado' },
        { st: 'PREPARING', label: 'En preparación' },
        { st: 'SHIPPED',   label: 'Enviado' },
        { st: 'DELIVERED', label: 'Entregado' },
    ]
    const cancelado = estadoActual === 'cancelado'
    // Un paso está "hecho" si el pedido ya llegó (o pasó) por ahí. Con los
    // salteos, un paso intermedio puede no tener fila en el historial (nunca
    // se marcó): igual se pinta como hecho, solo que sin fecha. Si se canceló,
    // el punto de referencia es el último estado real que alcanzó antes.
    const historialReal = pedido.statusHistory.filter(hh => hh.status !== 'CANCELLED')
    const ultimoAlcanzado = historialReal[historialReal.length - 1]?.status ?? 'PENDING'
    const idxActual = PASOS.findIndex(pp => pp.st === (cancelado ? ultimoAlcanzado : pedido.status))
    const pasos = PASOS.map((pp, i) => ({ label: pp.label, fecha: fechaDe(pp.st), done: i <= idxActual }))

    const permitidas   = PERMITIDAS[estadoActual] ?? []
    const siguiente    = permitidas.find(e => e !== 'cancelado') ?? null
    const puedeCancelar = permitidas.includes('cancelado')
    const accionLabel  = siguiente ? ACCION_LABEL[estadoActual] : null
    const finalizado   = permitidas.length === 0

    // La banda de acción cambia de tono según cómo terminó (o va) el pedido.
    const bandaBorde = cancelado ? 'var(--color-error)' : finalizado ? 'var(--color-success)' : 'var(--color-primary)'
    const bandaFondo = cancelado ? 'var(--color-error-bg)' : finalizado ? 'var(--color-success-bg)' : 'var(--color-primary-bg)'

    const pagoResumen = pedido.payments.length
        ? pedido.payments.map(pg => METODO_PAGO[pg.method] ?? pg.method).join(' + ')
        : 'Sin pago registrado'

    // Antes la única forma de enterarse de que un pedido tenía una devolución
    // en curso era ir a buscarla a mano en Postventa — este aviso muestra las
    // que todavía esperan una resolución (PENDING/IN_PROCESS), con link directo.
    const devolucionesPendientes = pedido.returns.filter(r => r.status === 'PENDING' || r.status === 'IN_PROCESS')
    // Una vez resuelta, el aviso de arriba desaparecía del todo — el pedido
    // quedaba mostrando "Entregado" como si la devolución nunca hubiese
    // pasado. Esto la deja visible siempre (más calma que la de arriba,
    // que sigue siendo la que pide acción), con el resultado real.
    const ultimaDevolucion = pedido.returns[0] ?? null

    // Mismo criterio que las devoluciones de arriba — antes una cancelación
    // pedida por el cliente (Confirmado/En preparación) no dejaba ningún
    // rastro visible en el detalle del pedido.
    const cancelacionPendiente = pedido.cancellationRequests.find(c => c.status === 'PENDING') ?? null
    const ultimaCancelacion = pedido.cancellationRequests[0] ?? null

    return (
        <div style={pageWrap}>
            <style>{`
                .det-header  { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
                .det-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
                .det-grid    { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; align-items:start; }
                .det-estado-menu { position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:300;
                    background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px;
                    box-shadow:0 8px 24px rgba(15,23,42,.14); overflow:hidden; }
                .det-banda { display:flex; align-items:center; gap:12px; flex-wrap:wrap;
                    padding:14px 16px; border:1px solid var(--color-primary); border-radius:12px;
                    margin-bottom:16px; }
                .det-banda-menu { position:absolute; top:calc(100% + 6px); right:0; width:240px; z-index:300;
                    background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px;
                    box-shadow:0 8px 24px rgba(15,23,42,.14); overflow:hidden; }
                @media (max-width:900px) {
                    .det-grid { grid-template-columns:1fr !important; }
                }
                @media (max-width:640px) {
                    .det-header  { flex-direction:column; align-items:flex-start; }
                    .det-actions { width:100%; }
                    .det-actions > * { flex:1; }
                }
            `}</style>

            {/* Breadcrumb */}
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--color-muted)', marginBottom:14 }}>
                <button onClick={() => ir('lista')} style={{ background:'none', border:'none', color:'var(--color-muted)', cursor:'pointer', fontFamily:'inherit', fontSize:13, padding:0 }}>Lista</button>
                <ChevronRight size={12} />
                <span style={{ color:'var(--color-text)', fontWeight:500, fontFamily:'"Geist Mono", monospace' }}>#{pedido.orderNumber}</span>
            </div>

            {/* Header: número + cliente + fecha, y el total grande a la derecha */}
            <div className="det-header">
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <h1 style={{ fontSize:26, fontWeight:700, fontFamily:'"Geist Mono", monospace', color:'var(--color-text)', margin:0 }}>#{pedido.orderNumber}</h1>
                    <span style={{ fontSize:14, color:'var(--color-muted)' }}>
                        {cliente} · <span style={{ fontFamily:'"Geist Mono", monospace', fontSize:13 }}>{fmtFecha(pedido.createdAt)}</span>
                    </span>
                </div>
                <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--color-subtle)' }}>Total</div>
                    <div style={{ fontSize:22, fontWeight:800, fontFamily:'"Geist Mono", monospace', color:'var(--color-primary-h)', lineHeight:1.2 }}>{fmtMoney(pedido.total)}</div>
                </div>
            </div>

            {/* ── Banda de acción: el próximo paso manda ── */}
            <div className="det-banda" style={{ borderColor: bandaBorde, background: `linear-gradient(90deg, ${bandaFondo}, var(--color-bg))` }}>
                <Badge status={estadoActual} />
                <span style={{ fontSize:12.5, color:'var(--color-muted)', flex:1, minWidth:180, lineHeight:1.5 }}>
                    {esPOS ? 'Venta de mostrador: se cobró y entregó en el momento.'
                        : cancelado ? 'Este pedido fue cancelado. Si ya se había cobrado, resolvelo como devolución.'
                        : finalizado ? 'Pedido completado: no quedan pasos pendientes.'
                        : !puedeGestionar ? 'Tu rol puede ver los pedidos pero no cambiarles el estado.'
                        : PROXIMO_HINT[estadoActual] ?? ''}
                </span>

                {puedeGestionar && accionLabel && siguiente && (
                    <button
                        onClick={() => iniciarCambio(siguiente)}
                        disabled={guardando}
                        style={{ height:40, padding:'0 20px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13.5, fontWeight:700, cursor: guardando ? 'wait' : 'pointer', fontFamily:'inherit', opacity: guardando ? 0.7 : 1, boxShadow:'0 4px 14px rgba(59,130,246,0.25)', flexShrink:0 }}
                    >
                        {guardando ? 'Guardando…' : `${accionLabel} →`}
                    </button>
                )}

                {puedeGestionar && !finalizado && (
                    <div style={{ position:'relative', flexShrink:0 }}>
                        <button
                            onClick={() => setMenuAbierto(o => !o)}
                            style={{ height:40, borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-body)', fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, padding:'0 12px' }}
                        >
                            <span>Otro estado</span>
                            <ChevronDown size={14} style={{ opacity:0.6, transform: menuAbierto ? 'rotate(180deg)' : 'none', transition:'transform 180ms' }} />
                        </button>

                        {menuAbierto && (
                            <div className="det-banda-menu">
                                {permitidas.filter(e => e !== 'cancelado').map(e => (
                                    <button
                                        key={e}
                                        onClick={() => iniciarCambio(e)}
                                        style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--color-text)', textAlign:'left' }}
                                    >
                                        <span style={{ width:8, height:8, borderRadius:'50%', background: ESTADO_COLOR[e], flexShrink:0 }} />
                                        <span style={{ flex:1 }}>{ESTADO_LABEL[e]}</span>
                                    </button>
                                ))}
                                {puedeCancelar && (
                                    <div style={{ borderTop:'1px solid var(--color-border)' }}>
                                        <button
                                            onClick={() => cambiarEstado('cancelado')}
                                            style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--color-error)', textAlign:'left' }}
                                        >
                                            <span style={{ width:8, height:8, borderRadius:'50%', background: ESTADO_COLOR.cancelado, flexShrink:0 }} />
                                            Cancelar pedido
                                        </button>
                                    </div>
                                )}
                                {permitidas.filter(e => e !== 'cancelado').length === 0 && !puedeCancelar && (
                                    <div style={{ padding:'9px 14px', fontSize:12.5, color:'var(--color-muted)' }}>No hay más cambios posibles.</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Acciones rápidas, siempre juntas */}
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button title="Imprimir comprobante" onClick={() => setModal('comprobante')} style={iconBtn}><Printer size={15} /></button>
                    <button title="Enviar por email" onClick={() => setModal('email')} style={iconBtn}><Mail size={15} /></button>
                    <button title="Copiar resumen del pedido (productos, dirección y transportista)" onClick={() => void copiarResumen()} style={iconBtn}><Copy size={15} /></button>
                    {linkWpp && (
                        <a title="Coordinar por WhatsApp (con el resumen ya escrito)" href={linkWpp} target="_blank" rel="noreferrer" style={{ ...iconBtn, color:'var(--color-success)', textDecoration:'none' }}><WhatsAppIcon size={16} /></a>
                    )}
                </div>
            </div>

            {errorCambio && (
                <div style={{ margin:'-8px 0 16px', fontSize:12.5, color:'var(--color-error)', lineHeight:1.5 }}>{errorCambio}</div>
            )}

            {devolucionesPendientes.length > 0 && (
                <button
                    onClick={() => ir('devoluciones')}
                    style={{
                        display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                        padding:'12px 16px', marginBottom:16, borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                        border:'1px solid var(--color-warning-bg, #FEF3C7)', background:'var(--color-warning-bg)', color:'var(--chip-warning-fg, #B45309)',
                    }}
                >
                    <RotateCcw size={16} strokeWidth={1.8} style={{ flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:600, flex:1 }}>
                        {devolucionesPendientes.length === 1
                            ? 'Este pedido tiene una devolución pendiente de resolver'
                            : `Este pedido tiene ${devolucionesPendientes.length} devoluciones pendientes de resolver`}
                    </span>
                    <span style={{ fontSize:12.5, fontWeight:600, textDecoration:'underline', flexShrink:0 }}>Ver en Postventa →</span>
                </button>
            )}

            {devolucionesPendientes.length === 0 && ultimaDevolucion && (ultimaDevolucion.status === 'APPROVED' || ultimaDevolucion.status === 'REJECTED') && (
                <button
                    onClick={() => ir('devoluciones')}
                    style={{
                        display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                        padding:'10px 16px', marginBottom:16, borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                        border: `1px solid ${ultimaDevolucion.status === 'APPROVED' ? 'rgba(16,185,129,0.35)' : 'var(--color-border)'}`,
                        background: ultimaDevolucion.status === 'APPROVED' ? 'var(--color-success-bg)' : 'var(--color-surface)',
                        color: ultimaDevolucion.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-muted)',
                    }}
                >
                    <RotateCcw size={15} strokeWidth={1.8} style={{ flexShrink:0 }} />
                    <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>
                        {ultimaDevolucion.status === 'APPROVED'
                            ? `Devolución aprobada — ${ultimaDevolucion.refundMethod === 'CREDIT_NOTE' ? `${fmtMoney(ultimaDevolucion.amount)} en nota de crédito emitida` : `${fmtMoney(ultimaDevolucion.amount)} a reembolsar`}`
                            : 'Devolución rechazada'}
                    </span>
                    <span style={{ fontSize:11.5, fontWeight:600, textDecoration:'underline', flexShrink:0 }}>Ver en Postventa →</span>
                </button>
            )}

            {cancelacionPendiente && (
                <button
                    onClick={() => ir('cancelaciones')}
                    style={{
                        display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                        padding:'12px 16px', marginBottom:16, borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                        border:'1px solid var(--color-warning-bg, #FEF3C7)', background:'var(--color-warning-bg)', color:'var(--chip-warning-fg, #B45309)',
                    }}
                >
                    <X size={16} strokeWidth={1.8} style={{ flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:600, flex:1 }}>El cliente pidió cancelar este pedido — pendiente de resolver</span>
                    <span style={{ fontSize:12.5, fontWeight:600, textDecoration:'underline', flexShrink:0 }}>Ver en Postventa →</span>
                </button>
            )}

            {!cancelacionPendiente && ultimaCancelacion && (ultimaCancelacion.status === 'APPROVED' || ultimaCancelacion.status === 'REJECTED') && (
                <button
                    onClick={() => ir('cancelaciones')}
                    style={{
                        display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                        padding:'10px 16px', marginBottom:16, borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                        border: `1px solid ${ultimaCancelacion.status === 'APPROVED' ? 'rgba(16,185,129,0.35)' : 'var(--color-border)'}`,
                        background: ultimaCancelacion.status === 'APPROVED' ? 'var(--color-success-bg)' : 'var(--color-surface)',
                        color: ultimaCancelacion.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-muted)',
                    }}
                >
                    <X size={15} strokeWidth={1.8} style={{ flexShrink:0 }} />
                    <span style={{ fontSize:12.5, fontWeight:600, flex:1 }}>
                        {ultimaCancelacion.status === 'APPROVED'
                            ? `Cancelación aprobada${ultimaCancelacion.refundStatus === 'REFUNDED' ? ' — reembolsado por Mercado Pago' : ultimaCancelacion.refundStatus === 'FAILED' ? ' — el reembolso por Mercado Pago falló, revisalo' : ''}`
                            : 'Cancelación rechazada'}
                    </span>
                    <span style={{ fontSize:11.5, fontWeight:600, textDecoration:'underline', flexShrink:0 }}>Ver en Postventa →</span>
                </button>
            )}

            <div className="det-grid">

                {/* Columna principal */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:14 }}>Productos del pedido</div>
                        {pedido.items.map((it, i) => (
                            <div key={it.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < pedido.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                {it.imgUrl
                                    ? <img src={it.imgUrl} alt={it.productName} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                                    : <ProductoThumb hue={hueDe(it.productName)} size={44} />}
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text)' }}>
                                        {it.productName}{it.variantLabel ? ` · ${it.variantLabel}` : ''}
                                    </div>
                                    <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace' }}>{it.quantity} × {fmtMoney(it.editedPrice ?? it.unitPrice)}</div>
                                </div>
                                <span style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(it.quantity * (it.editedPrice ?? it.unitPrice))}</span>
                            </div>
                        ))}
                        {pedido.onlineOrderDetails?.shippingCost != null && (
                            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:13 }}>
                                <span style={{ color:'var(--color-muted)' }}>Envío</span>
                                <span style={{ color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(pedido.onlineOrderDetails.shippingCost)}</span>
                            </div>
                        )}
                        {/* Si hubo descuento (cupón o promo automática), se muestra:
                            sin esta línea el total parecía "mal calculado" —
                            los renglones sumaban una cosa y el total decía otra. */}
                        {pedido.discountTotal > 0 && (
                            <>
                                <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:13 }}>
                                    <span style={{ color:'var(--color-muted)' }}>Subtotal</span>
                                    <span style={{ color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(pedido.subtotal)}</span>
                                </div>
                                <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:13 }}>
                                    <span style={{ color:'var(--color-success)' }}>Descuentos</span>
                                    <span style={{ color:'var(--color-success)', fontFamily:'"Geist Mono", monospace', fontWeight:600 }}>−{fmtMoney(pedido.discountTotal)}</span>
                                </div>
                            </>
                        )}
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:14, paddingTop:14, borderTop:'1px solid var(--color-border)' }}>
                            <span style={{ fontSize:15, fontWeight:600, color:'var(--color-text)' }}>Total</span>
                            <span style={{ fontSize:18, fontWeight:800, color:'var(--color-text)', fontFamily:'"Geist Mono", monospace' }}>{fmtMoney(pedido.total)}</span>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)' }}>Estado del pedido</div>
                            {cancelado && (
                                <span style={{ fontSize:12, fontWeight:600, color:'var(--color-error)', background:'var(--color-error-bg)', padding:'3px 10px', borderRadius:9999 }}>
                                    Cancelado{fechaDe('CANCELLED') ? ` · ${fmtFecha(fechaDe('CANCELLED')!)}` : ''}
                                </span>
                            )}
                        </div>
                        {esPOS ? (
                            <div style={{ fontSize:13, color:'var(--color-body)', lineHeight:1.6 }}>
                                Venta de mostrador: se cobró y entregó en el momento.
                            </div>
                        ) : pasos.map((paso, i) => (
                            <div key={i} style={{ display:'flex', gap:12 }}>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                                    <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background: paso.done && !cancelado ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: paso.done && !cancelado ? '#fff' : 'var(--color-muted)', display:'grid', placeItems:'center' }}>
                                        {paso.done && !cancelado ? <Check size={13} strokeWidth={2.6} /> : <span style={{ fontSize:11, fontWeight:700 }}>{i+1}</span>}
                                    </div>
                                    {i < pasos.length - 1 && <div style={{ width:2, flex:1, minHeight:24, background: paso.done && !cancelado ? 'var(--color-primary)' : 'var(--color-border)', marginTop:2 }} />}
                                </div>
                                <div style={{ paddingBottom: i < pasos.length - 1 ? 16 : 0 }}>
                                    <div style={{ fontSize:13, fontWeight: paso.done ? 600 : 500, color: paso.done && !cancelado ? 'var(--color-text)' : 'var(--color-muted)' }}>{paso.label}</div>
                                    {paso.done && paso.fecha && <div style={{ fontSize:11, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', marginTop:2 }}>{fmtFecha(paso.fecha)}</div>}
                                </div>
                            </div>
                        ))}
                    </Card>

                    {pedido.notes && (
                        <Card>
                            <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:10 }}>Notas del pedido</div>
                            <div style={{ fontSize:13, color:'var(--color-body)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{pedido.notes}</div>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                    {/* ── Cliente ── */}
                    <Card>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: pedido.customerId ? 12 : 0 }}>
                            <Avatar name={cliente} size={44} imgUrl={pedido.customer?.avatarUrl} />
                            <div style={{ minWidth:0 }}>
                                <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)' }}>{cliente}</div>
                                <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emailCliente || 'Sin email'}</div>
                                {dniCliente && (
                                    <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'"Geist Mono", monospace', marginTop:1 }}>DNI {dniCliente}</div>
                                )}
                            </div>
                        </div>
                        {pedido.customerId && (
                            <Button
                                variant="outline" size="sm"
                                style={{ width:'100%', justifyContent:'center' }}
                                onClick={() => router.push(`/admin/${negocioId}/ventas/clientes?vista=detalle&id=${pedido.customerId}`)}
                            >
                                Ver perfil completo →
                            </Button>
                        )}
                    </Card>

                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:12 }}>Datos del pedido</div>
                        {([
                            ['Origen', pedido.origin === 'MANUAL' ? 'Manual' : 'Tienda'],
                            ['Fecha', fmtFecha(pedido.createdAt)],
                            ['# Pedido', '#' + pedido.orderNumber],
                            ['Método de pago', pagoResumen],
                        ] as [string, string][]).map(([k, v]) => (
                            <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:13, padding:'5px 0' }}>
                                <span style={{ color:'var(--color-muted)', flexShrink:0 }}>{k}</span>
                                <span style={{ color:'var(--color-text)', textAlign:'right', fontFamily:/Fecha|Pedido/.test(k) ? '"Geist Mono", monospace' : 'inherit' }}>{v}</span>
                            </div>
                        ))}
                    </Card>

                    <Card>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--color-text)', marginBottom:8 }}>Entrega</div>

                        {shippingMethod === 'DELIVERY' ? (
                            <div style={{ marginBottom:12 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                                    <Truck size={14} /> Envío a domicilio
                                </div>
                                {direccionEntrega ? (
                                    <div style={{ fontSize:13, color:'var(--color-muted)', lineHeight:1.5 }}>
                                        <div>{direccionEntrega.calle}</div>
                                        {direccionEntrega.zona && (
                                            <div>{direccionEntrega.zona}{direccionEntrega.zip ? ` (CP ${direccionEntrega.zip})` : ''}</div>
                                        )}
                                        {direccionEntrega.referencia && <div style={{ fontStyle:'italic' }}>Ref: {direccionEntrega.referencia}</div>}
                                    </div>
                                ) : (
                                    <div style={{ fontSize:13, color:'var(--color-muted)' }}>Sin dirección cargada</div>
                                )}
                                {/* Lo que el cliente eligió AL COMPRAR, en texto fijo —
                                    separado del <select> de más abajo, que es la acción
                                    del negocio (confirmar/corregir antes de despachar).
                                    Antes no había ninguna mención de esto: el <select> de
                                    "Transportista y seguimiento" arrancaba vacío igual
                                    hubiera elegido algo el cliente o no, sin poder
                                    distinguir un caso del otro de un vistazo. */}
                                {carrierElegido && (
                                    <div style={{ fontSize:12.5, color:'var(--color-muted)', marginTop:6 }}>
                                        Transportista elegido por el cliente: <strong style={{ color:'var(--color-text)' }}>{CARRIER_LABEL[carrierElegido]}</strong>
                                    </div>
                                )}
                            </div>
                        ) : shippingMethod === 'PICKUP' ? (
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--color-text)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                                <Store size={14} /> Retira en el local
                            </div>
                        ) : (
                            <div style={{ fontSize:13, color:'var(--color-muted)', marginBottom:12 }}>{telefono ? 'Coordinar por WhatsApp' : 'Sin datos de entrega'}</div>
                        )}

                        {linkWpp && (
                            <div style={{ display:'flex', gap:8 }}>
                                <a
                                    href={linkWpp}
                                    target="_blank" rel="noreferrer"
                                    style={{ flex:1, height:40, borderRadius:8, border:'none', background:'var(--color-success-bg)', color:'var(--color-success)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none', boxSizing:'border-box' }}
                                >
                                    <WhatsAppIcon size={15} /> WhatsApp
                                </a>
                                <button
                                    type="button" title="Copiar el mensaje (productos, dirección y transportista)"
                                    onClick={() => void copiarResumen()}
                                    style={{ width:40, height:40, flexShrink:0, borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-muted)', cursor:'pointer', display:'grid', placeItems:'center' }}
                                >
                                    <Copy size={15} />
                                </button>
                            </div>
                        )}

                        {/* Transportista + tracking — solo pedidos ONLINE (los
                            de mostrador no tienen a quién mandarle un link de
                            seguimiento). Independiente del estado: se puede
                            cargar antes o después de marcar "Enviado". */}
                        {pedido.onlineOrderDetails && (
                            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--color-border)' }}>
                                <div style={{ fontSize:12, fontWeight:600, color:'var(--color-muted)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>
                                    Transportista y seguimiento
                                </div>
                                <select
                                    value={carrierSel}
                                    onChange={e => setCarrierSel(e.target.value as ApiCarrier | '')}
                                    style={{ width:'100%', height:38, padding:'0 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:13, fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}
                                >
                                    <option value="">Sin transportista</option>
                                    {(Object.keys(CARRIER_LABEL) as ApiCarrier[]).map(c => (
                                        <option key={c} value={c}>{CARRIER_LABEL[c]}</option>
                                    ))}
                                </select>
                                <input
                                    value={trackingVal}
                                    onChange={e => setTrackingVal(e.target.value)}
                                    placeholder="Número de seguimiento"
                                    style={{ width:'100%', height:38, padding:'0 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:13, fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}
                                />
                                {errorEnvio && <div style={{ fontSize:12, color:'var(--color-error)', marginBottom:8 }}>{errorEnvio}</div>}
                                <button
                                    type="button"
                                    onClick={() => void guardarEnvio()}
                                    disabled={guardandoEnvio}
                                    style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface-alt)', color:'var(--color-text)', fontSize:13, fontWeight:600, cursor: guardandoEnvio ? 'wait' : 'pointer', fontFamily:'inherit', opacity: guardandoEnvio ? 0.7 : 1 }}
                                >
                                    {guardandoEnvio ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* ── ¿Cómo se envía? — al marcar como Enviado ── */}
            <Modal isOpen={modalEnvio} onClose={() => setModalEnvio(false)} title="¿Cómo se envía este pedido?" maxWidth={440}>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {/* Opción A: entrega local, sin seguimiento */}
                    <button
                        type="button"
                        onClick={() => { setModalEnvio(false); void cambiarEstado('enviado') }}
                        style={{ width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-bg)', cursor:'pointer', fontFamily:'inherit' }}
                    >
                        <span style={{ width:36, height:36, borderRadius:8, background:'var(--color-surface-alt)', color:'var(--color-body)', display:'grid', placeItems:'center', flexShrink:0 }}><Store size={17} /></span>
                        <span style={{ minWidth:0 }}>
                            <span style={{ display:'block', fontSize:13.5, fontWeight:600, color:'var(--color-text)' }}>Entrega local / en mano</span>
                            <span style={{ display:'block', fontSize:12, color:'var(--color-muted)', marginTop:2 }}>Sin código de seguimiento — se avisa al cliente que va en camino.</span>
                        </span>
                    </button>

                    {/* Opción B: con transportista → empresa + código */}
                    <div style={{ border:'1px solid var(--color-border)', borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                            <span style={{ width:36, height:36, borderRadius:8, background:'var(--color-primary-bg)', color:'var(--color-primary)', display:'grid', placeItems:'center', flexShrink:0 }}><Truck size={17} /></span>
                            <span>
                                <span style={{ display:'block', fontSize:13.5, fontWeight:600, color:'var(--color-text)' }}>Con transportista</span>
                                <span style={{ display:'block', fontSize:12, color:'var(--color-muted)', marginTop:2 }}>El cliente recibe el código y el link para seguir el envío.</span>
                            </span>
                        </div>
                        <select
                            value={carrierSel}
                            onChange={e => setCarrierSel(e.target.value as ApiCarrier | '')}
                            style={{ width:'100%', height:40, padding:'0 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:13, fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }}
                        >
                            <option value="">Elegí la empresa…</option>
                            {(Object.keys(CARRIER_LABEL) as ApiCarrier[]).map(c => (
                                <option key={c} value={c}>{CARRIER_LABEL[c]}</option>
                            ))}
                        </select>
                        <input
                            value={trackingVal}
                            onChange={e => setTrackingVal(e.target.value)}
                            placeholder="Código de seguimiento"
                            style={{ width:'100%', height:40, padding:'0 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:13, fontFamily:'inherit', marginBottom:10, boxSizing:'border-box' }}
                        />
                        {errorEnvio && <div style={{ fontSize:12, color:'var(--color-error)', marginBottom:8 }}>{errorEnvio}</div>}
                        <button
                            type="button"
                            onClick={() => void enviarConTransportista()}
                            disabled={guardandoEnvio || !carrierSel || !trackingVal.trim()}
                            style={{ width:'100%', height:40, borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor: guardandoEnvio || !carrierSel || !trackingVal.trim() ? 'default' : 'pointer', opacity: guardandoEnvio || !carrierSel || !trackingVal.trim() ? 0.55 : 1 }}
                        >
                            {guardandoEnvio ? 'Guardando…' : 'Guardar y marcar como enviado'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* "Imprimir" va directo al diálogo de impresión del navegador,
                sin pasar por el resumen intermedio. */}
            <ModalComprobante isOpen={modal === 'comprobante'} onClose={() => setModal(null)} id={pedido.id} onToast={setToast} abrirDirecto autoImprimir />
            <ModalEmail isOpen={modal === 'email'} onClose={() => setModal(null)} cliente={{ nombre: cliente, email: emailCliente }} onToast={setToast} onEnviar={async (a, c) => { await sendOrderEmail(pedido.id, a, c) }} />

            {toast && (
                <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:9000 }}>
                    <Toast variant="success" title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding:'24px 32px 64px', maxWidth:1280, width:'100%', margin:'0 auto', boxSizing:'border-box' }
const iconBtn: React.CSSProperties = { width:40, height:40, borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-body)', cursor:'pointer', display:'grid', placeItems:'center', fontFamily:'inherit', fontSize:14, boxSizing:'border-box' }

// src/modules/ventas/panel/pedidos/PedidoNuevo.tsx — Vista 04
// Alta manual de un pedido, estilo caja (POS): todo en una sola pantalla.
// Catálogo a la izquierda (buscar y tocar = agregar), ticket a la derecha
// (cliente, renglones, envío, notas y el botón de crear siempre a la vista).
//
// (Fase 2 — Alex) Esta pantalla crea pedidos DE VERDAD: busca los clientes
// y productos reales del negocio, arma el carrito con variantes y cantidades,
// y al confirmar le pide al backend que cree el pedido. Si el backend rechaza
// el alta —por ejemplo por falta de stock— el motivo se muestra acá mismo.
//
// (Ale, 08/09) Dos modalidades, elegidas arriba del ticket:
//   - Venta presencial: se cobró y entregó en el mostrador. Se elige cómo se
//     cobró (efectivo o transferencia) y el pedido nace ENTREGADO, con el
//     stock descontado y el cobro registrado; en el listado figura "Manual"
//     y no tiene más estados.
//   - Pedido online: como los de la tienda, nace PENDIENTE y sigue el ciclo
//     de estados; el cobro es opcional acá (queda pendiente hasta confirmar).
// En las dos, si el comprador tiene email (cliente registrado o cargado a
// mano) le llega un aviso con el detalle al crear el pedido.
//
// (Rediseño) Antes era un wizard de 3 pasos; el ida y vuelta entre pasos
// hacía lenta la carga de una venta en el mostrador. Ahora es una pantalla
// única: la MISMA lógica de siempre (búsquedas con debounce y cancelación,
// tope de stock conocido, guarda contra doble click, ?clienteId= precargado),
// solo cambió la disposición.

import { useEffect, useState } from 'react'
import { ArrowLeft, Banknote, Globe, Landmark, Mail, Minus, Plus, Search, ShoppingBag, Store, Trash2, User, UserX } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Modal } from '@/design-system/components/Modal'
import { SkeletonText, SkeletonCircle } from '@/design-system/components/Skeleton'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/router'
import {
    ApiError, getCustomers, getCustomer, panelGetProducts, panelGetProduct, createOrder,
    type ApiCustomer, type ApiProductListItem,
} from '@/lib/api'
import type { VistaPedido } from './components/PedidoTabs'
import { ProductoThumb } from './components/ProductoThumb'
import { Volver } from '../_shared/Volver'

interface PedidoNuevoProps {
    ir:      (vista: VistaPedido, id?: string) => void
    onToast: (msg: string) => void
}

// El comprador puede ser un cliente registrado o alguien cargado a mano.
type ClienteElegido =
    | { tipo: 'registrado'; id: string; nombre: string; email: string; pedidos: number }
    | { tipo: 'manual'; nombre: string; email: string; tel: string }

type Modalidad = 'presencial' | 'online'
type MetodoCobro = 'CASH' | 'TRANSFER'

// Un renglón del carrito.
interface Linea {
    variantId: string
    productId: string
    nombre:    string
    label:     string | null
    precio:    number
    cantidad:  number
    // La foto real del producto (la principal del catálogo); null = sin foto,
    // se cae al thumb de color.
    img:       string | null
    // Cuánto stock había al agregarlo (null = producto con variantes, lo valida el backend).
    stockHint: number | null
}

const hueDe = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(0 + i)) % 360; return h }

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Cuántos productos se piden por página al catálogo — con negocios de miles
// de productos no tiene sentido traerlos todos para mostrar una grilla de a poco.
const PROD_POR_PAGINA = 10

export default function PedidoNuevo({ ir, onToast }: PedidoNuevoProps) {
    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'
    const puedeGestionar = user?.type === 'member' && user.permissions.includes('orders.manage')

    // ── Cliente (en el ticket) ──
    const [cliente, setCliente]       = useState<ClienteElegido | null>(null)
    const [modoManual, setModoManual] = useState(false)
    const [manual, setManual]         = useState({ nombre: '', email: '', tel: '' })
    const [buscaCli, setBuscaCli]     = useState('')
    const [clientes, setClientes]     = useState<ApiCustomer[]>([])
    const [cargandoCli, setCargandoCli] = useState(false)
    const [errorCli, setErrorCli]     = useState<string | null>(null)
    const [reintentoCli, setReintentoCli] = useState(0)

    // Si venimos del perfil de un cliente ("Nuevo pedido" en Clientes), el
    // cliente ya llega elegido por la URL (?clienteId=…): se precarga y el
    // ticket arranca con el comprador puesto.
    const router = useRouter()
    const clienteIdInicial = typeof router.query.clienteId === 'string' ? router.query.clienteId : null
    useEffect(() => {
        if (!esDueno || !clienteIdInicial) return
        let cancelado = false
        getCustomer(clienteIdInicial)
            .then(c => {
                if (cancelado) return
                setCliente(prev => prev ?? {
                    tipo: 'registrado', id: c.id,
                    nombre: `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`,
                    email: c.email ?? '', pedidos: c.orderCount ?? 0,
                })
            })
            .catch(() => { /* si no existe, el selector queda como siempre */ })
        return () => { cancelado = true }
    }, [esDueno, clienteIdInicial])

    // Busca clientes reales (espera 350ms desde la última tecla). Con flag de
    // cancelación: sin él, dos respuestas fuera de orden dejaban la lista
    // mostrando los resultados de una búsqueda vieja. Solo busca mientras el
    // selector de cliente está abierto (sin cliente elegido y sin modo manual).
    useEffect(() => {
        if (!esDueno || cliente !== null || modoManual) return
        let cancelado = false
        const t = setTimeout(() => {
            setCargandoCli(true)
            getCustomers({ search: buscaCli || undefined, limit: 5 })
                .then(r => { if (!cancelado) { setClientes(r?.data ?? []); setErrorCli(null) } })
                .catch(() => { if (!cancelado) { setClientes([]); setErrorCli('No se pudieron cargar los clientes.') } })
                .finally(() => { if (!cancelado) setCargandoCli(false) })
        }, buscaCli ? 350 : 0)
        return () => { cancelado = true; clearTimeout(t) }
    }, [buscaCli, esDueno, reintentoCli, cliente, modoManual])

    // ── Catálogo ──
    const [buscaProd, setBuscaProd]   = useState('')
    const [paginaProd, setPaginaProd] = useState(1)
    const [productos, setProductos]   = useState<ApiProductListItem[]>([])
    const [productosTotal, setProductosTotal] = useState(0)
    const [cargandoProd, setCargandoProd] = useState(false)
    const [errorProd, setErrorProd]   = useState<string | null>(null)
    const [reintentoProd, setReintentoProd] = useState(0)
    const [eligiendo, setEligiendo]   = useState<{ productId: string; nombre: string; img: string | null; variants: { id: string; price: number; variantLabel?: string | null }[] } | null>(null)
    const [carrito, setCarrito]       = useState<Linea[]>([])

    // Cualquier cambio de búsqueda vuelve a la primera página del catálogo.
    useEffect(() => { setPaginaProd(1) }, [buscaProd])

    useEffect(() => {
        if (!esDueno) return
        let cancelado = false
        const t = setTimeout(() => {
            setCargandoProd(true)
            panelGetProducts({ search: buscaProd || undefined, page: paginaProd, limit: PROD_POR_PAGINA })
                .then(r => { if (!cancelado) { setProductos(r?.data ?? []); setProductosTotal(r?.total ?? 0); setErrorProd(null) } })
                .catch(() => { if (!cancelado) { setProductos([]); setProductosTotal(0); setErrorProd('No se pudo cargar el catálogo.') } })
                .finally(() => { if (!cancelado) setCargandoProd(false) })
        }, buscaProd ? 350 : 0)
        return () => { cancelado = true; clearTimeout(t) }
    }, [buscaProd, paginaProd, esDueno, reintentoProd])

    // Agregar un producto: si tiene una sola variante va directo; si tiene
    // varias, primero se elige cuál (talle, color, etc.).
    // Guarda contra doble click mientras se trae el detalle: sin esto, dos clicks
    // rápidos agregaban 2 unidades (o abrían el selector dos veces).
    const [agregandoId, setAgregandoId] = useState<string | null>(null)
    const agregarProducto = async (prod: ApiProductListItem) => {
        // Sin stock no se puede cargar: no tiene sentido armar un pedido que va a rebotar.
        if (prod.variantCount > 0 && prod.totalStock === 0) return
        if (agregandoId) return
        setAgregandoId(prod.id)
        const det = await panelGetProduct(prod.id).catch(() => null)
        setAgregandoId(null)
        if (!det || det.variants.length === 0) return
        // El backend no manda `variantLabel` armado: manda `optionValues`
        // (talle, color, etc.) — acá se arma la etiqueta ("S", "Rojo / M")
        // para que el selector no diga "Única" cuando la variante SÍ tiene talle.
        const variantes = det.variants.map(v => ({
            id: v.id, price: v.price,
            variantLabel: v.variantLabel ?? (v.optionValues?.length ? v.optionValues.map(ov => ov.value).join(' / ') : null),
        }))
        // Si el producto tiene UNA sola variante, sé cuánto stock hay y freno el
        // contador ahí; con varias variantes el stock fino lo valida el backend.
        const stockHint = variantes.length === 1 ? prod.totalStock : null
        if (variantes.length === 1) agregarLinea(det.id, det.name, variantes[0], stockHint, prod.primaryImageUrl)
        else setEligiendo({ productId: det.id, nombre: det.name, img: prod.primaryImageUrl, variants: variantes })
    }

    const agregarLinea = (productId: string, nombre: string, v: { id: string; price: number; variantLabel?: string | null }, stockHint: number | null = null, img: string | null = null) => {
        setEligiendo(null)
        setCarrito(c => {
            const ya = c.find(l => l.variantId === v.id)
            if (ya) {
                // No dejo pasar el tope de stock conocido.
                if (ya.stockHint != null && ya.cantidad >= ya.stockHint) return c
                return c.map(l => l.variantId === v.id ? { ...l, cantidad: l.cantidad + 1 } : l)
            }
            return [...c, { variantId: v.id, productId, nombre, label: v.variantLabel ?? null, precio: Number(v.price), cantidad: 1, img, stockHint }]
        })
    }

    // Cuántas unidades de este producto ya están en el carrito (para marcar la tarjeta).
    const enCarritoDe = (productId: string) => carrito.filter(l => l.productId === productId).reduce((s, l) => s + l.cantidad, 0)

    const cambiarCantidad = (variantId: string, delta: number) => {
        setCarrito(c => c
            .map(l => {
                if (l.variantId !== variantId) return l
                // Para arriba, nunca más allá del stock que había.
                if (delta > 0 && l.stockHint != null && l.cantidad >= l.stockHint) return l
                return { ...l, cantidad: l.cantidad + delta }
            })
            .filter(l => l.cantidad > 0))
    }

    // ── Modalidad y cobro ──
    // Arranca en presencial: la pantalla es "estilo caja" y la venta de
    // mostrador es lo más frecuente de cargar a mano. El pedido online que
    // se carga por el dueño (un encargo por WhatsApp, por ejemplo) es la
    // otra opción, a un toque.
    const [modalidad, setModalidad] = useState<Modalidad>('presencial')
    const [cobro, setCobro]         = useState<MetodoCobro | null>(null)
    const esPresencial = modalidad === 'presencial'

    // ── Envío, notas y creación ──
    const [notas, setNotas]       = useState('')
    const [envio, setEnvio]       = useState('')
    const [creando, setCreando]   = useState(false)
    const [errorCrear, setErrorCrear] = useState<string | null>(null)

    // Una venta presencial no tiene envío: si el dueño lo había cargado y
    // cambió la modalidad, no se cobra.
    const envioNum = esPresencial ? 0 : (Number(envio) || 0)
    const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0) + envioNum

    const emailManualValido = manual.email.trim() === '' || EMAIL_OK.test(manual.email.trim())
    // En modo manual no hace falta un botón de "confirmar cliente": alcanza con
    // que el nombre (lo único obligatorio) esté cargado, y el email —si se
    // cargó— tenga formato válido. El comprador queda listo a medida que tipeás.
    const clienteListo: ClienteElegido | null = cliente ?? (modoManual && manual.nombre.trim() !== '' && emailManualValido
        ? { tipo: 'manual', nombre: manual.nombre.trim(), email: manual.email.trim(), tel: manual.tel.trim() }
        : null)

    // Presencial exige saber cómo se cobró; online no (puede pagar después).
    const faltaCobro = esPresencial && cobro === null
    const puedeCrear = clienteListo !== null && carrito.length > 0 && !faltaCobro && !creando
    // A quién le llega el aviso por email al crear (si hay a quién).
    const emailAviso = clienteListo?.email || null

    const crear = async () => {
        if (!clienteListo || carrito.length === 0 || creando) return
        setCreando(true)
        setErrorCrear(null)
        try {
            const pedido = await createOrder({
                // La modalidad es el canal: POS = venta presencial (nace
                // entregada y cobrada), ONLINE = pedido con ciclo de estados.
                channel: esPresencial ? 'POS' : 'ONLINE',
                ...(cobro ? { paymentMethod: cobro } : {}),
                notifyCustomer: !!emailAviso,
                ...(clienteListo.tipo === 'registrado'
                    ? { customerId: clienteListo.id }
                    : { buyer: { name: clienteListo.nombre, ...(clienteListo.email ? { email: clienteListo.email } : {}), ...(clienteListo.tel ? { phone: clienteListo.tel } : {}) } }),
                items: carrito.map(l => ({ variantId: l.variantId, quantity: l.cantidad })),
                ...(notas.trim() ? { notes: notas.trim() } : {}),
                ...(envioNum > 0 ? { shippingCost: envioNum } : {}),
            })
            onToast(
                (esPresencial ? `Venta #${pedido.orderNumber} registrada` : `Pedido #${pedido.orderNumber} creado`)
                + (emailAviso ? ` · le avisamos a ${emailAviso}` : ''),
            )
            ir('detalle', pedido.id)
        } catch (e) {
            setErrorCrear(e instanceof ApiError ? e.message : 'No se pudo crear el pedido.')
            setCreando(false)
        }
    }

    // ── Sin sesión ──
    if (authStatus !== 'loading' && !esDueno) {
        return (
            <div style={pageWrap}>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, maxWidth: 520 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>No hay sesión activa</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>Para crear pedidos entrá con tu cuenta.</div>
                    <Button variant="primary" onClick={() => { window.location.href = '/login' }}>Iniciar sesión</Button>
                </div>
            </div>
        )
    }

    if (esDueno && !puedeGestionar) {
        return (
            <div style={pageWrap}>
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, maxWidth: 520 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Tu rol no puede crear pedidos</div>
                    <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, marginBottom: 14 }}>
                        Pedile al propietario que te dé el permiso &quot;Gestionar pedidos&quot; si te toca cargar ventas.
                    </div>
                    <Button variant="outline" onClick={() => ir('lista')}>← Volver a la lista</Button>
                </div>
            </div>
        )
    }

    // Paginación del catálogo.
    const desdeProd = productosTotal === 0 ? 0 : (paginaProd - 1) * PROD_POR_PAGINA + 1
    const hastaProd = Math.min(paginaProd * PROD_POR_PAGINA, productosTotal)

    const unidades = carrito.reduce((s, l) => s + l.cantidad, 0)

    return (
        <div style={pageWrap}>
            <style>{`
                .npos-grid   { display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 16px; align-items: start; }
                .npos-ticket { position: sticky; top: 16px; }
                .npos-prodcard { transition: transform 150ms ease, box-shadow 150ms ease; cursor: pointer; }
                .npos-prodcard:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(15,23,42,0.10); }
                .npos-prodcard[data-bloqueado="1"] { cursor: not-allowed; }
                .npos-prodcard[data-bloqueado="1"]:hover { transform: none; box-shadow: none; }
                .npos-variant-row { transition: border-color 150ms ease, background 150ms ease; }
                .npos-variant-row:hover { border-color: var(--color-primary) !important; background: var(--color-primary-bg) !important; }
                .npos-qtybtn:hover:not(:disabled) { border-color: var(--color-primary) !important; color: var(--color-primary) !important; }
                .npos-live-dot { animation: npos-pulse 1.8s ease-in-out infinite; }
                @keyframes npos-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

                /* Tarjeta de producto del catálogo: foto cuadrada grande, nombre
                   en hasta dos renglones, precio protagonista y el stock como
                   pastilla. El "+" flota sobre la foto para que la tarjeta entera
                   se lea como "tocá para agregar". */
                .npos-prodgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 12px; }
                .npos-prodcard { border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; position: relative; background: var(--color-surface); }
                .npos-prodcard[data-en-carrito="1"] { border-color: var(--color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent); }
                .npos-prodcard:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                .npos-prodimg { position: relative; aspect-ratio: 1 / 1; background: var(--color-surface-alt); overflow: hidden; }
                .npos-prodimg img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 200ms ease; }
                .npos-prodcard:hover .npos-prodimg img { transform: scale(1.04); }
                .npos-prodcard[data-bloqueado="1"] .npos-prodimg img { filter: grayscale(0.6); }
                .npos-prodplus { position: absolute; right: 8px; bottom: 8px; width: 32px; height: 32px; border-radius: 9999px; display: grid; place-items: center; background: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 4px 12px rgba(15,23,42,0.25); }
                .npos-prodcard[data-bloqueado="1"] .npos-prodplus { background: var(--color-surface-alt); color: var(--color-muted); box-shadow: none; }
                .npos-prodbadge { position: absolute; top: 8px; left: 8px; height: 22px; padding: 0 8px; border-radius: 9999px; display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; font-family: "Geist Mono", monospace; background: var(--color-primary); color: var(--color-on-primary); }
                .npos-prodinfo { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
                .npos-prodname { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--color-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.7em; }
                .npos-prodmeta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .npos-prodprice { font-size: 14.5px; font-weight: 700; color: var(--color-text); font-family: "Geist Mono", monospace; white-space: nowrap; }
                .npos-stock { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 9999px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
                .npos-stock[data-nivel="ok"]   { color: var(--color-success); background: var(--color-success-bg); }
                .npos-stock[data-nivel="bajo"] { color: var(--color-warning); background: var(--color-warning-bg); }
                .npos-stock[data-nivel="sin"]  { color: var(--color-error);   background: var(--color-error-bg); }
                .npos-prodvars { font-size: 11px; color: var(--color-muted); }

                /* Modalidad y cobro: pares de botones grandes, con ícono y una
                   línea que dice qué implica cada uno. */
                .npos-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .npos-segbtn { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 12px; border-radius: 10px; text-align: left; cursor: pointer; font-family: inherit; border: 1.5px solid var(--color-border); background: var(--color-bg); color: var(--color-text); transition: border-color 150ms ease, background 150ms ease; }
                .npos-segbtn:hover { border-color: var(--color-primary); }
                .npos-segbtn[aria-pressed="true"] { border-color: var(--color-primary); background: var(--color-primary-bg); }
                .npos-segbtn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                .npos-segico { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-surface-alt); color: var(--color-body); }
                .npos-segbtn[aria-pressed="true"] .npos-segico { background: var(--color-primary); color: var(--color-on-primary); }
                .npos-segtxt { display: flex; flex-direction: column; min-width: 0; }
                .npos-segtxt b { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
                .npos-segtxt span { font-size: 10.5px; color: var(--color-muted); line-height: 1.3; margin-top: 2px; }
                @media (max-width: 960px) {
                    .npos-grid   { grid-template-columns: minmax(0,1fr) !important; }
                    .npos-ticket { position: static !important; }
                }
                @media (max-width: 768px) {
                    /* De a dos por fila: entran seis productos en pantalla y el
                       dedo sigue teniendo un blanco grande donde tocar. */
                    .npos-prodgrid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
                    .npos-prodinfo { padding: 8px 10px 10px !important; }
                    .npos-prodname { font-size: 12.5px; }
                    .npos-prodprice { font-size: 13.5px; }
                    /* A 390px el precio y la pastilla de stock no entran en un
                       renglón: la pastilla baja debajo del precio. */
                    .npos-prodmeta { flex-wrap: wrap; row-gap: 4px; }
                }
                @media (max-width: 400px) {
                    .npos-seg { grid-template-columns: 1fr; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .npos-prodcard, .npos-prodcard:hover { transition: none; transform: none; }
                    .npos-live-dot { animation: none; }
                }
            `}</style>

            <Volver a="Pedidos" onClick={() => ir('lista')} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 20px' }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Nuevo pedido</h1>
                <Button variant="outline" icon={<ArrowLeft size={15} />} onClick={() => ir('lista')}>Volver a la lista</Button>
            </div>

            <div className="npos-grid">
                {/* ── Izquierda: catálogo ── */}
                <Card>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Catálogo</div>
                        {unidades > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                <strong style={{ color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{unidades}</strong> en el ticket
                            </div>
                        )}
                    </div>
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                        <input className="ds-field" value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Buscar producto…" style={{ ...inputBase, paddingLeft: 32 }} />
                    </div>

                    {cargandoProd ? (
                        <div className="npos-prodgrid" aria-hidden="true">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                                    <SkeletonText width="100%" height={168} delay={i * 60} style={{ borderRadius: 0 }} />
                                    <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <SkeletonText width="85%" height={12} delay={i * 60 + 40} />
                                        <SkeletonText width="55%" height={12} delay={i * 60 + 60} />
                                        <SkeletonText width="40%" height={14} delay={i * 60 + 80} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : errorProd ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--color-error)' }}>{errorProd}</span>
                            <Button variant="outline" size="sm" onClick={() => setReintentoProd(n => n + 1)}>Reintentar</Button>
                        </div>
                    ) : productos.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>No hay productos {buscaProd ? 'con esa búsqueda' : 'en el catálogo todavía'}.</div>
                    ) : (
                        <div className="npos-prodgrid">
                            {productos.map(pr => {
                                const agotado = pr.variantCount > 0 && pr.totalStock === 0
                                const enCarrito = enCarritoDe(pr.id)
                                const alTope = pr.variantCount === 1 && pr.totalStock > 0 && enCarrito >= pr.totalStock
                                const bloqueado = agotado || alTope
                                const cargandoEste = agregandoId === pr.id
                                const nivelStock = agotado ? 'sin' : pr.totalStock <= 5 ? 'bajo' : 'ok'
                                return (
                                    /* toda la tarjeta agrega (estilo caja): un toque = una unidad */
                                    <div
                                        key={pr.id}
                                        className="npos-prodcard"
                                        data-bloqueado={bloqueado ? '1' : '0'}
                                        data-en-carrito={enCarrito > 0 ? '1' : '0'}
                                        role="button"
                                        tabIndex={bloqueado ? -1 : 0}
                                        aria-label={`${pr.name}, ${fmtMoney(Number(pr.basePrice))}${agotado ? ', sin stock' : ''}`}
                                        title={agotado ? 'Sin stock' : alTope ? 'Ya llevás todo el stock disponible' : 'Agregar al ticket'}
                                        onClick={() => { if (!bloqueado && !agregandoId) void agregarProducto(pr) }}
                                        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !bloqueado && !agregandoId) { e.preventDefault(); void agregarProducto(pr) } }}
                                        style={{ opacity: agotado ? 0.65 : cargandoEste ? 0.7 : 1 }}
                                    >
                                        {/* Foto cuadrada — la real del catálogo, o el thumb de color si no tiene. */}
                                        <div className="npos-prodimg">
                                            {pr.primaryImageUrl
                                                ? <img src={pr.primaryImageUrl} alt="" loading="lazy" />
                                                : <ProductoThumb hue={hueDe(pr.name)} size="100%" radius={0} />}
                                            {enCarrito > 0 && <span className="npos-prodbadge">×{enCarrito}</span>}
                                            <span className="npos-prodplus" aria-hidden="true"><Plus size={16} strokeWidth={2.4} /></span>
                                        </div>
                                        <div className="npos-prodinfo">
                                            <div className="npos-prodname">{pr.name}</div>
                                            <div className="npos-prodmeta">
                                                <span className="npos-prodprice">{fmtMoney(Number(pr.basePrice))}</span>
                                                <span className="npos-stock" data-nivel={nivelStock}>
                                                    {agotado ? 'Sin stock' : `${pr.totalStock} en stock`}
                                                </span>
                                            </div>
                                            {pr.variantCount > 1 && (
                                                <div className="npos-prodvars">{pr.variantCount} variantes · elegís al agregar</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {!cargandoProd && productosTotal > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 2px 0', flexWrap: 'wrap', gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                                Mostrando <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{desdeProd}–{hastaProd}</strong> de <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{productosTotal}</strong>
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button variant="outline" size="sm" disabled={paginaProd <= 1} onClick={() => setPaginaProd(p => Math.max(1, p - 1))}>← Anterior</Button>
                                <Button variant="outline" size="sm" disabled={hastaProd >= productosTotal} onClick={() => setPaginaProd(p => p + 1)}>Siguiente →</Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* ── Derecha: el ticket ── */}
                <div className="npos-ticket">
                    <Card style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                            <span className="npos-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
                                Ticket
                            </span>
                        </div>

                        {/* Modalidad: lo primero, porque cambia todo lo demás (estados, cobro, envío). */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Store size={13} style={{ color: 'var(--color-subtle)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modalidad</span>
                        </div>
                        <div className="npos-seg" role="group" aria-label="Modalidad de la venta" style={{ marginBottom: 16 }}>
                            <button type="button" className="npos-segbtn" aria-pressed={esPresencial} onClick={() => setModalidad('presencial')}>
                                <span className="npos-segico"><Store size={15} strokeWidth={2} /></span>
                                <span className="npos-segtxt"><b>Venta presencial</b><span>Se cobró y entregó ya</span></span>
                            </button>
                            <button type="button" className="npos-segbtn" aria-pressed={!esPresencial} onClick={() => setModalidad('online')}>
                                <span className="npos-segico"><Globe size={15} strokeWidth={2} /></span>
                                <span className="npos-segtxt"><b>Pedido online</b><span>Nace pendiente, como en la tienda</span></span>
                            </button>
                        </div>

                        {/* Cliente */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <User size={13} style={{ color: 'var(--color-subtle)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</span>
                        </div>

                        {cliente ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: 10, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 10 }}>
                                <Avatar name={cliente.nombre} size={32} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.nombre}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {cliente.email || 'Sin email'}{cliente.tipo === 'manual' ? ' · sin registrar' : ''}
                                    </div>
                                </div>
                                <button className="ds-link" onClick={() => { setCliente(null); setModoManual(false) }} style={linkBtn}>Cambiar</button>
                            </div>
                        ) : modoManual ? (
                            <div style={{ marginBottom: 16 }}>
                                <input className="ds-field" value={manual.nombre} onChange={e => setManual(m => ({ ...m, nombre: e.target.value }))} placeholder="Nombre y apellido *" style={{ ...inputBase, marginBottom: 8 }} />
                                {/* Con email inválido manda el borde de error: ds-field no aplica ahí. */}
                                <input className={emailManualValido ? 'ds-field' : undefined} value={manual.email} onChange={e => setManual(m => ({ ...m, email: e.target.value }))} placeholder="Email (opcional)" style={{ ...inputBase, marginBottom: !emailManualValido ? 4 : 8, ...(!emailManualValido ? { border: '1px solid var(--color-error)' } : {}) }} />
                                {!emailManualValido && (
                                    <div style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>Ese email no parece válido — fijate que tenga @ y punto.</div>
                                )}
                                <input className="ds-field" value={manual.tel} onChange={e => setManual(m => ({ ...m, tel: e.target.value.replace(/[^0-9+\-\s]/g, '') }))} placeholder="Teléfono (opcional)" style={{ ...inputBase, marginBottom: 8 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11.5, color: 'var(--color-subtle)' }}>No queda registrado como cliente.</span>
                                    <button className="ds-link" onClick={() => setModoManual(false)} style={linkBtn}>← Buscar cliente</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ position: 'relative', marginBottom: 8 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                                    <input value={buscaCli} onChange={e => setBuscaCli(e.target.value)} placeholder="Buscar cliente por nombre o email…" style={{ ...inputBase, paddingLeft: 32 }} />
                                </div>
                                {cargandoCli ? (
                                    <div aria-hidden="true">
                                        {[0, 1].map(i => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                                                <SkeletonCircle size={30} delay={i * 90} />
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                    <SkeletonText width={`${[52, 40][i]}%`} height={11} delay={i * 90 + 40} />
                                                    <SkeletonText width="30%" height={9} delay={i * 90 + 70} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : errorCli ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                                        <span style={{ fontSize: 12, color: 'var(--color-error)', flex: 1 }}>{errorCli}</span>
                                        <Button variant="outline" size="sm" onClick={() => setReintentoCli(n => n + 1)}>Reintentar</Button>
                                    </div>
                                ) : clientes.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', padding: '4px 0' }}>No hay clientes {buscaCli ? 'con esa búsqueda' : 'todavía'}.</div>
                                ) : clientes.map(c => (
                                    <button key={c.id} onClick={() => setCliente({ tipo: 'registrado', id: c.id, nombre: `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`, email: c.email ?? '', pedidos: c.orderCount })} style={pickRow}>
                                        <Avatar name={`${c.firstName} ${c.lastName ?? ''}`} size={30} />
                                        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email ?? 'Sin email'}</div>
                                        </div>
                                        <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>{c.orderCount} ped.</span>
                                    </button>
                                ))}
                                <button onClick={() => setModoManual(true)} style={{ ...pickRow, justifyContent: 'center', gap: 8, color: 'var(--color-body)', fontSize: 12.5, fontWeight: 500, marginBottom: 0 }}>
                                    <UserX size={14} /> Venta a un comprador sin registrar
                                </button>
                            </div>
                        )}

                        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 16 }} />

                        {/* Productos del ticket */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <ShoppingBag size={13} style={{ color: 'var(--color-subtle)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Productos{unidades > 0 ? ` (${unidades})` : ''}
                            </span>
                        </div>
                        {carrito.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginBottom: 16 }}>Tocá un producto del catálogo para agregarlo.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                {carrito.map(l => (
                                    <div key={l.variantId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                                        {l.img
                                            ? <img src={l.img} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                                            : <ProductoThumb hue={hueDe(l.nombre)} size={34} radius={7} />}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 12.5, color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                                                {l.nombre}{l.label ? ` · ${l.label}` : ''}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <button onClick={() => cambiarCantidad(l.variantId, -1)} className="npos-qtybtn" title={l.cantidad === 1 ? 'Quitar' : 'Restar uno'} style={qtyBtn}>
                                                    {l.cantidad === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                                                </button>
                                                <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: '"Geist Mono", monospace', minWidth: 16, textAlign: 'center', color: 'var(--color-text)', margin: '0 5px' }}>{l.cantidad}</span>
                                                {(() => {
                                                    const alTope = l.stockHint != null && l.cantidad >= l.stockHint
                                                    return (
                                                        <button onClick={() => cambiarCantidad(l.variantId, 1)} disabled={alTope} title={alTope ? 'No hay más stock' : 'Sumar uno'} className="npos-qtybtn" style={{ ...qtyBtn, opacity: alTope ? 0.4 : 1, cursor: alTope ? 'not-allowed' : 'pointer' }}>
                                                            <Plus size={11} />
                                                        </button>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                        <span style={{ color: 'var(--color-text)', fontWeight: 700, fontFamily: '"Geist Mono", monospace', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {fmtMoney(l.precio * l.cantidad)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Cobro: obligatorio en presencial (ya se cobró), opcional en online. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Banknote size={13} style={{ color: 'var(--color-subtle)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {esPresencial ? 'Cómo se cobró' : 'Cómo va a pagar'}
                            </span>
                            {!esPresencial && <span style={{ fontSize: 10.5, color: 'var(--color-subtle)' }}>(opcional)</span>}
                        </div>
                        <div className="npos-seg" role="group" aria-label={esPresencial ? 'Cómo se cobró' : 'Cómo va a pagar'} style={{ marginBottom: 12 }}>
                            <button type="button" className="npos-segbtn" aria-pressed={cobro === 'CASH'} onClick={() => setCobro(c => c === 'CASH' && !esPresencial ? null : 'CASH')}>
                                <span className="npos-segico"><Banknote size={15} strokeWidth={2} /></span>
                                <span className="npos-segtxt"><b>Efectivo</b></span>
                            </button>
                            <button type="button" className="npos-segbtn" aria-pressed={cobro === 'TRANSFER'} onClick={() => setCobro(c => c === 'TRANSFER' && !esPresencial ? null : 'TRANSFER')}>
                                <span className="npos-segico"><Landmark size={15} strokeWidth={2} /></span>
                                <span className="npos-segtxt"><b>Transferencia</b></span>
                            </button>
                        </div>

                        {/* Envío (solo online) y notas */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 4 }}>
                            {!esPresencial && (
                                <input value={envio} onChange={e => setEnvio(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Costo de envío ($, opcional)" style={inputBase} />
                            )}
                            <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder={esPresencial ? 'Notas de la venta (opcional)…' : 'Notas del pedido (opcional)…'} rows={2} style={{ ...inputBase, height: 'auto', minHeight: 44, resize: 'vertical', padding: '9px 12px' }} />
                        </div>

                        {envioNum > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-muted)', margin: '8px 0 0' }}>
                                <span>Envío</span>
                                <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(envioNum)}</span>
                            </div>
                        )}

                        {errorCrear && (
                            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)', lineHeight: 1.5 }}>{errorCrear}</div>
                        )}

                        <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', lineHeight: 1.5, marginTop: 10 }}>
                            {esPresencial
                                ? <>La venta queda <strong>entregada y cobrada</strong>: el stock se descuenta ahora y en el listado figura como manual, sin más estados.</>
                                : <>El pedido nace <strong>pendiente</strong>: el stock se descuenta cuando lo confirmes{cobro ? ', y el cobro queda por confirmar hasta entonces' : ', y el cobro se registra después'}.</>}
                            {' '}Si hay descuentos o cupones activos, se aplican solos al crear.
                        </div>
                        {clienteListo && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, color: emailAviso ? 'var(--color-body)' : 'var(--color-subtle)', lineHeight: 1.5, marginTop: 6 }}>
                                <Mail size={12} style={{ flexShrink: 0, marginTop: 2, color: emailAviso ? 'var(--color-primary)' : 'var(--color-subtle)' }} />
                                {emailAviso
                                    ? <span>Le llega un email a <strong style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{emailAviso}</strong> con el detalle{esPresencial ? ' de la compra' : ' del pedido'}.</span>
                                    : <span>Sin email cargado: no se le avisa al comprador.</span>}
                            </div>
                        )}

                        {/* Total + crear, siempre a la vista */}
                        <div style={{ margin: '14px -24px -24px', padding: '14px 24px 18px', background: 'var(--color-primary-bg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
                                <span>Total</span>
                                <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-primary-h)', fontSize: 20 }}>{fmtMoney(total)}</span>
                            </div>
                            <Button variant="primary" loading={creando} disabled={!puedeCrear} onClick={() => void crear()} style={{ width: '100%', justifyContent: 'center' }}>
                                {esPresencial ? 'Registrar venta' : 'Crear pedido'}
                            </Button>
                            {!clienteListo && carrito.length > 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>Falta elegir el cliente ↑</div>
                            )}
                            {clienteListo && carrito.length === 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>Falta agregar productos ←</div>
                            )}
                            {clienteListo && carrito.length > 0 && faltaCobro && (
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>Falta marcar cómo se cobró ↑</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Elegir variante — modal para que quede arriba de todo. */}
            <Modal
                isOpen={!!eligiendo}
                onClose={() => setEligiendo(null)}
                title={eligiendo ? `${eligiendo.nombre}: elegí la variante` : 'Elegí la variante'}
                maxWidth={420}
            >
                {eligiendo && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {eligiendo.variants.map(v => (
                            <button
                                key={v.id}
                                onClick={() => agregarLinea(eligiendo.productId, eligiendo.nombre, v)}
                                className="npos-variant-row"
                                style={variantRow}
                            >
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{v.variantLabel ?? 'Única'}</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(Number(v.price))}</span>
                            </button>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const pickRow: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10,
    border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)',
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
}
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8,
    fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
}
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }
const variantRow: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit',
}
const qtyBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }

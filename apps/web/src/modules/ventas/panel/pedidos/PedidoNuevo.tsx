// src/modules/ventas/panel/pedidos/PedidoNuevo.tsx — Vista 04
// Alta manual de un pedido, estilo caja (POS): todo en una sola pantalla.
// Catálogo a la izquierda (buscar y tocar = agregar), ticket a la derecha
// (cliente, renglones, envío, notas y el botón de crear siempre a la vista).
//
// (Fase 2 — Alex) Esta pantalla crea pedidos DE VERDAD: busca los clientes
// y productos reales del negocio, arma el carrito con variantes y cantidades,
// y al confirmar le pide al backend que cree el pedido (que nace "pendiente";
// el stock se descuenta recién cuando lo confirmás desde el detalle). Si el
// backend rechaza el alta —por ejemplo por falta de stock— el motivo se
// muestra acá mismo. El cobro no se registra en este paso: llega con la caja
// (POS) o el pago online, cada uno en su fase.
//
// (Rediseño) Antes era un wizard de 3 pasos; el ida y vuelta entre pasos
// hacía lenta la carga de una venta en el mostrador. Ahora es una pantalla
// única: la MISMA lógica de siempre (búsquedas con debounce y cancelación,
// tope de stock conocido, guarda contra doble click, ?clienteId= precargado),
// solo cambió la disposición.

import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Minus, Plus, Search, ShoppingBag, Trash2, User, UserX } from 'lucide-react'
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

    // ── Envío, notas y creación ──
    const [notas, setNotas]       = useState('')
    const [envio, setEnvio]       = useState('')
    const [creando, setCreando]   = useState(false)
    const [errorCrear, setErrorCrear] = useState<string | null>(null)

    const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0) + (Number(envio) || 0)

    const emailManualValido = manual.email.trim() === '' || EMAIL_OK.test(manual.email.trim())
    // En modo manual no hace falta un botón de "confirmar cliente": alcanza con
    // que el nombre (lo único obligatorio) esté cargado, y el email —si se
    // cargó— tenga formato válido. El comprador queda listo a medida que tipeás.
    const clienteListo: ClienteElegido | null = cliente ?? (modoManual && manual.nombre.trim() !== '' && emailManualValido
        ? { tipo: 'manual', nombre: manual.nombre.trim(), email: manual.email.trim(), tel: manual.tel.trim() }
        : null)

    const puedeCrear = clienteListo !== null && carrito.length > 0 && !creando

    const crear = async () => {
        if (!clienteListo || carrito.length === 0 || creando) return
        setCreando(true)
        setErrorCrear(null)
        try {
            const pedido = await createOrder({
                // OJO: acá NO se manda channel. El pedido manual va como 'ONLINE'
                // a propósito: en este sistema el canal es el TIPO de flujo, no
                // quién lo cargó — 'POS' es la venta de caja instantánea (módulo
                // eliminado, el backend la rechaza) y 'ONLINE' es el pedido con
                // ciclo de estados, que es exactamente lo que crea esta pantalla.
                ...(clienteListo.tipo === 'registrado'
                    ? { customerId: clienteListo.id }
                    : { buyer: { name: clienteListo.nombre, ...(clienteListo.email ? { email: clienteListo.email } : {}), ...(clienteListo.tel ? { phone: clienteListo.tel } : {}) } }),
                items: carrito.map(l => ({ variantId: l.variantId, quantity: l.cantidad })),
                ...(notas.trim() ? { notes: notas.trim() } : {}),
                ...(Number(envio) > 0 ? { shippingCost: Number(envio) } : {}),
            })
            onToast(`Pedido #${pedido.orderNumber} creado`)
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
                @media (max-width: 960px) {
                    .npos-grid   { grid-template-columns: minmax(0,1fr) !important; }
                    .npos-ticket { position: static !important; }
                }
                @media (max-width: 768px) {
                    /* auto-fill con minimo de 150px daba UNA tarjeta por fila:
                       una foto de 330px de ancho por producto, con el nombre y
                       el precio perdidos abajo. De a dos, con la miniatura mas
                       baja, entran seis productos en pantalla y el dedo sigue
                       teniendo un blanco grande donde tocar. */
                    .npos-prodgrid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
                    .npos-prodimg  { height: 72px !important; }
                    .npos-prodinfo { padding: 8px !important; }
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
                        <div className="npos-prodgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }} aria-hidden="true">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <SkeletonText width="100%" height={90} delay={i * 60} style={{ borderRadius: 8 }} />
                                    <SkeletonText width="80%" height={11} delay={i * 60 + 40} />
                                    <SkeletonText width="45%" height={11} delay={i * 60 + 70} />
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
                        <div className="npos-prodgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                            {productos.map(pr => {
                                const agotado = pr.variantCount > 0 && pr.totalStock === 0
                                const enCarrito = enCarritoDe(pr.id)
                                const alTope = pr.variantCount === 1 && pr.totalStock > 0 && enCarrito >= pr.totalStock
                                const bloqueado = agotado || alTope
                                const cargandoEste = agregandoId === pr.id
                                return (
                                    /* toda la tarjeta agrega (estilo caja): un toque = una unidad */
                                    <div
                                        key={pr.id}
                                        className="npos-prodcard"
                                        data-bloqueado={bloqueado ? '1' : '0'}
                                        role="button"
                                        tabIndex={bloqueado ? -1 : 0}
                                        title={agotado ? 'Sin stock' : alTope ? 'Ya llevás todo el stock disponible' : 'Agregar al ticket'}
                                        onClick={() => { if (!bloqueado && !agregandoId) void agregarProducto(pr) }}
                                        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !bloqueado && !agregandoId) { e.preventDefault(); void agregarProducto(pr) } }}
                                        style={{ border: `1px solid ${enCarrito > 0 ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--color-surface)', opacity: agotado ? 0.6 : cargandoEste ? 0.7 : 1 }}
                                    >
                                        {enCarrito > 0 && (
                                            <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: '2px 8px', fontFamily: '"Geist Mono", monospace' }}>×{enCarrito}</span>
                                        )}
                                        {/* la miniatura va en una caja de altura fija, si no se estira y tapa el
                                            resto — con la FOTO REAL del producto si la tiene (el thumb de color
                                            queda solo de fallback para productos sin foto) */}
                                        <div className="npos-prodimg" style={{ height: 84, overflow: 'hidden' }}>
                                            {pr.primaryImageUrl
                                                ? <img src={pr.primaryImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                : <ProductoThumb hue={hueDe(pr.name)} size="100%" radius={0} />}
                                        </div>
                                        <div className="npos-prodinfo" style={{ padding: 10 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.name}</div>
                                            <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: agotado ? 'var(--color-error)' : pr.totalStock <= 5 ? 'var(--color-warning)' : 'var(--color-muted)' }}>
                                                {agotado ? 'Sin stock' : `Stock: ${pr.totalStock}`}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(Number(pr.basePrice))}</span>
                                                <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 6, background: bloqueado ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: bloqueado ? 'var(--color-muted)' : 'var(--color-on-primary)', display: 'grid', placeItems: 'center' }}>
                                                    <Plus size={14} strokeWidth={2.2} />
                                                </span>
                                            </div>
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

                        {/* Envío y notas */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 4 }}>
                            <input value={envio} onChange={e => setEnvio(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Costo de envío ($, opcional)" style={inputBase} />
                            <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas del pedido (opcional)…" rows={2} style={{ ...inputBase, height: 'auto', minHeight: 44, resize: 'vertical', padding: '9px 12px' }} />
                        </div>

                        {Number(envio) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-muted)', margin: '8px 0 0' }}>
                                <span>Envío</span>
                                <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(Number(envio))}</span>
                            </div>
                        )}

                        {errorCrear && (
                            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)', lineHeight: 1.5 }}>{errorCrear}</div>
                        )}

                        <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', lineHeight: 1.5, marginTop: 10 }}>
                            El pedido nace <strong>pendiente</strong>: el stock se descuenta cuando lo confirmes, y el cobro se registra después. Si hay descuentos o cupones activos, se aplican solos al crear.
                        </div>

                        {/* Total + crear, siempre a la vista */}
                        <div style={{ margin: '14px -24px -24px', padding: '14px 24px 18px', background: 'var(--color-primary-bg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
                                <span>Total</span>
                                <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-primary-h)', fontSize: 20 }}>{fmtMoney(total)}</span>
                            </div>
                            <Button variant="primary" loading={creando} disabled={!puedeCrear} onClick={() => void crear()} style={{ width: '100%', justifyContent: 'center' }}>
                                Crear pedido
                            </Button>
                            {!clienteListo && carrito.length > 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>Falta elegir el cliente ↑</div>
                            )}
                            {clienteListo && carrito.length === 0 && (
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>Falta agregar productos ←</div>
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

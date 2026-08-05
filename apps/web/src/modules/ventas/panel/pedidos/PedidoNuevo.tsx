// src/modules/ventas/panel/pedidos/PedidoNuevo.tsx — Vista 04
// Alta manual de un pedido en 3 pasos: cliente, productos, revisión.
//
// (Fase 2 — Alex) Esta pantalla ya crea pedidos DE VERDAD: busca los clientes
// y productos reales del negocio, arma el carrito con variantes y cantidades,
// y al confirmar le pide al backend que cree el pedido (que nace "pendiente";
// el stock se descuenta recién cuando lo confirmás desde el detalle). Si el
// backend rechaza el alta —por ejemplo por falta de stock— el motivo se
// muestra acá mismo. El cobro no se registra en este paso: llega con la caja
// (POS) o el pago online, cada uno en su fase.

import { useEffect, useState } from 'react'
import { Check, Minus, Plus, Search, ShoppingBag, Trash2, User, UserX } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Modal } from '@/design-system/components/Modal'
import { Loader } from '@/design-system/components/Loader'
import { fmtMoney } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/router'
import {
    ApiError, getCustomers, getCustomer, panelGetProducts, panelGetProduct, createOrder,
    type ApiCustomer, type ApiProductListItem,
} from '@/lib/api'
import type { VistaPedido } from './components/PedidoTabs'
import { ProductoThumb } from './components/ProductoThumb'

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

    const [step, setStep] = useState(1)

    // ── Paso 1: cliente ──
    const [cliente, setCliente]       = useState<ClienteElegido | null>(null)
    const [modoManual, setModoManual] = useState(false)
    const [manual, setManual]         = useState({ nombre: '', email: '', tel: '' })
    const [buscaCli, setBuscaCli]     = useState('')
    const [clientes, setClientes]     = useState<ApiCustomer[]>([])
    const [cargandoCli, setCargandoCli] = useState(false)

    // Si venimos del perfil de un cliente ("Nuevo pedido" en Clientes), el
    // cliente ya llega elegido por la URL (?clienteId=…): se precarga y el
    // paso 1 arranca resuelto, listo para tocar Siguiente.
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
            .catch(() => { /* si no existe, el paso 1 queda como siempre */ })
        return () => { cancelado = true }
    }, [esDueno, clienteIdInicial])

    // Busca clientes reales (espera 350ms desde la última tecla). Con flag de
    // cancelación: sin él, dos respuestas fuera de orden dejaban la lista
    // mostrando los resultados de una búsqueda vieja.
    useEffect(() => {
        if (!esDueno) return
        let cancelado = false
        const t = setTimeout(() => {
            setCargandoCli(true)
            getCustomers({ search: buscaCli || undefined, limit: 5 })
                .then(r => { if (!cancelado) setClientes(r.data) })
                .catch(() => { if (!cancelado) setClientes([]) })
                .finally(() => { if (!cancelado) setCargandoCli(false) })
        }, buscaCli ? 350 : 0)
        return () => { cancelado = true; clearTimeout(t) }
    }, [buscaCli, esDueno])

    // ── Paso 2: productos ──
    const [buscaProd, setBuscaProd]   = useState('')
    const [paginaProd, setPaginaProd] = useState(1)
    const [productos, setProductos]   = useState<ApiProductListItem[]>([])
    const [productosTotal, setProductosTotal] = useState(0)
    const [cargandoProd, setCargandoProd] = useState(false)
    const [eligiendo, setEligiendo]   = useState<{ productId: string; nombre: string; variants: { id: string; price: number; variantLabel?: string | null }[] } | null>(null)
    const [carrito, setCarrito]       = useState<Linea[]>([])

    // Cualquier cambio de búsqueda vuelve a la primera página del catálogo.
    useEffect(() => { setPaginaProd(1) }, [buscaProd])

    useEffect(() => {
        if (!esDueno || step !== 2) return
        let cancelado = false
        const t = setTimeout(() => {
            setCargandoProd(true)
            panelGetProducts({ search: buscaProd || undefined, page: paginaProd, limit: PROD_POR_PAGINA })
                .then(r => { if (!cancelado) { setProductos(r.data); setProductosTotal(r.total) } })
                .catch(() => { if (!cancelado) { setProductos([]); setProductosTotal(0) } })
                .finally(() => { if (!cancelado) setCargandoProd(false) })
        }, buscaProd ? 350 : 0)
        return () => { cancelado = true; clearTimeout(t) }
    }, [buscaProd, paginaProd, esDueno, step])

    // Agregar un producto: si tiene una sola variante va directo; si tiene
    // varias, primero se elige cuál (talle, color, etc.).
    const agregarProducto = async (prod: ApiProductListItem) => {
        // Sin stock no se puede cargar: no tiene sentido armar un pedido que va a rebotar.
        if (prod.variantCount > 0 && prod.totalStock === 0) return
        const det = await panelGetProduct(prod.id).catch(() => null)
        if (!det || det.variants.length === 0) return
        // Si el producto tiene UNA sola variante, sé cuánto stock hay y freno el
        // contador ahí; con varias variantes el stock fino lo valida el backend.
        const stockHint = det.variants.length === 1 ? prod.totalStock : null
        if (det.variants.length === 1) agregarLinea(det.id, det.name, det.variants[0], stockHint)
        else setEligiendo({ productId: det.id, nombre: det.name, variants: det.variants })
    }

    const agregarLinea = (productId: string, nombre: string, v: { id: string; price: number; variantLabel?: string | null }, stockHint: number | null = null) => {
        setEligiendo(null)
        setCarrito(c => {
            const ya = c.find(l => l.variantId === v.id)
            if (ya) {
                // No dejo pasar el tope de stock conocido.
                if (ya.stockHint != null && ya.cantidad >= ya.stockHint) return c
                return c.map(l => l.variantId === v.id ? { ...l, cantidad: l.cantidad + 1 } : l)
            }
            return [...c, { variantId: v.id, productId, nombre, label: v.variantLabel ?? null, precio: Number(v.price), cantidad: 1, stockHint }]
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

    // ── Paso 3: revisión ──
    const [notas, setNotas]       = useState('')
    const [envio, setEnvio]       = useState('')
    const [creando, setCreando]   = useState(false)
    const [errorCrear, setErrorCrear] = useState<string | null>(null)

    const total = carrito.reduce((s, l) => s + l.precio * l.cantidad, 0) + (Number(envio) || 0)

    const crear = async () => {
        if (!cliente || carrito.length === 0 || creando) return
        setCreando(true)
        setErrorCrear(null)
        try {
            const pedido = await createOrder({
                ...(cliente.tipo === 'registrado'
                    ? { customerId: cliente.id }
                    : { buyer: { name: cliente.nombre, ...(cliente.email ? { email: cliente.email } : {}), ...(cliente.tel ? { phone: cliente.tel } : {}) } }),
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
                        Pedile al dueño que te dé el permiso &quot;Gestionar pedidos&quot; si te toca cargar ventas.
                    </div>
                    <Button variant="outline" onClick={() => ir('lista')}>← Volver a la lista</Button>
                </div>
            </div>
        )
    }

    const emailManualValido = manual.email.trim() === '' || EMAIL_OK.test(manual.email.trim())
    // En modo manual no hace falta haber tocado "Usar estos datos": alcanza con
    // que el nombre (lo único obligatorio) esté cargado — "Siguiente" hace de
    // confirmación. El email, si se cargó, tiene que tener formato válido.
    const puedeAvanzar1 = cliente !== null || (modoManual && manual.nombre.trim() !== '' && emailManualValido)
    const puedeAvanzar2 = carrito.length > 0
    // Paginación del catálogo (paso 2).
    const desdeProd = productosTotal === 0 ? 0 : (paginaProd - 1) * PROD_POR_PAGINA + 1
    const hastaProd = Math.min(paginaProd * PROD_POR_PAGINA, productosTotal)

    // Al avanzar del paso 1: si vengo del alta manual y todavía no confirmé el
    // cliente (lo elegí por búsqueda), lo armo acá con lo cargado hasta ahora.
    const irAPaso2 = () => {
        if (!cliente && modoManual && manual.nombre.trim()) {
            setCliente({ tipo: 'manual', nombre: manual.nombre.trim(), email: manual.email.trim(), tel: manual.tel.trim() })
        }
        setStep(2)
    }

    // Para la vista previa en vivo: si todavía no confirmé el cliente pero ya
    // estoy escribiendo sus datos a mano, lo muestro igual (se actualiza a
    // medida que tipeo, no recién cuando aprieto "Siguiente").
    const clientePreview: ClienteElegido | null = cliente ?? (modoManual && manual.nombre.trim()
        ? { tipo: 'manual', nombre: manual.nombre.trim(), email: manual.email.trim(), tel: manual.tel.trim() }
        : null)

    return (
        <div style={pageWrap}>
            <style>{`
                .nped-grid    { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 16px; align-items: start; }
                .nped-preview { position: sticky; top: 16px; }
                .nped-prodcard { transition: transform 150ms ease, box-shadow 150ms ease; }
                .nped-prodcard:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(15,23,42,0.10); }
                .nped-variant-row { transition: border-color 150ms ease, background 150ms ease; }
                .nped-variant-row:hover { border-color: var(--color-primary) !important; background: var(--color-primary-bg) !important; }
                .nped-qtybtn:hover:not(:disabled) { border-color: var(--color-primary) !important; color: var(--color-primary) !important; }
                .nped-live-dot { animation: nped-pulse 1.8s ease-in-out infinite; }
                @keyframes nped-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
                @media (max-width: 900px) {
                    .nped-grid    { grid-template-columns: 1fr !important; }
                    .nped-preview { position: static !important; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .nped-prodcard, .nped-prodcard:hover { transition: none; transform: none; }
                    .nped-live-dot { animation: none; }
                }
            `}</style>

            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Nuevo pedido manual</h1>

            {/* Stepper */}
            <div style={{ display: 'flex', marginBottom: 24, maxWidth: 560 }}>
                {[['1', 'Cliente'], ['2', 'Productos'], ['3', 'Revisión']].map(([n, l], i) => {
                    const activo = step === i + 1
                    const done = step > i + 1
                    return (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                            {/* a un paso ya completado se puede volver tocándolo */}
                            <div onClick={() => { if (done) setStep(i + 1) }} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: done ? 'pointer' : 'default' }}>
                                <span style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'var(--color-success)' : activo ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: done || activo ? '#fff' : 'var(--color-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, fontFamily: '"Geist Mono", monospace' }}>
                                    {done ? <Check size={13} strokeWidth={2.6} /> : n}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: activo || done ? 600 : 500, color: activo || done ? 'var(--color-text)' : 'var(--color-muted)' }}>{l}</span>
                            </div>
                            {i < 2 && <div style={{ flex: 1, height: 2, background: done ? 'var(--color-success)' : 'var(--color-border)', margin: '0 12px' }} />}
                        </div>
                    )
                })}
            </div>

            <div className="nped-grid">
            <Card>
                {/* Paso 1 — cliente */}
                {step === 1 && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>¿Quién compra?</div>

                        {cliente ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)', borderRadius: 10 }}>
                                <Avatar name={cliente.nombre} size={44} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{cliente.nombre}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{cliente.email}{cliente.tipo === 'manual' ? ' · sin registrar' : ''}</div>
                                </div>
                                <button onClick={() => setCliente(null)} style={linkBtn}>Cambiar</button>
                            </div>
                        ) : modoManual ? (
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--color-body)', marginBottom: 14 }}>Datos del comprador (no queda registrado como cliente):</div>

                                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 5 }}>
                                    Nombre y apellido <span style={{ color: 'var(--color-error)' }}>*</span>
                                </label>
                                <input value={manual.nombre} onChange={e => setManual(m => ({ ...m, nombre: e.target.value }))} placeholder="Nombre y apellido" style={{ ...inputBase, marginBottom: 12 }} />

                                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 5 }}>
                                    Email <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(opcional)</span>
                                </label>
                                <input value={manual.email} onChange={e => setManual(m => ({ ...m, email: e.target.value }))} placeholder="Email" style={{ ...inputBase, marginBottom: 4, ...(!emailManualValido ? { border: '1px solid var(--color-error)' } : {}) }} />
                                {!emailManualValido && (
                                    <div style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8 }}>Ese email no parece válido — fijate que tenga @ y punto.</div>
                                )}
                                <div style={{ marginBottom: emailManualValido ? 12 : 0 }} />

                                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 5 }}>
                                    Teléfono <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(opcional)</span>
                                </label>
                                <input value={manual.tel} onChange={e => setManual(m => ({ ...m, tel: e.target.value.replace(/[^0-9+\-\s]/g, '') }))} placeholder="Teléfono" style={{ ...inputBase, marginBottom: 4 }} />

                                <div style={{ marginTop: 10 }}>
                                    <Button variant="ghost" size="sm" onClick={() => setModoManual(false)}>← Buscar cliente</Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ position: 'relative', marginBottom: 10 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                                    <input value={buscaCli} onChange={e => setBuscaCli(e.target.value)} placeholder="Buscar cliente por nombre o email…" style={{ ...inputBase, paddingLeft: 32 }} />
                                </div>
                                {cargandoCli ? (
                                    <Loader message="Buscando…" size="sm" style={{ padding: '10px 0' }} />
                                ) : clientes.length === 0 ? (
                                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', padding: '8px 0' }}>No hay clientes {buscaCli ? 'con esa búsqueda' : 'todavía'}.</div>
                                ) : clientes.map(c => (
                                    <button key={c.id} onClick={() => setCliente({ tipo: 'registrado', id: c.id, nombre: `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}`, email: c.email ?? '', pedidos: c.orderCount })} style={pickRow}>
                                        <Avatar name={`${c.firstName} ${c.lastName ?? ''}`} size={36} />
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</div>
                                            <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{c.email ?? 'Sin email'}</div>
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{c.orderCount} pedidos</span>
                                    </button>
                                ))}
                                <button onClick={() => setModoManual(true)} style={{ ...pickRow, justifyContent: 'center', gap: 8, color: 'var(--color-body)', fontSize: 13, fontWeight: 500 }}>
                                    <UserX size={15} /> Venta a un comprador sin registrar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Paso 2 — productos */}
                {step === 2 && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>Agregá productos</div>
                            {carrito.length > 0 && (
                                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                                    <strong style={{ color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{carrito.reduce((s, l) => s + l.cantidad, 0)}</strong> en el carrito — mirá la vista previa →
                                </div>
                            )}
                        </div>
                        <div style={{ position: 'relative', marginBottom: 14 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                            <input value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Buscar producto…" style={{ ...inputBase, paddingLeft: 32 }} />
                        </div>

                        {cargandoProd ? (
                            <Loader message="Cargando catálogo…" style={{ padding: '40px 0' }} />
                        ) : productos.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>No hay productos {buscaProd ? 'con esa búsqueda' : 'en el catálogo todavía'}.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                                {productos.map(pr => {
                                    const agotado = pr.variantCount > 0 && pr.totalStock === 0
                                    const enCarrito = enCarritoDe(pr.id)
                                    return (
                                    <div key={pr.id} className="nped-prodcard" style={{ border: `1px solid ${enCarrito > 0 ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--color-surface)' }}>
                                        {enCarrito > 0 && (
                                            <span style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: '2px 8px', fontFamily: '"Geist Mono", monospace' }}>×{enCarrito}</span>
                                        )}
                                        {/* la miniatura va en una caja de altura fija, si no se estira y tapa el resto */}
                                        <div style={{ height: 84 }}><ProductoThumb hue={hueDe(pr.name)} size="100%" radius={0} /></div>
                                        <div style={{ padding: 10 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.name}</div>
                                            <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: agotado ? 'var(--color-error)' : pr.totalStock <= 5 ? 'var(--color-warning)' : 'var(--color-muted)' }}>
                                                {agotado ? 'Sin stock' : `Stock: ${pr.totalStock}`}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(Number(pr.basePrice))}</span>
                                                {(() => {
                                                    const alTope = pr.variantCount === 1 && pr.totalStock > 0 && enCarrito >= pr.totalStock
                                                    const bloqueado = agotado || alTope
                                                    return (
                                                        <button
                                                            onClick={() => { if (!bloqueado) void agregarProducto(pr) }}
                                                            disabled={bloqueado}
                                                            title={agotado ? 'Sin stock' : alTope ? 'Ya llevás todo el stock disponible' : 'Agregar'}
                                                            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: bloqueado ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: bloqueado ? 'var(--color-muted)' : '#fff', cursor: bloqueado ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center' }}
                                                        >
                                                            <Plus size={14} strokeWidth={2.2} />
                                                        </button>
                                                    )
                                                })()}
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
                    </div>
                )}

                {/* Paso 3 — revisión */}
                {step === 3 && cliente && (
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>Revisá y creá el pedido</div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <Avatar name={cliente.nombre} size={36} />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{cliente.nombre}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{cliente.email}</div>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '4px 12px', marginBottom: 14 }}>
                            {carrito.map((l, i) => (
                                <div key={l.variantId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < carrito.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: 13 }}>
                                    <span style={{ color: 'var(--color-body)' }}>{l.cantidad}× {l.nombre}{l.label ? ` · ${l.label}` : ''}</span>
                                    <span style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{fmtMoney(l.precio * l.cantidad)}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                                <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-body)', display: 'block', marginBottom: 5 }}>Costo de envío ($, opcional)</label>
                                <input value={envio} onChange={e => setEnvio(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" style={inputBase} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                                    <span>Total</span>
                                    <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(total)}</span>
                                </div>
                            </div>
                        </div>

                        <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas del pedido (opcional)…" rows={2} style={{ ...inputBase, height: 'auto', minHeight: 52, resize: 'vertical', padding: '10px 12px' }} />

                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                            El pedido nace <strong>pendiente</strong>: el stock se descuenta cuando lo confirmes, y el cobro se registra después (en la caja o con el pago online).
                        </div>

                        {errorCrear && (
                            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-error-bg)', fontSize: 13, color: 'var(--color-error)', lineHeight: 1.5 }}>{errorCrear}</div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {step === 1 && <Button variant="ghost" onClick={() => ir('lista')}>← Volver atrás</Button>}
                        {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Volver</Button>}
                        {carrito.length > 0 && (
                            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                                Total <strong style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', fontSize: 15 }}>{fmtMoney(total)}</strong>
                            </span>
                        )}
                    </div>
                    {step < 3
                        ? <Button variant="primary" disabled={(step === 1 && !puedeAvanzar1) || (step === 2 && !puedeAvanzar2)} onClick={() => { if (step === 1) irAPaso2(); else setStep(step + 1) }}>Siguiente →</Button>
                        : <Button variant="primary" loading={creando} disabled={carrito.length === 0} onClick={() => void crear()}>Crear pedido</Button>}
                </div>
            </Card>

            {/* Vista previa en vivo — se arma con lo que ya está cargado, sin
                importar en qué paso estés (cliente elegido o tipeado a mano,
                productos en el carrito, envío, total). */}
            <div className="nped-preview">
                <Card style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
                        <span className="nped-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
                            Vista previa
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <User size={13} style={{ color: 'var(--color-subtle)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</span>
                    </div>
                    {clientePreview ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                            <Avatar name={clientePreview.nombre} size={32} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {clientePreview.nombre}
                                </div>
                                {clientePreview.email && (
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {clientePreview.email}
                                    </div>
                                )}
                            </div>
                            {clientePreview.tipo === 'manual' && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-subtle)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 9999, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    Sin registrar
                                </span>
                            )}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginBottom: 18 }}>Todavía no elegiste a nadie.</div>
                    )}

                    <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 18 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <ShoppingBag size={13} style={{ color: 'var(--color-subtle)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Productos{carrito.length > 0 ? ` (${carrito.reduce((s, l) => s + l.cantidad, 0)})` : ''}
                        </span>
                    </div>
                    {carrito.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginBottom: 18 }}>Todavía no agregaste productos.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                            {carrito.map(l => (
                                <div key={l.variantId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                                    <ProductoThumb hue={hueDe(l.nombre)} size={34} radius={7} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 12.5, color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                                            {l.nombre}{l.label ? ` · ${l.label}` : ''}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <button onClick={() => cambiarCantidad(l.variantId, -1)} className="nped-qtybtn" title={l.cantidad === 1 ? 'Quitar' : 'Restar uno'} style={qtyBtn}>
                                                {l.cantidad === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                                            </button>
                                            <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: '"Geist Mono", monospace', minWidth: 16, textAlign: 'center', color: 'var(--color-text)', margin: '0 5px' }}>{l.cantidad}</span>
                                            {(() => {
                                                const alTope = l.stockHint != null && l.cantidad >= l.stockHint
                                                return (
                                                    <button onClick={() => cambiarCantidad(l.variantId, 1)} disabled={alTope} title={alTope ? 'No hay más stock' : 'Sumar uno'} className="nped-qtybtn" style={{ ...qtyBtn, opacity: alTope ? 0.4 : 1, cursor: alTope ? 'not-allowed' : 'pointer' }}>
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

                    {Number(envio) > 0 && (
                        <>
                            <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 10 }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 4 }}>
                                <span>Envío</span>
                                <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmtMoney(Number(envio))}</span>
                            </div>
                        </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-primary-bg)', margin: '18px -24px -24px', padding: '16px 24px' }}>
                        <span>Total</span>
                        <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-primary-h)', fontSize: 18 }}>{fmtMoney(total)}</span>
                    </div>
                </Card>
            </div>
            </div>

            {/* Elegir variante — modal para que quede arriba de todo, no metido
                entre la búsqueda y la grilla como antes. */}
            <Modal
                isOpen={!!eligiendo}
                onClose={() => setEligiendo(null)}
                title={eligiendo ? `${eligiendo.nombre} — elegí la variante` : 'Elegí la variante'}
                maxWidth={420}
            >
                {eligiendo && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {eligiendo.variants.map(v => (
                            <button
                                key={v.id}
                                onClick={() => agregarLinea(eligiendo.productId, eligiendo.nombre, v)}
                                className="nped-variant-row"
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
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12,
    border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)',
    cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
}
const inputBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8,
    fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
}
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const variantRow: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit',
}
const qtyBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }

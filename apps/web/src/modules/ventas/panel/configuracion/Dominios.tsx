// src/modules/ventas/panel/configuracion/Dominios.tsx — Vista "Dominios"
//
// Vincular un dominio propio (LINKED, real — habla con la API de Vercel del
// lado del backend, ver domains.service.ts/vercel-domains.service.ts) o
// comprar uno nuevo (PURCHASED, TAMBIÉN real — Vercel es su propio
// registrador, ver domain-purchase.service.ts: cotiza en vivo, cobra por
// Mercado Pago con margen ANTES de comprar de verdad contra Vercel, y el
// dominio comprado se vincula solo — a diferencia de LINKED, acá no hace
// falta que el dueño cargue DNS a mano en otro lado).
//
// Mismo patrón de carga/errores que Suscripcion.tsx (la otra vista "propia"
// del módulo, sin snapshot de "cambios sin guardar" porque acá cada acción
// es su propia mutación, no un formulario con botón Guardar).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Globe, Copy, Check, RefreshCw, Trash2, ShoppingBag, Link2, Loader2, AlertCircle } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Modal } from '@/design-system/components/Modal'
import {
    ApiError, panelListDomains, panelLinkDomain, panelGetDnsInstructions,
    panelVerifyDomainDns, panelRemoveDomain,
    panelSearchDomainPurchase, panelCheckoutDomainPurchase, panelGetDomainPurchaseOrder,
    type ApiDomain, type ApiDnsRecord, type ApiDomainSearchResult, type DomainPurchaseContact, type ApiDomainPurchaseOrder,
} from '@/lib/api'

const fmtArs = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ESTADO_META: Record<ApiDomain['status'], { label: string; color: string; bg: string }> = {
    PENDING:   { label: 'Pendiente',   color: 'var(--color-muted)',   bg: 'var(--color-surface-alt)' },
    VERIFYING: { label: 'Verificando', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
    ACTIVE:    { label: 'Activo',      color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    SUSPENDED: { label: 'Suspendido',  color: 'var(--color-error)',   bg: 'var(--color-error-bg)' },
    EXPIRED:   { label: 'Vencido',     color: 'var(--color-error)',   bg: 'var(--color-error-bg)' },
}

const SSL_META: Record<ApiDomain['sslStatus'], { label: string; color: string }> = {
    PROVISIONING: { label: 'SSL: emitiendo certificado', color: 'var(--color-muted)' },
    ACTIVE:       { label: 'SSL: activo', color: 'var(--color-success)' },
    FAILED:       { label: 'SSL: falló', color: 'var(--color-error)' },
}

function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
    return (
        <span style={{ fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 9999, padding: bg ? '3px 10px' : 0 }}>
            {label}
        </span>
    )
}

function CopyField({ value }: { value: string }) {
    const [copiado, setCopiado] = useState(false)
    return (
        <button
            type="button"
            className="ds-hover"
            onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontFamily: '"Geist Mono", "Fira Code", monospace', fontSize: 12.5,
                color: copiado ? 'var(--color-success)' : 'var(--color-body)',
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                borderRadius: 6, padding: '4px 8px',
            }}
        >
            {value} {copiado ? <Check size={12} /> : <Copy size={12} />}
        </button>
    )
}

function DnsRecordsTable({ records }: { records: ApiDnsRecord[] }) {
    if (records.length === 0) return null
    return (
        <div style={{ marginTop: 10, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8, padding: '8px 12px', background: 'var(--color-surface-alt)', fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase' }}>
                <span>Tipo</span><span>Nombre</span><span>Valor</span>
            </div>
            {records.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{r.type}</span>
                    <CopyField value={r.domain} />
                    <CopyField value={r.value} />
                </div>
            ))}
        </div>
    )
}

function DomainRow({ d, onChange }: { d: ApiDomain; onChange: () => void }) {
    const [records, setRecords] = useState<ApiDnsRecord[] | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [modalBorrar, setModalBorrar] = useState(false)

    async function toggleRecords() {
        if (records) { setRecords(null); return }
        setBusy('records')
        setError(null)
        try {
            const r = await panelGetDnsInstructions(d.id)
            setRecords(r.records)
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudieron traer los registros DNS')
        } finally {
            setBusy(null)
        }
    }

    async function verificar() {
        setBusy('verify')
        setError(null)
        try {
            await panelVerifyDomainDns(d.id)
            onChange()
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo verificar el DNS')
        } finally {
            setBusy(null)
        }
    }

    async function confirmarBorrar() {
        setModalBorrar(false)
        setBusy('remove')
        setError(null)
        try {
            await panelRemoveDomain(d.id)
            onChange()
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo quitar el dominio')
            setBusy(null)
        }
    }

    const estado = ESTADO_META[d.status]
    const ssl = SSL_META[d.sslStatus]

    return (
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Globe size={16} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{d.domain}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                            <Badge label={estado.label} color={estado.color} bg={estado.bg} />
                            <span style={{ fontSize: 11.5, color: ssl.color }}>{ssl.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>{d.source === 'LINKED' ? 'Vinculado' : 'Comprado'}</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {d.status !== 'ACTIVE' && d.source === 'LINKED' && (
                        <Button size="sm" variant="secondary" loading={busy === 'records'} onClick={toggleRecords}>
                            {records ? 'Ocultar DNS' : 'Ver registros DNS'}
                        </Button>
                    )}
                    {d.status !== 'ACTIVE' && (
                        <Button size="sm" variant="outline" loading={busy === 'verify'} onClick={verificar}>
                            <RefreshCw size={13} strokeWidth={2.2} /> Verificar
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" loading={busy === 'remove'} onClick={() => setModalBorrar(true)} style={{ color: 'var(--color-error)' }}>
                        <Trash2 size={13} strokeWidth={2.2} />
                    </Button>
                </div>
            </div>
            {records && <DnsRecordsTable records={records} />}
            {error && <div style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 8 }}>{error}</div>}

            <Modal
                isOpen={modalBorrar}
                onClose={() => setModalBorrar(false)}
                title="¿Quitar este dominio?"
                variant="danger"
                footer={<>
                    <Button variant="secondary" onClick={() => setModalBorrar(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={confirmarBorrar}>Sí, quitar</Button>
                </>}
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    <strong>{d.domain}</strong> deja de apuntar a tu tienda en Órbita. El dominio en sí no se pierde (seguís siendo su dueño), solo se desvincula.
                </div>
            </Modal>
        </div>
    )
}

export default function Dominios() {
    const [domains, setDomains] = useState<ApiDomain[] | null>(null)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)

    const [nuevoLink, setNuevoLink] = useState('')
    const [linkBusy, setLinkBusy] = useState(false)
    const [linkError, setLinkError] = useState<string | null>(null)
    const [linkInstrucciones, setLinkInstrucciones] = useState<{ domain: string; records: ApiDnsRecord[] } | null>(null)

    const router = useRouter()

    // Cotización en vivo — debounce (mismo criterio que el buscador del
    // header del storefront), no cobra ni compra nada, solo consulta a
    // Vercel disponibilidad + precio.
    const [nuevoCompra, setNuevoCompra] = useState('')
    const [buscando, setBuscando] = useState(false)
    const [resultados, setResultados] = useState<ApiDomainSearchResult[] | null>(null)
    const [compraError, setCompraError] = useState<string | null>(null)

    // Formulario de contacto (WHOIS) — se abre al tocar "Comprar" sobre un
    // resultado disponible de la lista de arriba.
    const [seleccionado, setSeleccionado] = useState<ApiDomainSearchResult | null>(null)
    const [modalContacto, setModalContacto] = useState(false)
    const [contacto, setContacto] = useState<DomainPurchaseContact>({
        firstName: '', lastName: '', email: '', phone: '', address1: '', city: '', state: '', zip: '', country: 'AR',
    })
    const [checkoutBusy, setCheckoutBusy] = useState(false)

    // Vuelta de Mercado Pago — la pantalla queda sondeando el pedido hasta
    // que el webhook lo termine (COMPLETED/FAILED), mismo patrón que
    // Confirmacion.tsx del storefront con el pedido del comprador.
    const [pedidoEnCurso, setPedidoEnCurso] = useState<ApiDomainPurchaseOrder | null>(null)

    function cargar() {
        setCargando(true)
        panelListDomains()
            .then(setDomains)
            .catch(e => setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar los dominios'))
            .finally(() => setCargando(false))
    }
    useEffect(cargar, [])

    async function vincular() {
        const domain = nuevoLink.trim().toLowerCase()
        if (!domain) return
        setLinkBusy(true)
        setLinkError(null)
        setLinkInstrucciones(null)
        try {
            const created = await panelLinkDomain(domain)
            setNuevoLink('')
            cargar()
            if (created.status !== 'ACTIVE') {
                const info = await panelGetDnsInstructions(created.id)
                setLinkInstrucciones({ domain: info.domain, records: info.records })
            }
        } catch (e) {
            setLinkError(e instanceof ApiError ? e.message : 'No se pudo vincular el dominio')
        } finally {
            setLinkBusy(false)
        }
    }

    // Busca mientras se escribe — mismo criterio de debounce que el
    // buscador del header del storefront (StorefrontHeader.tsx): 300ms sin
    // tipear, cancelable si el texto cambia antes de que responda. Un
    // nombre sin TLD ("lenteslindos") trae variantes (.com/.store/etc — el
    // dueño no tiene por qué saber qué TLDs existen); un dominio completo
    // con TLD trae solo ese.
    useEffect(() => {
        const query = nuevoCompra.trim().toLowerCase()
        if (query.length < 2) { setResultados(null); setBuscando(false); return }
        let cancelado = false
        setBuscando(true)
        setCompraError(null)
        const t = setTimeout(() => {
            panelSearchDomainPurchase(query)
                .then(r => { if (!cancelado) setResultados(r) })
                .catch(e => { if (!cancelado) { setCompraError(e instanceof ApiError ? e.message : 'No se pudo buscar el dominio'); setResultados(null) } })
                .finally(() => { if (!cancelado) setBuscando(false) })
        }, 300)
        return () => { cancelado = true; clearTimeout(t) }
    }, [nuevoCompra])

    // Vuelta de Mercado Pago (?domainOrder=<id> en la URL) — arranca el
    // sondeo del pedido. Se limpia el query param apenas se captura, mismo
    // criterio que Inicio.tsx con la vuelta del login de Google.
    useEffect(() => {
        if (!router.isReady) return
        const { domainOrder, ...resto } = router.query
        if (typeof domainOrder !== 'string' || !domainOrder) return
        panelGetDomainPurchaseOrder(domainOrder).then(setPedidoEnCurso).catch(() => {})
        router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady])

    // Sondeo cada 3s mientras el pedido no terminó — el webhook de MP puede
    // tardar en procesar, mismo patrón que Confirmacion.tsx del storefront.
    useEffect(() => {
        if (!pedidoEnCurso || pedidoEnCurso.status === 'COMPLETED' || pedidoEnCurso.status === 'FAILED') return
        const t = setTimeout(() => {
            panelGetDomainPurchaseOrder(pedidoEnCurso.id).then(setPedidoEnCurso).catch(() => {})
        }, 3000)
        return () => clearTimeout(t)
    }, [pedidoEnCurso])

    useEffect(() => {
        if (pedidoEnCurso?.status === 'COMPLETED') cargar()
    }, [pedidoEnCurso?.status])

    function abrirContacto(resultado: ApiDomainSearchResult) {
        setSeleccionado(resultado)
        setModalContacto(true)
    }

    function setCampoContacto<K extends keyof DomainPurchaseContact>(campo: K, valor: string) {
        setContacto(c => ({ ...c, [campo]: valor }))
    }

    const contactoCompleto = Object.values(contacto).every(v => v.trim() !== '')

    async function confirmarCompra() {
        if (!seleccionado?.available || !contactoCompleto || checkoutBusy) return
        setCheckoutBusy(true)
        setCompraError(null)
        try {
            // Sin el orderId acá — el backend lo agrega a este mismo returnUrl
            // recién cuando crea el pedido (ver domain-purchase.service.ts),
            // el frontend no lo conoce todavía en este punto.
            const returnUrl = `${window.location.origin}${window.location.pathname}`
            const { initPoint } = await panelCheckoutDomainPurchase(seleccionado.domain, contacto, returnUrl)
            if (!initPoint) throw new Error('Mercado Pago no devolvió un link de pago')
            window.location.href = initPoint
        } catch (e) {
            setCompraError(e instanceof ApiError ? e.message : 'No se pudo iniciar el pago')
            setCheckoutBusy(false)
        }
    }

    return (
        <div className="panel-page panel-page--form">
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>Dominios</h1>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>Usá tu propio dominio (ej: tutienda.com) en vez del subdominio de Órbita.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Lista de dominios */}
                <Card padding="md">
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Tus dominios</div>
                    {cargando ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            <SkeletonText width="60%" height={16} />
                            <SkeletonText width="40%" height={12} />
                        </div>
                    ) : errorCarga ? (
                        <div style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 8 }}>{errorCarga}</div>
                    ) : !domains || domains.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8 }}>Todavía no tenés ningún dominio propio vinculado — usás el subdominio de Órbita.</div>
                    ) : (
                        <div style={{ marginTop: 6 }}>
                            {domains.map(d => <DomainRow key={d.id} d={d} onChange={cargar} />)}
                        </div>
                    )}
                </Card>

                {/* Vincular dominio existente — el camino real para tefaltacalleok.com */}
                <Card padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <Link2 size={16} strokeWidth={2} color="var(--color-primary)" />
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Vincular un dominio que ya tenés</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 12 }}>
                        Si ya compraste tu dominio en otro lado (ej: Hostinger, GoDaddy, NIC), lo cargás acá y te damos los registros DNS para apuntarlo a tu tienda.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={nuevoLink}
                            onChange={e => setNuevoLink(e.target.value)}
                            placeholder="tudominio.com"
                            style={{ flex: 1, height: 38, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 13.5, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                        />
                        <Button variant="primary" loading={linkBusy} disabled={!nuevoLink.trim()} onClick={vincular}>Vincular</Button>
                    </div>
                    {linkError && <div style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 8 }}>{linkError}</div>}
                    {linkInstrucciones && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12.5, color: 'var(--color-body)' }}>
                                Cargá estos registros en el panel de DNS de <strong>{linkInstrucciones.domain}</strong> (donde lo compraste). Puede tardar unos minutos u horas en propagar — después tocá &quot;Verificar&quot; arriba.
                            </div>
                            <DnsRecordsTable records={linkInstrucciones.records} />
                        </div>
                    )}
                </Card>

                {/* Pedido de compra en curso — vuelta de Mercado Pago, sondeando
                    hasta que el webhook lo termine. */}
                {pedidoEnCurso && (
                    <Card padding="md" style={{
                        borderColor: pedidoEnCurso.status === 'FAILED' ? 'var(--color-error)' : pedidoEnCurso.status === 'COMPLETED' ? 'var(--color-success)' : undefined,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {pedidoEnCurso.status === 'COMPLETED' ? (
                                <Check size={18} strokeWidth={2.5} color="var(--color-success)" style={{ flexShrink: 0 }} />
                            ) : pedidoEnCurso.status === 'FAILED' ? (
                                <AlertCircle size={18} strokeWidth={2} color="var(--color-error)" style={{ flexShrink: 0 }} />
                            ) : (
                                <Loader2 size={18} strokeWidth={2} style={{ flexShrink: 0, animation: 'orbita-spin 1s linear infinite' }} />
                            )}
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{pedidoEnCurso.domain}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>
                                    {pedidoEnCurso.status === 'PENDING_PAYMENT' && 'Esperando confirmación del pago…'}
                                    {pedidoEnCurso.status === 'PAID' && 'Pago confirmado, comprando el dominio…'}
                                    {pedidoEnCurso.status === 'COMPLETED' && 'Dominio comprado y vinculado a tu tienda.'}
                                    {pedidoEnCurso.status === 'FAILED' && `No se pudo completar la compra${pedidoEnCurso.failReason ? `: ${pedidoEnCurso.failReason}` : ''} — se reembolsó el pago.`}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Comprar dominio nuevo — real: Vercel es su propio registrador. */}
                <Card padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <ShoppingBag size={16} strokeWidth={2} color="var(--color-muted)" />
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Comprar un dominio nuevo</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 12 }}>
                        Escribí el nombre que quieras (ej: <em>lenteslindos</em>) y te mostramos qué terminaciones están disponibles — no hace falta que sepas de antemano qué dominios existen.
                    </div>
                    <input
                        value={nuevoCompra}
                        onChange={e => setNuevoCompra(e.target.value)}
                        placeholder="lenteslindos"
                        style={{ width: '100%', boxSizing: 'border-box', height: 38, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 13.5, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit', marginBottom: 10 }}
                    />
                    {compraError && <div style={{ fontSize: 12.5, color: 'var(--color-error)', marginBottom: 8 }}>{compraError}</div>}
                    {buscando && <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Buscando…</div>}
                    {!buscando && resultados && (
                        resultados.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Ese nombre no parece un dominio válido.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {resultados.map(r => (
                                    <div key={r.domain} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                                        padding: '10px 4px', borderTop: '1px solid var(--color-border)',
                                        opacity: r.available ? 1 : 0.5,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            {r.available ? <Check size={14} strokeWidth={2.5} color="var(--color-success)" style={{ flexShrink: 0 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
                                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.domain}</span>
                                        </div>
                                        {r.available ? (
                                            r.priceCharged != null ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 12.5, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtArs(r.priceCharged)}/año</span>
                                                    <Button size="sm" variant="primary" onClick={() => abrirContacto(r)}>Comprar</Button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11.5, color: 'var(--color-subtle)', flexShrink: 0 }}>Sin precio disponible</span>
                                            )
                                        ) : (
                                            <span style={{ fontSize: 11.5, color: 'var(--color-subtle)', flexShrink: 0 }}>No disponible</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* .com.ar/.ar — confirmado que Vercel NO los soporta
                        (tld_not_supported, probado en vivo). Se gestionan a
                        mano (NIC Argentina + vincular acá, que ya funciona)
                        — este aviso evita que alguien busque "algo.com.ar"
                        y se quede sin saber por qué nunca aparece en la
                        lista de arriba. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 11.5, color: 'var(--color-subtle)', flexWrap: 'wrap' }}>
                        <span>¿Necesitás un <strong style={{ color: 'var(--color-muted)' }}>.com.ar</strong>? No lo vendemos automático ($ 8.500/año) — lo gestionamos por vos.</span>
                        <button
                            type="button"
                            className="ds-link"
                            onClick={() => router.push({ query: { ...router.query, vista: 'soporte', categoria: 'DOMINIO' } })}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Contactar soporte →
                        </button>
                    </div>
                </Card>
            </div>

            {/* Formulario de contacto (WHOIS) — titular del dominio ante Vercel */}
            <Modal
                isOpen={modalContacto}
                onClose={() => !checkoutBusy && setModalContacto(false)}
                title={`Comprar ${seleccionado?.domain ?? ''}`}
                footer={<>
                    <Button variant="secondary" onClick={() => setModalContacto(false)} disabled={checkoutBusy}>Cancelar</Button>
                    <Button variant="primary" loading={checkoutBusy} disabled={!contactoCompleto} onClick={confirmarCompra}>
                        Ir a pagar {seleccionado?.priceCharged != null ? fmtArs(seleccionado.priceCharged) : ''}
                    </Button>
                </>}
            >
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    Datos del titular del dominio (WHOIS) — los pide el registrador, no se muestran públicamente en la tienda.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <ContactoInput label="Nombre" value={contacto.firstName} onChange={v => setCampoContacto('firstName', v)} />
                    <ContactoInput label="Apellido" value={contacto.lastName} onChange={v => setCampoContacto('lastName', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <ContactoInput label="Email" value={contacto.email} onChange={v => setCampoContacto('email', v)} type="email" />
                    <ContactoInput label="Teléfono" value={contacto.phone} onChange={v => setCampoContacto('phone', v)} placeholder="+5491122334455" />
                </div>
                <div style={{ marginBottom: 10 }}>
                    <ContactoInput label="Dirección" value={contacto.address1} onChange={v => setCampoContacto('address1', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
                    <ContactoInput label="Ciudad" value={contacto.city} onChange={v => setCampoContacto('city', v)} />
                    <ContactoInput label="Provincia" value={contacto.state} onChange={v => setCampoContacto('state', v)} />
                    <ContactoInput label="CP" value={contacto.zip} onChange={v => setCampoContacto('zip', v)} />
                </div>
            </Modal>
        </div>
    )
}

function ContactoInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <label style={{ display: 'block' }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ width: '100%', boxSizing: 'border-box', height: 36, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 10px', fontSize: 13, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
            />
        </label>
    )
}


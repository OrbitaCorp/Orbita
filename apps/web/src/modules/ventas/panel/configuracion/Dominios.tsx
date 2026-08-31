// src/modules/ventas/panel/configuracion/Dominios.tsx — Vista "Dominios"
//
// Vincular un dominio propio (LINKED, real — habla con la API de Vercel del
// lado del backend, ver domains.service.ts/vercel-domains.service.ts) o
// comprar uno nuevo (PURCHASED, todavía MOCK: no hay integración de
// registrador conectada — el botón deja constancia del pedido pero no cobra
// ni compra nada real, se lo dejamos clarísimo al dueño acá mismo).
//
// Mismo patrón de carga/errores que Suscripcion.tsx (la otra vista "propia"
// del módulo, sin snapshot de "cambios sin guardar" porque acá cada acción
// es su propia mutación, no un formulario con botón Guardar).

import { useEffect, useState } from 'react'
import { Globe, Copy, Check, RefreshCw, Trash2, ShoppingBag, Link2 } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Modal } from '@/design-system/components/Modal'
import {
    ApiError, panelListDomains, panelLinkDomain, panelGetDnsInstructions,
    panelVerifyDomainDns, panelRemoveDomain, panelPurchaseDomain,
    type ApiDomain, type ApiDnsRecord,
} from '@/lib/api'

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

    const [nuevoCompra, setNuevoCompra] = useState('')
    const [compraBusy, setCompraBusy] = useState(false)
    const [compraMsg, setCompraMsg] = useState<string | null>(null)
    const [compraError, setCompraError] = useState<string | null>(null)

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

    async function comprar() {
        const domain = nuevoCompra.trim().toLowerCase()
        if (!domain) return
        setCompraBusy(true)
        setCompraError(null)
        setCompraMsg(null)
        try {
            const r = await panelPurchaseDomain(domain)
            setCompraMsg(r.message)
            setNuevoCompra('')
            cargar()
        } catch (e) {
            setCompraError(e instanceof ApiError ? e.message : 'No se pudo registrar el pedido')
        } finally {
            setCompraBusy(false)
        }
    }

    return (
        <div style={pageWrap}>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>Dominios</h1>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>Usá tu propio dominio (ej: tutienda.com) en vez del subdominio de Órbita.</div>

            <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 16 }}>

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

                {/* Comprar dominio nuevo — mock, sin registrador conectado */}
                <Card padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <ShoppingBag size={16} strokeWidth={2} color="var(--color-muted)" />
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Comprar un dominio nuevo</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-warning)', marginBottom: 12, padding: '8px 12px', background: 'var(--color-warning-bg)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)' }}>
                        Todavía no procesamos la compra de forma automática. Dejá el dominio que querés y te contactamos para completarla a mano — no se te cobra nada acá.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={nuevoCompra}
                            onChange={e => setNuevoCompra(e.target.value)}
                            placeholder="tudominio.com"
                            style={{ flex: 1, height: 38, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 13.5, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                        />
                        <Button variant="secondary" loading={compraBusy} disabled={!nuevoCompra.trim()} onClick={comprar}>Pedir compra</Button>
                    </div>
                    {compraError && <div style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 8 }}>{compraError}</div>}
                    {compraMsg && <div style={{ fontSize: 12.5, color: 'var(--color-success)', marginTop: 8 }}>{compraMsg}</div>}
                </Card>
            </div>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }

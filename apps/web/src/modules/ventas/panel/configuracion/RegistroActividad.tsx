// src/modules/ventas/panel/configuracion/RegistroActividad.tsx — Vista "Registro de actividad"
//
// Hallazgo `auditoria-sin-pantalla` de la auditoría interna. Desde el 10/09
// las acciones sensibles del panel quedan en `audit_logs` (audit.service.ts) y
// GET /audit-logs ya responde con el permiso `config.audit.view`, pero el
// dueño no tenía dónde verlas: el registro existía y no se podía leer.
//
// Solo lectura, como el endpoint: el registro no se edita ni se borra desde
// ningún lado (la única excepción es la purga por antigüedad del cron,
// retencion-logs.service.ts). Por eso no hay acciones por fila.
//
// Filtros: los mismos tres que acepta el backend (tipo de cosa, persona y
// rango de fechas) — se mandan como query y la paginación la hace el servidor,
// no se traen todos los registros para filtrar en el navegador.
//
// Mismo esqueleto que Dominios.tsx / Equipo.tsx: panel-page--form, Card,
// tabla con las clases compartidas ds-tabla/ds-tabla-fila (en celular cada
// fila se convierte sola en tarjeta, ver globals.css).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Filter, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError, panelListAuditLogs, getMembers,
    type ApiAuditLog, type ApiAuditAction, type ApiMember,
} from '@/lib/api'

const POR_PAGINA = 25

// Las etiquetas de acción del registro. El enum del backend (AuditAction) es
// cerrado: si aparece uno nuevo, se ve el código crudo en vez de romper.
const ACCION: Record<ApiAuditAction, { label: string; fg: string; bg: string }> = {
    CREATE:     { label: 'Creó',      fg: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    UPDATE:     { label: 'Editó',     fg: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
    ACTIVATE:   { label: 'Activó',    fg: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    DEACTIVATE: { label: 'Desactivó', fg: 'var(--chip-warning-fg)', bg: 'var(--color-warning-bg)' },
    DELETE:     { label: 'Borró',     fg: 'var(--color-error)',   bg: 'var(--color-error-bg)' },
}

// Los `entityType` que hoy escribe el backend, en castellano. La lista sale de
// los registrar() de apps/api/src (audit.service.ts es quien los define): si se
// suma uno nuevo allá, hay que sumarlo acá — mientras tanto se muestra el
// código tal cual y el filtro sigue funcionando por el select "Todo".
const TIPO: Record<string, string> = {
    branch: 'Sucursal',
    business: 'Datos del negocio',
    cancellation: 'Cancelación',
    category: 'Categoría',
    coupon: 'Cupón',
    credit_note: 'Nota de crédito',
    customer: 'Cliente',
    customer_email: 'Mail a clientes',
    customer_export: 'Exportación de clientes',
    discount: 'Descuento',
    domain: 'Dominio',
    inventory: 'Inventario',
    member: 'Miembro del equipo',
    mp_credentials: 'Credenciales de Mercado Pago',
    order_export: 'Exportación de pedidos',
    product: 'Producto',
    return: 'Devolución',
    role: 'Rol',
    subscription: 'Suscripción',
    tag: 'Etiqueta',
}

const TIPOS_ORDENADOS = Object.entries(TIPO).sort((a, b) => a[1].localeCompare(b[1], 'es'))

const nombreTipo = (t: string) => TIPO[t] ?? t

// hour12: false a propósito — con "a. m."/"p. m." la fecha no entraba en la
// columna y cada fila se partía en dos renglones.
const fechaLarga = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

/** Un valor del `changes` como texto corto y legible. */
function comoTexto(v: unknown): string {
    if (v === null || v === undefined || v === '') return '(vacío)'
    if (typeof v === 'boolean') return v ? 'sí' : 'no'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
}

const ESTILO_CAMPO: React.CSSProperties = {
    height: 36, borderRadius: 8, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: 13, fontFamily: 'inherit', padding: '0 10px', minWidth: 0,
}

const COLS = '132px 110px 1fr 170px 44px'

function FilaRegistro({ log, ultima }: { log: ApiAuditLog; ultima: boolean }) {
    const [abierto, setAbierto] = useState(false)
    const cambios = log.changes ?? []
    const accion = ACCION[log.action] ?? { label: log.action, fg: 'var(--color-body)', bg: 'var(--color-surface-alt)' }

    return (
        <div style={{ borderBottom: ultima ? 'none' : '1px solid var(--color-border)' }}>
            <div className="ds-tabla-fila" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '10px 16px', minHeight: 56 }}>
                <span data-col="Fecha" style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fechaLarga(log.createdAt)}</span>
                <span data-col="Acción">
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, background: accion.bg, color: accion.fg }}>
                        {accion.label}
                    </span>
                </span>
                <div data-col="Qué" data-principal data-largo style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>{nombreTipo(log.entityType)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entityId}</div>
                </div>
                <span data-col="Quién" style={{ fontSize: 12.5, color: log.memberName ? 'var(--color-body)' : 'var(--color-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.memberName ?? 'Automático'}
                </span>
                <div data-col="" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {cambios.length > 0 && (
                        <button
                            type="button"
                            className="ds-hover"
                            onClick={() => setAbierto(v => !v)}
                            aria-expanded={abierto}
                            aria-label={abierto ? 'Ocultar los cambios' : `Ver los ${cambios.length} cambios`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 30, minWidth: 44, justifyContent: 'center', padding: '0 8px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-body)', fontSize: 12, fontFamily: 'inherit' }}
                        >
                            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {cambios.length}
                        </button>
                    )}
                </div>
            </div>

            {abierto && cambios.length > 0 && (
                <div style={{ padding: '2px 16px 12px 16px', background: 'var(--color-surface-alt)' }}>
                    {cambios.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '4px 0', fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.field}</span>
                            <span style={{ color: 'var(--color-subtle)', textDecoration: 'line-through' }}>{comoTexto(c.before)}</span>
                            <span style={{ color: 'var(--color-subtle)' }}>→</span>
                            <span style={{ color: 'var(--color-body)' }}>{comoTexto(c.after)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function RegistroActividad() {
    const { user } = useAuth()
    const puedeVer = user?.type === 'member' && user.permissions.includes('config.audit.view')

    const [tipo, setTipo] = useState('')
    const [memberId, setMemberId] = useState('')
    const [desde, setDesde] = useState('')
    const [hasta, setHasta] = useState('')
    const [pagina, setPagina] = useState(1)

    const [logs, setLogs] = useState<ApiAuditLog[] | null>(null)
    const [total, setTotal] = useState(0)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [miembros, setMiembros] = useState<ApiMember[]>([])

    const hayFiltro = Boolean(tipo || memberId || desde || hasta)

    const cargar = useCallback(async () => {
        setCargando(true)
        setError(null)
        try {
            const r = await panelListAuditLogs({
                page: pagina,
                limit: POR_PAGINA,
                entityType: tipo || undefined,
                memberId: memberId || undefined,
                // El input date da "2026-09-16" y el backend espera ISO 8601:
                // desde arranca a las 00:00 y hasta termina a las 23:59:59, si
                // no un rango de un solo día no devolvía nada.
                from: desde ? new Date(`${desde}T00:00:00`).toISOString() : undefined,
                to: hasta ? new Date(`${hasta}T23:59:59.999`).toISOString() : undefined,
            })
            setLogs(r.data)
            setTotal(r.total)
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo traer el registro de actividad')
            setLogs([])
            setTotal(0)
        } finally {
            setCargando(false)
        }
    }, [pagina, tipo, memberId, desde, hasta])

    useEffect(() => { if (puedeVer) void cargar() }, [puedeVer, cargar])

    // El filtro por persona necesita la lista del equipo. Si el miembro no
    // puede verla, el filtro no aparece y el resto de la pantalla funciona
    // igual — no es un error.
    useEffect(() => {
        if (!puedeVer) return
        getMembers().then(setMiembros).catch(() => setMiembros([]))
    }, [puedeVer])

    // Cambiar un filtro vuelve a la página 1: si no, se pedía la página 7 de
    // un resultado que ahora tiene 2 y la tabla salía vacía.
    function cambiarFiltro(set: (v: string) => void) {
        return (v: string) => { set(v); setPagina(1) }
    }

    function limpiar() {
        setTipo(''); setMemberId(''); setDesde(''); setHasta(''); setPagina(1)
    }

    const paginas = useMemo(() => Math.max(1, Math.ceil(total / POR_PAGINA)), [total])
    const desdeFila = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
    const hastaFila = Math.min(pagina * POR_PAGINA, total)

    if (!puedeVer) {
        return (
            <div className="panel-page panel-page--form">
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>Registro de actividad</h1>
                <Card padding="md">
                    <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        No tenés permiso para ver el registro de actividad. Pedile a quien administre el negocio el permiso “Ver auditoría”.
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="panel-page panel-page--form">
            <style>{`
                @media (max-width: 768px) {
                    .ra-filtros { grid-template-columns: 1fr !important; }
                    .ra-paginacion { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
                    .ra-paginacion > div { justify-content: space-between !important; }
                }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 4px' }}>
                <History size={20} style={{ color: 'var(--color-primary)' }} />
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Registro de actividad</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>
                Quién hizo qué en tu negocio: cambios de precios y productos, altas y bajas del equipo, descuentos, dominios y exportaciones. No se puede editar ni borrar.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card padding="md">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Filter size={15} style={{ color: 'var(--color-muted)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Filtros</span>
                        {hayFiltro && (
                            <button
                                type="button"
                                className="ds-hover"
                                onClick={limpiar}
                                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-body)', fontSize: 12, fontFamily: 'inherit' }}
                            >
                                <X size={12} /> Limpiar
                            </button>
                        )}
                    </div>

                    <div className="ra-filtros" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body)' }}>Tipo</span>
                            <select className="ds-field" style={ESTILO_CAMPO} value={tipo} onChange={e => cambiarFiltro(setTipo)(e.target.value)}>
                                <option value="">Todo</option>
                                {TIPOS_ORDENADOS.map(([codigo, label]) => (
                                    <option key={codigo} value={codigo}>{label}</option>
                                ))}
                            </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body)' }}>Persona</span>
                            <select className="ds-field" style={ESTILO_CAMPO} value={memberId} onChange={e => cambiarFiltro(setMemberId)(e.target.value)} disabled={miembros.length === 0}>
                                <option value="">Todo el equipo</option>
                                {miembros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body)' }}>Desde</span>
                            <input type="date" className="ds-field" style={ESTILO_CAMPO} value={desde} max={hasta || undefined} onChange={e => cambiarFiltro(setDesde)(e.target.value)} />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-body)' }}>Hasta</span>
                            <input type="date" className="ds-field" style={ESTILO_CAMPO} value={hasta} min={desde || undefined} onChange={e => cambiarFiltro(setHasta)(e.target.value)} />
                        </label>
                    </div>
                </Card>

                {cargando && logs === null ? (
                    <Card padding="md">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <SkeletonText width="40%" height={14} />
                            <SkeletonText width="70%" height={14} />
                            <SkeletonText width="55%" height={14} />
                        </div>
                    </Card>
                ) : error ? (
                    <Card padding="md">
                        <div style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</div>
                        <div style={{ marginTop: 10 }}><Button variant="outline" size="sm" onClick={() => void cargar()}>Reintentar</Button></div>
                    </Card>
                ) : (logs?.length ?? 0) === 0 ? (
                    <Card padding="md">
                        <div style={{ textAlign: 'center', padding: '18px 0' }}>
                            <History size={26} style={{ color: 'var(--color-subtle)' }} />
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>
                                {hayFiltro ? 'No hay actividad con esos filtros' : 'Todavía no hay actividad registrada'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, maxWidth: '60ch', marginInline: 'auto', lineHeight: 1.6 }}>
                                {hayFiltro
                                    ? 'Probá con un rango de fechas más amplio o sacá algún filtro.'
                                    : 'Apenas alguien del equipo cambie un precio, edite un producto o toque la configuración, va a aparecer acá.'}
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div
                        className="ds-tabla"
                        aria-busy={cargando}
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflowX: 'auto', position: 'relative', opacity: cargando ? 0.45 : 1, pointerEvents: cargando ? 'none' : 'auto', transition: 'opacity 180ms ease' }}
                    >
                        <div className="ds-tabla-min" style={{ minWidth: 760 }}>
                            <div className="ds-tabla-head" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 10, padding: '0 16px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <span>Fecha</span><span>Acción</span><span>Qué</span><span>Quién</span><span />
                            </div>
                            {logs!.map((log, i) => (
                                <FilaRegistro key={log.id} log={log} ultima={i === logs!.length - 1} />
                            ))}
                        </div>

                        <div className="ra-paginacion" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                                {desdeFila}–{hastaFila} de {total}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</Button>
                                <span style={{ fontSize: 12, color: 'var(--color-body)', fontFamily: '"Geist Mono", monospace' }}>{pagina} / {paginas}</span>
                                <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina(p => Math.min(paginas, p + 1))}>Siguiente</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

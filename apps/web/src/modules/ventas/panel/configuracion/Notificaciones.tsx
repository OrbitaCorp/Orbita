// src/modules/ventas/panel/configuracion/Notificaciones.tsx — Vista 18
//
// (Fase 4 — Ale) La matriz evento × canal se lee y se guarda de verdad contra
// GET/PUT /business/notification-config — que es exactamente lo que consume
// el motor de notificaciones de Alan (misma fase, coordinado): él genera los
// avisos y respeta lo que acá se configura.
//
// 19/08 — Dos cambios pedidos por el equipo:
//   1. Chau WhatsApp. El canal nunca entregó un aviso de verdad (el despacho
//      del backend era un stub que solo logueaba): tener el toggle prometía
//      algo que el producto no hace. Quedan Panel y Email.
//   2. Rediseño. Antes era una grilla pelada de nueve filas iguales; ahora los
//      avisos van agrupados por tema, cada canal se explica arriba con su
//      tarjeta, y cada fila tiene su ícono para que se lea de un vistazo.

import { useEffect, useMemo, useState } from 'react'
import {
    Bell, Mail, ShoppingBag, XCircle, PackageX, RotateCcw, Ban,
    CreditCard, UserPlus, Sun, CalendarDays, Check,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import type { VistaConfig } from './components/ConfigTabs'
import { Toggle } from './components/ConfigControls'
import {
    ApiError, panelGetNotificationConfig, panelUpdateNotificationConfig,
    type ApiNotificationMatrix,
} from '@/lib/api'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
type Canal = 'panel' | 'email'

// Los eventos que valida el backend (businesses.service.ts), agrupados por
// tema: "qué pasó con una venta", "qué pasó con el stock", "los resúmenes".
// Sin los grupos eran nueve filas indistinguibles una de otra.
const GRUPOS: { titulo: string; desc: string; eventos: { key: string; label: string; desc: string; Icon: IconType }[] }[] = [
    {
        titulo: 'Ventas',
        desc: 'Lo que pasa con tus pedidos y tus cobros',
        eventos: [
            { key: 'nuevo_pedido',       label: 'Nuevo pedido',        desc: 'Cada vez que entra un pedido nuevo',                 Icon: ShoppingBag },
            { key: 'pago_confirmado',    label: 'Pago confirmado',     desc: 'Se acreditó un pago que estaba pendiente',           Icon: CreditCard },
            { key: 'pedido_cancelado',   label: 'Pedido cancelado',    desc: 'Un pedido se canceló',                               Icon: XCircle },
            { key: 'cancelacion_pedida', label: 'Cancelación pedida',  desc: 'Un cliente pidió cancelar un pedido ya confirmado',  Icon: Ban },
            { key: 'devolucion',         label: 'Devolución',          desc: 'Un cliente inició una devolución',                   Icon: RotateCcw },
        ],
    },
    {
        titulo: 'Stock y clientes',
        desc: 'Avisos para que no se te escape nada',
        eventos: [
            { key: 'stock_critico', label: 'Stock crítico', desc: 'Un producto llegó a su stock mínimo', Icon: PackageX },
            { key: 'cliente_nuevo', label: 'Cliente nuevo', desc: 'Se registró un cliente nuevo',        Icon: UserPlus },
        ],
    },
    {
        titulo: 'Resúmenes',
        desc: 'Los números, sin que tengas que entrar a buscarlos',
        eventos: [
            { key: 'resumen_diario',  label: 'Resumen diario',  desc: 'Cómo cerró el día, todas las noches', Icon: Sun },
            { key: 'reporte_semanal', label: 'Reporte semanal', desc: 'Los números de la semana, los lunes', Icon: CalendarDays },
        ],
    },
]

const EVENTOS = GRUPOS.flatMap(g => g.eventos)

// Los dos canales vivos. WhatsApp se sacó (ver cabecera del archivo).
const CANALES: { key: Canal; label: string; desc: string; Icon: IconType; color: string }[] = [
    { key: 'panel', label: 'En el panel', desc: 'Aparece en la campanita, arriba a la derecha', Icon: Bell, color: 'var(--color-primary)' },
    { key: 'email', label: 'Por email',   desc: 'Te llega al correo de tu cuenta y al de tu equipo', Icon: Mail, color: 'var(--color-success)' },
]

const matrizVacia = (): ApiNotificationMatrix =>
    Object.fromEntries(EVENTOS.map(e => [e.key, { panel: true, email: false }]))

export default function Notificaciones({ ir }: { ir: (v: VistaConfig) => void }) {
    void ir
    const [matriz, setMatriz]         = useState<ApiNotificationMatrix>(matrizVacia)
    const [original, setOriginal]     = useState<string>('')
    const [cargando, setCargando]     = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [reintento, setReintento]   = useState(0)
    const [guardando, setGuardando]   = useState(false)
    const [toast, setToast]           = useState<{ variant: 'success' | 'error'; msg: string } | null>(null)

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        panelGetNotificationConfig()
            .then(r => {
                if (cancelado) return
                // Se completa con los defaults cualquier evento que falte en lo
                // guardado (negocios viejos, eventos agregados después) y se
                // descarta la clave `whatsapp` que puedan tener las matrices
                // viejas: el canal ya no existe.
                const completa = limpiar({ ...matrizVacia(), ...r.matrix })
                setMatriz(completa)
                setOriginal(JSON.stringify(completa))
                setErrorCarga(null)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar las preferencias') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const hayCambios = useMemo(() => original !== '' && JSON.stringify(matriz) !== original, [matriz, original])

    const cambiar = (evento: string, canal: Canal, on: boolean) => {
        setMatriz(m => ({ ...m, [evento]: { ...m[evento], [canal]: on } }))
    }

    // Prende o apaga una columna entera — con nueve eventos, ir uno por uno
    // para "quiero todo por email" era tedioso.
    const cambiarColumna = (canal: Canal, on: boolean) => {
        setMatriz(m => Object.fromEntries(
            EVENTOS.map(e => [e.key, { ...m[e.key], [canal]: on }]),
        ) as ApiNotificationMatrix)
    }

    const activos = (canal: Canal) => EVENTOS.filter(e => matriz[e.key]?.[canal]).length

    const guardar = async () => {
        if (guardando || !hayCambios) return
        setGuardando(true)
        try {
            const r = await panelUpdateNotificationConfig(matriz)
            const completa = limpiar({ ...matrizVacia(), ...r.matrix })
            setMatriz(completa)
            setOriginal(JSON.stringify(completa))
            setToast({ variant: 'success', msg: 'Preferencias guardadas' })
        } catch (e) {
            setToast({ variant: 'error', msg: e instanceof ApiError ? e.message : 'No se pudieron guardar las preferencias' })
        } finally {
            setGuardando(false)
        }
    }

    const COLS = '1fr 92px 92px'

    return (
        <div className="notif-page panel-page panel-page--form">
            <style>{`
                @media (max-width: 640px) {
                    .notif-canales { grid-template-columns: minmax(0,1fr) !important; }
                }
                @media (max-width: 768px) {
                    .notif-head    { align-items: stretch !important; }
                    .notif-head h1 { font-size: 21px !important; }
                    .notif-head > button { width: 100% !important; }
                    /* La matriz aviso x canal apilada (ds-tabla en globals.css)
                       deja el aviso arriba y los dos toggles abajo, cada uno
                       con su etiqueta. Los toggles van a la derecha, no
                       centrados como en la columna de escritorio. */
                    .notif-fila > [data-col]:not([data-principal]) > div { place-items: end !important; }
                    /* El aviso (icono + nombre + explicacion) ocupa el renglon
                       entero y arranca pegado al icono: si no, el nombre queda
                       colgado a la derecha, lejos de su propia descripcion. */
                    .notif-fila > [data-principal] { justify-content: flex-start !important; gap: 10px !important; }
                    .notif-fila > [data-principal] > div:last-child { flex: 1 1 auto !important; min-width: 0 !important; }
                }
            `}</style>

            <div className="notif-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '0 0 20px' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Notificaciones</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Elegí qué avisos querés recibir y por dónde.</div>
                </div>
                <Button variant="primary" loading={guardando} disabled={!hayCambios || cargando} onClick={() => void guardar()}>Guardar cambios</Button>
            </div>

            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12, maxWidth: 820 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            {/* Los dos canales, explicados — antes eran dos palabras sueltas en
                un encabezado de tabla y no se entendía a dónde llegaba cada
                aviso. De paso, cada tarjeta prende o apaga su columna entera. */}
            <div className="notif-canales" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {CANALES.map(c => {
                    const n = activos(c.key)
                    const todos = n === EVENTOS.length
                    return (
                        <Card key={c.key} padding="sm">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', background: c.key === 'panel' ? 'var(--color-primary-bg)' : 'var(--color-success-bg)' }}>
                                    <c.Icon size={17} strokeWidth={1.8} color={c.color} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{c.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.45 }}>{c.desc}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                                        <span style={{ fontSize: 11.5, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace' }}>
                                            {cargando && original === '' ? '-' : `${n} de ${EVENTOS.length}`}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={cargando && original === ''}
                                            onClick={() => cambiarColumna(c.key, !todos)}
                                            className="ds-link"
                                            style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}
                                        >
                                            {todos ? 'Apagar todos' : 'Activar todos'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>

            {/* La matriz, agrupada por tema */}
            <Card className="ds-tabla" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="ds-tabla-head" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 8, padding: '11px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={enc}>Aviso</span>
                    {CANALES.map(c => <span key={c.key} style={{ ...enc, textAlign: 'center' }}>{c.key === 'panel' ? 'Panel' : 'Email'}</span>)}
                </div>

                {cargando && original === '' ? (
                    <div aria-hidden="true">
                        {EVENTOS.map((_, i) => (
                            <div key={i} className="ds-tabla-fila" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 8, padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                    <Skeleton width={30} height={30} radius={8} delay={i * 70} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <SkeletonText width={`${[38, 44, 32, 46, 36, 34, 40, 42, 37][i]}%`} height={12} delay={i * 70} />
                                        <SkeletonText width="62%" height={9} delay={i * 70 + 40} />
                                    </div>
                                </div>
                                {[0, 1].map(j => (
                                    <div key={j} style={{ display: 'grid', placeItems: 'center' }}>
                                        <Skeleton width={36} height={20} radius={9999} delay={i * 70 + j * 30} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    GRUPOS.map(g => (
                        <div key={g.titulo}>
                            <div style={{ padding: '12px 20px 9px', background: 'var(--color-surface-alt)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{g.titulo}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 1 }}>{g.desc}</div>
                            </div>
                            {g.eventos.map((e, i) => {
                                const apagado = !matriz[e.key]?.panel && !matriz[e.key]?.email
                                return (
                                    <div
                                        key={e.key}
                                        className="ds-tabla-fila notif-fila"
                                        style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', transition: 'opacity 160ms' }}
                                    >
                                        <div data-col="Aviso" data-principal style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, opacity: apagado ? 0.55 : 1 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-surface-alt)' }}>
                                                <e.Icon size={14.5} strokeWidth={1.8} color="var(--color-muted)" />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>{e.label}</div>
                                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{e.desc}</div>
                                            </div>
                                        </div>
                                        {CANALES.map(c => (
                                            <div key={c.key} data-col={c.key === 'panel' ? 'Panel' : 'Email'} style={{ display: 'grid', placeItems: 'center' }}>
                                                <Toggle on={matriz[e.key]?.[c.key] ?? false} onChange={(v: boolean) => cambiar(e.key, c.key, v)} />
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    ))
                )}
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-muted)', marginTop: 12 }}>
                <Check size={13} strokeWidth={2.2} color="var(--color-success)" />
                <span>Los avisos por email les llegan a vos y a todo tu equipo activo.</span>
            </div>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toast.variant} title={toast.msg} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// Saca la clave `whatsapp` de las matrices guardadas antes de que el canal se
// diera de baja: si la dejáramos, el "¿hay cambios?" comparando JSON marcaría
// diferencia sola apenas se toca cualquier toggle.
function limpiar(m: ApiNotificationMatrix): ApiNotificationMatrix {
    return Object.fromEntries(
        Object.entries(m).map(([k, v]) => [k, { panel: !!v?.panel, email: !!v?.email }]),
    ) as ApiNotificationMatrix
}

const enc: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }

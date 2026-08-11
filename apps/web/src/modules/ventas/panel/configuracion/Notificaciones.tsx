// src/modules/ventas/panel/configuracion/Notificaciones.tsx — Vista 18
//
// (Fase 4 — Ale) Antes los toggles eran de mentira. Ahora la matriz
// evento × canal se lee y se guarda de verdad contra
// GET/PUT /business/notification-config — que es exactamente lo que consume
// el motor de notificaciones de Alan (misma fase, coordinado): él genera los
// avisos y respeta lo que acá se configura.
//
// La pantalla muestra una fila por evento con sus tres canales (panel, email,
// WhatsApp). Se guarda con el botón "Guardar cambios" (no en cada toggle) y
// el toast de "Preferencias guardadas" sale abajo, como en el resto del panel.

import { useEffect, useMemo, useState } from 'react'
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

// Los eventos que valida el backend (businesses.service.ts) con su etiqueta.
const EVENTOS: { key: string; label: string; desc: string }[] = [
    { key: 'nuevo_pedido',     label: 'Nuevo pedido',      desc: 'Cada vez que entra un pedido nuevo' },
    { key: 'pedido_cancelado', label: 'Pedido cancelado',  desc: 'Cuando un pedido se cancela' },
    { key: 'stock_critico',    label: 'Stock crítico',     desc: 'Un producto llegó a su stock mínimo' },
    { key: 'devolucion',       label: 'Devolución',        desc: 'Un cliente inició una devolución' },
    { key: 'pago_confirmado',  label: 'Pago confirmado',   desc: 'Se acreditó un pago pendiente' },
    { key: 'cliente_nuevo',    label: 'Cliente nuevo',     desc: 'Se registró un cliente nuevo' },
    { key: 'resumen_diario',   label: 'Resumen diario',    desc: 'El resumen del día, todas las noches' },
    { key: 'reporte_semanal',  label: 'Reporte semanal',   desc: 'Los números de la semana, los lunes' },
]

const CANALES: { key: 'panel' | 'email' | 'whatsapp'; label: string }[] = [
    { key: 'panel',    label: 'Panel' },
    { key: 'email',    label: 'Email' },
    { key: 'whatsapp', label: 'WhatsApp' },
]

const matrizVacia = (): ApiNotificationMatrix =>
    Object.fromEntries(EVENTOS.map(e => [e.key, { panel: true, email: false, whatsapp: false }]))

export default function Notificaciones({ ir }: { ir: (v: VistaConfig) => void }) {
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
                // guardado (negocios viejos, eventos agregados después).
                const completa = { ...matrizVacia(), ...r.matrix }
                setMatriz(completa)
                setOriginal(JSON.stringify(completa))
                setErrorCarga(null)
            })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudieron cargar las preferencias') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [reintento])

    const hayCambios = useMemo(() => original !== '' && JSON.stringify(matriz) !== original, [matriz, original])

    const cambiar = (evento: string, canal: 'panel' | 'email' | 'whatsapp', on: boolean) => {
        setMatriz(m => ({ ...m, [evento]: { ...m[evento], [canal]: on } }))
    }

    const guardar = async () => {
        if (guardando || !hayCambios) return
        setGuardando(true)
        try {
            const r = await panelUpdateNotificationConfig(matriz)
            const completa = { ...matrizVacia(), ...r.matrix }
            setMatriz(completa)
            setOriginal(JSON.stringify(completa))
            setToast({ variant: 'success', msg: 'Preferencias guardadas' })
        } catch (e) {
            setToast({ variant: 'error', msg: e instanceof ApiError ? e.message : 'No se pudieron guardar las preferencias' })
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '0 0 20px' }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Notificaciones</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Elegí qué avisos recibir y por dónde.</div>
                </div>
                <Button variant="primary" loading={guardando} disabled={!hayCambios || cargando} onClick={() => void guardar()}>Guardar cambios</Button>
            </div>

            {errorCarga && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 12, maxWidth: 760 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorCarga}</span>
                    <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                </div>
            )}

            <Card style={{ maxWidth: 760, padding: 0 }}>
                {/* Encabezado de la matriz */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 88px)', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '12px 12px 0 0' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Evento</span>
                    {CANALES.map(c => (
                        <span key={c.key} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>{c.label}</span>
                    ))}
                </div>

                {cargando && original === '' ? (
                    /* Silueta de la matriz: una fila por evento con sus tres toggles */
                    <div aria-hidden="true">
                        {EVENTOS.map((_, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 88px)', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: i < EVENTOS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <SkeletonText width={`${[38, 44, 32, 36, 42, 34, 40, 46][i]}%`} height={12} delay={i * 70} />
                                    <SkeletonText width="60%" height={9} delay={i * 70 + 40} />
                                </div>
                                {[0, 1, 2].map(j => (
                                    <div key={j} style={{ display: 'grid', placeItems: 'center' }}>
                                        <Skeleton width={36} height={20} radius={9999} delay={i * 70 + j * 30} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    EVENTOS.map((e, i) => (
                        <div key={e.key} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 88px)', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: i < EVENTOS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>{e.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{e.desc}</div>
                            </div>
                            {CANALES.map(c => (
                                <div key={c.key} style={{ display: 'grid', placeItems: 'center' }}>
                                    <Toggle on={matriz[e.key]?.[c.key] ?? false} onChange={(v: boolean) => cambiar(e.key, c.key, v)} />
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </Card>

            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 12, maxWidth: 760 }}>
                Los avisos por WhatsApp llegan al número configurado en <button onClick={() => ir('general')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Configuración general</button>.
            </div>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toast.variant} title={toast.msg} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }

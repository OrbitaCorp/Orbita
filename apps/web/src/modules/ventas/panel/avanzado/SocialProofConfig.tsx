// src/modules/ventas/panel/avanzado/SocialProofConfig.tsx — Configuración de
// "Prueba social" (paquete Avanzado).
//
// Mitad construida de la tarjeta "Countdown y prueba social" de Avanzado.tsx
// (countdown de ofertas y exit-intent quedan pendientes de una fase futura).
// A propósito, esta pantalla NO tiene campos de texto como PromoModalConfig:
// el contenido de cada notificación sale siempre de un pedido real de la
// tienda — nunca se inventa una venta. Por eso la única config real es
// prender/apagar y de qué lado de la pantalla aparece; el resto de la
// pantalla es el preview de los pedidos reales que se mostrarían.

import { useEffect, useState } from 'react'
import { ArrowLeft, ShoppingBag, Info } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle } from '../configuracion/components/ConfigControls'
import {
    ApiError, panelGetSocialProof, panelUpsertSocialProof, panelPreviewSocialProof,
    type ApiSocialProofEvent,
} from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { currentSlug, tenantUrl } from '@/lib/tenant'

type Posicion = 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'

function relativo(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 1) return 'recién'
    if (min < 60) return `hace ${min} min`
    const hs = Math.floor(min / 60)
    if (hs < 24) return `hace ${hs} ${hs === 1 ? 'hora' : 'horas'}`
    const dias = Math.floor(hs / 24)
    return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export default function SocialProofConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const [activo, setActivo] = useState(false)
    const [posicion, setPosicion] = useState<Posicion>('BOTTOM_LEFT')
    const [original, setOriginal] = useState('')

    const [preview, setPreview] = useState<ApiSocialProofEvent[] | null>(null)

    useEffect(() => {
        let cancelado = false
        Promise.all([panelGetSocialProof(), panelPreviewSocialProof()])
            .then(([cfg, eventos]) => {
                if (cancelado) return
                const a = cfg?.isActive ?? false
                const p = cfg?.position ?? 'BOTTOM_LEFT'
                setActivo(a)
                setPosicion(p)
                setOriginal(JSON.stringify({ isActive: a, position: p }))
                setPreview(eventos)
            })
            .catch(e => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración'))
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const slug = currentSlug()
    const tiendaUrl = slug ? tenantUrl(slug, '/') : null

    const hayCambios = original !== '' && JSON.stringify({ isActive: activo, position: posicion }) !== original

    async function guardar() {
        if (!hayCambios || guardando) return
        setGuardando(true)
        try {
            const res = await panelUpsertSocialProof({ isActive: activo, position: posicion })
            setActivo(res.isActive)
            setPosicion(res.position)
            setOriginal(JSON.stringify({ isActive: res.isActive, position: res.position }))
            setToast('Configuración guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <style>{`
                @media (max-width: 900px) {
                    .social-proof-cols { grid-template-columns: 1fr !important; }
                }
            `}</style>
            <button onClick={onVolver} style={volverBtn}>
                <ArrowLeft size={14} strokeWidth={2} /> Avanzado
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <ShoppingBag size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Prueba social</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>
                Una notificación tipo &ldquo;Fulano compró tal producto&rdquo; que va apareciendo sola en tu tienda, armada siempre con pedidos reales — nunca con datos inventados.
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md">
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                </Card>
            ) : (
                <div className="social-proof-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
                    {/* ── Columna principal: la config ── */}
                    <Card padding="md">
                        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: 18 }}>
                            <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                No hay nada que redactar acá: cada notificación sale de un pedido confirmado real de los últimos 7 días (nombre de pila + inicial del apellido, y qué compró). Si no tenés pedidos recientes, no se muestra nada — nunca se inventa una venta.
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 20px' }}>
                            <Toggle on={activo} onChange={setActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Prueba social activa</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, la notificación va rotando en cualquier página de tu tienda.</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>Dónde aparece</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            {([['BOTTOM_LEFT', 'Abajo a la izquierda'], ['BOTTOM_RIGHT', 'Abajo a la derecha']] as const).map(([val, label]) => {
                                const sel = posicion === val
                                return (
                                    <button
                                        key={val} type="button" onClick={() => setPosicion(val)}
                                        style={{
                                            height: 38, padding: '0 14px', borderRadius: 8,
                                            border: `1.5px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                            background: sel ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                            color: sel ? 'var(--color-primary)' : 'var(--color-body)',
                                            fontSize: 12.5, fontWeight: sel ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginBottom: 18 }}>
                            &ldquo;Abajo a la derecha&rdquo; deja lugar arriba del botón de WhatsApp, si lo tenés activado — no se superponen.
                        </div>

                        <DirtyHint show={hayCambios} />
                        <Button variant="primary" loading={guardando} disabled={!hayCambios} onClick={guardar}>Guardar</Button>
                    </Card>

                    {/* ── Sidebar: preview con pedidos reales ── */}
                    <Card padding="md">
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Lo que se mostraría ahora</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 14 }}>
                            Pedidos reales de los últimos 7 días — se actualiza solo, no hace falta guardar para verlo.
                        </div>
                        {!preview || preview.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-subtle)', lineHeight: 1.5, padding: '8px 0' }}>
                                Todavía no tenés pedidos recientes para mostrar. En cuanto entre una venta nueva, va a aparecer acá y en tu tienda.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {preview.slice(0, 6).map(ev => (
                                    <div key={ev.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'grid', placeItems: 'center' }}>
                                            <ShoppingBag size={12} strokeWidth={1.8} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.4 }}>
                                                <strong>{ev.firstName}{ev.lastInitial ? ` ${ev.lastInitial}.` : ''}</strong> compró <span style={{ color: 'var(--color-muted)' }}>{ev.productName}</span>
                                            </div>
                                            <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', marginTop: 1 }}>{relativo(ev.occurredAt)}</div>
                                        </div>
                                    </div>
                                ))}
                                {preview.length > 6 && (
                                    <div style={{ fontSize: 11, color: 'var(--color-subtle)' }}>+ {preview.length - 6} más</div>
                                )}
                            </div>
                        )}
                        {tiendaUrl && (
                            <a href={tiendaUrl} target="_blank" rel="noreferrer" style={linkVerTienda}>
                                Ver en tu tienda →
                            </a>
                        )}
                    </Card>
                </div>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// Mismo patrón que PromoModalConfig.tsx#DirtyHint.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const volverBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0,
    fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit',
}
const linkVerTienda: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
    color: 'var(--color-primary)', textDecoration: 'none', marginTop: 16,
}

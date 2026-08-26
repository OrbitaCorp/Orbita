// src/modules/ventas/panel/avanzado/Avanzado.tsx — Módulo "Avanzado"
//
// Shell del paquete de funcionalidades pagas aparte de la suscripción mensual
// (Fase 1 del plan — ver plan aprobado). Todavía no hay contenido real detrás
// de ninguna de las 4 secciones (eso son las Fases 2-4: juegos, plantillas de
// Home, modales/countdown/exit-intent/prueba social) — este módulo hoy solo:
//
//   1. Lee GET /business/addons (panelGetAddons) para saber si el negocio
//      tiene el add-on "ADVANCED" activo.
//   2. Si lo tiene: cada card queda desbloqueada, con un botón que por ahora
//      lleva a un placeholder "Próximamente en esta fase" (no hay pantalla de
//      configuración real todavía para ninguna sección).
//   3. Si NO lo tiene: cada card se ve bloqueada (overlay + candado) y el
//      botón lleva a Configuración → Suscripción, donde está el upsell real.
//
// El gate de verdad (que nadie pueda ENTRAR a un endpoint de estas features
// sin el add-on aunque le fuerce la URL) vive en el backend, en AddonGuard —
// esto es solo la vidriera.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
    Sparkles, Trophy, MessageSquareText, LayoutTemplate, Timer, Lock, ArrowRight, Crown,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { Modal } from '@/design-system/components/Modal'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ApiError, panelGetAddons } from '@/lib/api'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>

interface Feature { key: string; label: string; desc: string; Icon: IconType }

const FEATURES: Feature[] = [
    {
        key: 'juegos', label: 'Juegos con premio', Icon: Trophy,
        desc: 'Mini-juegos de habilidad (encestar, meter un gol, etc.) — vos definís cuánto descuento se gana por acierto y el tope. El descuento se crea solo, sin tocar el módulo de Descuentos.',
    },
    {
        key: 'modales', label: 'Modales de anuncios', Icon: MessageSquareText,
        desc: 'Promos 2x1, bienvenida con descuento y anuncios que aparecen en el momento justo del storefront.',
    },
    {
        key: 'plantillas', label: 'Plantillas de Home', Icon: LayoutTemplate,
        desc: 'Diseños alternativos solo para la portada de tu tienda — el resto del storefront (catálogo, checkout, perfil) queda igual.',
    },
    {
        key: 'countdown', label: 'Countdown y prueba social', Icon: Timer,
        desc: 'Cuenta regresiva de ofertas, aviso de exit-intent y notificaciones tipo "Alguien acaba de comprar esto".',
    },
]

export default function Avanzado() {
    const router = useRouter()
    const [advanced, setAdvanced] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [proximamente, setProximamente] = useState<Feature | null>(null)

    useEffect(() => {
        let cancelado = false
        panelGetAddons()
            .then(r => { if (!cancelado) setAdvanced(r.advanced) })
            .catch(e => { if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo verificar tu plan') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    const irASuscripcion = () => {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
    }

    return (
        <div style={pageWrap}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <Sparkles size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Avanzado</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px', maxWidth: 640 }}>
                Funcionalidades pagas aparte de tu suscripción: juegos con premio, modales de anuncios, plantillas de Home y más.
            </div>

            {errorCarga && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, maxWidth: 820, fontSize: 13, color: 'var(--color-error)' }}>
                    {errorCarga}
                </div>
            )}

            {!cargando && !advanced && !errorCarga && (
                <Card padding="md" style={{ marginBottom: 20, maxWidth: 820, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
                    <Crown size={22} strokeWidth={1.8} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Todavía no tenés el paquete Avanzado</div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>Activalo para desbloquear todo lo de acá abajo.</div>
                    </div>
                    <Button variant="primary" size="sm" onClick={irASuscripcion}>Ver qué incluye</Button>
                </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxWidth: 1000 }}>
                {cargando ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} padding="md">
                            <Skeleton width={36} height={36} radius={9} delay={i * 70} />
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <SkeletonText width="55%" height={14} delay={i * 70 + 40} />
                                <SkeletonText width="90%" height={11} delay={i * 70 + 80} />
                                <SkeletonText width="70%" height={11} delay={i * 70 + 100} />
                            </div>
                        </Card>
                    ))
                ) : (
                    FEATURES.map(f => (
                        <Card key={f.key} padding="md" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ opacity: advanced ? 1 : 0.45, filter: advanced ? 'none' : 'blur(1.5px)', transition: 'opacity 160ms, filter 160ms' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--color-surface-alt)' }}>
                                    <f.Icon size={17} strokeWidth={1.8} color="var(--color-muted)" />
                                </div>
                                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 12 }}>{f.label}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5, minHeight: 52 }}>{f.desc}</div>
                            </div>

                            {advanced ? (
                                <Button variant="secondary" size="sm" style={{ marginTop: 14, width: '100%' }} onClick={() => setProximamente(f)}>
                                    Configurar
                                </Button>
                            ) : (
                                <div
                                    style={{
                                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16,
                                        background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)',
                                    }}
                                >
                                    <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}>
                                        <Lock size={15} strokeWidth={1.8} color="var(--color-muted)" />
                                    </div>
                                    <Button variant="primary" size="sm" icon={<ArrowRight size={14} strokeWidth={2} />} onClick={irASuscripcion}>
                                        Ver qué incluye
                                    </Button>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>

            {proximamente && (
                <Modal isOpen onClose={() => setProximamente(null)} title={proximamente.label}>
                    <div style={{ padding: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                            <proximamente.Icon size={20} strokeWidth={1.8} color="var(--color-primary)" />
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>
                            La configuración de <strong>{proximamente.label.toLowerCase()}</strong> todavía está en construcción — ya tenés el paquete Avanzado activo, así que apenas esté lista la vas a ver acá mismo, sin tener que hacer nada de tu lado.
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setProximamente(null)}>Entendido</Button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }

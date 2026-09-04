// src/modules/ventas/panel/avanzado/Avanzado.tsx — Módulo "Avanzado"
//
// Shell del paquete de funcionalidades pagas aparte de la suscripción mensual
// (Fase 1 del plan — ver plan aprobado). "Juegos con premio" (Fase 2.1),
// "Modales de anuncios", "2x1 y 3x2" (RBT-675, ver TwoForOneConfig.tsx),
// "Plantillas de Home" y "Prueba social" ya tienen pantalla de configuración
// real (ver CON_PANTALLA y el `if (vista === ...)` más abajo) — falta la
// mitad "Countdown y exit-intent" de la última tarjeta (quedó dividida en
// dos: Prueba social ya construida, Countdown pendiente de una fase futura,
// ver comentario en SocialProofConfig.tsx):
//
//   1. Lee GET /business/addons (panelGetAddons) para saber si el negocio
//      tiene el add-on "ADVANCED" activo.
//   2. Si lo tiene: cada card queda desbloqueada. Las que están en
//      CON_PANTALLA llevan a su configuración real; el resto, a un
//      placeholder "Próximamente en esta fase".
//   3. Si NO lo tiene: cada card se ve bloqueada (overlay + candado) y el
//      botón lleva a Configuración → Suscripción, donde está el upsell real.
//
// El gate de verdad (que nadie pueda ENTRAR a un endpoint de estas features
// sin el add-on aunque le fuerce la URL) vive en el backend, en AddonGuard —
// esto es solo la vidriera.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
    Sparkles, Trophy, MessageSquareText, LayoutTemplate, Timer, ShoppingBag, Lock, ArrowRight, Crown, Tag,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { Modal } from '@/design-system/components/Modal'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ApiError, panelGetAddons } from '@/lib/api'
import JuegosConfig from './JuegosConfig'
import PromoModalConfig from './PromoModalConfig'
import TwoForOneConfig from './TwoForOneConfig'
import PlantillasConfig from './plantillas/PlantillasConfig'
import SocialProofConfig from './SocialProofConfig'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>

// `accent` — un color propio por feature (en vez del gris uniforme de
// antes) para que la grilla se lea de un vistazo, mismo criterio que otras
// grillas de "tarjetas de función" ya usadas en el diseño del panel.
interface Feature { key: string; label: string; desc: string; Icon: IconType; accent: string }

const FEATURES: Feature[] = [
    {
        key: 'juegos', label: 'Juegos con premio', Icon: Trophy, accent: '#7C3AED',
        desc: 'Mini-juegos de habilidad (encestar, meter un gol, etc.): vos definís cuánto descuento se gana por acierto y el tope. El descuento se crea solo, sin tocar el módulo de Descuentos.',
    },
    {
        key: 'modales', label: 'Modales de anuncios', Icon: MessageSquareText, accent: '#2563EB',
        desc: 'Bienvenida con descuento y anuncios que aparecen en el momento justo del storefront.',
    },
    {
        key: 'dos-por-uno', label: '2x1 y 3x2', Icon: Tag, accent: '#DC2626',
        desc: 'Promo "llevá X, pagá Y" que se aplica sola en el carrito — sin código — y muestra un cartel en la card del producto.',
    },
    {
        key: 'plantillas', label: 'Plantillas de Home', Icon: LayoutTemplate, accent: '#DB2777',
        desc: 'Diseños alternativos solo para la portada de tu tienda. El resto del storefront (catálogo, checkout, perfil) queda igual.',
    },
    {
        key: 'prueba-social', label: 'Prueba social', Icon: ShoppingBag, accent: '#059669',
        desc: 'Notificaciones tipo "Fulano compró tal producto" armadas con pedidos reales de tu tienda — nunca con datos inventados.',
    },
    {
        key: 'countdown', label: 'Countdown y exit-intent', Icon: Timer, accent: '#D97706',
        desc: 'Cuenta regresiva de ofertas con fecha límite y un aviso cuando alguien está por irse sin comprar.',
    },
]

// Features que ya tienen pantalla propia (las demás abren el modal de
// "próximamente"). Agregar una acá Y en el `if (vista === ...)` de abajo.
const CON_PANTALLA = ['juegos', 'modales', 'dos-por-uno', 'plantillas', 'prueba-social']

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

    // Sub-vista por feature (Fase 2.1: solo "juegos" tiene contenido real
    // todavía) — mismo patrón que DescuentosShell.tsx: query param `vista`
    // dentro de este mismo módulo, sin ruta aparte en el componentMap.
    const vista = router.query.vista as string | undefined
    const irA = (vistaNueva: string) => router.push({ query: { ...router.query, vista: vistaNueva } })
    const volverAGrilla = () => {
        const { vista: _v, ...resto } = router.query
        router.push({ query: resto })
    }

    // Si el negocio no tiene el add-on, "juegos"/"modales" en la URL (a mano
    // o un link viejo) cae a la grilla de siempre en vez de mostrar un form
    // roto — el gate real de todos modos vive en el backend (AddonGuard).
    if (vista === 'juegos' && advanced) {
        return <JuegosConfig onVolver={volverAGrilla} />
    }
    if (vista === 'modales' && advanced) {
        return <PromoModalConfig onVolver={volverAGrilla} />
    }
    if (vista === 'dos-por-uno' && advanced) {
        return <TwoForOneConfig onVolver={volverAGrilla} />
    }
    if (vista === 'plantillas' && advanced) {
        return <PlantillasConfig onVolver={volverAGrilla} />
    }
    if (vista === 'prueba-social' && advanced) {
        return <SocialProofConfig onVolver={volverAGrilla} />
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18, maxWidth: 1080, alignItems: 'stretch' }}>
                {cargando ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} padding="md">
                            <Skeleton width={40} height={40} radius={11} delay={i * 70} />
                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <SkeletonText width="55%" height={14} delay={i * 70 + 40} />
                                <SkeletonText width="90%" height={11} delay={i * 70 + 80} />
                                <SkeletonText width="70%" height={11} delay={i * 70 + 100} />
                            </div>
                        </Card>
                    ))
                ) : (
                    FEATURES.map(f => (
                        <Card
                            key={f.key}
                            padding="md"
                            hoverable
                            style={{ position: 'relative', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ opacity: advanced ? 1 : 0.4, filter: advanced ? 'none' : 'blur(2px)', transition: 'opacity 160ms, filter 160ms', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center',
                                    background: `color-mix(in srgb, ${f.accent} 14%, transparent)`,
                                }}>
                                    <f.Icon size={19} strokeWidth={1.8} color={f.accent} />
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginTop: 14, letterSpacing: '-0.01em' }}>{f.label}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 5, lineHeight: 1.55, flex: 1 }}>{f.desc}</div>

                                {advanced && (
                                    <Button
                                        variant="outline" size="sm"
                                        icon={<ArrowRight size={13} strokeWidth={2.2} />}
                                        style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                                        onClick={() => CON_PANTALLA.includes(f.key) ? irA(f.key) : setProximamente(f)}
                                    >
                                        Configurar
                                    </Button>
                                )}
                            </div>

                            {!advanced && (
                                <div
                                    style={{
                                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20,
                                        background: 'color-mix(in srgb, var(--color-surface) 62%, transparent)',
                                        backdropFilter: 'blur(1px)',
                                    }}
                                >
                                    <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-surface)', boxShadow: 'var(--shadow-card-hover)', border: '1px solid var(--color-border)' }}>
                                        <Lock size={16} strokeWidth={1.8} color="var(--color-muted)" />
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

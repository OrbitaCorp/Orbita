// src/modules/ventas/cliente/juegos/JuegosIndex.tsx — listado de juegos
// activos de la tienda (solo se llega acá cuando hay MÁS DE UNO activo — con
// uno solo, Inicio.tsx enlaza directo; ver el banner ahí). Reusa TEMAS de
// JuegoTiro.tsx como única fuente de título/ícono, para que no se desalineen.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Gamepad2, ArrowRight } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Skeleton } from '@/design-system/components/Skeleton'
import {
    getStorefrontConfig, toTiendaConfig, getActiveGames,
    type StorefrontConfigResponse, type ActiveGame,
} from '@/lib/storefront/api'
import { TEMAS } from './JuegoTiro'

export default function JuegosIndex() {
    const router = useRouter()
    const { slug } = router.query as { slug: string }
    const base = `/tienda/${slug}`

    const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
    const [juegos, setJuegos] = useState<ActiveGame[] | null>(null)

    useEffect(() => {
        if (!slug) return
        let cancelado = false
        getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
        getActiveGames(slug).then(g => { if (!cancelado) setJuegos(g) }).catch(() => { if (!cancelado) setJuegos([]) })
        return () => { cancelado = true }
    }, [slug])
    const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
            <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

            <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 32px 64px' }}>
                <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Juegos con premio' }]} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 6px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                        <Gamepad2 size={19} strokeWidth={1.8} color="var(--color-primary)" />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>Juegos con premio</h1>
                </div>
                <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 24px' }}>Elegí uno y jugá — cada juego se juega una sola vez.</p>

                {juegos === null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
                        {[1, 2].map(i => <Skeleton key={i} width="100%" height={78} radius={14} delay={i * 60} />)}
                    </div>
                ) : juegos.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
                        No hay ningún juego activo en este momento.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {juegos.map(j => {
                            const tema = TEMAS[j.type] ?? TEMAS.HOOP
                            return (
                                <a
                                    key={j.type}
                                    href={`${base}/juegos/${j.type}`}
                                    onClick={e => { e.preventDefault(); router.push(`${base}/juegos/${j.type}`) }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 14,
                                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                        textDecoration: 'none', cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                                        <tema.Icon size={19} strokeWidth={1.8} color="var(--color-primary)" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{j.name || tema.titulo}</div>
                                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{tema.instrucciones}</div>
                                    </div>
                                    <ArrowRight size={16} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                                </a>
                            )
                        })}
                    </div>
                )}
            </div>

            <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
            <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
        </div>
    )
}

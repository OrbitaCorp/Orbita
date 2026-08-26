// src/modules/ventas/cliente/juegos/ReclamarPremio.tsx — landing de vuelta
// del login con Google (googleLoginUrl + returnTo, ver JuegoHoop.tsx), ya
// autenticado como cliente. Llama POST /storefront/:slug/games/claim y
// muestra el código — mismo patrón de "copiá el código" que
// DescuentoExclusivo.tsx (no auto-aplica al carrito, el cliente lo pega en
// el checkout).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { PartyPopper, Copy, Check, ArrowRight, AlertCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import {
    getStorefrontConfig, toTiendaConfig, claimGameSession,
    StorefrontApiError, type StorefrontConfigResponse,
} from '@/lib/storefront/api'

export default function ReclamarPremio() {
    const router = useRouter()
    const { slug, sessionId } = router.query as { slug: string; sessionId: string }
    const { status } = useAuth()

    const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
    useEffect(() => {
        if (!slug) return
        let cancelado = false
        getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
        return () => { cancelado = true }
    }, [slug])
    const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

    const [resultado, setResultado] = useState<{ code: string; discountPercent: number } | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [copiado, setCopiado] = useState(false)

    useEffect(() => {
        // Se espera a que useAuth() termine de resolver la sesión (el token
        // recién llega vía el exchange del login) antes de reclamar — si se
        // llama antes, la request sale sin Authorization y el backend la
        // rechaza pidiendo login, aunque la sesión esté por resolverse.
        if (!slug || !sessionId || status === 'loading') return
        if (status !== 'authenticated') {
            setErrorMsg('Necesitás iniciar sesión para reclamar tu premio.')
            return
        }
        let cancelado = false
        claimGameSession(slug, sessionId)
            .then(r => { if (!cancelado) setResultado(r) })
            .catch(e => { if (!cancelado) setErrorMsg(e instanceof StorefrontApiError ? e.message : 'No se pudo reclamar el premio.') })
        return () => { cancelado = true }
    }, [slug, sessionId, status])

    function copiar() {
        if (!resultado) return
        navigator.clipboard.writeText(resultado.code).catch(() => {})
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    const cargando = !errorMsg && !resultado

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
            <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

            <div style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {cargando && (
                    <div aria-hidden="true">
                        <SkeletonCircle size={72} style={{ margin: '0 auto 20px' }} />
                        <SkeletonText width={240} height={20} style={{ margin: '0 auto 10px' }} />
                        <SkeletonText width={180} height={12} style={{ margin: '0 auto' }} />
                    </div>
                )}

                {errorMsg && (
                    <>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-error-bg)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                            <AlertCircle size={28} strokeWidth={1.5} color="var(--color-error)" />
                        </div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>No se pudo reclamar</h1>
                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, maxWidth: 340 }}>{errorMsg}</p>
                    </>
                )}

                {resultado && (
                    <>
                        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                            <PartyPopper size={32} strokeWidth={1.5} color="var(--color-success)" />
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>¡Descuento reclamado!</h1>
                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 20px' }}>{resultado.discountPercent}% de descuento — usalo en tu próxima compra con este código:</p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 320, marginBottom: 24 }}>
                            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '0.04em' }}>
                                {resultado.code}
                            </div>
                            <button onClick={copiar} style={{ height: 44, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: copiado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                            </button>
                        </div>

                        <button
                            onClick={() => router.push(`/tienda/${slug}/catalogo`)}
                            style={{ height: 48, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        >
                            Ir de compras <ArrowRight size={16} />
                        </button>
                    </>
                )}
            </div>

            <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
            <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
        </div>
    )
}

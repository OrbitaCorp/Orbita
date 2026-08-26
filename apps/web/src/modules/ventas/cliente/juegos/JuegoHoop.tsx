// src/modules/ventas/cliente/juegos/JuegoHoop.tsx — "Encestar" (Fase 2.2 del
// paquete Avanzado). Único mecánica real hoy (type 'HOOP' en Game).
//
// Mecánica: un medidor oscila de 0 a 100 — hay que tocar "Tirar" cuando pasa
// por la zona verde. Acierto = +1 tiro (hasta el techo del juego); un fallo
// termina la sesión. Es de habilidad/timing, no de suerte — a diferencia de
// una ruleta, el jugador controla el resultado con el click.
//
// Modelo de confianza: la física corre 100% acá (cliente) — el backend NO
// reverifica el timing, solo cappea el resultado final contra el techo
// configurado (GamesPlayService#finishSession) y evita reclamos duplicados.
// Documentado así a propósito, ver el comentario del service.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Trophy, Target, PartyPopper } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { googleLoginUrl } from '@/lib/auth/authClient'
import {
    getStorefrontConfig, toTiendaConfig, startGameSession, finishGameSession,
    StorefrontApiError, type StorefrontConfigResponse, type GameStartResponse,
} from '@/lib/storefront/api'

const TIPO = 'HOOP'
// % del recorrido del medidor que cuenta como acierto — franja fija por
// ahora (se puede ajustar la dificultad más adelante, ej. angostarla en
// cada tiro sucesivo).
const ZONA: [number, number] = [38, 62]

function jugadoKey(slug: string) {
    return `orbita-juego-jugado:${slug}:${TIPO}`
}

type Fase = 'cargando' | 'ya_jugado' | 'no_disponible' | 'intro' | 'jugando' | 'resultado'

export default function JuegoHoop() {
    const router = useRouter()
    const { slug } = router.query as { slug: string }
    const { status, user } = useAuth()

    const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
    useEffect(() => {
        if (!slug) return
        let cancelado = false
        getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
        return () => { cancelado = true }
    }, [slug])
    const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

    const [fase, setFase] = useState<Fase>('cargando')
    const [sesion, setSesion] = useState<GameStartResponse | null>(null)
    const [intento, setIntento] = useState(0)
    const [historial, setHistorial] = useState<boolean[]>([])
    const [resultado, setResultado] = useState<{ status: string; discountPercent: number | null } | null>(null)
    const [errorMsg, setErrorMsg] = useState('')

    // "Ya jugaste" — chequeo del lado del cliente (ver comentario de arriba
    // sobre el modelo de confianza; el backend igual nunca deja terminar dos
    // veces la MISMA sesión, pero nada impide hoy arrancar una nueva desde
    // otro navegador/incógnito — aceptado a propósito, premio topeado).
    useEffect(() => {
        if (!slug) return
        setFase(typeof window !== 'undefined' && localStorage.getItem(jugadoKey(slug)) ? 'ya_jugado' : 'intro')
    }, [slug])

    async function arrancar() {
        if (!slug) return
        try {
            const s = await startGameSession(slug, TIPO)
            setSesion(s)
            setIntento(0)
            setHistorial([])
            setFase('jugando')
        } catch (e) {
            setErrorMsg(e instanceof StorefrontApiError ? e.message : 'Este juego no está disponible ahora mismo.')
            setFase('no_disponible')
        }
    }

    async function terminar(aciertos: number) {
        if (!slug || !sesion) return
        try { localStorage.setItem(jugadoKey(slug), '1') } catch { /* sin localStorage, sigue igual */ }
        try {
            const r = await finishGameSession(slug, sesion.sessionId, aciertos)
            setResultado(r)
            if (r.code) {
                // Ya estaba logueado como cliente — el backend reclamó de una,
                // sin pasar por Google. Guardamos el código para mostrarlo.
                setCodigoGanado(r.code)
            }
        } catch {
            setResultado({ status: 'LOST', discountPercent: null })
        }
        setFase('resultado')
    }

    const [codigoGanado, setCodigoGanado] = useState<string | null>(null)

    function onTiro(acierto: boolean) {
        const nuevoHistorial = [...historial, acierto]
        setHistorial(nuevoHistorial)
        if (!acierto) {
            void terminar(nuevoHistorial.filter(Boolean).length)
            return
        }
        const aciertos = nuevoHistorial.filter(Boolean).length
        if (sesion && aciertos >= sesion.maxAttempts) {
            void terminar(aciertos)
            return
        }
        setIntento(i => i + 1)
    }

    const returnTo = slug ? `/tienda/${slug}/juegos/reclamar?sessionId=${sesion?.sessionId ?? ''}` : undefined
    const yaLogueado = status === 'authenticated' && user?.type === 'customer'

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
            <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

            <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '48px 24px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                {fase === 'cargando' && (
                    <div style={{ width: '100%' }} aria-hidden="true">
                        <SkeletonText width="60%" height={22} style={{ margin: '0 auto 12px' }} />
                        <Skeleton width="100%" height={160} radius={16} />
                    </div>
                )}

                {fase === 'ya_jugado' && (
                    <>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-alt)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                            <Trophy size={28} strokeWidth={1.5} color="var(--color-muted)" />
                        </div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Ya jugaste este juego</h1>
                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, maxWidth: 360 }}>Solo se puede jugar una vez. Estate atento a nuevos juegos de {tienda.nombre || 'la tienda'}.</p>
                    </>
                )}

                {fase === 'no_disponible' && (
                    <>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>No disponible</h1>
                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>{errorMsg}</p>
                    </>
                )}

                {fase === 'intro' && (
                    <>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary-bg)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                            <Target size={28} strokeWidth={1.5} color="var(--color-primary)" />
                        </div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Encestá y ganá</h1>
                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 28px', maxWidth: 380, lineHeight: 1.6 }}>
                            Tocá &ldquo;Tirar&rdquo; justo cuando la barra pase por la zona verde. Cada acierto suma descuento — un fallo termina el juego. Se juega una sola vez.
                        </p>
                        <button onClick={arrancar} style={btnPrimario}>Jugar</button>
                    </>
                )}

                {fase === 'jugando' && sesion && (
                    <>
                        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 6 }}>
                            Tiro {intento + 1} — llevás {historial.filter(Boolean).length * sesion.percentPerWin}% asegurado
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                            {Array.from({ length: sesion.maxAttempts }).map((_, i) => (
                                <div key={i} style={{
                                    width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13,
                                    background: i < historial.length ? (historial[i] ? 'var(--color-success)' : 'var(--color-error)') : 'var(--color-surface-alt)',
                                    color: i < historial.length ? '#fff' : 'var(--color-subtle)',
                                    border: i === intento ? '2px solid var(--color-primary)' : 'none',
                                }}>
                                    {i < historial.length ? (historial[i] ? '✓' : '✕') : i + 1}
                                </div>
                            ))}
                        </div>
                        <Tiro key={intento} zona={ZONA} onResultado={onTiro} />
                    </>
                )}

                {fase === 'resultado' && resultado && (
                    <>
                        {resultado.discountPercent ? (
                            <>
                                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                                    <PartyPopper size={32} strokeWidth={1.5} color="var(--color-success)" />
                                </div>
                                <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>¡Ganaste {resultado.discountPercent}% de descuento!</h1>

                                {codigoGanado ? (
                                    <>
                                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 16px' }}>Ya se aplicó a tu cuenta — usá este código en el checkout:</p>
                                        <div style={{ padding: '10px 18px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', marginBottom: 20 }}>
                                            {codigoGanado}
                                        </div>
                                        <button onClick={() => router.push(`/tienda/${slug}/catalogo`)} style={btnPrimario}>Ir de compras</button>
                                    </>
                                ) : yaLogueado ? (
                                    <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Estamos aplicando tu premio…</p>
                                ) : (
                                    <>
                                        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 20px', maxWidth: 340, lineHeight: 1.6 }}>
                                            Iniciá sesión con Google para reclamarlo — queda atado a tu cuenta al toque.
                                        </p>
                                        <button
                                            onClick={() => { window.location.href = googleLoginUrl(slug, returnTo) }}
                                            style={btnGoogle}
                                        >
                                            <GoogleIcon /> Continuar con Google
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>No llegaste esta vez</h1>
                                <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, maxWidth: 340 }}>Gracias por jugar — estate atento a la próxima.</p>
                            </>
                        )}
                    </>
                )}
            </div>

            <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
            <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
        </div>
    )
}

// Un tiro individual — medidor oscilante + botón. Se remonta (key={intento})
// en cada intento nuevo, así el RAF/estado arranca limpio cada vez.
function Tiro({ zona, onResultado }: { zona: [number, number]; onResultado: (acierto: boolean) => void }) {
    const [valor, setValor] = useState(0)
    const rafRef = useRef<number | null>(null)
    const inicioRef = useRef<number | null>(null)
    const disparadoRef = useRef(false)

    useEffect(() => {
        function tick(t: number) {
            if (inicioRef.current === null) inicioRef.current = t
            const transcurrido = t - inicioRef.current
            setValor(50 + 50 * Math.sin(transcurrido / 260))
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
    }, [])

    function tirar() {
        if (disparadoRef.current) return
        disparadoRef.current = true
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        onResultado(valor >= zona[0] && valor <= zona[1])
    }

    return (
        <div style={{ width: '100%', maxWidth: 320 }}>
            <div style={{ position: 'relative', height: 32, borderRadius: 999, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ position: 'absolute', left: `${zona[0]}%`, width: `${zona[1] - zona[0]}%`, top: 0, bottom: 0, background: 'var(--color-success-bg)' }} />
                <div style={{ position: 'absolute', left: `${valor}%`, top: -2, bottom: -2, width: 4, borderRadius: 2, background: 'var(--color-primary)', transform: 'translateX(-50%)' }} />
            </div>
            <button onClick={tirar} style={btnPrimario}>Tirar</button>
        </div>
    )
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    )
}

const btnPrimario: React.CSSProperties = {
    width: '100%', height: 48, borderRadius: 10, background: 'var(--color-primary)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
}
const btnGoogle: React.CSSProperties = {
    width: '100%', maxWidth: 320, height: 46, borderRadius: 10,
    background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}

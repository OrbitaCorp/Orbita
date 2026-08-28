// src/modules/ventas/cliente/juegos/JuegoInline.tsx — mecánica genérica de
// "tiro con timing" (Fase 2.2 del paquete Avanzado), embebida DENTRO del
// modal de Inicio.tsx — no vive en una URL propia (pedido explícito del
// dueño 2026-08-27: "no quiero que exista esa URL, solamente quiero modal
// al entrar a la página"). Antes era una página completa
// (/tienda/[slug]/juegos/[type], con su propio header/footer) — ahora es un
// widget que Inicio.tsx monta adentro del modal; `slug`/`tipo` llegan por
// props en vez de por router.query, y no hay navegación a ningún lado para
// jugar. También absorbe lo que antes era la página separada
// /juegos/reclamar (ReclamarPremio.tsx): el regreso del login con Google
// (googleLoginUrl + returnTo) apunta ahora al HOME con
// ?reclamarSesion=<id>, y este mismo componente reconoce ese caso (fase
// 'reclamando') en vez de depender de otra página.
//
// Mecánica: un medidor oscila de 0 a 100 — hay que tocar el botón cuando
// pasa por la zona verde. Acierto = +1 tiro (hasta el techo del juego); un
// fallo termina la sesión. Es de habilidad/timing, no de suerte.
//
// Modelo de confianza: la física corre 100% acá (cliente) — el backend NO
// reverifica el timing, solo cappea el resultado final contra el techo
// configurado (GamesPlayService#finishSession) y evita reclamos duplicados.
// Documentado así a propósito, ver el comentario del service.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Trophy, Target, Goal, Crosshair, Fish, Flag, PartyPopper, X, AlertCircle, Copy, Check } from 'lucide-react'
import type { ComponentType } from 'react'
import { Skeleton, SkeletonText, SkeletonCircle } from '@/design-system/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { googleLoginUrl } from '@/lib/auth/authClient'
import {
    startGameSession, finishGameSession, getActiveGames, claimGameSession,
    StorefrontApiError, type GameStartResponse,
} from '@/lib/storefront/api'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>

// Todo lo que cambia de un juego a otro — la mecánica de abajo es idéntica.
// Agregar un juego nuevo es agregar UNA entrada acá (y su card en
// JuegosConfig.tsx, panel), no un archivo nuevo.
export interface TemaJuego { titulo: string; verbo: string; instrucciones: string; Icon: IconType }
export const TEMAS: Record<string, TemaJuego> = {
    HOOP: {
        titulo: 'Encestá y ganá',
        verbo: 'Tirar',
        instrucciones: 'Tocá el botón justo cuando la barra pase por la zona verde. Cada acierto suma descuento — un fallo termina el juego. Se juega una sola vez.',
        Icon: Target,
    },
    GOAL: {
        titulo: 'Metela y ganá',
        verbo: 'Patear',
        instrucciones: 'Tocá el botón justo cuando la barra pase por la zona verde. Cada gol suma descuento — un fallo termina el juego. Se juega una sola vez.',
        Icon: Goal,
    },
    DART: {
        titulo: 'Al blanco y ganá',
        verbo: 'Lanzar',
        instrucciones: 'Tocá el botón justo cuando la barra pase por la zona verde para clavar el dardo en el centro. Un tiro afuera termina el juego. Se juega una sola vez.',
        Icon: Crosshair,
    },
    FISH: {
        titulo: 'Pescá tu premio',
        verbo: 'Enganchar',
        instrucciones: 'Tocá el botón justo cuando la barra pase por la zona verde para enganchar el pez. Si se escapa, se termina el juego. Se juega una sola vez.',
        Icon: Fish,
    },
    GOLF: {
        titulo: 'Hoyo en uno y ganá',
        verbo: 'Pegarle',
        instrucciones: 'Tocá el botón justo cuando la barra pase por la zona verde para el swing perfecto. Un golpe flojo termina el juego. Se juega una sola vez.',
        Icon: Flag,
    },
}
// Zona con onda ('HOOP') si el `tipo` no matchea ningún tema conocido —
// nunca deja el modal en blanco.
const TEMA_DEFAULT = TEMAS.HOOP

// % del recorrido del medidor que cuenta como acierto — franja fija por
// ahora (se puede ajustar la dificultad más adelante, ej. angostarla en
// cada tiro sucesivo).
const ZONA: [number, number] = [38, 62]

// Ganó alguna vez esta mecánica (aunque todavía no haya reclamado el
// premio) — PERMANENTE, no depende de campaignVersion a propósito: ganar
// entrega un descuento real, dejar que "relanzar" también reseteara esto
// sería una forma de cobrar el mismo premio una y otra vez con cada
// relanzamiento. Pedido explícito del dueño 2026-08-28.
function ganadoKey(slug: string, tipo: string) {
    return `orbita-juego-ganado:${slug}:${tipo}`
}
export function yaGano(slug: string, tipo: string): boolean {
    if (typeof window === 'undefined') return false
    try { return !!localStorage.getItem(ganadoKey(slug, tipo)) } catch { return false }
}

// Jugó y perdió ESTA campaña — a diferencia de "ganó", esto SÍ está atado a
// campaignVersion: perder no entrega ningún premio, así que no hay riesgo
// de farmear nada dejando que una campaña nueva (botón "Mostrar de nuevo a
// quienes lo cerraron", o cualquier relanzamiento) le dé otra oportunidad.
function perdidoKey(slug: string, tipo: string, version: number) {
    return `orbita-juego-perdido:${slug}:${tipo}:${version}`
}
export function yaPerdio(slug: string, tipo: string, version: number): boolean {
    if (typeof window === 'undefined') return false
    try { return !!localStorage.getItem(perdidoKey(slug, tipo, version)) } catch { return false }
}

// Misma clave que guarda el modal de Inicio.tsx al cerrarse con la X
// (cerrarModal) — atada a campaignVersion, no solo al tipo: Game es una
// sola fila por type (el dueño la activa/desactiva, no "crea otra"), así
// que reactivarlo es la única forma real de "relanzarlo" — ver
// campaignVersion en schema.prisma. Por eso, aunque cerrar el modal sigue
// siendo una decisión final para ESA campaña, una reactivación futura del
// mismo juego sí vuelve a estar disponible (nueva campaña, nuevo aviso).
export function declinadoKey(slug: string, tipo: string, version: number) {
    return `orbita-juego-declinado:${slug}:${tipo}:${version}`
}
// Exportado — mismo motivo que yaGano/yaPerdio: Inicio.tsx filtra con esto
// antes de decidir qué ofrecer en el modal (o directamente no mostrar nada
// si ya no queda ningún juego elegible).
export function estaDeclinado(slug: string, tipo: string, version: number): boolean {
    if (typeof window === 'undefined') return false
    try { return !!localStorage.getItem(declinadoKey(slug, tipo, version)) } catch { return false }
}

type Fase = 'cargando' | 'ganado' | 'ya_jugado' | 'declinado' | 'no_disponible' | 'intro' | 'jugando' | 'resultado' | 'reclamando'

interface Props {
    slug: string
    tipo: string
    nombreTienda: string
    // Presente solo cuando este montaje es el "aterrizaje" de vuelta del
    // login con Google (ver returnTo más abajo) — salta directo a la fase
    // 'reclamando' en vez de la lógica normal de intro/ya_jugado/declinado.
    sessionIdReclamo?: string
}

export default function JuegoInline({ slug, tipo, nombreTienda, sessionIdReclamo }: Props) {
    const router = useRouter()
    const tema = TEMAS[tipo] ?? TEMA_DEFAULT
    const { status, user } = useAuth()

    const [fase, setFase] = useState<Fase>('cargando')
    const [sesion, setSesion] = useState<GameStartResponse | null>(null)
    const [intento, setIntento] = useState(0)
    const [historial, setHistorial] = useState<boolean[]>([])
    const [resultado, setResultado] = useState<{ status: string; discountPercent: number | null } | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [codigoGanado, setCodigoGanado] = useState<string | null>(null)

    // Vuelta de Google — reclamo directo, sin pasar por la lógica normal de
    // abajo (ese chequeo es "¿puedo arrancar un juego nuevo?", acá ya hay
    // uno terminado esperando que se reclame).
    const [resultadoReclamo, setResultadoReclamo] = useState<{ code: string; discountPercent: number } | null>(null)
    const [errorReclamo, setErrorReclamo] = useState('')
    const [copiado, setCopiado] = useState(false)

    // Para saber si esta mecánica sigue activa, y de paso su campaignVersion
    // (necesaria para el chequeo de "declinado" de abajo — ver
    // declinadoKey). null = todavía no se confirmó ninguna de las dos. Se
    // omite por completo si esto es un reclamo (no hace falta).
    const [activo, setActivo] = useState<{ encontrado: boolean; campaignVersion: number | null } | null>(null)
    useEffect(() => {
        if (!slug || !tipo || sessionIdReclamo) return
        let cancelado = false
        getActiveGames(slug)
            .then(games => {
                if (cancelado) return
                const g = games.find(x => x.type === tipo)
                setActivo({ encontrado: !!g, campaignVersion: g?.campaignVersion ?? null })
            })
            // Si el pedido falla (red/backend caído) no bloqueamos por las
            // dudas — sigue igual que antes de esta verificación: arrancar()
            // ya maneja el error real de "no disponible" al tocar Jugar.
            .catch(() => { if (!cancelado) setActivo({ encontrado: true, campaignVersion: null }) })
        return () => { cancelado = true }
    }, [slug, tipo, sessionIdReclamo])

    // Chequeo del lado del cliente (ver comentario de arriba sobre el
    // modelo de confianza; el backend igual nunca deja terminar dos veces
    // la MISMA sesión, pero nada impide hoy arrancar una nueva desde otro
    // navegador/incógnito — aceptado a propósito, premio topeado). "Ganó"
    // bloquea para siempre (ver ganadoKey); "perdió" y "declinó" solo
    // bloquean ESTA campaña — una nueva campaña (relanzamiento) les da otra
    // oportunidad, porque perder o declinar no entregó ningún premio.
    useEffect(() => {
        if (!slug || !tipo) return
        if (sessionIdReclamo) { setFase('reclamando'); return }
        if (!activo) return
        if (!activo.encontrado) {
            setErrorMsg('Este juego no está disponible ahora mismo.')
            setFase('no_disponible')
            return
        }
        if (yaGano(slug, tipo)) { setFase('ganado'); return }
        if (activo.campaignVersion != null) {
            if (estaDeclinado(slug, tipo, activo.campaignVersion)) { setFase('declinado'); return }
            if (yaPerdio(slug, tipo, activo.campaignVersion)) { setFase('ya_jugado'); return }
        }
        setFase('intro')
    }, [slug, tipo, activo, sessionIdReclamo])

    // Reclamo — se dispara una sola vez al entrar en fase 'reclamando'. Se
    // espera a que useAuth() termine de resolver la sesión (el token recién
    // llega vía el exchange del login) antes de reclamar.
    useEffect(() => {
        if (fase !== 'reclamando' || !sessionIdReclamo || !slug || status === 'loading') return
        if (status !== 'authenticated') { setErrorReclamo('Necesitás iniciar sesión para reclamar tu premio.'); return }
        let cancelado = false
        claimGameSession(slug, sessionIdReclamo)
            .then(r => { if (!cancelado) setResultadoReclamo(r) })
            .catch(e => { if (!cancelado) setErrorReclamo(e instanceof StorefrontApiError ? e.message : 'No se pudo reclamar el premio.') })
        return () => { cancelado = true }
    }, [fase, sessionIdReclamo, slug, status])

    async function arrancar() {
        if (!slug) return
        try {
            const s = await startGameSession(slug, tipo)
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
        // Ganó vs perdió marca claves DISTINTAS (ver ganadoKey/perdidoKey) —
        // ganar bloquea para siempre, perder solo bloquea esta campaña. Se
        // marca según el resultado real (después de finishGameSession, no
        // antes) para no bloquear a alguien como "ganador" sin haberlo sido.
        function marcar(gano: boolean) {
            try {
                if (gano) localStorage.setItem(ganadoKey(slug, tipo), '1')
                else if (activo?.campaignVersion != null) localStorage.setItem(perdidoKey(slug, tipo, activo.campaignVersion), '1')
            } catch { /* sin localStorage, sigue igual */ }
        }
        try {
            const r = await finishGameSession(slug, sesion.sessionId, aciertos)
            setResultado(r)
            marcar(!!r.discountPercent)
            if (r.code) {
                // Ya estaba logueado como cliente — el backend reclamó de una,
                // sin pasar por Google. Guardamos el código para mostrarlo.
                setCodigoGanado(r.code)
            }
        } catch {
            // Error de red/API al terminar — no se sabe si ganó, pero tampoco
            // se le acreditó nada: tratarlo como "perdió esta campaña" (no
            // permanente) es lo más seguro, no bloquea de más ni de menos.
            setResultado({ status: 'LOST', discountPercent: null })
            marcar(false)
        }
        setFase('resultado')
    }

    // Antes: un solo fallo terminaba la sesión al toque, sin importar
    // cuántos intentos tuviera configurados el dueño — en la práctica era
    // "un solo tiro" para casi todo el mundo (bug reportado 2026-08-28).
    // Ahora fallar solo consume un intento; la sesión sigue hasta que se
    // acaben los intentos O se llegue al techo de % (lo que pase primero).
    function onTiro(acierto: boolean) {
        const nuevoHistorial = [...historial, acierto]
        setHistorial(nuevoHistorial)
        const aciertos = nuevoHistorial.filter(Boolean).length
        const llegoAlTecho = !!sesion && aciertos * sesion.percentPerWin >= sesion.maxPercent
        const sinIntentos = !!sesion && nuevoHistorial.length >= sesion.maxAttempts
        if (llegoAlTecho || sinIntentos) {
            void terminar(aciertos)
            return
        }
        setIntento(i => i + 1)
    }

    function copiarCodigo() {
        if (!resultadoReclamo) return
        navigator.clipboard.writeText(resultadoReclamo.code).catch(() => {})
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    // El home es el único lugar donde este juego puede aparecer — volver acá
    // (con el sessionId en la URL) es lo que hace que este mismo componente
    // reconozca la vuelta de Google y salte a 'reclamando' sin pasar por
    // ninguna página intermedia.
    const returnTo = slug ? `/tienda/${slug}/?reclamarSesion=${sesion?.sessionId ?? ''}&reclamarTipo=${tipo}` : undefined
    const yaLogueado = status === 'authenticated' && user?.type === 'customer'

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {fase === 'cargando' && (
                <div style={{ width: '100%' }} aria-hidden="true">
                    <SkeletonText width="60%" height={22} style={{ margin: '0 auto 12px' }} />
                    <Skeleton width="100%" height={120} radius={16} />
                </div>
            )}

            {fase === 'ganado' && (
                <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                        <Trophy size={24} strokeWidth={1.5} color="var(--color-success)" />
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Ya ganaste este juego</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, maxWidth: 320 }}>Ese premio ya te lo llevaste — no se puede reclamar dos veces. Estate atento a nuevos juegos de {nombreTienda || 'la tienda'}.</p>
                </>
            )}

            {fase === 'ya_jugado' && (
                <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-alt)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                        <Trophy size={24} strokeWidth={1.5} color="var(--color-muted)" />
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Ya jugaste esta ronda</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, maxWidth: 320 }}>Se juega una vez por ronda. Estate atento — {nombreTienda || 'la tienda'} puede volver a habilitarla más adelante.</p>
                </>
            )}

            {fase === 'declinado' && (
                <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-alt)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                        <X size={24} strokeWidth={1.5} color="var(--color-muted)" />
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Este juego ya no está disponible</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, maxWidth: 320 }}>Cerraste la invitación a jugar la primera vez que entraste a la tienda. Estate atento a nuevos juegos de {nombreTienda || 'la tienda'}.</p>
                </>
            )}

            {fase === 'no_disponible' && (
                <>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>No disponible</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>{errorMsg}</p>
                </>
            )}

            {fase === 'intro' && (
                <>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-bg)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                        <tema.Icon size={24} strokeWidth={1.5} color="var(--color-primary)" />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{tema.titulo}</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 22px', maxWidth: 340, lineHeight: 1.6 }}>
                        {tema.instrucciones}
                    </p>
                    <button onClick={arrancar} style={btnPrimario}>Jugar</button>
                </>
            )}

            {fase === 'jugando' && sesion && (
                <>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 6 }}>
                        Tiro {intento + 1} — llevás {historial.filter(Boolean).length * sesion.percentPerWin}% asegurado
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                        {Array.from({ length: sesion.maxAttempts }).map((_, i) => (
                            <div key={i} style={{
                                width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12,
                                background: i < historial.length ? (historial[i] ? 'var(--color-success)' : 'var(--color-error)') : 'var(--color-surface-alt)',
                                color: i < historial.length ? '#fff' : 'var(--color-subtle)',
                                border: i === intento ? '2px solid var(--color-primary)' : 'none',
                            }}>
                                {i < historial.length ? (historial[i] ? '✓' : '✕') : i + 1}
                            </div>
                        ))}
                    </div>
                    {tipo === 'HOOP'
                        ? <TiroCanasta key={intento} zona={ZONA} tiempoMaximoMs={sesion.timeLimitMs} onResultado={onTiro} />
                        : <Tiro key={intento} zona={ZONA} verbo={tema.verbo} tiempoMaximoMs={sesion.timeLimitMs} onResultado={onTiro} />}
                </>
            )}

            {fase === 'resultado' && resultado && (
                <>
                    {resultado.discountPercent ? (
                        <>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                                <PartyPopper size={28} strokeWidth={1.5} color="var(--color-success)" />
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>¡Ganaste {resultado.discountPercent}% de descuento!</h2>

                            {codigoGanado ? (
                                <>
                                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 14px' }}>Ya se aplicó a tu cuenta — usá este código en el checkout:</p>
                                    <div style={{ padding: '10px 18px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', marginBottom: 18 }}>
                                        {codigoGanado}
                                    </div>
                                    <button onClick={() => router.push(`/tienda/${slug}/catalogo`)} style={btnPrimario}>Ir de compras</button>
                                </>
                            ) : yaLogueado ? (
                                <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Estamos aplicando tu premio…</p>
                            ) : (
                                <>
                                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 18px', maxWidth: 300, lineHeight: 1.6 }}>
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
                            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>No llegaste esta vez</h2>
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, maxWidth: 300 }}>Gracias por jugar — estate atento a la próxima.</p>
                        </>
                    )}
                </>
            )}

            {fase === 'reclamando' && (
                <>
                    {!errorReclamo && !resultadoReclamo && (
                        <div aria-hidden="true">
                            <SkeletonCircle size={64} style={{ margin: '0 auto 16px' }} />
                            <SkeletonText width={220} height={18} style={{ margin: '0 auto 8px' }} />
                            <SkeletonText width={160} height={12} style={{ margin: '0 auto' }} />
                        </div>
                    )}
                    {errorReclamo && (
                        <>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-error-bg)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                                <AlertCircle size={24} strokeWidth={1.5} color="var(--color-error)" />
                            </div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>No se pudo reclamar</h2>
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, maxWidth: 300 }}>{errorReclamo}</p>
                        </>
                    )}
                    {resultadoReclamo && (
                        <>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                                <PartyPopper size={28} strokeWidth={1.5} color="var(--color-success)" />
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px' }}>¡Descuento reclamado!</h2>
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 16px' }}>{resultadoReclamo.discountPercent}% de descuento — usalo en tu próxima compra con este código:</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300, marginBottom: 18 }}>
                                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '0.04em' }}>
                                    {resultadoReclamo.code}
                                </div>
                                <button onClick={copiarCodigo} style={{ height: 42, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: copiado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                                </button>
                            </div>
                            <button onClick={() => router.push(`/tienda/${slug}/catalogo`)} style={btnPrimario}>Ir de compras</button>
                        </>
                    )}
                </>
            )}
        </div>
    )
}

// Un tiro individual — medidor oscilante + botón. Se remonta (key={intento})
// en cada intento nuevo, así el RAF/estado arranca limpio cada vez.
// `tiempoMaximoMs` viene de Game.timeLimitSeconds (lo configura el dueño en
// JuegosConfig.tsx, panel) — antes era un TIEMPO_MAX_MS fijo acá. Sin un
// tiempo máximo, la barra oscilaba para siempre: el jugador podía mirar un
// par de ciclos, aprenderse el ritmo exacto (es una onda periódica) y tirar
// sin ninguna presión real. No reaccionar a tiempo cuenta como fallo — igual
// que dejar pasar la pelota.
function Tiro({ zona, verbo, tiempoMaximoMs, onResultado }: { zona: [number, number]; verbo: string; tiempoMaximoMs: number; onResultado: (acierto: boolean) => void }) {
    const [valor, setValor] = useState(0)
    const [tiempoRestante, setTiempoRestante] = useState(1)
    const rafRef = useRef<number | null>(null)
    const inicioRef = useRef<number | null>(null)
    const disparadoRef = useRef(false)

    function resolver(acierto: boolean) {
        if (disparadoRef.current) return
        disparadoRef.current = true
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        onResultado(acierto)
    }

    useEffect(() => {
        function tick(t: number) {
            if (inicioRef.current === null) inicioRef.current = t
            const transcurrido = t - inicioRef.current
            if (transcurrido >= tiempoMaximoMs) {
                setTiempoRestante(0)
                resolver(false)
                return
            }
            setValor(50 + 50 * Math.sin(transcurrido / 260))
            setTiempoRestante(1 - transcurrido / tiempoMaximoMs)
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function tirar() {
        resolver(valor >= zona[0] && valor <= zona[1])
    }

    return (
        <div style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ height: 3, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${tiempoRestante * 100}%`, background: tiempoRestante < 0.3 ? 'var(--color-error)' : 'var(--color-primary)', transition: 'width 80ms linear, background 200ms' }} />
            </div>
            <div style={{ position: 'relative', height: 32, borderRadius: 999, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ position: 'absolute', left: `${zona[0]}%`, width: `${zona[1] - zona[0]}%`, top: 0, bottom: 0, background: 'var(--color-success-bg)' }} />
                <div style={{ position: 'absolute', left: `${valor}%`, top: -2, bottom: -2, width: 4, borderRadius: 2, background: 'var(--color-primary)', transform: 'translateX(-50%)' }} />
            </div>
            <button onClick={tirar} style={btnPrimario}>{verbo}</button>
        </div>
    )
}

// Versión "de verdad" del mismo mecanismo de arriba, solo para HOOP — pedido
// explícito del dueño: "quiero una pelota de basquet encestando al aro...
// que se pueda tirar la pelota y que el aro se mueva también". La regla de
// fondo NO cambia (mismo `zona`, mismo timing, mismo modelo de confianza):
// lo único que cambia es que en vez de una barra abstracta, lo que oscila es
// el ARO de verdad, y tirar dispara una animación de tiro (arco de la
// pelota) hacia el mismo lugar de siempre — el aro se queda quieto apenas se
// tira, así lo que se ve coincide exactamente con lo que ya se decidió
// (acierto/fallo) en el momento del tap, no después.
const CANCHA_ALTO = 176
const ARO_Y = 148 // altura del aro medida desde el piso de la cancha (px)
function TiroCanasta({ zona, tiempoMaximoMs, onResultado }: { zona: [number, number]; tiempoMaximoMs: number; onResultado: (acierto: boolean) => void }) {
    const [posAro, setPosAro] = useState(50) // 0-100, posición horizontal del aro
    const [tiempoRestante, setTiempoRestante] = useState(1)
    const [pelota, setPelota] = useState({ x: 50, y: 0, escala: 1, opacidad: 1 })
    const [resultado, setResultado] = useState<null | 'acierto' | 'fallo'>(null)
    const rafRef = useRef<number | null>(null)
    const inicioRef = useRef<number | null>(null)
    const disparadoRef = useRef(false)

    function animarTiro(acierto: boolean) {
        const DURACION_MS = 620
        const inicio = performance.now()
        function frame(t: number) {
            const p = Math.min(1, (t - inicio) / DURACION_MS)
            // Arco parabólico: sube y baja hasta terminar en yFinal. Encestar
            // pasa POR el aro (yFinal ≈ altura del aro, con un pico bien
            // arriba); fallar se queda corto — nunca llega al aro y vuelve a
            // caer al piso, sin importar dónde estaba el aro parado.
            const yFinal = acierto ? ARO_Y : 0
            const pico = acierto ? 85 : 95
            const y = 4 * pico * p * (1 - p) + yFinal * p
            const escala = 1 - 0.3 * p
            const opacidad = acierto && p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1
            setPelota({ x: 50, y, escala, opacidad })
            if (p < 1) {
                rafRef.current = requestAnimationFrame(frame)
            } else {
                setTimeout(() => onResultado(acierto), 120)
            }
        }
        rafRef.current = requestAnimationFrame(frame)
    }

    function resolver(acierto: boolean) {
        if (disparadoRef.current) return
        disparadoRef.current = true
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        setResultado(acierto ? 'acierto' : 'fallo')
        animarTiro(acierto)
    }

    useEffect(() => {
        function tick(t: number) {
            if (inicioRef.current === null) inicioRef.current = t
            const transcurrido = t - inicioRef.current
            if (transcurrido >= tiempoMaximoMs) {
                setTiempoRestante(0)
                resolver(false)
                return
            }
            setPosAro(50 + 38 * Math.sin(transcurrido / 260))
            setTiempoRestante(1 - transcurrido / tiempoMaximoMs)
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function tirar() {
        resolver(posAro >= zona[0] && posAro <= zona[1])
    }

    return (
        <div style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ height: 3, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${tiempoRestante * 100}%`, background: tiempoRestante < 0.3 ? 'var(--color-error)' : 'var(--color-primary)', transition: 'width 80ms linear, background 200ms' }} />
            </div>

            <div style={{ position: 'relative', height: CANCHA_ALTO, marginBottom: 16 }}>
                {/* Piso de la cancha */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'var(--color-border)' }} />

                {/* Aro — se congela apenas se tira (posAro deja de actualizarse porque el
                    RAF de arriba ya se canceló en resolver()), así lo que se ve coincide
                    con el momento exacto del tap. */}
                <div style={{ position: 'absolute', left: `${posAro}%`, top: 0, transform: 'translateX(-50%)' }}>
                    <AroSVG />
                </div>

                {/* Pelota */}
                <div style={{ position: 'absolute', left: `${pelota.x}%`, bottom: pelota.y, transform: `translateX(-50%) scale(${pelota.escala})`, opacity: pelota.opacidad }}>
                    <PelotaSVG />
                </div>
            </div>

            <button onClick={tirar} disabled={!!resultado} style={{ ...btnPrimario, opacity: resultado ? 0.6 : 1 }}>Tirar</button>
        </div>
    )
}

// Aro de básquet visto de frente: tablero + aro naranja + red. Simple a
// propósito (sin degradados/sombras raras) para que se vea bien nítido en un
// modal chico y no pese como asset.
function AroSVG() {
    return (
        <svg width="76" height="56" viewBox="0 0 76 56" fill="none">
            <rect x="20" y="1" width="36" height="27" rx="2" fill="#fff" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="32" y="9" width="12" height="10" fill="none" stroke="#ef4444" strokeWidth="1.5" />
            <ellipse cx="38" cy="29.5" rx="17" ry="4.5" fill="none" stroke="#f97316" strokeWidth="3" />
            <path d="M23 30 L27 50 M31 30.5 L33 51 M38 31 L38 52 M45 30.5 L43 51 M53 30 L49 50" stroke="#cbd5e1" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M23 30 Q38 35 53 30" stroke="#cbd5e1" strokeWidth="1" fill="none" />
        </svg>
    )
}

// Pelota de básquet — círculo naranja con las costuras típicas.
function PelotaSVG() {
    return (
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="11.5" fill="#f97316" stroke="#9a3412" strokeWidth="1" />
            <path d="M1.5 13 H24.5 M13 1.5 V24.5 M4.3 4.3 Q13 13 4.3 21.7 M21.7 4.3 Q13 13 21.7 21.7" stroke="#9a3412" strokeWidth="1" fill="none" />
        </svg>
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
    width: '100%', height: 46, borderRadius: 10, background: 'var(--color-primary)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
}
const btnGoogle: React.CSSProperties = {
    width: '100%', maxWidth: 300, height: 44, borderRadius: 10,
    background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}

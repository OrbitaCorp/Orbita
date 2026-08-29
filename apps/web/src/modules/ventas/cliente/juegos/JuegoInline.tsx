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
import { Trophy, Target, Goal, Crosshair, Fish, Flag, PartyPopper, X, AlertCircle, Copy, Check, ShoppingBag } from 'lucide-react'
import type { ComponentType } from 'react'
import { Skeleton, SkeletonText, SkeletonCircle } from '@/design-system/components/Skeleton'
import { Loader } from '@/design-system/components/Loader'
import { useAuth } from '@/hooks/useAuth'
import { googleLoginUrl } from '@/lib/auth/authClient'
import {
    startGameSession, finishGameSession, getActiveGames, claimGameSession,
    StorefrontApiError, type GameStartResponse,
} from '@/lib/storefront/api'
import { ESCENAS, ALTO_ESCENA, ANCHO_DISENO, ESCALA_MAX, TijeraIcon, type EscenaConfig, type EstadoTiro } from './escenas'

type IconType = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>

// Todo lo que cambia de un juego a otro DEL LADO DEL TEXTO — el arte de cada
// uno vive en escenas.tsx y la mecánica es la misma para los cinco. Agregar
// un juego nuevo es agregar UNA entrada acá, otra en ESCENAS y su card en
// JuegosConfig.tsx (panel), no un archivo nuevo.
//
// (2026-08-28) Se sacó `verbo` (era el label del botón "Tirar/Patear/…" que
// ya no existe: ahora se toca la escena directamente) y se reescribieron las
// instrucciones — describían una barra con una zona verde que ya no existe,
// y decían "un fallo termina el juego", que dejó de ser cierto cuando los
// intentos pasaron a ser configurables.
export interface TemaJuego { titulo: string; instrucciones: string; Icon: IconType }
export const TEMAS: Record<string, TemaJuego> = {
    HOOP: {
        titulo: 'Encestá y ganá',
        instrucciones: 'El aro se mueve de lado a lado: tocá la cancha justo cuando lo tengas de frente. Cada acierto te suma descuento.',
        Icon: Target,
    },
    GOAL: {
        titulo: 'Metela y ganá',
        instrucciones: 'El arco se mueve de lado a lado: pateá justo cuando lo tengas de frente. Cada gol te suma descuento.',
        Icon: Goal,
    },
    DART: {
        titulo: 'Al blanco y ganá',
        instrucciones: 'La diana se mueve de lado a lado: lanzá justo cuando la tengas de frente. Cada dardo en el centro te suma descuento.',
        Icon: Crosshair,
    },
    FISH: {
        titulo: 'Pescá tu premio',
        instrucciones: 'El pez nada de un lado al otro: soltá el anzuelo justo cuando lo tengas debajo. Cada pesca te suma descuento.',
        Icon: Fish,
    },
    GOLF: {
        titulo: 'Hoyo en uno y ganá',
        instrucciones: 'El hoyo se mueve de lado a lado: pegale justo cuando lo tengas de frente. Cada hoyo en uno te suma descuento.',
        Icon: Flag,
    },
    CUT: {
        titulo: 'Cortá y ganá',
        instrucciones: 'El globo pasea tu descuento de un lado al otro, frenando y acelerando. Cortá el hilo justo cuando esté sobre la caja: lo que caiga adentro es tuyo.',
        Icon: TijeraIcon,
    },
}
// Zona con onda ('HOOP') si el `tipo` no matchea ningún tema conocido —
// nunca deja el modal en blanco.
const TEMA_DEFAULT = TEMAS.HOOP

// % del recorrido del medidor que cuenta como acierto — franja fija por
// ahora (se puede ajustar la dificultad más adelante, ej. angostarla en
// cada tiro sucesivo).
const ZONA: [number, number] = [38, 62]

// Ganó esta mecánica — EN ESTA CAMPAÑA (atado a campaignVersion, igual que
// "perdió" y "declinó"). Pedido explícito del dueño 2026-08-28: "¿si el
// usuario gana, y más adelante el propietario lanza otro juego de
// encestar? no le va a parecer de nuevo por ganar" — correcto que no le
// aparecía, y era el criterio equivocado. Cada relanzamiento (reactivar,
// vigencia nueva, o el botón "Mostrar de nuevo a quienes lo cerraron") es
// una decisión DELIBERADA del dueño, no algo que el visitante controle —
// dentro de UNA misma campaña sigue sin poder ganar dos veces (eso es lo
// único que importa para no pagar el mismo premio dos veces), pero una
// campaña nueva es, para cualquier propósito práctico, una promoción
// nueva, y tiene sentido que también le dé una vuelta más a quien ya ganó
// la anterior — mismo trato que ya tenía "perdió".
function ganadoKey(slug: string, tipo: string, version: number) {
    return `orbita-juego-ganado:${slug}:${tipo}:${version}`
}
export function yaGano(slug: string, tipo: string, version: number): boolean {
    if (typeof window === 'undefined') return false
    try { return !!localStorage.getItem(ganadoKey(slug, tipo, version)) } catch { return false }
}

// Jugó y perdió esta campaña — mismo criterio que "ganó" de arriba: atado a
// campaignVersion, una campaña nueva vuelve a habilitar el juego.
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

type Fase = 'cargando' | 'ganado' | 'ya_jugado' | 'declinado' | 'no_disponible' | 'intro' | 'jugando' | 'terminando' | 'resultado' | 'reclamando'

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
    // (el botón "Ir de compras" tiene su propio useRouter() — ver
    // BotonIrDeCompras — es la única navegación que hacía falta acá)
    const tema = TEMAS[tipo] ?? TEMA_DEFAULT
    // La ambientación (fondo, objetivo, proyectil) de ESTA mecánica — ver
    // escenas.tsx. Cae a la de básquet si el `tipo` no matchea ninguna, mismo
    // criterio que TEMA_DEFAULT: nunca dejar el modal en blanco.
    const escena = ESCENAS[tipo] ?? ESCENAS.HOOP
    const { status, user } = useAuth()

    const [fase, setFase] = useState<Fase>('cargando')
    const [sesion, setSesion] = useState<GameStartResponse | null>(null)
    const [intento, setIntento] = useState(0)
    const [historial, setHistorial] = useState<boolean[]>([])
    const [resultado, setResultado] = useState<{ status: string; discountPercent: number | null } | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [codigoGanado, setCodigoGanado] = useState<string | null>(null)
    // Vencimiento del cupón — dura lo mismo que la vigencia del juego (ver
    // GamesPlayService#claimInternal). null = sin vencimiento.
    const [codigoVence, setCodigoVence] = useState<string | null>(null)

    // Vuelta de Google — reclamo directo, sin pasar por la lógica normal de
    // abajo (ese chequeo es "¿puedo arrancar un juego nuevo?", acá ya hay
    // uno terminado esperando que se reclame).
    const [resultadoReclamo, setResultadoReclamo] = useState<{ code: string; discountPercent: number; expiresAt: string | null } | null>(null)
    const [errorReclamo, setErrorReclamo] = useState('')
    const [copiado, setCopiado] = useState(false)

    // Para saber si esta mecánica sigue activa, y de paso su campaignVersion
    // (necesaria para el chequeo de "declinado" de abajo — ver
    // declinadoKey). null = todavía no se confirmó ninguna de las dos. Se
    // omite por completo si esto es un reclamo (no hace falta).
    // maxPercent/maxAttempts vienen del mismo pedido y solo se usan para
    // anunciar el premio en la intro, antes de arrancar.
    const [activo, setActivo] = useState<{ encontrado: boolean; campaignVersion: number | null; maxPercent: number | null; maxAttempts: number | null } | null>(null)
    useEffect(() => {
        if (!slug || !tipo || sessionIdReclamo) return
        let cancelado = false
        getActiveGames(slug)
            .then(games => {
                if (cancelado) return
                const g = games.find(x => x.type === tipo)
                setActivo({
                    encontrado: !!g,
                    campaignVersion: g?.campaignVersion ?? null,
                    maxPercent: g?.maxPercent ?? null,
                    maxAttempts: g?.maxAttempts ?? null,
                })
            })
            // Si el pedido falla (red/backend caído) no bloqueamos por las
            // dudas — sigue igual que antes de esta verificación: arrancar()
            // ya maneja el error real de "no disponible" al tocar Jugar.
            .catch(() => { if (!cancelado) setActivo({ encontrado: true, campaignVersion: null, maxPercent: null, maxAttempts: null }) })
        return () => { cancelado = true }
    }, [slug, tipo, sessionIdReclamo])

    // Chequeo del lado del cliente (ver comentario de arriba sobre el
    // modelo de confianza; el backend igual nunca deja terminar dos veces
    // la MISMA sesión, pero nada impide hoy arrancar una nueva desde otro
    // navegador/incógnito — aceptado a propósito, premio topeado). Ganó,
    // perdió y declinó bloquean ESTA campaña — una campaña nueva
    // (relanzamiento, decisión del dueño) vuelve a habilitar el juego para
    // los tres casos por igual.
    useEffect(() => {
        if (!slug || !tipo) return
        if (sessionIdReclamo) { setFase('reclamando'); return }
        if (!activo) return
        if (!activo.encontrado) {
            setErrorMsg('Este juego no está disponible ahora mismo.')
            setFase('no_disponible')
            return
        }
        if (activo.campaignVersion != null) {
            if (yaGano(slug, tipo, activo.campaignVersion)) { setFase('ganado'); return }
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
        // Pedido explícito del dueño: apenas termina el último tiro, mostrar
        // un círculo de carga hasta tener el resultado real — antes se
        // quedaba en la pantalla del último tiro (con el aro ya congelado)
        // mientras se esperaba la respuesta del backend, sin ningún aviso de
        // que algo estaba pasando.
        setFase('terminando')
        // Ganó vs perdió marca claves distintas (ver ganadoKey/perdidoKey),
        // las dos atadas a la campaña actual. Se marca según el resultado
        // real (después de finishGameSession, no antes) para no bloquear a
        // alguien como "ganador" sin haberlo sido.
        function marcar(gano: boolean) {
            if (activo?.campaignVersion == null) return
            try {
                if (gano) localStorage.setItem(ganadoKey(slug, tipo, activo.campaignVersion), '1')
                else localStorage.setItem(perdidoKey(slug, tipo, activo.campaignVersion), '1')
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
                setCodigoVence(r.expiresAt)
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

    // Recibe el código explícito para poder reusarse tanto acá (fase
    // 'resultado', ya logueado) como en la fase 'reclamando' — antes solo
    // existía en 'reclamando', y en 'resultado' el código se mostraba como
    // texto plano sin forma de copiarlo (bug reportado: "qué pasa si el
    // usuario se olvida de copiar" — sin este botón, dependía de que
    // seleccionara el texto a mano).
    function copiarCodigo(codigo: string) {
        navigator.clipboard.writeText(codigo).catch(() => {})
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    // El cupón del premio dura lo mismo que la vigencia del juego (ver
    // GamesPlayService#claimInternal) — null = sin vencimiento.
    function textoVencimiento(iso: string | null) {
        if (!iso) return null
        return `Vale hasta el ${new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}.`
    }

    // El home es el único lugar donde este juego puede aparecer — volver acá
    // (con el sessionId en la URL) es lo que hace que este mismo componente
    // reconozca la vuelta de Google y salte a 'reclamando' sin pasar por
    // ninguna página intermedia.
    const returnTo = slug ? `/tienda/${slug}/?reclamarSesion=${sesion?.sessionId ?? ''}&reclamarTipo=${tipo}` : undefined
    const yaLogueado = status === 'authenticated' && user?.type === 'customer'
    // Badge de la intro. Solo si el backend llegó a responder con los dos
    // datos — si el pedido falló, la intro se muestra igual, sin badge.
    const premio = activo?.maxPercent != null && activo.maxAttempts != null
        ? { maxPercent: activo.maxPercent, maxAttempts: activo.maxAttempts }
        : null

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

            {/* Intro — con un vistazo de la escena real de fondo y el premio
                anunciado de entrada ("N rondas · hasta X% OFF"), como los
                juegos de referencia que mandó el dueño. Antes era un ícono
                chico y texto: no se veía a qué se estaba por jugar ni cuánto
                se podía ganar hasta después de arrancar. */}
            {fase === 'intro' && (
                <>
                    <div style={{ position: 'relative', width: '100%', height: 132, borderRadius: 14, overflow: 'hidden', marginBottom: 18, boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.12)' }}>
                        <escena.Fondo />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,14,28,0.5)' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.5)', display: 'grid', placeItems: 'center' }}>
                                <tema.Icon size={24} strokeWidth={1.6} color="#fff" />
                            </div>
                        </div>
                    </div>
                    <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 7px', letterSpacing: '-0.02em' }}>{tema.titulo}</h2>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 16px', maxWidth: 360, lineHeight: 1.6 }}>
                        {tema.instrucciones}
                    </p>
                    {premio && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20,
                            padding: '7px 14px', borderRadius: 999,
                            background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)',
                            fontSize: 12, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--color-primary)', textTransform: 'uppercase',
                        }}>
                            <Trophy size={13} strokeWidth={2.2} />
                            {premio.maxAttempts} {premio.maxAttempts === 1 ? 'tiro' : 'tiros'} · hasta {premio.maxPercent}% OFF
                        </div>
                    )}
                    <button onClick={arrancar} style={btnPrimario}>Jugar</button>
                </>
            )}

            {fase === 'jugando' && sesion && (
                <>
                    {/* etiqueta: lo que el juego "reparte" en este tiro. Hoy
                        solo la usa la tijera (es lo que cuelga del globo y
                        cae a la caja), el resto la ignora. */}
                    <EscenaTiro
                        key={intento}
                        escena={escena}
                        zona={ZONA}
                        tiempoMaximoMs={sesion.timeLimitMs}
                        etiqueta={`+${sesion.percentPerWin}%`}
                        onResultado={onTiro}
                    />

                    {/* Marcador — ronda actual, tiros ya hechos y % asegurado.
                        Debajo de la escena (no encima) para no taparla. */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {Array.from({ length: sesion.maxAttempts }).map((_, i) => (
                                <span key={i} style={{
                                    width: 9, height: 9, borderRadius: '50%',
                                    background: i < historial.length
                                        ? (historial[i] ? 'var(--color-success)' : 'var(--color-error)')
                                        : i === intento ? 'var(--color-primary)' : 'var(--color-border)',
                                    outline: i === intento ? '2px solid var(--color-primary-bg)' : 'none',
                                }} />
                            ))}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                            Tiro {intento + 1}/{sesion.maxAttempts} → {historial.filter(Boolean).length * sesion.percentPerWin}%
                        </div>
                    </div>
                </>
            )}

            {fase === 'terminando' && (
                <div style={{ padding: '28px 0' }}>
                    <Loader size="md" message="Confirmando tu resultado…" />
                </div>
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
                                    <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 14px' }}>Ya se aplicó a tu cuenta — usá este código en el checkout. También te lo mandamos por mail, por las dudas.</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300, marginBottom: 8 }}>
                                        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '0.04em' }}>
                                            {codigoGanado}
                                        </div>
                                        <button onClick={() => copiarCodigo(codigoGanado)} style={{ height: 42, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: copiado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                                        </button>
                                    </div>
                                    {textoVencimiento(codigoVence) && <p style={{ fontSize: 11.5, color: 'var(--color-muted)', margin: '0 0 10px' }}>{textoVencimiento(codigoVence)}</p>}
                                    {/* width:'100%' EXPLÍCITO acá, no `auto` — el contenedor
                                        de afuera es un flex column con alignItems:'center', así
                                        que un div sin ancho propio se encoge al contenido y el
                                        `width:100%` del botón de adentro queda sin nada contra
                                        qué resolverse (colapsaba a un botón angosto, reportado
                                        con captura por el dueño). */}
                                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                                        <BotonIrDeCompras slug={slug} />
                                    </div>
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
                            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 16px' }}>{resultadoReclamo.discountPercent}% de descuento — usalo en tu próxima compra con este código (también te lo mandamos por mail):</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300, marginBottom: 8 }}>
                                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-alt)', border: '1.5px dashed var(--color-border-strong)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', letterSpacing: '0.04em' }}>
                                    {resultadoReclamo.code}
                                </div>
                                <button onClick={() => copiarCodigo(resultadoReclamo.code)} style={{ height: 42, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: copiado ? 'var(--color-success)' : 'var(--color-primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                                </button>
                            </div>
                            {textoVencimiento(resultadoReclamo.expiresAt) && <p style={{ fontSize: 11.5, color: 'var(--color-muted)', margin: '0 0 10px' }}>{textoVencimiento(resultadoReclamo.expiresAt)}</p>}
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                                <BotonIrDeCompras slug={slug} />
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}

// Confeti del acierto: 12 piezas repartidas en círculo, con colores y
// pequeños retardos distintos para que no salgan todas clavadas al mismo
// tiempo. Es una constante y no un cálculo por render: siempre es el mismo
// estallido, no hace falta aleatoriedad (y así no cambia entre el HTML del
// server y el del cliente, que rompería la hidratación).
const CONFETI = Array.from({ length: 12 }, (_, i) => ({
    ang: i * 30,
    color: ['#facc15', '#22c55e', '#ffffff', '#38bdf8'][i % 4],
    delay: (i % 4) * 45,
}))

// Un tiro individual, con la escena real del juego (ver escenas.tsx). Se
// remonta (key={intento}) en cada intento nuevo, así el RAF/estado arranca
// limpio cada vez.
//
// (2026-08-28) Reemplaza a las dos mecánicas que había antes: una barra gris
// abstracta (4 de los 5 juegos) y una cancha de básquet a medio hacer (solo
// HOOP). Pedido del dueño, con juegos de referencia de otras tiendas:
// "quiero que los juegos de Órbita tengan calidad, buena jugabilidad y buen
// ux/ui, para todos los juegos". La REGLA de fondo no cambió (mismo `zona`,
// mismo timing, mismo modelo de confianza) — lo que cambió es que ahora lo
// que oscila es el objetivo de verdad (aro, arco, diana, pez, hoyo) sobre su
// ambientación, y el tiro se dispara tocando la escena en vez de un botón
// aparte abajo (como los juegos de referencia).
//
// `tiempoMaximoMs` viene de Game.timeLimitSeconds (lo configura el dueño en
// JuegosConfig.tsx). Sin un tiempo máximo, el objetivo oscilaría para
// siempre: el jugador podía mirar un par de ciclos, aprenderse el ritmo
// exacto (es una onda periódica) y tirar sin ninguna presión real. No
// reaccionar a tiempo cuenta como fallo — igual que dejar pasar la pelota.
function EscenaTiro({ escena, zona, tiempoMaximoMs, etiqueta, onResultado }: { escena: EscenaConfig; zona: [number, number]; tiempoMaximoMs: number; etiqueta?: string; onResultado: (acierto: boolean) => void }) {
    const [posObjetivo, setPosObjetivo] = useState(50) // 0-100, posición horizontal
    const [tiempoRestante, setTiempoRestante] = useState(1)
    const [proyectil, setProyectil] = useState({ y: 0, escala: 1, opacidad: 0 })
    const [estado, setEstado] = useState<EstadoTiro>('moviendo')
    // Se enciende cuando el proyectil TERMINÓ su recorrido — dispara la
    // celebración. Distinto de `estado`, que se setea al tocar (y sirve para
    // congelar el objetivo y reaccionar la red/bandera al instante).
    const [celebra, setCelebra] = useState<null | 'acierto' | 'fallo'>(null)
    const rafRef = useRef<number | null>(null)
    const inicioRef = useRef<number | null>(null)
    const disparadoRef = useRef(false)

    // Cuánto hay que escalar el lienzo de diseño para llenar el ancho real
    // del modal. Se mide con ResizeObserver (no con window.innerWidth): lo
    // que importa es el ancho del CONTENEDOR, que depende del padding del
    // modal y del ancho de la ventana a la vez.
    const contenedorRef = useRef<HTMLDivElement>(null)
    const [escala, setEscala] = useState(1)
    useEffect(() => {
        const el = contenedorRef.current
        if (!el) return
        const medir = () => setEscala(el.clientWidth / ANCHO_DISENO)
        medir()
        if (typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(medir)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // De dónde sale el proyectil (px desde abajo del contenedor). En
    // 'cortar' arranca colgando del globo, no del piso ni del tope.
    const origenY = escena.direccion === 'soltar' ? ALTO_ESCENA - 30
        : escena.direccion === 'cortar' ? ALTO_ESCENA - escena.objetivoTop - 132
        : 4

    function animarTiro(acierto: boolean) {
        const DURACION_MS = escena.direccion === 'cortar' ? 720 : 640
        const inicio = performance.now()
        const pico = acierto ? escena.pico : escena.picoFallo
        // Fallar cae un poco más allá del destino: se lee como "se pasó" en
        // vez de simplemente desaparecer a mitad de camino. En 'soltar' y
        // 'cortar' el recorrido es el mismo — lo que cambia es DÓNDE cae
        // (en 'cortar', al costado de la caja), y eso ya lo da la x.
        const destino = acierto || escena.direccion === 'soltar' || escena.direccion === 'cortar'
            ? escena.destinoY : 6
        function frame(t: number) {
            const p = Math.min(1, (t - inicio) / DURACION_MS)
            const y = origenY + (destino - origenY) * p + 4 * pico * p * (1 - p)
            setProyectil({
                y,
                escala: 1 - 0.28 * p,
                // Al acertar se desvanece al final (entró/quedó enganchado).
                opacidad: acierto && p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1,
            })
            if (p < 1) {
                rafRef.current = requestAnimationFrame(frame)
            } else {
                // Se le da aire al acierto para que la celebración se vea
                // entera antes de pasar al tiro siguiente; fallar corta
                // rápido, que es justamente el contraste que hace que ganar
                // se sienta.
                setCelebra(acierto ? 'acierto' : 'fallo')
                setTimeout(() => onResultado(acierto), acierto ? 900 : 420)
            }
        }
        rafRef.current = requestAnimationFrame(frame)
    }

    function resolver(acierto: boolean) {
        if (disparadoRef.current) return
        disparadoRef.current = true
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        setEstado(acierto ? 'acierto' : 'fallo')
        setProyectil(p => ({ ...p, opacidad: 1 }))
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
            // 'suave' = sinusoide limpia. 'irregular' le suma un armónico
            // más rápido y desfasado: el objetivo frena y acelera de forma
            // menos predecible, sin salirse nunca de la amplitud (los pesos
            // suman 1). Pedido del dueño para el globo de la tijera.
            const fase = transcurrido / 260
            const onda = escena.ritmo === 'irregular'
                ? 0.72 * Math.sin(fase) + 0.28 * Math.sin(3.3 * fase + 1.1)
                : Math.sin(fase)
            setPosObjetivo(50 + escena.amplitud * onda)
            setTiempoRestante(1 - transcurrido / tiempoMaximoMs)
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function tirar() {
        resolver(posObjetivo >= zona[0] && posObjetivo <= zona[1])
    }

    const { Fondo, FondoFrente, Objetivo, ObjetivoFrente, Proyectil } = escena
    const yaTiro = estado !== 'moviendo'
    // En 'cortar' el proyectil cae desde donde quedó el objetivo (el globo
    // congelado), no desde el centro: así fallar se VE — la etiqueta cae al
    // costado de la caja en vez de adentro.
    const proyectilX = escena.direccion === 'cortar' ? posObjetivo : 50

    return (
        <div style={{ width: '100%' }}>
            {/* Escena — toda clickeable (mejor que un botón aparte abajo:
                menos distancia entre lo que mirás y lo que tocás, y es lo que
                hacen los juegos de referencia).

                El contenedor es fluido pero con `aspectRatio` fijo: así el
                alto sale solo, sin JS y sin salto de layout al montar. Lo que
                hay adentro se dibuja SIEMPRE contra el lienzo de diseño
                (ANCHO_DISENO × ALTO_ESCENA) y se escala entero — ver el
                comentario de ANCHO_DISENO en escenas.tsx: sin esto, en un
                celular el objetivo (tamaño fijo en px) se cortaba contra el
                borde al llegar al extremo de su recorrido. */}
            <style>{`
                @keyframes orbjuegoAnillo {
                    0%   { opacity:.85; transform:translate(-50%,-50%) scale(.25) }
                    100% { opacity:0;   transform:translate(-50%,-50%) scale(2.6) }
                }
                @keyframes orbjuegoParticula {
                    0%   { opacity:1; transform:translateY(0) scale(1) }
                    70%  { opacity:1 }
                    100% { opacity:0; transform:translateY(-52px) scale(.35) }
                }
                @keyframes orbjuegoPremio {
                    0%   { opacity:0; transform:translate(-50%,6px)   scale(.5) }
                    40%  { opacity:1; transform:translate(-50%,-18px) scale(1.18) }
                    62%  { opacity:1; transform:translate(-50%,-24px) scale(1) }
                    100% { opacity:0; transform:translate(-50%,-52px) scale(.96) }
                }
                .orbjuego-anillo {
                    position:absolute; left:0; top:0; width:56px; height:56px; border-radius:50%;
                    border:3px solid rgba(255,255,255,.9);
                    box-shadow:0 0 18px rgba(250,204,21,.9);
                    animation:orbjuegoAnillo 620ms ease-out forwards;
                }
                .orbjuego-part-wrap { position:absolute; left:0; top:0; width:0; height:0; }
                .orbjuego-part {
                    display:block; width:7px; height:9px; margin-left:-3.5px;
                    animation:orbjuegoParticula 720ms cubic-bezier(.2,.7,.3,1) forwards;
                }
                .orbjuego-premio {
                    position:absolute; left:0; top:0; white-space:nowrap;
                    padding:5px 13px; border-radius:999px;
                    background:#16a34a; color:#fff; font-size:16px; font-weight:800; letter-spacing:.01em;
                    box-shadow:0 6px 18px rgba(0,0,0,.35), 0 0 0 2px rgba(255,255,255,.5);
                    animation:orbjuegoPremio 900ms cubic-bezier(.2,.7,.3,1) forwards;
                }
                /* Respeta a quien pidió menos animación en el sistema: se
                   mantiene el premio (es la información) y se sacan el
                   confeti y el destello, que son solo adorno. */
                @media (prefers-reduced-motion: reduce) {
                    .orbjuego-anillo, .orbjuego-part { display:none }
                    .orbjuego-premio { animation-duration:900ms; animation-timing-function:ease-out }
                }
            `}</style>
            <div
                ref={contenedorRef}
                onClick={yaTiro ? undefined : tirar}
                role="button"
                tabIndex={yaTiro ? -1 : 0}
                onKeyDown={e => { if (!yaTiro && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tirar() } }}
                aria-label={escena.instruccion}
                style={{
                    position: 'relative', width: '100%', maxWidth: ANCHO_DISENO * ESCALA_MAX, margin: '0 auto',
                    aspectRatio: `${ANCHO_DISENO} / ${ALTO_ESCENA}`,
                    borderRadius: 14, overflow: 'hidden',
                    cursor: yaTiro ? 'default' : 'pointer', userSelect: 'none',
                    boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.12), 0 8px 24px rgba(15,23,42,0.14)',
                }}
            >
                {/* Capa escalada: todo lo que es "mundo del juego". */}
                <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: ANCHO_DISENO, height: ALTO_ESCENA,
                    transform: `scale(${escala})`, transformOrigin: 'top left',
                }}>
                    <Fondo />

                    {/* Objetivo, capa de ATRÁS — se congela apenas se tira (el
                        RAF ya se canceló en resolver()), así lo que se ve
                        coincide exactamente con lo que se decidió en el tap. */}
                    <div style={{ position: 'absolute', left: `${posObjetivo}%`, top: escena.objetivoTop, transform: 'translateX(-50%)' }}>
                        <Objetivo estado={estado} etiqueta={etiqueta} />
                    </div>

                    {/* Proyectil — invisible hasta que se tira. Va ENTRE las dos
                        capas del objetivo: eso es lo que le da profundidad (la
                        pelota se ve entrar al aro, no pasarle por encima). */}
                    <div style={{
                        position: 'absolute', left: `${proyectilX}%`, bottom: proyectil.y,
                        transform: `translateX(-50%) scale(${proyectil.escala})`,
                        opacity: proyectil.opacidad, pointerEvents: 'none',
                    }}>
                        <Proyectil estado={estado} etiqueta={etiqueta} />
                    </div>

                    {/* Decorado fijo por delante (la cara de la caja en la
                        tijera) — no sigue al objetivo, a diferencia de abajo. */}
                    {FondoFrente && <FondoFrente />}

                    {/* Objetivo, capa de ADELANTE (aro, red, boca del hoyo). */}
                    {ObjetivoFrente && (
                        <div style={{ position: 'absolute', left: `${posObjetivo}%`, top: escena.objetivoTop, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                            <ObjetivoFrente estado={estado} />
                        </div>
                    )}
                </div>

                {/* ── Celebración del acierto ──────────────────────────────
                    Va FUERA de la capa escalada para que el texto se lea del
                    mismo tamaño en un celular, pero posicionada con la
                    escala aplicada a mano (objetivoTop está en px de diseño)
                    para que caiga justo sobre el objetivo. Antes acertar casi
                    no se notaba: solo se estiraba un poco la red. */}
                {celebra === 'acierto' && (
                    <div style={{
                        position: 'absolute', left: `${posObjetivo}%`,
                        top: (escena.objetivoTop + 46) * escala,
                        pointerEvents: 'none',
                    }}>
                        {/* destello que se expande */}
                        <span className="orbjuego-anillo" />
                        {/* confeti: cada partícula es un wrapper rotado + la
                            pieza que sale hacia "arriba" de ese wrapper, así
                            una sola animación sirve para las 12 direcciones */}
                        {CONFETI.map((c, i) => (
                            <span key={i} className="orbjuego-part-wrap" style={{ transform: `translate(-50%,-50%) rotate(${c.ang}deg)` }}>
                                <i className="orbjuego-part" style={{ background: c.color, animationDelay: `${c.delay}ms`, borderRadius: i % 3 === 0 ? '50%' : 2 }} />
                            </span>
                        ))}
                        {/* pastilla con lo que se ganó */}
                        <span className="orbjuego-premio">{etiqueta ?? '¡Bien!'}</span>
                    </div>
                )}

                {/* Barra de tiempo e instrucción van FUERA de la capa
                    escalada: son UI, no mundo del juego — así el texto se ve
                    del mismo tamaño y nítido en cualquier pantalla, en vez de
                    achicarse junto con la escena en un celular. */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(0,0,0,0.28)' }}>
                    <div style={{
                        height: '100%', width: `${tiempoRestante * 100}%`,
                        background: tiempoRestante < 0.3 ? '#ef4444' : '#facc15',
                        transition: 'width 80ms linear, background 200ms',
                    }} />
                </div>

                {/* Instrucción — solo hasta que se tira. */}
                {!yaTiro && (
                    <div style={{
                        position: 'absolute', left: 0, right: 0, top: 0, padding: '9px 12px',
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0))',
                        color: '#fff', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)', pointerEvents: 'none',
                    }}>
                        {escena.instruccion}
                    </div>
                )}
            </div>
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
    width: '100%', maxWidth: 300, height: 48, borderRadius: 10, background: 'var(--color-primary)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 8px 20px -6px var(--color-primary)', transition: 'transform 120ms ease, box-shadow 120ms ease',
}
// Mismo estilo que btnPrimario + hover/press — separado porque un <button>
// necesita los handlers de mouse para el hover (no hay :hover en style
// inline), y no todos los usos de btnPrimario lo necesitan (ej. "Jugar", que
// ya tenía el suyo propio antes de este cambio).
function BotonIrDeCompras({ slug }: { slug: string }) {
    const router = useRouter()
    const [hover, setHover] = useState(false)
    return (
        <button
            onClick={() => router.push(`/tienda/${slug}/catalogo`)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                ...btnPrimario,
                transform: hover ? 'translateY(-1px)' : 'none',
                boxShadow: hover ? '0 10px 24px -6px var(--color-primary)' : btnPrimario.boxShadow,
            }}
        >
            <ShoppingBag size={16} strokeWidth={2} /> Ir de compras
        </button>
    )
}
const btnGoogle: React.CSSProperties = {
    width: '100%', maxWidth: 300, height: 44, borderRadius: 10,
    background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
    fontSize: 13, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}

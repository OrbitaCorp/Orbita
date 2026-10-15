// ─── Ayuda del panel: primeros pasos + tutorial por módulo ───────────────────
//
// Reemplaza al tutorial de bienvenida anterior (cinco variantes que movían a la
// persona de sección en sección). Dos reglas, pensadas para el celular:
//   · NUNCA navega solo: el usuario toca un botón y recién ahí cambia de pantalla.
//   · Una sola cosa a la vez: o los primeros pasos, o el aviso del módulo.
//
// 1. Primeros pasos (solo dueño/admin): crear la primera categoría y el primer
//    producto. Un modal que lo pide, una tira fina mientras lo hace, y un
//    cierre cuando el producto existe (con el correo por verificar, si falta).
//    Qué mostrar lo decide decidirPrimerosPasos (puro, con tests).
// 2. Aviso por módulo: la primera vez que se entra a un módulo, una tarjeta
//    "¿Querés ver cómo funciona?" con [Ver tutorial] [Ahora no]. El tutorial es
//    la HojaTutorial, armada con temas del manual.
//
// Se monta en AdminLayout, debajo del banner de verificación de correo: la tira
// ocupa su lugar en el flujo; modales y tarjeta son fixed.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { X } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { adminPath } from '@/lib/tenant'
import { panelEstadoVerificacionEmail, panelGetTutorial } from '@/lib/api'
import { ayudaDe, claveDeAyuda } from './modulos'
import {
    COPY_PASO, SECCION_DEL_PASO, decidirPrimerosPasos, type VistaPrimerosPasos,
} from './primerosPasos'
import { ESTADO_AYUDA_VACIO, POSPONER_MS, guardarAyuda, leerAyuda, type EstadoAyuda } from './almacen'
import HojaTutorial from './HojaTutorial'
import Foco from './Foco'

// Mientras hay un paso a medias se vuelve a preguntar cada tanto: crear la
// categoría o el producto no cambia de ruta, y el cierre tiene que aparecer
// solo cuando el dato ya existe.
const REVISAR_CADA_MS = 5000

export default function AyudaHost() {
    const router = useRouter()
    const { user } = useAuth()
    const esMember = user?.type === 'member'
    const negocioId = user?.type === 'member' ? user.business.id : ''
    // Mismo criterio que el tutorial anterior: configurar la tienda es cosa del
    // dueño (o de un admin); a un empleado no se le pide cargar el catálogo.
    const esAdmin = user?.type === 'member' && (user.role === 'owner' || user.role === 'admin')

    const [ayuda, setAyuda] = useState<EstadoAyuda | null>(null)
    // "Más tarde" vigente. Se calcula al leer lo guardado y al tocarlo (no en el
    // render: la hora no es parte del estado de la pantalla).
    const [pospuesto, setPospuesto] = useState(false)
    const [cumplidas, setCumplidas] = useState<string[] | null>(null)
    const [fallo, setFallo] = useState(false)
    const [hojaAbierta, setHojaAbierta] = useState(false)
    // Clave del tutorial cuyo aviso se está mostrando ahora (no se vuelve a ofrecer).
    const [avisada, setAvisada] = useState<string | null>(null)
    const [avisoCerrado, setAvisoCerrado] = useState(false)
    // null = todavía no se sabe.
    const [correoVerificado, setCorreoVerificado] = useState<boolean | null>(null)

    const path = router.asPath.split(/[?#]/)[0]
    const segmentos = path.split('/').filter(Boolean)
    const seccion = segmentos[segmentos.length - 1] ?? ''
    const vista = typeof router.query.vista === 'string' ? router.query.vista : undefined
    // Qué tutorial corresponde a donde está parado (Apariencia tiene el suyo).
    const clave = claveDeAyuda(seccion, vista)

    // Lo recordado en este dispositivo (solo en el cliente).
    useEffect(() => {
        if (!negocioId) return
        const guardado = leerAyuda(negocioId)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAyuda(guardado)
        setPospuesto(guardado.pospuestoHasta > Date.now())
    }, [negocioId])

    const actualizarAyuda = useCallback((cambio: (a: EstadoAyuda) => EstadoAyuda) => {
        setAyuda(prev => {
            const base = prev ?? ESTADO_AYUDA_VACIO
            const nuevo = cambio(base)
            if (negocioId) guardarAyuda(negocioId, nuevo)
            return nuevo
        })
    }, [negocioId])

    // Qué tiene hecho el negocio (categoría/producto), deducido por la API.
    const ultimaConsulta = useRef(0)
    const consultar = useCallback((forzar = false) => {
        if (!esAdmin) return
        const ahora = Date.now()
        if (!forzar && ahora - ultimaConsulta.current < 3000) return
        ultimaConsulta.current = ahora
        panelGetTutorial()
            .then(r => { setCumplidas(r.cumplidas); setFallo(false) })
            // Sin respuesta no se muestra nada de los primeros pasos: mejor un
            // panel limpio que una tarjeta que pide algo que quizás ya está.
            .catch(() => setFallo(true))
    }, [esAdmin])

    useEffect(() => {
        if (!router.isReady || !negocioId) return
        consultar()
    }, [router.isReady, path, negocioId, consultar])

    useEffect(() => {
        const alVolver = () => { if (document.visibilityState === 'visible') consultar() }
        window.addEventListener('focus', alVolver)
        document.addEventListener('visibilitychange', alVolver)
        return () => {
            window.removeEventListener('focus', alVolver)
            document.removeEventListener('visibilitychange', alVolver)
        }
    }, [consultar])

    const primeros: VistaPrimerosPasos = !esAdmin || !ayuda
        ? { tipo: 'nada' }
        : decidirPrimerosPasos({ cumplidas, seccion, vista, pospuesto, enCurso: ayuda.enCurso })

    // Quien llegó a ver el modal o la tira está "en curso": al crear el producto
    // se le muestra el cierre. Quien ya tenía todo hecho antes nunca lo ve.
    const hayPasoVisible = primeros.tipo === 'modal' || primeros.tipo === 'tira'
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hayPasoVisible && ayuda && !ayuda.enCurso) actualizarAyuda(a => ({ ...a, enCurso: true }))
    }, [hayPasoVisible, ayuda, actualizarAyuda])

    // Con un paso a medias se revisa cada tanto si ya lo hizo.
    useEffect(() => {
        if (!hayPasoVisible) return
        const t = setInterval(() => consultar(true), REVISAR_CADA_MS)
        return () => clearInterval(t)
    }, [hayPasoVisible, consultar])

    // El cierre le avisa si falta verificar el correo; y si fue a verificarlo,
    // se vuelve a mirar hasta que lo haga, para preguntarle qué quiere hacer ahora.
    const hayCierre = primeros.tipo === 'listo'
    const esperando = !!ayuda?.esperaCorreo
    useEffect(() => {
        if (!hayCierre && !esperando) return
        let vigente = true
        const revisar = () => {
            panelEstadoVerificacionEmail()
                .then(e => { if (vigente) setCorreoVerificado(e.emailVerified) })
                // Sin respuesta se asume verificado: no se le pide verificar algo
                // que no podemos comprobar.
                .catch(() => { if (vigente) setCorreoVerificado(true) })
        }
        revisar()
        if (!esperando) return () => { vigente = false }
        const t = setInterval(revisar, REVISAR_CADA_MS)
        window.addEventListener('focus', revisar)
        return () => { vigente = false; clearInterval(t); window.removeEventListener('focus', revisar) }
    }, [hayCierre, esperando])

    // Con el producto creado y el correo verificado: qué sigue.
    const eleccionVisible = correoVerificado === true && (hayCierre || esperando)

    const ir = useCallback((destino: string, query?: Record<string, string>) => {
        const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
        void router.push(`${adminPath(negocioId, 'ventas', destino)}${qs}`)
    }, [router, negocioId])

    // ── Aviso por módulo ──
    // Espera a saber si hay primeros pasos pendientes (cumplidas o fallo) para
    // no mostrar dos cosas a la vez ni parpadear.
    const listoParaAviso = !!ayuda && (!esAdmin || cumplidas !== null || fallo)
    const modulo = ayudaDe(clave)
    const ofrecer = esMember && listoParaAviso && primeros.tipo === 'nada' && !eleccionVisible
        && !!modulo && !ayuda?.vistos.includes(clave)
    useEffect(() => {
        if (!ofrecer) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvisada(clave)
        setAvisoCerrado(false)
        setHojaAbierta(false)
        actualizarAyuda(a => ({ ...a, vistos: [...a.vistos, clave] }))
    }, [ofrecer, clave, actualizarAyuda])

    if (!esMember || !ayuda) return null

    // ── Primeros pasos ──
    if (primeros.tipo === 'tira') {
        // El foco resalta el botón de entrada de cada paso. Dentro del formulario
        // del producto no hay uno solo que tocar (son varios campos), así que ahí
        // acompaña únicamente la tira.
        const foco = primeros.paso === 'categoria'
            ? { objetivo: 'nueva-categoria', texto: 'Tocá acá para crear tu primera categoría' }
            : vista === 'nuevo' ? null : { objetivo: 'crear-producto', texto: 'Tocá acá para cargar tu primer producto' }
        return (
            <>
                <div role="status" style={{
                    padding: '9px 16px', fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-text)',
                    background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)',
                }}>
                    {primeros.texto}
                </div>
                {foco && <Foco key={foco.objetivo} objetivo={foco.objetivo} texto={foco.texto} />}
            </>
        )
    }
    if (primeros.tipo === 'modal') {
        const c = COPY_PASO[primeros.paso]
        return (
            <Tarjeta
                etiqueta={`Paso ${c.numero} de 2`}
                titulo={c.titulo}
                texto={c.texto}
                boton={c.boton}
                onBoton={() => ir(SECCION_DEL_PASO[primeros.paso], primeros.paso === 'producto' ? { vista: 'nuevo' } : undefined)}
                secundario="Más tarde"
                onSecundario={() => { setPospuesto(true); actualizarAyuda(a => ({ ...a, pospuestoHasta: Date.now() + POSPONER_MS })) }}
            />
        )
    }
    if (eleccionVisible) {
        const cerrar = () => actualizarAyuda(a => ({ ...a, enCurso: false, esperaCorreo: false }))
        return (
            <Tarjeta
                etiqueta="Listo"
                titulo="¿Qué querés hacer ahora?"
                texto="Ya tenés tu primer producto y tu correo verificado. ¿Querés seguir creando productos o ver cómo personalizar tu página web?"
                boton="Seguir creando productos"
                onBoton={() => { cerrar(); ir('catalogo', { vista: 'nuevo' }) }}
                secundario="Personalizar mi página web"
                onSecundario={() => { cerrar(); ir('configuracion', { vista: 'apariencia' }) }}
                cerrar={cerrar}
            />
        )
    }
    if (primeros.tipo === 'listo') {
        // Hasta saber si el correo está verificado no se muestra nada: evita un
        // parpadeo del cierre equivocado.
        if (correoVerificado === null) return null
        const cerrar = () => actualizarAyuda(a => ({ ...a, enCurso: false }))
        return (
            <Tarjeta
                etiqueta="Listo"
                titulo="¡Ya tenés tu primer producto!"
                texto="Tu tienda ya tiene algo para mostrar. Último paso: verificá tu correo para poder recuperar tu cuenta si alguna vez perdés el acceso."
                boton="Verificar mi correo"
                onBoton={() => { actualizarAyuda(a => ({ ...a, enCurso: false, esperaCorreo: true })); ir('perfil') }}
                secundario="Después"
                onSecundario={cerrar}
                cerrar={cerrar}
            />
        )
    }

    // ── Aviso por módulo ──
    const ayudaAbierta = hojaAbierta ? ayudaDe(avisada ?? clave) : null
    return (
        <>
            {avisada === clave && !avisoCerrado && !hojaAbierta && modulo && (
                <div role="region" aria-label="Tutorial del módulo" className="ayu-aviso" style={{
                    position: 'fixed', zIndex: 150, left: 12, right: 12,
                    bottom: 'calc(12px + env(safe-area-inset-bottom))',
                    maxWidth: 420, marginLeft: 'auto',
                    background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)',
                    borderRadius: 14, padding: '14px 16px', boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
                }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>
                        ¿Querés ver cómo funciona {modulo.titulo}?
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={() => setHojaAbierta(true)} style={botonPrimario}>Ver tutorial</button>
                        <button type="button" onClick={() => setAvisoCerrado(true)} style={botonSecundario}>Ahora no</button>
                    </div>
                </div>
            )}
            {ayudaAbierta && (
                <HojaTutorial
                    ayuda={ayudaAbierta}
                    onCerrar={() => { setHojaAbierta(false); setAvisoCerrado(true) }}
                    onManual={() => { setHojaAbierta(false); setAvisoCerrado(true); ir('manual') }}
                />
            )}
        </>
    )
}

const botonBase: React.CSSProperties = {
    minHeight: 44, padding: '0 18px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14.5, fontWeight: 600,
}
const botonPrimario: React.CSSProperties = { ...botonBase, flex: 1, border: 'none', background: 'var(--color-primary)', color: '#fff' }
const botonSecundario: React.CSSProperties = { ...botonBase, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }

function Tarjeta(props: {
    etiqueta: string
    titulo: string
    texto: string
    boton: string
    onBoton: () => void
    secundario?: string
    onSecundario: () => void
    /** Qué hace tocar afuera o la X (por defecto, lo mismo que el secundario). */
    cerrar?: () => void
}) {
    const principal = useRef<HTMLButtonElement>(null)
    useEffect(() => { principal.current?.focus() }, [])
    return (
        <div
            onClick={props.cerrar ?? props.onSecundario}
            style={{
                position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                padding: 12, background: 'rgba(15, 23, 42, 0.45)',
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={props.titulo}
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 440, background: 'var(--color-bg)', color: 'var(--color-text)',
                    borderRadius: 16, padding: '22px 20px calc(20px + env(safe-area-inset-bottom))',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)', position: 'relative',
                }}
            >
                {props.secundario && (
                    <button type="button" onClick={props.cerrar ?? props.onSecundario} aria-label="Cerrar" style={{
                        position: 'absolute', top: 8, right: 8, width: 40, height: 40, border: 'none',
                        background: 'none', color: 'var(--color-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <X size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                )}
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', marginBottom: 6 }}>{props.etiqueta}</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.3 }}>{props.titulo}</h2>
                <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.6, color: 'var(--color-body)' }}>{props.texto}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button ref={principal} type="button" onClick={props.onBoton} style={{ ...botonPrimario, minHeight: 50, fontSize: 16 }}>
                        {props.boton}
                    </button>
                    {props.secundario && (
                        <button type="button" onClick={props.onSecundario} style={props.cerrar ? botonSecundario : { ...botonSecundario, border: 'none', color: 'var(--color-muted)' }}>
                            {props.secundario}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

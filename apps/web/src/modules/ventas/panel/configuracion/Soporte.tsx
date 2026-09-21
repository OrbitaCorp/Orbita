// src/modules/ventas/panel/configuracion/Soporte.tsx — Vista "Soporte"
//
// Consultas al equipo de Órbita, con historial. Antes era un formulario que
// mandaba un mail y listo: no se sabía cuándo respondían, ni qué se había
// preguntado, ni se podía adjuntar una captura. Ahora cada consulta es un
// hilo (ver SoporteHilo.tsx) que queda en la lista de abajo, con estado, y
// la columna lateral dice de entrada cuánto tardamos, si el sistema está
// andando y qué temas del manual suelen resolver la duda sin escribir.
//
// Estados de la columna principal, decididos por la URL (siempre con
// ?vista=soporte, que es lo que ConfigGeneral.tsx usa para llegar acá):
//   · sin ?consulta       → formulario nuevo + lista "Tus consultas"
//   · ?consulta=<id>      → el hilo de esa consulta (SoporteHilo)
// Se navega con router.push shallow para que "atrás" del navegador vuelva
// del hilo a la lista sin recargar nada.
//
// La categoría se puede precargar por query param (?vista=soporte&categoria=DOMINIO)
// — la usa Dominios.tsx para linkear acá con "Dominios" ya seleccionado
// cuando alguien pide un .com.ar. Fuera de eso NO hay categoría elegida de
// entrada: "Otra consulta" preseleccionado era lo que más consultas mandaba
// al cajón equivocado.

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { LifeBuoy, Check, Mail, Clock, Activity, BookOpen, ArrowRight, Send, Lightbulb, Inbox } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { adminPath, currentSlug } from '@/lib/tenant'
import {
    panelListSupportRequests, panelSendSupportRequest, panelUploadSupportAttachment,
    type SupportAttachment, type SupportCategory, type SupportRequestDetail, type SupportRequestRow,
} from '@/lib/api'
import { CAPITULOS, textoPlano } from '@/modules/ventas/panel/manual/contenido'
import { SoporteAdjuntos, agregarAdjuntos, type AdjuntoLocal } from './SoporteAdjuntos'
import { SoporteHilo } from './SoporteHilo'
import {
    CATEGORIAS, EstadoPill, categoriaDe, fechaRelativa, hhmm, leerVistos, marcarVisto, normalizar, sinLeer, type Vistos,
    mensajeParaElNegocio,
} from './SoporteComun'

// Promesa PÚBLICA de soporte: la lee todo el que abre la pantalla y aparece
// también en el mail de confirmación, así que es un compromiso del equipo.
// Confirmada por Ale el 21/09/2026 (48 horas hábiles, no 24); si cambia,
// se cambia acá y en ningún otro lado.
export const PROMESA_SOPORTE = {
    texto: 'Menos de 48 horas hábiles',
    horario: 'Lunes a viernes de 9 a 18 (hora de Argentina)',
}

// Misma base que lib/api.ts (que no la exporta). /health es público y se
// pide sin sesión: no pasa por authedFetch a propósito, para que un 401 de
// una sesión vencida no se confunda con "el sistema está caído".
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// Los temas del manual que más consultas evitan. Los ids son los de
// contenido.ts (capítulo → tema); si se renombra uno allá, se renombra acá.
const ATAJOS_MANUAL: { capId: string; temaId: string; label: string }[] = [
    { capId: 'configuracion', temaId: 'cfg-pagos',    label: 'Conectar Mercado Pago y medios de pago' },
    { capId: 'configuracion', temaId: 'cfg-envios',   label: 'Envíos: transportes y costos' },
    { capId: 'configuracion', temaId: 'cfg-dominios', label: 'Dominio propio (.com, .com.ar)' },
    { capId: 'arranque',      temaId: 'publicar',     label: 'Publicar la tienda' },
]

// ─── Buscador del manual para "¿Es esto lo que buscás?" ─────────────────────
// Índice a nivel de módulo: se arma una vez por carga, no por tecla. Título y
// texto plano sin tildes ni mayúsculas (normalizar), para que "envio" dé con
// "Envíos" y "mercadopago" no, porque nadie lo escribe igual dos veces.
const INDICE_MANUAL = CAPITULOS.flatMap(cap => cap.temas.map(t => ({
    capId: cap.id, capTitulo: cap.titulo, temaId: t.id, titulo: t.titulo,
    tituloN: normalizar(t.titulo), textoN: normalizar(textoPlano(t)),
})))
type TemaIndexado = (typeof INDICE_MANUAL)[number]

// Palabras que aparecen en todos los temas y no dicen nada de la consulta.
const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'mi', 'que', 'no', 'se', 'por', 'para', 'con', 'del', 'al', 'es', 'me', 'lo', 'le', 'su', 'tengo', 'quiero', 'como', 'puedo', 'hay'])

function buscarEnManual(consulta: string): TemaIndexado[] {
    // Raíz de 5 letras en vez de la palabra entera: "comprar" encuentra
    // "comprás", "dominio" encuentra "dominios". Barato y alcanza para esto.
    const raices = normalizar(consulta).split(/[^a-z0-9]+/)
        .filter(p => p.length >= 3 && !VACIAS.has(p))
        .map(p => (p.length > 5 ? p.slice(0, 5) : p))
    if (raices.length === 0) return []
    const minimo = raices.length >= 2 ? 2 : 1
    const puntuados: { t: TemaIndexado; puntos: number }[] = []
    for (const t of INDICE_MANUAL) {
        let puntos = 0
        for (const r of raices) {
            if (t.tituloN.includes(r)) puntos += 3
            else if (t.textoN.includes(r)) puntos += 1
        }
        if (puntos >= minimo) puntuados.push({ t, puntos })
    }
    return puntuados.sort((a, b) => b.puntos - a.puntos).slice(0, 3).map(x => x.t)
}

type Salud = { estado: 'cargando' } | { estado: 'ok' | 'sin-verificar'; hora: string }
type Errores = { categoria?: string; asunto?: string; mensaje?: string }

export default function Soporte() {
    const router = useRouter()
    const { user } = useAuth()
    const email = user?.type === 'member' ? user.member.email : null
    // El registro de "visto" es por negocio: el mismo miembro puede tener
    // acceso a dos negocios con consultas distintas.
    const businessId = user && 'business' in user ? user.business.id : 'sin-negocio'

    const consultaId = typeof router.query.consulta === 'string' ? router.query.consulta : null

    // ── Formulario ──
    const [categoria, setCategoria] = useState<SupportCategory | null>(null)
    const [asunto, setAsunto] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [telefono, setTelefono] = useState('')
    const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>([])
    const [errorAdjuntos, setErrorAdjuntos] = useState<string | null>(null)
    const [errores, setErrores] = useState<Errores>({})
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [progreso, setProgreso] = useState<string | null>(null)
    const [enviada, setEnviada] = useState<SupportRequestDetail | null>(null)
    const [asuntoBuscado, setAsuntoBuscado] = useState('')

    const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
    const asuntoRef = useRef<HTMLInputElement>(null)
    const mensajeRef = useRef<HTMLTextAreaElement>(null)
    const catsLabelId = useId()
    const errCatId = useId()
    const errAsuntoId = useId()
    const errMensajeId = useId()
    const sugerenciasId = useId()

    // ── Lista y lateral ──
    const [consultas, setConsultas] = useState<SupportRequestRow[] | null>(null)
    const [errorLista, setErrorLista] = useState<string | null>(null)
    const [vistos, setVistos] = useState<Vistos>({})
    const [salud, setSalud] = useState<Salud>({ estado: 'cargando' })

    // Precarga de categoría por query param — se limpia apenas se captura,
    // mismo criterio que otras vueltas con query param en el proyecto
    // (Inicio.tsx con la vuelta de Google), para no dejar la URL colgada
    // con un parámetro que ya cumplió su función.
    useEffect(() => {
        if (!router.isReady) return
        const { categoria: cat, ...resto } = router.query
        if (typeof cat === 'string' && CATEGORIAS.some(c => c.value === cat)) {
            setCategoria(cat as SupportCategory)
            void router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady])

    // Lo visto se lee al montar y no en el useState inicial: localStorage no
    // existe en el servidor y el getter puede tirar (ver SoporteComun).
    useEffect(() => {
        setVistos(leerVistos(businessId))
    }, [businessId])

    async function cargarLista() {
        try {
            const r = await panelListSupportRequests()
            setConsultas(r.data)
            setErrorLista(null)
        } catch (e) {
            // Nunca el texto crudo de la API ("Cannot GET /api/v1/support" mientras
            // el backend viejo no tiene el endpoint): el negocio no tiene que leer
            // eso. El detalle va a la consola para quien depure.
            console.error('[soporte] no se pudo cargar la lista', e)
            setErrorLista('No pudimos cargar tus consultas. Probá de nuevo en un rato.')
        }
    }

    // La lista se pide al entrar y cada vez que se vuelve del hilo: si desde
    // el hilo se respondió, el estado y la fecha de esa fila cambiaron.
    useEffect(() => {
        if (!router.isReady || consultaId) return
        void cargarLista()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, consultaId])

    // Estado del sistema: un ping a /health con tope de 5s. Si falla, NO se
    // dice que está caído: lo más probable es la red de quien mira, y un
    // "caído" falso genera justo las consultas que esta columna quiere evitar.
    useEffect(() => {
        let vivo = true
        const ctrl = new AbortController()
        const timer = window.setTimeout(() => ctrl.abort(), 5000)
        fetch(`${API_BASE}/health`, { signal: ctrl.signal, cache: 'no-store' })
            .then(r => { if (vivo) setSalud({ estado: r.ok ? 'ok' : 'sin-verificar', hora: hhmm(new Date()) }) })
            .catch(() => { if (vivo) setSalud({ estado: 'sin-verificar', hora: hhmm(new Date()) }) })
            .finally(() => window.clearTimeout(timer))
        return () => { vivo = false; window.clearTimeout(timer); ctrl.abort() }
    }, [])

    // Sugerencias del manual: el asunto se "asienta" 250ms después de la
    // última tecla y recién ahí se busca. La búsqueda en sí es derivada.
    useEffect(() => {
        const q = asunto.trim()
        const t = window.setTimeout(() => setAsuntoBuscado(q), 250)
        return () => window.clearTimeout(t)
    }, [asunto])
    const sugerencias = asuntoBuscado.length >= 3 ? buscarEnManual(asuntoBuscado) : []

    // ── Navegación ──
    function abrirConsulta(id: string) {
        void router.push({ query: { ...router.query, consulta: id } }, undefined, { shallow: true })
    }
    function volverALista() {
        const resto = { ...router.query }
        delete resto.consulta
        void router.push({ query: resto }, undefined, { shallow: true })
    }
    // Mismo armado del pathname que piezas.tsx del manual: el hash es el
    // ancla del tema (man-<capId>-<temaId>), y el manual lo lee al abrirse.
    function irAlManual(capId?: string, temaId?: string) {
        const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        void router.push({
            pathname: adminPath(negocioId, moduloPadre, 'manual'),
            ...(capId && temaId ? { hash: `man-${capId}-${temaId}` } : {}),
        })
    }

    function onDetalleHilo(d: SupportRequestDetail, motivo: 'carga' | 'respuesta') {
        setVistos(marcarVisto(businessId, d.id, d.lastMessageAt))
        if (motivo === 'respuesta') void cargarLista()
    }

    // ── Categoría: grupo de radios con foco itinerante ──
    // Un solo chip entra en el orden de tabulación (el elegido, o el primero
    // si no hay ninguno); las flechas recorren y eligen, como en un grupo de
    // radios nativo. Space/Enter también eligen, por si alguien llega con Tab.
    const focoIndex = Math.max(0, CATEGORIAS.findIndex(c => c.value === categoria))
    function elegirCategoria(value: SupportCategory) {
        setCategoria(value)
        if (errores.categoria) setErrores({ ...errores, categoria: undefined })
    }
    function onKeyDownChip(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
        const n = CATEGORIAS.length
        let destino = -1
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') destino = (i + 1) % n
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') destino = (i - 1 + n) % n
        else if (e.key === 'Home') destino = 0
        else if (e.key === 'End') destino = n - 1
        else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            elegirCategoria(CATEGORIAS[i].value)
            return
        }
        if (destino < 0) return
        e.preventDefault()
        elegirCategoria(CATEGORIAS[destino].value)
        chipRefs.current[destino]?.focus()
    }

    // ── Adjuntos (elegir/arrastrar y pegar pasan por acá) ──
    function agregar(archivos: File[]) {
        const r = agregarAdjuntos(adjuntos, archivos)
        setAdjuntos(r.lista)
        setErrorAdjuntos(r.error)
    }
    function quitar(id: string) {
        setAdjuntos(adjuntos.filter(a => a.id !== id))
        setErrorAdjuntos(null)
    }
    function onPasteMensaje(e: React.ClipboardEvent<HTMLTextAreaElement>) {
        const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
        if (files.length === 0) return
        e.preventDefault()
        agregar(files)
    }

    // ── Enviar ──
    // El botón nunca se deshabilita por validez: se valida al tocarlo, se
    // marca cada campo con su error y el foco va al primero que falta. Un
    // botón apagado no explica qué falta; un error debajo del campo sí.
    async function enviar() {
        if (enviando) return
        const errs: Errores = {}
        if (!categoria) errs.categoria = 'Elegí de qué se trata.'
        if (asunto.trim().length < 3) errs.asunto = 'Contanos en pocas palabras de qué se trata.'
        if (mensaje.trim().length < 10) errs.mensaje = 'Escribí un poco más de detalle: al menos una oración.'
        setErrores(errs)
        if (errs.categoria) { chipRefs.current[focoIndex]?.focus(); return }
        if (errs.asunto) { asuntoRef.current?.focus(); return }
        if (errs.mensaje) { mensajeRef.current?.focus(); return }
        if (!categoria) return

        setEnviando(true)
        setErrorEnvio(null)
        try {
            // Las capturas se suben recién acá, de a una, para que el botón
            // pueda decir en cuál va. Si una falla, el formulario queda
            // intacto y se reintenta todo (lo ya subido se vuelve a subir:
            // es más simple que reconciliar, y son a lo sumo tres imágenes).
            const subidos: SupportAttachment[] = []
            for (let i = 0; i < adjuntos.length; i++) {
                setProgreso(`Subiendo ${i + 1} de ${adjuntos.length}…`)
                subidos.push(await panelUploadSupportAttachment(adjuntos[i].file, adjuntos[i].nombre))
            }
            setProgreso('Enviando…')
            const det = await panelSendSupportRequest({
                category: categoria,
                subject: asunto.trim(),
                message: mensaje.trim(),
                contactPhone: telefono.trim() || undefined,
                ...(subidos.length > 0 ? { attachments: subidos } : {}),
            })
            setEnviada(det)
            limpiarFormulario()
            void cargarLista()
        } catch (e) {
            setErrorEnvio(mensajeParaElNegocio(e, 'No se pudo enviar tu consulta. Probá de nuevo en un momento.'))
        } finally {
            setEnviando(false)
            setProgreso(null)
        }
    }

    function limpiarFormulario() {
        setCategoria(null)
        setAsunto('')
        setMensaje('')
        setTelefono('')
        setAdjuntos([])
        setErrorAdjuntos(null)
        setErrores({})
        setErrorEnvio(null)
        setAsuntoBuscado('')
    }

    const abiertas = consultas?.filter(c => c.status === 'OPEN').length ?? 0

    return (
        <div className="sop-page panel-page">
            <style>{`
                .sop-grid { display: grid; grid-template-columns: minmax(0,1fr) 300px; gap: 20px; align-items: start; }
                .sop-main { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
                .sop-lateral { position: sticky; top: 16px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
                @media (max-width: 1023px) {
                    /* Una columna: la lateral pasa abajo del formulario. Sticky
                       ahí no tiene sentido y taparía la lista. */
                    .sop-grid { grid-template-columns: minmax(0,1fr); }
                    .sop-lateral { position: static; }
                }
                .sop-chip { transition: background 150ms ease, border-color 150ms ease, color 150ms ease; }
                .sop-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                /* Input de archivo fuera de la vista pero enfocable: el label es
                   el botón. Cuando el input tiene foco de teclado, el anillo se
                   dibuja sobre el label, que es lo que se ve. */
                .sop-file-input { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
                .sop-file-input:focus-visible + .sop-file-label { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                .sop-drop { position: relative; transition: border-color 150ms ease, background 150ms ease; }
                .sop-fila { transition: background 150ms ease; }
                .sop-fila:hover { background: var(--color-surface-alt); }
                .sop-fila:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
                .sop-link { transition: color 150ms ease; }
                .sop-link:hover { text-decoration: underline; text-underline-offset: 3px; }
                .sop-link:focus-visible, .sop-adjunto:focus-visible, .sop-quitar:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
                .sop-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
                @media (prefers-reduced-motion: reduce) {
                    .sop-page * { transition-duration: 0.01ms !important; animation: none !important; }
                }
                @media (max-width: 768px) {
                    .sop-page h1 { font-size: 21px !important; }
                    /* Las categorías caían una por renglón, cada chip ocupando
                       un cuarto del ancho: quedaba una lista flaca y larga. */
                    .sop-cats { display: grid !important; grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important; gap: 8px !important; }
                    .sop-cats > .sop-chip {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 44px !important;
                        padding: 6px 10px !important;
                        justify-content: center !important;
                        text-align: center !important;
                        line-height: 1.25 !important;
                    }
                    /* Campos y botón de envío a todo el ancho, con área táctil
                       cómoda; 16px evita el zoom automático de iOS al enfocar. */
                    .sop-form input, .sop-form textarea, .sop-textarea { font-size: 16px !important; }
                    .sop-enviar { width: 100% !important; min-height: 46px !important; justify-content: center !important; }
                    .sop-file-label { min-height: 44px !important; }
                    .sop-quitar { width: 44px !important; height: 44px !important; }
                    /* Filas de la lista como tarjeta: número y estado arriba,
                       asunto abajo a todo el ancho, fecha al pie. */
                    .sop-fila { grid-template-areas: "num estado" "main main" "fecha fecha" !important; grid-template-columns: minmax(0,1fr) auto !important; row-gap: 6px !important; }
                    .sop-fila-fecha { text-align: left !important; }
                    .sop-sugerencia { min-height: 44px !important; }
                }
            `}</style>

            {!consultaId && (
                <header style={{ marginBottom: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                            <LifeBuoy size={19} strokeWidth={1.8} color="var(--color-primary)" aria-hidden="true" />
                        </div>
                        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Soporte</h1>
                        {consultas && consultas.length > 0 && (
                            <span style={{ fontSize: 12.5, color: 'var(--color-subtle)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'} · {abiertas} {abiertas === 1 ? 'abierta' : 'abiertas'}
                            </span>
                        )}
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
                        Escribinos por lo que sea: dominios, pagos, un problema técnico o una duda. Cada consulta queda acá con su respuesta.
                    </p>
                </header>
            )}

            <div className="sop-grid">
                <div className="sop-main">
                    {consultaId ? (
                        <SoporteHilo id={consultaId} onVolver={volverALista} onDetalle={onDetalleHilo} />
                    ) : (
                        <>
                            {/* ── Nueva consulta ── */}
                            <Card padding="md">
                                {enviada ? (
                                    <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '24px 8px' }}>
                                        <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-success-bg)' }}>
                                            <Check size={24} strokeWidth={2.5} color="var(--color-success)" aria-hidden="true" />
                                        </div>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>Consulta #{enviada.number} recibida</div>
                                        <div style={{ fontSize: 13.5, color: 'var(--color-muted)', maxWidth: 400, lineHeight: 1.6 }}>
                                            Te respondemos en {PROMESA_SOPORTE.texto.toLowerCase()}{email ? <> a <strong style={{ color: 'var(--color-body)', fontWeight: 600 }}>{email}</strong></> : ' al correo de tu cuenta'}. La respuesta también queda en esta pantalla.
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                                            <Button variant="primary" size="sm" onClick={() => abrirConsulta(enviada.id)}>Ver la consulta</Button>
                                            <Button variant="secondary" size="sm" onClick={() => setEnviada(null)}>Hacer otra consulta</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <form className="sop-form" noValidate onSubmit={e => { e.preventDefault(); void enviar() }}>
                                        <div id={catsLabelId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>¿Sobre qué es tu consulta?</div>
                                        <div
                                            role="radiogroup"
                                            aria-labelledby={catsLabelId}
                                            aria-describedby={errores.categoria ? errCatId : undefined}
                                            aria-invalid={errores.categoria ? true : undefined}
                                            className="sop-cats"
                                            style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                                        >
                                            {CATEGORIAS.map((c, i) => {
                                                const activa = categoria === c.value
                                                return (
                                                    <button
                                                        key={c.value}
                                                        ref={el => { chipRefs.current[i] = el }}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={activa}
                                                        tabIndex={i === focoIndex ? 0 : -1}
                                                        className="sop-chip"
                                                        onClick={() => elegirCategoria(c.value)}
                                                        onKeyDown={e => onKeyDownChip(e, i)}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px',
                                                            borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                                                            border: `1.5px solid ${activa ? 'var(--color-primary)' : errores.categoria ? 'var(--color-error)' : 'var(--color-border)'}`,
                                                            background: activa ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                                            color: activa ? 'var(--color-primary)' : 'var(--color-body)',
                                                        }}
                                                    >
                                                        <c.Icon size={14} strokeWidth={2} aria-hidden="true" />
                                                        {c.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {errores.categoria && <div id={errCatId} style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 8 }}>{errores.categoria}</div>}

                                        {/* Asunto */}
                                        <div style={{ marginTop: 18 }}>
                                            <label htmlFor="sop-asunto" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Asunto</label>
                                            <input
                                                id="sop-asunto"
                                                ref={asuntoRef}
                                                value={asunto}
                                                onChange={e => { setAsunto(e.target.value); if (errores.asunto) setErrores({ ...errores, asunto: undefined }) }}
                                                placeholder="Ej: Quiero comprar un dominio .com.ar"
                                                autoComplete="off"
                                                disabled={enviando}
                                                aria-invalid={errores.asunto ? true : undefined}
                                                aria-describedby={errores.asunto ? errAsuntoId : undefined}
                                                className="ds-field"
                                                style={{ width: '100%', boxSizing: 'border-box', height: 40, border: `1px solid ${errores.asunto ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                                            />
                                            {errores.asunto && <div id={errAsuntoId} style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 6 }}>{errores.asunto}</div>}
                                        </div>

                                        {/* Sugerencias del manual: aparecen mientras se escribe el asunto */}
                                        <div id={sugerenciasId} aria-live="polite">
                                            {sugerencias.length > 0 && (
                                                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--color-info-bg)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--color-info)', marginBottom: 6 }}>
                                                        <Lightbulb size={13} strokeWidth={2} aria-hidden="true" /> ¿Es esto lo que buscás?
                                                    </div>
                                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {sugerencias.map(s => (
                                                            <li key={`${s.capId}-${s.temaId}`}>
                                                                <button
                                                                    type="button"
                                                                    className="sop-link sop-sugerencia"
                                                                    onClick={() => irAlManual(s.capId, s.temaId)}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '2px 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left' }}
                                                                >
                                                                    <span style={{ fontWeight: 500 }}>{s.titulo}</span>
                                                                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>· {s.capTitulo}</span>
                                                                    <ArrowRight size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Detalle */}
                                        <div style={{ marginTop: 14 }}>
                                            <label htmlFor="sop-mensaje" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Contanos el detalle</label>
                                            <textarea
                                                id="sop-mensaje"
                                                ref={mensajeRef}
                                                value={mensaje}
                                                onChange={e => { setMensaje(e.target.value); if (errores.mensaje) setErrores({ ...errores, mensaje: undefined }) }}
                                                onPaste={onPasteMensaje}
                                                placeholder="Cuanto más detalle nos des, más rápido te podemos ayudar. Podés pegar una captura acá con Ctrl+V."
                                                rows={6}
                                                disabled={enviando}
                                                aria-invalid={errores.mensaje ? true : undefined}
                                                aria-describedby={errores.mensaje ? errMensajeId : undefined}
                                                className="ds-field"
                                                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${errores.mensaje ? 'var(--color-error)' : 'var(--color-border)'}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit', resize: 'vertical', minHeight: 120 }}
                                            />
                                            {errores.mensaje && <div id={errMensajeId} style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 6 }}>{errores.mensaje}</div>}
                                        </div>

                                        {/* Adjuntos */}
                                        <div style={{ marginTop: 14 }}>
                                            <SoporteAdjuntos adjuntos={adjuntos} onAgregar={agregar} onQuitar={quitar} error={errorAdjuntos} disabled={enviando} />
                                        </div>

                                        {/* Teléfono */}
                                        <div style={{ marginTop: 14 }}>
                                            <label htmlFor="sop-telefono" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6 }}>Teléfono (opcional)</label>
                                            <input
                                                id="sop-telefono"
                                                value={telefono}
                                                onChange={e => setTelefono(e.target.value)}
                                                placeholder="Por si preferís que te llamemos"
                                                inputMode="tel"
                                                autoComplete="tel"
                                                disabled={enviando}
                                                className="ds-field"
                                                style={{ width: '100%', boxSizing: 'border-box', height: 40, border: '1px solid var(--color-border)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--color-text)', background: 'var(--color-bg)', fontFamily: 'inherit' }}
                                            />
                                        </div>

                                        {errorEnvio && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-error)', marginTop: 14 }}>{errorEnvio}</div>}

                                        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <Button type="submit" variant="primary" className="sop-enviar" loading={enviando} icon={enviando ? undefined : <Send size={14} strokeWidth={2} aria-hidden="true" />}>
                                                {progreso ?? 'Enviar consulta'}
                                            </Button>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--color-subtle)' }}>
                                                <Mail size={12} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} />
                                                <span>Te respondemos al correo de tu cuenta{email ? ` (${email})` : ''}.</span>
                                            </div>
                                        </div>
                                    </form>
                                )}
                            </Card>

                            {/* ── Tus consultas ── */}
                            <Card padding="md" style={{ padding: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 12px' }}>
                                    <Inbox size={16} strokeWidth={1.8} color="var(--color-muted)" aria-hidden="true" />
                                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Tus consultas</h2>
                                </div>
                                {errorLista ? (
                                    <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span role="alert" style={{ fontSize: 13, color: 'var(--color-error)' }}>{errorLista}</span>
                                        <Button variant="secondary" size="sm" onClick={() => void cargarLista()}>Reintentar</Button>
                                    </div>
                                ) : consultas === null ? (
                                    <div aria-live="polite" style={{ padding: '0 16px 16px', fontSize: 13, color: 'var(--color-muted)' }}>Cargando…</div>
                                ) : consultas.length === 0 ? (
                                    <div style={{ padding: '0 16px 18px', fontSize: 13.5, color: 'var(--color-muted)' }}>Todavía no hiciste ninguna consulta.</div>
                                ) : (
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        {consultas.map(c => <FilaConsulta key={c.id} c={c} nueva={sinLeer(vistos, c)} onAbrir={() => abrirConsulta(c.id)} />)}
                                    </ul>
                                )}
                            </Card>
                        </>
                    )}
                </div>

                {/* ── Lateral ── */}
                <aside className="sop-lateral" aria-label="Información de soporte">
                    <BloqueLateral Icon={Clock} titulo="Tiempo de respuesta">
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{PROMESA_SOPORTE.texto}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{PROMESA_SOPORTE.horario}</div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: 'var(--color-body)', marginTop: 10, overflowWrap: 'anywhere' }}>
                            <Mail size={13} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-muted)' }} />
                            <span>Te respondemos a {email ? <strong style={{ fontWeight: 600 }}>{email}</strong> : 'tu correo'}</span>
                        </div>
                    </BloqueLateral>

                    <BloqueLateral Icon={Activity} titulo="Estado del sistema">
                        {/* El punto de color nunca va solo: el texto dice lo mismo. */}
                        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>
                            <span aria-hidden="true" style={{
                                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                                background: salud.estado === 'ok' ? 'var(--color-success)' : salud.estado === 'sin-verificar' ? 'var(--color-warning)' : 'var(--color-border-strong)',
                            }} />
                            {salud.estado === 'cargando' ? 'Revisando…' : salud.estado === 'ok' ? 'Todo funcionando' : 'No pudimos verificar el estado'}
                        </div>
                        {salud.estado !== 'cargando' && (
                            <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 4 }}>Revisado {salud.hora}</div>
                        )}
                    </BloqueLateral>

                    <BloqueLateral Icon={BookOpen} titulo="Antes de escribir">
                        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 8 }}>Lo que más nos preguntan ya está explicado en el manual:</div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {ATAJOS_MANUAL.map(a => (
                                <li key={`${a.capId}-${a.temaId}`}>
                                    <button
                                        type="button"
                                        className="sop-link"
                                        onClick={() => irAlManual(a.capId, a.temaId)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 32, padding: '4px 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <span>{a.label}</span>
                                        <ArrowRight size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            className="sop-link"
                            onClick={() => irAlManual()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, marginTop: 6, padding: 0, background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}
                        >
                            Abrir el manual completo
                            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                    </BloqueLateral>
                </aside>
            </div>
        </div>
    )
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function BloqueLateral({ Icon, titulo, children }: { Icon: typeof Clock; titulo: string; children: React.ReactNode }) {
    return (
        <Card padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Icon size={14} strokeWidth={2} color="var(--color-muted)" aria-hidden="true" />
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-subtle)' }}>{titulo}</h2>
            </div>
            {children}
        </Card>
    )
}

// Una fila de "Tus consultas". Es un botón entero (no un link por celda) para
// que en celular la tarjeta completa sea el área táctil.
function FilaConsulta({ c, nueva, onAbrir }: { c: SupportRequestRow; nueva: boolean; onAbrir: () => void }) {
    const cat = categoriaDe(c.category)
    return (
        <li>
            <button
                type="button"
                className="sop-fila"
                onClick={onAbrir}
                style={{
                    display: 'grid', gridTemplateAreas: '"num main estado fecha"', gridTemplateColumns: '52px minmax(0,1fr) auto auto',
                    alignItems: 'center', columnGap: 12, width: '100%', minHeight: 56, padding: '12px 16px', boxSizing: 'border-box',
                    background: 'transparent', border: 'none', borderTop: '1px solid var(--color-border)',
                    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'var(--color-text)',
                }}
            >
                <span style={{ gridArea: 'num', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    #{c.number}
                    {nueva && (
                        <>
                            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                            <span className="sop-sr">Respuesta sin leer</span>
                        </>
                    )}
                </span>
                <span style={{ gridArea: 'main', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: nueva ? 700 : 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-muted)', marginTop: 2, minWidth: 0 }}>
                        <cat.Icon size={12} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{cat.label}</span>
                        <span aria-hidden="true">·</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.member.name}</span>
                    </span>
                </span>
                <span style={{ gridArea: 'estado' }}><EstadoPill estado={c.status} /></span>
                <span className="sop-fila-fecha" style={{ gridArea: 'fecha', fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 64 }}>
                    <span className="sop-sr">Última actividad </span>
                    <time dateTime={c.lastMessageAt}>{fechaRelativa(c.lastMessageAt)}</time>
                </span>
            </button>
        </li>
    )
}

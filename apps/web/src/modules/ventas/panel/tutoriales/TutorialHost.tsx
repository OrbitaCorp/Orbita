// ─── Host del tutorial de bienvenida ─────────────────────────────────────────
//
// Montado en AdminLayout. Lee el estado del tutorial de la base al entrar al
// panel (GET /business/tutorial): si el negocio nunca lo tocó arranca la
// Checklist desde cero; si quedó a medias la retoma; si está terminado no
// renderiza nada. Cada avance se guarda en la base (PUT), así el progreso
// acompaña al negocio en cualquier dispositivo. ?tutorial=<variante> fuerza
// una variante (?tutorial=checklist2, la segunda etapa) — ver contrato en
// estado.ts. Qué se muestra al abrir lo decide resolverAlAbrir (pura, con
// tests): es donde vive la regla de las dos etapas de la Checklist.

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { adminPath } from '@/lib/tenant'
import { useAuth } from '@/lib/auth/AuthContext'
import { panelGetTutorial, panelSetTutorial } from '@/lib/api'
import {
    EstadoTutorial, QUERY_ETAPA_2, TUTORIAL_INICIAL, Variante, VARIANTES,
    desdeRemoto, etapaDe, inicial, resolverAlAbrir,
} from './estado'

export interface PropsVariante {
    estado: EstadoTutorial
    /** Mergea y persiste una parte del estado. */
    actualizar: (parcial: Partial<EstadoTutorial>) => void
    /** Marca el tutorial como terminado y lo saca de pantalla. */
    terminar: () => void
    /** Vuelve a arrancar la misma variante desde cero. */
    reiniciar: () => void
    /** Tareas que la API detectó como cumplidas de verdad (se tildan solas
        y no se pueden destildar). Siempre están incluidas en estado.hechas. */
    hechasAuto: string[]
    /** Segmento de sección actual de la URL (dashboard, pedidos, catalogo…). */
    seccionActual: string
    /** Navega a una sección del panel preservando negocioId/subdominio. */
    irA: (moduloPadre: string, seccion: string, query?: Record<string, string>) => void
    nombreUsuario?: string
}

const VARIANTE_COMPONENTES: Record<Variante, ComponentType<PropsVariante>> = {
    recorrido: dynamic(() => import('./VarianteRecorrido'), { ssr: false }),
    checklist: dynamic(() => import('./VarianteChecklist'), { ssr: false }),
    tooltips: dynamic(() => import('./VarianteTooltips'), { ssr: false }),
    bienvenida: dynamic(() => import('./VarianteBienvenida'), { ssr: false }),
    asistente: dynamic(() => import('./VarianteAsistente'), { ssr: false }),
}

export default function TutorialHost() {
    const router = useRouter()
    const { user } = useAuth()
    const [estado, setEstado] = useState<EstadoTutorial | null>(null)
    const [hechasAuto, setHechasAuto] = useState<string[]>([])
    // Con ?limpio=1: no se tilda solo nada, ni al abrir ni en el re-chequeo en
    // vivo. Solo para probar; un dueño real nunca entra por acá.
    const [sinAutotilde, setSinAutotilde] = useState(false)

    const negocioId = user?.type === 'member' ? user.business.id : ''
    const nombreUsuario = user?.type === 'member' ? user.member.name?.split(' ')[0] : undefined

    // Guardado en la base, fire-and-forget: el tutorial no puede trabar el
    // panel. Si un PUT falla, el siguiente avance vuelve a mandar el estado
    // completo (siempre se manda entero, no deltas), así se autocorrige.
    const guardar = useCallback((e: EstadoTutorial) => {
        panelSetTutorial(e).catch(() => { /* se reintenta con el próximo avance */ })
    }, [])

    // Activación: por query (?tutorial=...) o según lo que diga la base.
    // Sin guards por ref: en dev React monta/desmonta/monta el effect y un
    // guard así descartaba la respuesta del GET. La bandera `vigente` alcanza.
    const queryTutorial = typeof router.query.tutorial === 'string' ? router.query.tutorial : null
    // ?limpio=1 junto con ?tutorial=... arranca SIN tildar lo que el negocio ya
    // tiene hecho. Existe para poder probar el tutorial en una tienda con datos:
    // sin esto, en un negocio real que ya cargó productos, conectó Mercado Pago
    // y publicó, la tarjeta abre con todo tildado y parece que no arrancó.
    // No cambia nada para un dueño de verdad, que nunca lleva esta query.
    const limpio = router.query.limpio === '1'
    useEffect(() => {
        if (!router.isReady || !negocioId) return
        let vigente = true
        // La query es un disparador de una sola vez: se consume y se saca de
        // la URL, así recargar o compartir el link no vuelve a arrancar el
        // tutorial desde cero. Se saca DESPUÉS de que la base tenga el estado
        // nuevo: al cambiar la query este effect vuelve a correr y relee.
        const sacarQuery = () => {
            if (!vigente) return
            const { tutorial: _t, limpio: _l, ...resto } = router.query
            void router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        }
        if (queryTutorial === 'off') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEstado(null)
            // "off" = no mostrar más nada: se guarda como etapa 2 terminada.
            // Con etapa 1 (o sin etapa) resolverAlAbrir podría arrancar la
            // segunda etapa en la próxima visita, que es lo contrario de "off".
            panelSetTutorial({ ...inicial(TUTORIAL_INICIAL, 2), fase: 'terminado' })
                .catch(() => { /* la relectura de abajo muestra lo que haya */ })
                .finally(sacarQuery)
            return () => { vigente = false }
        }
        if (queryTutorial === QUERY_ETAPA_2) {
            // Segunda etapa de la Checklist desde cero, para probarla sin
            // pasar por la primera.
            const nuevo = inicial('checklist', 2)
            if (limpio) setSinAutotilde(true)
            setEstado(nuevo)
            panelSetTutorial(nuevo)
                .catch(() => { /* idem */ })
                .finally(sacarQuery)
            return () => { vigente = false }
        }
        if (queryTutorial && (VARIANTES as readonly string[]).includes(queryTutorial)) {
            const nuevo = inicial(queryTutorial as Variante)
            if (limpio) setSinAutotilde(true)
            setEstado(nuevo)
            panelSetTutorial(nuevo)
                .catch(() => { /* idem */ })
                .finally(sacarQuery)
            return () => { vigente = false }
        }
        // Sin query: lo que diga la base. Las tareas cumplidas de verdad
        // (`cumplidas`) se suman a las hechas y, si cambió algo, se persiste.
        // Nunca lo tocó → arranca la Checklist; ya terminó la primera etapa
        // antes de que existiera la segunda → arranca la segunda (ver
        // ETAPA_2_PARA_QUIEN_YA_TERMINO); terminado de verdad → nada.
        panelGetTutorial()
            .then(({ tutorial, cumplidas }) => {
                if (!vigente) return
                setHechasAuto(cumplidas)
                const { estado: resuelto, persistir } = resolverAlAbrir(desdeRemoto(tutorial), cumplidas)
                if (resuelto && persistir) guardar(resuelto)
                setEstado(resuelto)
            })
            .catch(() => {
                // Sin respuesta de la API no se muestra nada: mejor un panel
                // limpio que un tutorial que no puede guardar su progreso.
            })
        return () => { vigente = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, queryTutorial, limpio, negocioId])

    // Re-chequeo en vivo de las cumplidas: al cambiar de sección (creó el
    // producto y volvió a la lista, volvió del OAuth de MP...) y al volver a
    // la pestaña. Solo con el tutorial activo y como mucho una vez cada 3s.
    const path = router.asPath.split(/[?#]/)[0]
    const activo = !!estado && estado.fase === 'activo'
    const ultimoChequeo = useRef(0)
    useEffect(() => {
        if (!activo || !negocioId || sinAutotilde) return
        let vigente = true
        const chequear = () => {
            if (sinAutotilde) return
            const ahora = Date.now()
            if (ahora - ultimoChequeo.current < 3000) return
            ultimoChequeo.current = ahora
            panelGetTutorial()
                .then(({ cumplidas }) => {
                    if (!vigente) return
                    setHechasAuto(cumplidas)
                    setEstado(prev => {
                        if (!prev || prev.fase !== 'activo') return prev
                        const faltan = cumplidas.filter(id => !prev.hechas.includes(id))
                        if (!faltan.length) return prev
                        const proximo = { ...prev, hechas: [...prev.hechas, ...faltan] }
                        guardar(proximo)
                        return proximo
                    })
                })
                .catch(() => { /* se reintenta en el próximo cambio */ })
        }
        chequear()
        const alVolver = () => { if (document.visibilityState === 'visible') chequear() }
        window.addEventListener('focus', chequear)
        document.addEventListener('visibilitychange', alVolver)
        return () => {
            vigente = false
            window.removeEventListener('focus', chequear)
            document.removeEventListener('visibilitychange', alVolver)
        }
    }, [path, activo, negocioId, sinAutotilde, guardar])

    const actualizar = useCallback((parcial: Partial<EstadoTutorial>) => {
        setEstado(prev => {
            if (!prev) return prev
            const proximo = { ...prev, ...parcial }
            guardar(proximo)
            return proximo
        })
    }, [guardar])

    const terminar = useCallback(() => {
        setEstado(prev => {
            if (prev) guardar({ ...prev, fase: 'terminado' })
            return null
        })
    }, [guardar])

    const reiniciar = useCallback(() => {
        setEstado(prev => {
            if (!prev) return prev
            // Reiniciar es "esta etapa desde cero", no volver a la primera.
            // En la Checklist `paso` marca que la presentación de la segunda
            // etapa ya se vio: reiniciar borra los tildes, no la presentación.
            const nuevo = inicial(prev.variante, etapaDe(prev))
            if (prev.variante === 'checklist') nuevo.paso = prev.paso
            guardar(nuevo)
            return nuevo
        })
    }, [guardar])

    const irA = useCallback((moduloPadre: string, seccion: string, query?: Record<string, string>) => {
        const base = adminPath(negocioId, moduloPadre, seccion)
        const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
        void router.push(`${base}${qs}`)
    }, [router, negocioId])

    if (!estado || estado.fase !== 'activo') return null

    // Sección actual = último segmento del path (sin query/hash).
    const segmentos = path.split('/').filter(Boolean)
    const seccionActual = segmentos[segmentos.length - 1] ?? ''

    const Componente = VARIANTE_COMPONENTES[estado.variante]
    return (
        // key por etapa: al pasar de la primera a la segunda la variante se
        // remonta y su estado local (acordeón, guía, hoja) arranca limpio.
        <Componente
            key={`${estado.variante}-${etapaDe(estado)}`}
            estado={estado}
            actualizar={actualizar}
            terminar={terminar}
            reiniciar={reiniciar}
            hechasAuto={hechasAuto}
            seccionActual={seccionActual}
            irA={irA}
            nombreUsuario={nombreUsuario}
        />
    )
}

// ─── Host del tutorial de bienvenida ─────────────────────────────────────────
//
// Montado en AdminLayout. Lee el estado del tutorial de la base al entrar al
// panel (GET /business/tutorial): si el negocio nunca lo tocó arranca la
// Checklist desde cero; si quedó a medias la retoma; si está terminado no
// renderiza nada. Cada avance se guarda en la base (PUT), así el progreso
// acompaña al negocio en cualquier dispositivo. ?tutorial=<variante> fuerza
// una variante — ver contrato en estado.ts.

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { adminPath } from '@/lib/tenant'
import { useAuth } from '@/lib/auth/AuthContext'
import { panelGetTutorial, panelSetTutorial } from '@/lib/api'
import {
    EstadoTutorial, TUTORIAL_INICIAL, Variante, VARIANTES,
    desdeRemoto, inicial,
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
    useEffect(() => {
        if (!router.isReady || !negocioId) return
        let vigente = true
        // La query es un disparador de una sola vez: se consume y se saca de
        // la URL, así recargar o compartir el link no vuelve a arrancar el
        // tutorial desde cero. Se saca DESPUÉS de que la base tenga el estado
        // nuevo: al cambiar la query este effect vuelve a correr y relee.
        const sacarQuery = () => {
            if (!vigente) return
            const { tutorial: _t, ...resto } = router.query
            void router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
        }
        if (queryTutorial === 'off') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEstado(null)
            panelSetTutorial({ ...inicial(TUTORIAL_INICIAL), fase: 'terminado' })
                .catch(() => { /* la relectura de abajo muestra lo que haya */ })
                .finally(sacarQuery)
            return () => { vigente = false }
        }
        if (queryTutorial && (VARIANTES as readonly string[]).includes(queryTutorial)) {
            const nuevo = inicial(queryTutorial as Variante)
            setEstado(nuevo)
            panelSetTutorial(nuevo)
                .catch(() => { /* idem */ })
                .finally(sacarQuery)
            return () => { vigente = false }
        }
        // Sin query: lo que diga la base. Las tareas cumplidas de verdad
        // (`cumplidas`) se suman a las hechas y, si cambió algo, se persiste.
        panelGetTutorial()
            .then(({ tutorial, cumplidas }) => {
                if (!vigente) return
                setHechasAuto(cumplidas)
                const remoto = desdeRemoto(tutorial)
                if (remoto === null) {
                    // Nunca lo tocó: arranca la Checklist y queda registrado.
                    const nuevo = { ...inicial(TUTORIAL_INICIAL), hechas: cumplidas }
                    guardar(nuevo)
                    setEstado(nuevo)
                    return
                }
                if (remoto.fase !== 'activo') { setEstado(null); return }
                const faltan = cumplidas.filter(id => !remoto.hechas.includes(id))
                const conAuto = faltan.length ? { ...remoto, hechas: [...remoto.hechas, ...faltan] } : remoto
                if (faltan.length) guardar(conAuto)
                setEstado(conAuto)
            })
            .catch(() => {
                // Sin respuesta de la API no se muestra nada: mejor un panel
                // limpio que un tutorial que no puede guardar su progreso.
            })
        return () => { vigente = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, queryTutorial, negocioId])

    // Re-chequeo en vivo de las cumplidas: al cambiar de sección (creó el
    // producto y volvió a la lista, volvió del OAuth de MP...) y al volver a
    // la pestaña. Solo con el tutorial activo y como mucho una vez cada 3s.
    const path = router.asPath.split(/[?#]/)[0]
    const activo = !!estado && estado.fase === 'activo'
    const ultimoChequeo = useRef(0)
    useEffect(() => {
        if (!activo || !negocioId) return
        let vigente = true
        const chequear = () => {
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
    }, [path, activo, negocioId, guardar])

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
            const nuevo = inicial(prev.variante)
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
        <Componente
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

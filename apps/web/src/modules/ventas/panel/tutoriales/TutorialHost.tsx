// ─── Host de las 5 variantes de tutorial de bienvenida (demo interna) ────────
//
// Montado en AdminLayout. Por defecto NO renderiza nada: solo se activa vía
// ?tutorial=<variante> (o si quedó un tutorial a medias en sessionStorage).
// Ver contrato de activación en estado.ts y la guía de demo en
// docs/demo-tutoriales-onboarding.md.

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { adminPath } from '@/lib/tenant'
import { useAuth } from '@/lib/auth/AuthContext'
import {
    EstadoTutorial, Variante, VARIANTES,
    arrancar, guardarEstado, leerEstado, limpiarEstado,
} from './estado'

export interface PropsVariante {
    estado: EstadoTutorial
    /** Mergea y persiste una parte del estado. */
    actualizar: (parcial: Partial<EstadoTutorial>) => void
    /** Marca el tutorial como terminado y lo saca de pantalla. */
    terminar: () => void
    /** Vuelve a arrancar la misma variante desde cero. */
    reiniciar: () => void
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

    const negocioId = user?.type === 'member' ? user.business.id : ''
    const nombreUsuario = user?.type === 'member' ? user.member.name?.split(' ')[0] : undefined

    // Activación por query (?tutorial=...) o reanudación desde sessionStorage.
    // Los setEstado sincrónicos están bien acá: el effect corre solo cuando
    // cambia el query param (mount o navegación), no en cada render.
    const queryTutorial = typeof router.query.tutorial === 'string' ? router.query.tutorial : null
    useEffect(() => {
        if (!router.isReady) return
        if (queryTutorial === 'off') {
            limpiarEstado()
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEstado(null)
            return
        }
        if (queryTutorial && (VARIANTES as readonly string[]).includes(queryTutorial)) {
            // La URL con ?tutorial=X SIEMPRE arranca de cero: recargar la
            // pestaña de la demo = reiniciar la demo.
            setEstado(arrancar(queryTutorial as Variante))
            return
        }
        // Sin query: retomar solo un tutorial que quedó activo.
        const guardado = leerEstado()
        if (guardado?.fase === 'activo') setEstado(guardado)
    }, [router.isReady, queryTutorial])

    const actualizar = useCallback((parcial: Partial<EstadoTutorial>) => {
        setEstado(prev => {
            if (!prev) return prev
            const proximo = { ...prev, ...parcial }
            guardarEstado(proximo)
            return proximo
        })
    }, [])

    const terminar = useCallback(() => {
        setEstado(prev => {
            if (prev) guardarEstado({ ...prev, fase: 'terminado' })
            return null
        })
    }, [])

    const reiniciar = useCallback(() => {
        setEstado(prev => (prev ? arrancar(prev.variante) : prev))
    }, [])

    const irA = useCallback((moduloPadre: string, seccion: string, query?: Record<string, string>) => {
        const base = adminPath(negocioId, moduloPadre, seccion)
        const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
        void router.push(`${base}${qs}`)
    }, [router, negocioId])

    if (!estado || estado.fase !== 'activo') return null

    // Sección actual = último segmento del path (sin query/hash).
    const path = router.asPath.split(/[?#]/)[0]
    const segmentos = path.split('/').filter(Boolean)
    const seccionActual = segmentos[segmentos.length - 1] ?? ''

    const Componente = VARIANTE_COMPONENTES[estado.variante]
    return (
        <Componente
            estado={estado}
            actualizar={actualizar}
            terminar={terminar}
            reiniciar={reiniciar}
            seccionActual={seccionActual}
            irA={irA}
            nombreUsuario={nombreUsuario}
        />
    )
}

// ─── Tira horizontal con indicador de scroll ─────────────────────────────────
//
// En celular varias barras del panel (las secciones de Configuración, las
// pestañas por estado de Pedidos, filtros varios) no entran en 390px y pasan a
// scrollear de costado. El scrollbar nativo no se ve en mobile, así que sin una
// señal el usuario no sabe que hay más opciones a la derecha: parecía que la
// lista terminaba en la última que entraba.
//
// Esto resuelve las dos mitades de ese problema, una sola vez para todo el panel:
//   · una barrita finita debajo de la tira que muestra cuánto hay y dónde estás
//     (se esconde sola cuando todo entra, así en escritorio no aparece nunca);
//   · centrar el elemento activo al entrar y al cambiar de opción, para que
//     nunca quede tapado y se vea que hay vecinos a los costados.
//
// Uso:
//   const { scrollerRef, hintRef } = useTiraScroll(activa)
//   <div ref={scrollerRef} className="ds-tira" >…botones con data-activa…</div>
//   <TiraScrollHint hintRef={hintRef} />
//
// El elemento activo se marca con data-activa="true" (no con una clase: así el
// hook no necesita saber nada del diseño de quien lo usa).

import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'

export function useTiraScroll<S extends HTMLElement = HTMLDivElement>(
    /** Valor que identifica la opción activa: al cambiar, se recentra. */
    activa?: string | number | null,
    /** Apagarlo en escritorio, donde la tira no scrollea. Por defecto, siempre. */
    habilitado = true,
) {
    const scrollerRef = useRef<S>(null)
    const hintRef = useRef<HTMLDivElement>(null)

    // Centrar el activo. scrollTo del contenedor y no scrollIntoView: este
    // último también scrollea la página en vertical para "traerlo a la vista".
    useEffect(() => {
        if (!habilitado) return
        const sc = scrollerRef.current
        const el = sc?.querySelector<HTMLElement>('[data-activa="true"]')
        if (!sc || !el) return
        sc.scrollTo({ left: el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }, [activa, habilitado])

    // Pintar la barrita. Directo sobre el DOM y no con estado: si no, sería un
    // render por píxel scrolleado.
    useEffect(() => {
        const sc = scrollerRef.current
        const hint = hintRef.current
        const pista = hint?.firstElementChild as HTMLElement | null
        const pulgar = pista?.firstElementChild as HTMLElement | null
        if (!sc || !hint || !pista || !pulgar) return

        const pintar = () => {
            const total = sc.scrollWidth
            const visible = sc.clientWidth
            // Entra todo (o está apagada): no hay nada que indicar.
            if (!habilitado || total <= visible + 1) { hint.style.visibility = 'hidden'; return }
            hint.style.visibility = 'visible'
            const largo = pista.clientWidth
            const ancho = Math.max(28, (visible / total) * largo)
            const x = (sc.scrollLeft / (total - visible)) * (largo - ancho)
            pulgar.style.width = `${ancho}px`
            pulgar.style.transform = `translateX(${x}px)`
        }

        pintar()
        sc.addEventListener('scroll', pintar, { passive: true })
        window.addEventListener('resize', pintar)
        // El contenido de la tira puede cambiar (contadores que cargan, tabs que
        // aparecen por permisos) y con eso cambia si hay overflow o no.
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pintar) : null
        ro?.observe(sc)
        return () => {
            sc.removeEventListener('scroll', pintar)
            window.removeEventListener('resize', pintar)
            ro?.disconnect()
        }
    }, [activa, habilitado])

    return { scrollerRef, hintRef }
}

/** La barrita en sí. Los estilos viven en globals.css (.ds-tira-*). */
export function TiraScrollHint({
    hintRef,
    className,
    style,
}: {
    hintRef: RefObject<HTMLDivElement | null>
    className?: string
    style?: CSSProperties
}) {
    return (
        <div ref={hintRef} aria-hidden className={className ? `ds-tira-hint ${className}` : 'ds-tira-hint'} style={style}>
            <div className="ds-tira-pista">
                <div className="ds-tira-pulgar" />
            </div>
        </div>
    )
}

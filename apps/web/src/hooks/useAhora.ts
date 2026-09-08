import { useEffect, useState } from 'react'

/**
 * "Ahora" en milisegundos, refrescado cada `intervaloMs`, para todo lo que
 * cuenta tiempo hacia adelante (relojes, "faltan X días", "ya venció").
 *
 * Existe porque `Date.now()` no se puede llamar durante el render: el compilador
 * de React lo rechaza (regla `react-hooks/purity`) — un valor que cambia solo
 * hace que dos renders del mismo estado den resultados distintos. Acá el
 * tiempo entra por estado, que es la forma correcta de tener algo que cambia.
 *
 * Devuelve `null` en el primer render (todavía no corrió ningún efecto): quien
 * lo use tiene que decidir qué mostrar mientras tanto, normalmente nada.
 *
 * `hasta` (timestamp) corta el intervalo cuando se llega a esa marca: una
 * cuenta regresiva que ya terminó no tiene por qué seguir renderizando una vez
 * por segundo mientras la pestaña siga abierta.
 */
export function useAhora(activo = true, intervaloMs = 1000, hasta?: number): number | null {
    const [ahora, setAhora] = useState<number | null>(null)

    useEffect(() => {
        if (!activo) return
        // El primer valor va por timeout y no derecho: un setState síncrono
        // dentro de un efecto encadena un render extra (y el lint lo marca).
        // El costo es un frame sin reloj, que no se ve.
        const primero = setTimeout(() => setAhora(Date.now()), 0)
        const id = setInterval(() => {
            const n = Date.now()
            setAhora(n)
            if (hasta !== undefined && n >= hasta) clearInterval(id)
        }, intervaloMs)
        return () => { clearTimeout(primero); clearInterval(id) }
    }, [activo, intervaloMs, hasta])

    return ahora
}

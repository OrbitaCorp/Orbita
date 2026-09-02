// ─── Estado del tutorial de bienvenida ───────────────────────────────────────
//
// La variante elegida por el equipo es la CHECKLIST (tarjeta de primeros
// pasos con cursor fantasma). Arranca sola apenas se termina de crear la
// cuenta: el onboarding manda al panel con `?tutorial=checklist` (ver
// `conTutorialInicial`), el host la arranca y limpia la query de la URL.
//
// El estado vive en localStorage bajo una clave POR NEGOCIO: así la lista
// sobrevive a cerrar la pestaña, abrir otra o volver a loguearse en el mismo
// navegador, y dos negocios distintos en el mismo navegador no se pisan.
// Nada de esto toca backend: en otro dispositivo el tutorial no se retoma
// (la persistencia por cuenta necesita un flag server-side que hoy no existe
// — ver auth.service.ts getMe).
//
// Contrato de activación:
//   · ?tutorial=<variante>  → ARRANCA esa variante desde cero (aunque ya se
//     haya visto) y saca la query de la URL. Las otras cuatro variantes
//     siguen accesibles así solo para probarlas.
//   · ?tutorial=off         → apaga y limpia todo.
//   · sin query             → continúa lo que haya en localStorage (así el
//     tutorial sobrevive a la navegación interna del panel y a la recarga).
//   · sin query y sin estado → no se muestra NADA.

export const VARIANTES = ['recorrido', 'checklist', 'tooltips', 'bienvenida', 'asistente'] as const
export type Variante = (typeof VARIANTES)[number]

/** La variante que arranca sola para una cuenta recién creada. */
export const TUTORIAL_INICIAL: Variante = 'checklist'

/**
 * Agrega `?tutorial=checklist` a la URL a la que el onboarding manda al
 * panel. Sirve tanto para paths relativos (`/admin/...`) como para URLs
 * absolutas al subdominio de la tienda (`https://x.orbita.site/panel`).
 */
export function conTutorialInicial(url: string): string {
    const [sinHash, hash = ''] = url.split('#')
    const sep = sinHash.includes('?') ? '&' : '?'
    return `${sinHash}${sep}tutorial=${TUTORIAL_INICIAL}${hash ? `#${hash}` : ''}`
}

export interface EstadoTutorial {
    variante: Variante
    fase: 'activo' | 'terminado'
    /** Paso actual (recorrido / bienvenida / asistente). */
    paso: number
    /** Checklist: ids de tareas marcadas como hechas. */
    hechas: string[]
    /** Checklist: tarjeta minimizada a píldora. */
    minimizado: boolean
    /** Tooltips: secciones cuyos tips ya se mostraron. */
    seccionesVistas: string[]
}

const clave = (negocioId: string) => `orbita-tutorial:${negocioId}`

const inicial = (variante: Variante): EstadoTutorial => ({
    variante, fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [],
})

export function leerEstado(negocioId: string): EstadoTutorial | null {
    if (typeof window === 'undefined' || !negocioId) return null
    try {
        const crudo = window.localStorage.getItem(clave(negocioId))
        if (!crudo) return null
        const e = JSON.parse(crudo) as EstadoTutorial
        if (!VARIANTES.includes(e.variante)) return null
        return { ...inicial(e.variante), ...e }
    } catch {
        return null
    }
}

export function guardarEstado(negocioId: string, e: EstadoTutorial): void {
    if (!negocioId) return
    try { window.localStorage.setItem(clave(negocioId), JSON.stringify(e)) } catch { /* modo privado, etc. */ }
}

export function limpiarEstado(negocioId: string): void {
    if (!negocioId) return
    try { window.localStorage.removeItem(clave(negocioId)) } catch { /* idem */ }
}

/** Arranca (o re-arranca) una variante desde cero y devuelve el estado nuevo. */
export function arrancar(negocioId: string, variante: Variante): EstadoTutorial {
    const e = inicial(variante)
    guardarEstado(negocioId, e)
    return e
}

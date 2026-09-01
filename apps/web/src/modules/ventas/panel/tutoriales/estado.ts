// ─── Estado del tutorial (demo interna) ──────────────────────────────────────
//
// El estado vive en sessionStorage bajo UNA clave. sessionStorage y no
// localStorage A PROPÓSITO: es POR PESTAÑA, así la demo puede tener 5
// pestañas del mismo panel corriendo una variante distinta cada una sin
// pisarse entre sí (con localStorage compartirían estado). Sobrevive a la
// recarga de la pestaña, que es lo único que la demo necesita.
//
// Nada de esto toca backend: es un prototipo para decidir qué variante se
// implementa en serio (la definitiva necesita un flag de "primer login"
// server-side; hoy no existe — ver auth.service.ts getMe, que no expone
// lastAccessAt — y persistencia por cuenta, no por navegador).
//
// Contrato de activación (documentado en docs/demo-tutoriales-onboarding.md):
//   · ?tutorial=<variante>  → ARRANCA esa variante desde cero (aunque ya se
//     haya visto). Recargar la pestaña con esa URL = reiniciar la demo.
//   · ?tutorial=off         → apaga y limpia todo.
//   · sin query             → continúa lo que haya en localStorage (así el
//     tutorial sobrevive a la navegación interna del panel).
//   · sin query y sin estado → no se muestra NADA (comportamiento default
//     intacto para usuarios reales).

export const VARIANTES = ['recorrido', 'checklist', 'tooltips', 'bienvenida', 'asistente'] as const
export type Variante = (typeof VARIANTES)[number]

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

const CLAVE = 'orbita-tutorial-demo'

const inicial = (variante: Variante): EstadoTutorial => ({
    variante, fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [],
})

export function leerEstado(): EstadoTutorial | null {
    if (typeof window === 'undefined') return null
    try {
        const crudo = window.sessionStorage.getItem(CLAVE)
        if (!crudo) return null
        const e = JSON.parse(crudo) as EstadoTutorial
        if (!VARIANTES.includes(e.variante)) return null
        return { ...inicial(e.variante), ...e }
    } catch {
        return null
    }
}

export function guardarEstado(e: EstadoTutorial): void {
    try { window.sessionStorage.setItem(CLAVE, JSON.stringify(e)) } catch { /* modo privado, etc. */ }
}

export function limpiarEstado(): void {
    try { window.sessionStorage.removeItem(CLAVE) } catch { /* idem */ }
}

/** Arranca (o re-arranca) una variante desde cero y devuelve el estado nuevo. */
export function arrancar(variante: Variante): EstadoTutorial {
    const e = inicial(variante)
    guardarEstado(e)
    return e
}

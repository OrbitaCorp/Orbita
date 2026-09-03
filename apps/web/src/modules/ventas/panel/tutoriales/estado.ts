// ─── Estado del tutorial de bienvenida ───────────────────────────────────────
//
// La variante elegida por el equipo es la CHECKLIST (tarjeta de primeros
// pasos con cursor fantasma). Arranca sola para TODO negocio que todavía no
// la tocó, en cualquier dispositivo.
//
// El estado vive en la base, en businesses.tutorial (JSONB), y se lee y
// guarda por GET/PUT /business/tutorial (ver lib/api.ts panelGetTutorial /
// panelSetTutorial). NULL en la base = nunca se tocó = arrancar desde cero.
// Cuando el dueño termina las tareas u oculta la tarjeta queda fase
// 'terminado' y no se le vuelve a mostrar en ningún lado.
//
// El shape es espejo de TutorialStateDto en apps/api (update-tutorial.dto.ts):
// si cambia uno, cambia el otro.
//
// Contrato de activación:
//   · sin query            → lo que diga la base (null → arranca la Checklist).
//   · ?tutorial=<variante> → ARRANCA esa variante desde cero (aunque ya se
//     haya visto) y saca la query de la URL. Sirve para probar las otras
//     cuatro variantes o para re-mostrar la Checklist a alguien.
//   · ?tutorial=off        → la marca terminada (deja de mostrarse).

export const VARIANTES = ['recorrido', 'checklist', 'tooltips', 'bienvenida', 'asistente'] as const
export type Variante = (typeof VARIANTES)[number]

/** La variante que arranca sola para un negocio que nunca tocó el tutorial. */
export const TUTORIAL_INICIAL: Variante = 'checklist'

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

/** Estado inicial de una variante, desde cero. */
export function inicial(variante: Variante): EstadoTutorial {
    return { variante, fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] }
}

/** Normaliza lo que vino de la base: shape completo o null si no sirve. */
export function desdeRemoto(crudo: unknown): EstadoTutorial | null {
    if (!crudo || typeof crudo !== 'object') return null
    const e = crudo as Partial<EstadoTutorial>
    if (!e.variante || !(VARIANTES as readonly string[]).includes(e.variante)) return null
    return { ...inicial(e.variante), ...e, fase: e.fase === 'terminado' ? 'terminado' : 'activo' }
}

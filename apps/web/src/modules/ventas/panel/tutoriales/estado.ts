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
// La Checklist tiene DOS etapas (pedido de Ale, 15/09): la 1 deja la tienda
// operativa (datos, MP, categorías, producto, envíos, publicar) y la 2 cubre
// los módulos que la 1 no toca (pedidos, clientes, plantillas, descuentos,
// equipo, apariencia, notificaciones). Misma UI, mismas piezas, mismo
// mecanismo de tildado; cambia la lista de tareas (copy.ts, tareasDeEtapa).
// `etapa` es opcional en el shape porque lo guardado en producción antes de
// este cambio no lo tiene: ausente = etapa 1 (ver resolverAlAbrir).
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
//   · ?tutorial=checklist2 → ARRANCA la segunda etapa de la Checklist desde
//     cero (para probarla sin tener que pasar por la primera).

export const VARIANTES = ['recorrido', 'checklist', 'tooltips', 'bienvenida', 'asistente'] as const
export type Variante = (typeof VARIANTES)[number]

/** La variante que arranca sola para un negocio que nunca tocó el tutorial. */
export const TUTORIAL_INICIAL: Variante = 'checklist'

export type Etapa = 1 | 2

/** Valor de ?tutorial= que fuerza la segunda etapa de la Checklist. */
export const QUERY_ETAPA_2 = 'checklist2'

/**
 * Los negocios que YA habían terminado (u ocultado) la Checklist antes de
 * que existiera la segunda etapa quedaron en fase 'terminado' SIN `etapa`.
 * Ale decidió "que todas la tengan": a esos les arranca la etapa 2 la
 * próxima vez que abren el panel. Poner en false para apagarlo en una línea
 * (los que ya la tienen andando no se ven afectados: su estado ya dice
 * etapa 2).
 */
export const ETAPA_2_PARA_QUIEN_YA_TERMINO = true

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
    /** Checklist: en qué etapa está. Ausente = etapa 1 (estados guardados
        antes de que existiera la segunda). */
    etapa?: Etapa
}

/** Estado inicial de una variante, desde cero. La Checklist arranca en la
    etapa que se le pida (1 por default); las demás variantes no tienen etapas. */
export function inicial(variante: Variante, etapa: Etapa = 1): EstadoTutorial {
    const base: EstadoTutorial = { variante, fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] }
    return variante === 'checklist' ? { ...base, etapa } : base
}

/** Etapa efectiva de un estado (ausente = 1). */
export const etapaDe = (e: Pick<EstadoTutorial, 'etapa'>): Etapa => (e.etapa === 2 ? 2 : 1)

/** Normaliza lo que vino de la base: shape completo o null si no sirve. */
export function desdeRemoto(crudo: unknown): EstadoTutorial | null {
    if (!crudo || typeof crudo !== 'object') return null
    const e = crudo as Partial<EstadoTutorial>
    if (!e.variante || !(VARIANTES as readonly string[]).includes(e.variante)) return null
    // `etapa` se respeta solo si es 1 o 2; cualquier otra cosa (o ausente) se
    // deja SIN definir a propósito: "sin etapa" significa "de antes de la
    // segunda etapa" y resolverAlAbrir lo trata distinto de etapa: 1.
    const { etapa: etapaCruda, ...resto } = e
    const etapa: Etapa | undefined = etapaCruda === 1 || etapaCruda === 2 ? etapaCruda : undefined
    // La base sale de inicial() SIN su etapa: si no, un estado viejo heredaría
    // el default (1) y perdería el significado de "sin etapa".
    const { etapa: _default, ...base } = inicial(e.variante)
    return {
        ...base,
        ...resto,
        fase: e.fase === 'terminado' ? 'terminado' : 'activo',
        ...(etapa !== undefined ? { etapa } : {}),
    }
}

/**
 * Qué mostrar al abrir el panel, a partir de lo que dice la base y de las
 * tareas que la API detectó cumplidas. Pura: el host la llama con la
 * respuesta del GET y persiste si `persistir` es true.
 *
 *   · null (nunca lo tocó)          → arranca la Checklist, etapa 1.
 *   · activo                        → se retoma, sumando las cumplidas nuevas.
 *   · terminado, etapa 2            → nada, nunca más.
 *   · terminado, etapa 1            → ocultó la primera etapa sin terminarla
 *                                     (al terminarla de verdad la web pasa a
 *                                     etapa 2 sin pisar por 'terminado'): la
 *                                     segunda NO arranca sola; queda
 *                                     disponible con ?tutorial=checklist2.
 *   · terminado, sin etapa (viejo)  → según ETAPA_2_PARA_QUIEN_YA_TERMINO.
 *   · terminado, otra variante      → nada (las otras cuatro no tienen etapas).
 */
export function resolverAlAbrir(
    remoto: EstadoTutorial | null,
    cumplidas: string[],
): { estado: EstadoTutorial | null; persistir: boolean } {
    if (remoto === null) {
        return { estado: { ...inicial(TUTORIAL_INICIAL, 1), hechas: [...cumplidas] }, persistir: true }
    }
    if (remoto.fase === 'activo') {
        const faltan = cumplidas.filter(id => !remoto.hechas.includes(id))
        if (!faltan.length) return { estado: remoto, persistir: false }
        return { estado: { ...remoto, hechas: [...remoto.hechas, ...faltan] }, persistir: true }
    }
    if (remoto.variante !== 'checklist') return { estado: null, persistir: false }
    if (remoto.etapa === 2 || remoto.etapa === 1) return { estado: null, persistir: false }
    if (!ETAPA_2_PARA_QUIEN_YA_TERMINO) return { estado: null, persistir: false }
    return { estado: iniciarEtapa2(remoto, cumplidas), persistir: true }
}

/** Estado con el que arranca la segunda etapa: desde cero (paso 0 = todavía
    no vio la presentación), con lo que la API ya detectó como cumplido. */
export function iniciarEtapa2(prev: Pick<EstadoTutorial, 'variante'>, cumplidas: string[]): EstadoTutorial {
    return { ...inicial(prev.variante === 'checklist' ? 'checklist' : TUTORIAL_INICIAL, 2), hechas: [...cumplidas] }
}

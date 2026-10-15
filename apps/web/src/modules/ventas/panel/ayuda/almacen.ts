// ─── Lo que la ayuda recuerda en ESTE dispositivo ────────────────────────────
//
// Va en localStorage (no en la base): que alguien haya visto el aviso de
// Productos en la computadora no significa que lo haya visto en el teléfono,
// y es justo ahí donde más se necesita. Si el storage no está (modo privado,
// datos bloqueados) todo sigue andando: simplemente el aviso se repite.

export interface EstadoAyuda {
    /** Claves de tutorial (ver claveDeAyuda) cuyo aviso ya se mostró. */
    vistos: string[]
    /** Hasta cuándo (ms epoch) dejó "Más tarde" los primeros pasos. 0 = no. */
    pospuestoHasta: number
    /** Ya vio los primeros pasos: habilita el cierre cuando cree el producto. */
    enCurso: boolean
    /** Fue a verificar el correo: al verificarlo se le pregunta qué quiere hacer ahora. */
    esperaCorreo: boolean
    /** Sugerencias de tutorial a las que respondió "ya sé" (ids de sugerencias.ts). */
    sabe: string[]
    /** Sugerencia → hasta cuándo (ms epoch) no se vuelve a ofrecer. */
    posponer: Record<string, number>
    /** Cuándo apareció la última sugerencia (ms epoch). 0 = ninguna. */
    ultimaSugerencia: number
}

export const ESTADO_AYUDA_VACIO: EstadoAyuda = {
    vistos: [], pospuestoHasta: 0, enCurso: false, esperaCorreo: false,
    sabe: [], posponer: {}, ultimaSugerencia: 0,
}

/** "Más tarde" calla los primeros pasos un día. */
export const POSPONER_MS = 24 * 60 * 60 * 1000

const clave = (negocioId: string) => `orbita:ayuda:${negocioId}`

function soloNumeros(v: unknown): Record<string, number> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number'))
}

/** Tolerante a cualquier cosa guardada: un valor roto vuelve al estado vacío. */
export function parsear(crudo: string | null): EstadoAyuda {
    if (!crudo) return ESTADO_AYUDA_VACIO
    try {
        const o = JSON.parse(crudo) as Partial<EstadoAyuda> | null
        return {
            vistos: Array.isArray(o?.vistos) ? o.vistos.filter((s): s is string => typeof s === 'string') : [],
            pospuestoHasta: typeof o?.pospuestoHasta === 'number' ? o.pospuestoHasta : 0,
            enCurso: o?.enCurso === true,
            esperaCorreo: o?.esperaCorreo === true,
            sabe: Array.isArray(o?.sabe) ? o.sabe.filter((x): x is string => typeof x === 'string') : [],
            posponer: soloNumeros(o?.posponer),
            ultimaSugerencia: typeof o?.ultimaSugerencia === 'number' ? o.ultimaSugerencia : 0,
        }
    } catch {
        return ESTADO_AYUDA_VACIO
    }
}

export function leerAyuda(negocioId: string): EstadoAyuda {
    try {
        return parsear(window.localStorage.getItem(clave(negocioId)))
    } catch {
        return ESTADO_AYUDA_VACIO
    }
}

export function guardarAyuda(negocioId: string, estado: EstadoAyuda): void {
    try {
        window.localStorage.setItem(clave(negocioId), JSON.stringify(estado))
    } catch { /* sin storage: el aviso se repetirá, nada más */ }
}

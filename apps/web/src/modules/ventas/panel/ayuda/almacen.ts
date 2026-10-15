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
}

export const ESTADO_AYUDA_VACIO: EstadoAyuda = { vistos: [], pospuestoHasta: 0, enCurso: false, esperaCorreo: false }

/** "Más tarde" calla los primeros pasos un día. */
export const POSPONER_MS = 24 * 60 * 60 * 1000

const clave = (negocioId: string) => `orbita:ayuda:${negocioId}`

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

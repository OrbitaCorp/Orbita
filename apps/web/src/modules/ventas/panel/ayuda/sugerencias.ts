// ─── Sugerencias de tutorial ─────────────────────────────────────────────────
//
// De vez en cuando (no todo el tiempo) el panel le pregunta a la persona si ya
// sabe hacer algo que todavía no hizo: "¿Ya sabés crear un descuento?". Si dice
// que sí, no se vuelve a preguntar por eso. Si dice que no, se le ofrece el
// tutorial de ese módulo.
//
// "Todavía no lo hizo" sale de la API (GET /business/tutorial → `cumplidas`):
// lo que ya existe en la base (un descuento, un envío configurado, un miembro
// invitado…) nunca se sugiere. Lógica pura, con tests; la pantalla está en
// AyudaHost.

import { claveDeAyuda } from './recorridos'

export interface Sugerencia {
    /** Id de la tarea en `cumplidas` (ver businesses.service.ts getTutorial). */
    id: string
    /** En infinitivo: "¿Ya sabés ___?" / "Aprendé a ___". */
    accion: string
    /** Pantalla del tutorial (sección y, en Configuración, vista). */
    seccion: string
    vista?: string
}

/** En orden de importancia: primero lo que deja la tienda lista para vender. */
export const SUGERENCIAS: readonly Sugerencia[] = [
    { id: 'negocio', accion: 'completar los datos de tu negocio', seccion: 'configuracion', vista: 'negocio' },
    { id: 'mp', accion: 'conectar tu cuenta de Mercado Pago', seccion: 'configuracion', vista: 'pagos' },
    { id: 'envios', accion: 'definir cómo entregás tus pedidos', seccion: 'configuracion', vista: 'envios' },
    { id: 'pedidos', accion: 'cargar un pedido a mano', seccion: 'pedidos' },
    { id: 'descuentos', accion: 'crear un descuento o un cupón', seccion: 'descuentos' },
    { id: 'apariencia', accion: 'personalizar cómo se ve tu tienda', seccion: 'configuracion', vista: 'apariencia' },
    { id: 'contacto', accion: 'cargar tus datos de contacto', seccion: 'configuracion', vista: 'contacto' },
    { id: 'redes', accion: 'sumar tus redes sociales', seccion: 'configuracion', vista: 'redes' },
    { id: 'plantillas', accion: 'armar tus plantillas de respuesta', seccion: 'mensajes' },
    { id: 'clientes', accion: 'ver tu base de clientes', seccion: 'clientes' },
    { id: 'dominio', accion: 'poner tu propia dirección web', seccion: 'configuracion', vista: 'dominios' },
    { id: 'equipo', accion: 'invitar a alguien de tu equipo', seccion: 'configuracion', vista: 'equipo' },
    { id: 'notificaciones', accion: 'elegir qué avisos recibís', seccion: 'configuracion', vista: 'notificaciones' },
    { id: 'postventa', accion: 'definir cambios y devoluciones', seccion: 'configuracion', vista: 'postventa' },
]

/** Cuánto se espera, ya en el panel, antes de la primera sugerencia. */
export const ESPERA_INICIAL_MS = 45_000
/** Entre una sugerencia y la siguiente (en este dispositivo): como mucho una por día. */
export const INTERVALO_MS = 24 * 60 * 60 * 1000
/** "Más tarde" calla ESA sugerencia tres días. */
export const POSPONER_SUGERENCIA_MS = 3 * 24 * 60 * 60 * 1000
/** Si la tarjeta se ignora, vuelve a poder aparecer al día siguiente. */
export const POSPONER_IGNORADA_MS = 24 * 60 * 60 * 1000
/** Si cierra o ignora tantas seguidas, se entiende que no las quiere: se callan todas un tiempo. */
export const DESCARTADAS_PARA_SILENCIAR = 3
export const SILENCIO_MS = 14 * 24 * 60 * 60 * 1000

export const claveDeSugerencia = (s: Sugerencia) => claveDeAyuda(s.seccion, s.vista)

export interface EntradaSugerencia {
    cumplidas: readonly string[]
    /** Ids que la persona dijo "ya sé". */
    sabe: readonly string[]
    /** Id → hasta cuándo (ms epoch) no se vuelve a sugerir. */
    posponer: Readonly<Record<string, number>>
    /** Cuándo apareció la última (ms epoch). */
    ultima: number
    ahora: number
    /** Hasta cuándo (ms epoch) están calladas todas las sugerencias. 0 = no. */
    silenciadoHasta: number
    /** Clave del tutorial de la pantalla en que está: no se le sugiere lo que tiene delante. */
    claveActual: string
}

/** La próxima sugerencia, o null si hoy no toca o no queda ninguna. */
export function elegirSugerencia(e: EntradaSugerencia): Sugerencia | null {
    if (e.ahora < e.silenciadoHasta) return null
    if (e.ahora - e.ultima < INTERVALO_MS) return null
    return SUGERENCIAS.find(s =>
        !e.cumplidas.includes(s.id)
        && !e.sabe.includes(s.id)
        && (e.posponer[s.id] ?? 0) <= e.ahora
        && claveDeSugerencia(s) !== e.claveActual,
    ) ?? null
}

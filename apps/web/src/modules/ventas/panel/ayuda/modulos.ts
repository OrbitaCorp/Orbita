// ─── Qué tutorial tiene cada módulo ──────────────────────────────────────────
//
// El tutorial de un módulo NO tiene texto propio: es una selección de temas
// del manual (manual/contenido.ts), mostrados de a uno. Así hay una sola
// fuente de verdad: cuando una pantalla cambia y se corrige el manual, el
// tutorial y Orbi quedan al día juntos.
//
// Se eligen pocos temas por módulo (los que contestan "qué es cada cosa y cómo
// se crea"): en el celular, tres pantallas cortas se terminan; ocho no.
// ayuda.test.ts falla si un id de acá no existe en el manual.

import { CAPITULOS, type Capitulo, type Tema } from '../manual/contenido'

interface AyudaDeModulo {
    /** Cómo se nombra el módulo en el aviso: "¿Querés ver cómo funciona X?". */
    titulo: string
    /** Id del capítulo del manual del que salen los temas. */
    capitulo: string
    /** Ids de los temas, en el orden en que se muestran. */
    temas: string[]
}

/** Clave = la sección de la URL (/admin/ventas/<seccion>, ver secciones.ts),
    o `seccion/vista` para una vista de Configuración que tiene tutorial propio. */
export const AYUDA_POR_SECCION: Record<string, AyudaDeModulo> = {
    dashboard: { titulo: 'el Inicio', capitulo: 'inicio', temas: ['kpis', 'alertas'] },
    pedidos: { titulo: 'Pedidos', capitulo: 'pedidos', temas: ['estados', 'detalle-pedido', 'nuevo-pedido'] },
    catalogo: { titulo: 'Productos', capitulo: 'productos', temas: ['crear-producto', 'variantes', 'estados-producto'] },
    categorias: { titulo: 'Categorías', capitulo: 'productos', temas: ['categorias'] },
    clientes: { titulo: 'Clientes', capitulo: 'clientes', temas: ['lista-clientes', 'escribirles'] },
    mensajes: { titulo: 'Mensajes', capitulo: 'mensajes', temas: ['bandeja', 'chat', 'plantillas'] },
    descuentos: { titulo: 'Descuentos', capitulo: 'descuentos', temas: ['diferencia', 'tipos-descuento', 'alcance-condiciones'] },
    cupones: { titulo: 'Cupones', capitulo: 'descuentos', temas: ['cupones', 'compartir'] },
    reportes: { titulo: 'Reportes', capitulo: 'reportes', temas: ['las-cinco-pestanas'] },
    configuracion: { titulo: 'Configuración', capitulo: 'configuracion', temas: ['cfg-negocio', 'cfg-pagos', 'cfg-envios'] },
    // Apariencia es una vista de Configuración con su propio tutorial: a ella se
    // llega derecho desde "Editar el diseño de mi tienda" (ver claveDeAyuda).
    'configuracion/apariencia': { titulo: 'Apariencia', capitulo: 'configuracion', temas: ['cfg-apariencia'] },
    difusion: { titulo: 'Difusión', capitulo: 'difusion', temas: ['instagram-conexion', 'tablero-difusion', 'publicar-instagram'] },
}

/** La clave del tutorial para donde está parado el usuario. */
export function claveDeAyuda(seccion: string, vista?: string): string {
    const conVista = vista ? `${seccion}/${vista}` : ''
    return conVista && AYUDA_POR_SECCION[conVista] ? conVista : seccion
}

export interface AyudaResuelta {
    titulo: string
    capitulo: Capitulo
    temas: Tema[]
}

/** El tutorial de esa clave, o null si no tiene (perfil, manual…). */
export function ayudaDe(seccion: string): AyudaResuelta | null {
    const def = AYUDA_POR_SECCION[seccion]
    if (!def) return null
    const capitulo = CAPITULOS.find(c => c.id === def.capitulo)
    if (!capitulo) return null
    const temas = def.temas
        .map(id => capitulo.temas.find(t => t.id === id))
        .filter((t): t is Tema => !!t)
    if (temas.length === 0) return null
    return { titulo: def.titulo, capitulo, temas }
}

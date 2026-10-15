// ─── Qué tutorial tiene cada módulo ──────────────────────────────────────────
//
// El tutorial de un módulo NO tiene texto propio: es una selección de temas
// del manual (manual/contenido.ts), mostrados de a uno. Así hay una sola
// fuente de verdad: cuando una pantalla cambia y se corrige el manual, el
// tutorial y Orbi quedan al día juntos.
//
// Se eligen pocos temas por módulo (los que contestan "qué es cada cosa y cómo
// se crea"): en el celular, tres pantallas cortas se terminan; ocho no.
// ayuda.test.ts falla si un id de acá no existe en el manual, y si queda sin
// tutorial alguna sección o vista de Configuración del panel.

import { CAPITULOS, type Capitulo, type Tema } from '../manual/contenido'

interface AyudaDeModulo {
    /** Cómo se nombra en el aviso: "¿Querés ver cómo funciona X?". */
    titulo: string
    /** Id del capítulo del manual del que salen los temas. */
    capitulo: string
    /** Ids de los temas, en el orden en que se muestran. */
    temas: string[]
}

/** Clave = la sección de la URL (/admin/ventas/<seccion>, ver secciones.ts),
    o `configuracion/<vista>` para cada pantalla de Configuración. */
export const AYUDA_POR_SECCION: Record<string, AyudaDeModulo> = {
    dashboard: { titulo: 'el Inicio', capitulo: 'inicio', temas: ['periodo', 'kpis', 'alertas', 'top'] },
    pedidos: { titulo: 'Pedidos', capitulo: 'pedidos', temas: ['estados', 'detalle-pedido', 'nuevo-pedido', 'lote-exportar'] },
    catalogo: { titulo: 'Productos', capitulo: 'productos', temas: ['crear-producto', 'variantes', 'stock-rapido', 'estados-producto', 'importar-excel'] },
    categorias: { titulo: 'Categorías', capitulo: 'productos', temas: ['categorias'] },
    clientes: { titulo: 'Clientes', capitulo: 'clientes', temas: ['lista-clientes', 'escribirles'] },
    mensajes: { titulo: 'Mensajes', capitulo: 'mensajes', temas: ['bandeja', 'chat', 'plantillas'] },
    descuentos: { titulo: 'Descuentos', capitulo: 'descuentos', temas: ['diferencia', 'tipos-descuento', 'alcance-condiciones'] },
    cupones: { titulo: 'Cupones', capitulo: 'descuentos', temas: ['cupones', 'compartir'] },
    reportes: { titulo: 'Reportes', capitulo: 'reportes', temas: ['las-cinco-pestanas'] },
    difusion: { titulo: 'Difusión', capitulo: 'difusion', temas: ['instagram-conexion', 'tablero-difusion', 'publicar-instagram', 'mensajes-instagram'] },
    avanzado: { titulo: 'el paquete Avanzado', capitulo: 'avanzado', temas: ['que-es-avanzado', 'funciones-avanzado'] },
    perfil: { titulo: 'Mi perfil', capitulo: 'cuenta', temas: ['mi-perfil'] },

    // Configuración: una pantalla por vista, cada una con su tutorial.
    'configuracion/negocio': { titulo: 'los datos del Negocio', capitulo: 'configuracion', temas: ['cfg-negocio'] },
    'configuracion/contacto': { titulo: 'Contacto', capitulo: 'configuracion', temas: ['cfg-contacto'] },
    'configuracion/pagos': { titulo: 'Pagos', capitulo: 'configuracion', temas: ['cfg-pagos'] },
    'configuracion/envios': { titulo: 'Envíos', capitulo: 'configuracion', temas: ['cfg-envios'] },
    'configuracion/redes': { titulo: 'las Redes sociales', capitulo: 'configuracion', temas: ['cfg-redes'] },
    'configuracion/postventa': { titulo: 'Cambios y devoluciones', capitulo: 'configuracion', temas: ['cfg-postventa'] },
    'configuracion/apariencia': { titulo: 'Apariencia', capitulo: 'configuracion', temas: ['cfg-apariencia'] },
    'configuracion/equipo': { titulo: 'tu Equipo', capitulo: 'configuracion', temas: ['cfg-equipo'] },
    'configuracion/notificaciones': { titulo: 'Notificaciones', capitulo: 'configuracion', temas: ['cfg-notificaciones'] },
    'configuracion/suscripcion': { titulo: 'tu Suscripción', capitulo: 'configuracion', temas: ['cfg-suscripcion'] },
    'configuracion/dominios': { titulo: 'Dominios', capitulo: 'configuracion', temas: ['cfg-dominios'] },
    'configuracion/soporte': { titulo: 'Soporte', capitulo: 'configuracion', temas: ['cfg-soporte'] },
    'configuracion/actividad': { titulo: 'el Registro de actividad', capitulo: 'configuracion', temas: ['cfg-actividad'] },
}

/** La clave del tutorial para donde está parado el usuario. */
export function claveDeAyuda(seccion: string, vista?: string): string {
    if (seccion === 'configuracion') {
        // Sin vista (o con la vieja 'general'), Configuración abre en Negocio.
        const v = !vista || vista === 'general' ? 'negocio' : vista
        return AYUDA_POR_SECCION[`configuracion/${v}`] ? `configuracion/${v}` : seccion
    }
    return seccion
}

export interface AyudaResuelta {
    titulo: string
    capitulo: Capitulo
    temas: Tema[]
}

/** El tutorial de esa clave, o null si no tiene (manual, zona peligrosa…). */
export function ayudaDe(clave: string): AyudaResuelta | null {
    const def = AYUDA_POR_SECCION[clave]
    if (!def) return null
    const capitulo = CAPITULOS.find(c => c.id === def.capitulo)
    if (!capitulo) return null
    const temas = def.temas
        .map(id => capitulo.temas.find(t => t.id === id))
        .filter((t): t is Tema => !!t)
    if (temas.length === 0) return null
    return { titulo: def.titulo, capitulo, temas }
}

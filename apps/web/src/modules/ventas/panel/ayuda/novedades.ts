// ─── Novedades del panel (modal de actualizaciones para propietarios) ──────────
//
// Cómo publicar una nueva tanda de novedades en un deploy:
//   1. Guardá las capturas (PNG, WebP o SVG en relación 16:9) dentro de
//      `apps/web/public/novedades/`.
//   2. Sumá una entrada al inicio de `NOVEDADES` con un `id` único (por ejemplo
//      `'2026-12-caja-turnos'`). El modal solo aparece automáticamente en Inicio
//      cuando hay al menos un `id` que este dispositivo todavía no vio.
//   3. Si querés retirar novedades viejas, sacalas de `NOVEDADES` y el botón
//      del encabezado seguirá abriendo las que dejes acá.
//
// Cuánto dura una novedad (pedido 18/11): hasta que el propietario la LEE —su
// diapositiva se mostró en el modal—, y desde ahí 3 días más
// (NOVEDAD_LEIDA_DURA_MS). Si nunca la lee, no se va nunca. Se cuenta por
// dispositivo, como el resto de la ayuda (ver almacen.ts). Sin ninguna vigente
// el botón del encabezado no aparece.

import type { SeccionDelPanel } from '../secciones'

export interface CapturaNovedad {
    /** Ruta pública relativa a `apps/web/public` (ej.: '/novedades/foto.png'). */
    src: string
    /** Descripción breve mostrada sobre la imagen y en el selector de capturas. */
    epigrafe: string
}

export interface Novedad {
    /** Identificador único e inmutable para recordar si el propietario ya la vio. */
    id: string
    etiqueta: 'Nuevo' | 'Mejora'
    modulo: string
    titulo: string
    descripcion: string
    puntos?: readonly string[]
    imagenes: readonly CapturaNovedad[]
    irA?: {
        texto: string
        seccion: SeccionDelPanel
        query?: Record<string, string>
    }
}

export const NOVEDADES: readonly Novedad[] = [
    {
        // Le aparece a todos los dueños: sin el paquete, el botón lleva a
        // Avanzado con las tarjetas bloqueadas y "Ver qué incluye".
        id: '2026-11-tematicas-promos',
        etiqueta: 'Nuevo',
        modulo: 'Avanzado',
        titulo: 'Juegos, anuncios y ofertas con el diseño de cada temporada',
        descripcion: 'Con el paquete Avanzado, tus promos ya no se ven iguales a las de otras tiendas: elegí una temática como Navidad, San Valentín o Halloween, y la forma en que aparece cada anuncio.',
        puntos: [
            '19 temáticas para tus juegos con premio',
            'Probá el juego antes de lanzarlo, sin gastar premios',
            '9 formatos de anuncio, como barra con foto o cupón',
            '7 diseños para la oferta relámpago',
        ],
        imagenes: [
            {
                src: '/novedades/promos-tematicas.svg',
                epigrafe: 'El mismo juego, con la temática que elijas',
            },
            {
                src: '/novedades/promos-vista-previa.svg',
                epigrafe: 'Jugalo vos antes de lanzarlo',
            },
            {
                src: '/novedades/promos-formatos.svg',
                epigrafe: 'Anuncios y ofertas en varios formatos',
            },
        ],
        irA: {
            texto: 'Ver los diseños',
            seccion: 'avanzado',
            query: { vista: 'juegos' },
        },
    },
    {
        id: '2026-11-actualizar-precios-excel',
        etiqueta: 'Nuevo',
        modulo: 'Productos',
        titulo: 'Cambiá todos tus precios juntos con un Excel',
        descripcion: 'Si ajustás precios por cotización o por inflación, ya no hace falta entrar producto por producto: bajás el Excel con tus productos, cambiás la columna Precio y lo volvés a subir.',
        puntos: [
            'Una fila por variante: cada talle, color o tamaño con su precio',
            'Antes de guardar ves qué cambia, con los precios raros arriba (un cero de más o de menos)',
            'Solo toca precios: el stock se sigue manejando desde Inventario',
        ],
        imagenes: [
            {
                src: '/novedades/actualizar-precios-excel.svg',
                epigrafe: 'En el Excel cambiás solo la columna Precio',
            },
            {
                src: '/novedades/actualizar-precios.svg',
                epigrafe: 'Antes de guardar, revisás todos los cambios',
            },
        ],
        irA: {
            texto: 'Ir a Productos',
            seccion: 'catalogo',
        },
    },
    {
        id: '2026-11-pedido-solo-venta',
        etiqueta: 'Nuevo',
        modulo: 'Pedidos',
        titulo: 'Registrá ventas rápidas sin pedir datos del cliente',
        descripcion: 'Ahora al crear un pedido manual podés elegir "Solo la venta" para registrar la operación al instante como Consumidor final, sin pedir correo ni demorar la atención.',
        puntos: [
            'Cobro inmediato en mostrador sin cargar correo electrónico',
            'Descuenta stock y suma en tus reportes igual que siempre',
        ],
        imagenes: [
            {
                src: '/novedades/pedido-solo-venta.jpg',
                epigrafe: 'Nueva opción "Solo la venta" al crear un pedido',
            },
            {
                src: '/novedades/pedido-solo-venta-detalle.jpg',
                epigrafe: 'Selector en el ticket: venta rápida como Consumidor final',
            },
        ],
        irA: {
            texto: 'Ir a Nuevo pedido',
            seccion: 'pedidos',
            query: { vista: 'nuevo' },
        },
    },
    {
        id: '2026-11-orbi-barra',
        etiqueta: 'Nuevo',
        modulo: 'Asistente Orbi AI',
        titulo: 'Asistente Orbi AI siempre a mano en la barra superior',
        descripcion: 'Consultá tus ventas, pedidos pendientes o dudas de configuración desde cualquier pantalla del panel sin perder lo que estabas haciendo.',
        puntos: [
            'Respuestas con los datos reales de tu tienda',
            'Acceso directo con Ctrl+K o Cmd+K desde el teclado',
        ],
        imagenes: [
            {
                src: '/novedades/orbi-asistente.svg',
                epigrafe: 'Panel lateral de Orbi AI desde la barra superior',
            },
        ],
        irA: {
            texto: 'Ver reportes',
            seccion: 'reportes',
        },
    },
    {
        id: '2026-11-buscador-global',
        etiqueta: 'Mejora',
        modulo: 'Panel General',
        titulo: 'Buscador global unificado en todo el panel',
        descripcion: 'Encontrá pedidos por número, clientes, productos o descuentos desde un solo campo arriba, con acceso directo al detalle de cada resultado.',
        puntos: [
            'Resultados agrupados por pedidos, clientes, productos y secciones',
            'Respeta los permisos asignados a cada miembro del equipo',
        ],
        imagenes: [
            {
                src: '/novedades/buscador-global.svg',
                epigrafe: 'Resultados agrupados en tiempo real desde la barra',
            },
            {
                src: '/novedades/buscador-resultados.svg',
                epigrafe: 'Apertura directa de la ficha sin pasos intermedios',
            },
        ],
        irA: {
            texto: 'Ir a Pedidos',
            seccion: 'pedidos',
        },
    },
    {
        id: '2026-11-tutoriales-guiados',
        etiqueta: 'Nuevo',
        modulo: 'Ayuda del panel',
        titulo: 'Tutoriales en video y recorridos guiados por pantalla',
        descripcion: 'Cada módulo ahora cuenta con guías paso a paso sobre tu pantalla real y videos cortos para resolver dudas en el momento.',
        puntos: [
            'Señalización directa sobre los botones de cada sección',
            'Disponible siempre desde el botón Ver tutorial',
        ],
        imagenes: [
            {
                src: '/novedades/tutoriales-guiados.svg',
                epigrafe: 'Selector entre video explicativo y recorrido guiado',
            },
        ],
        irA: {
            texto: 'Ir al Catálogo',
            seccion: 'catalogo',
        },
    },
]

/** Una novedad leída sigue a mano 3 días más y después se va. */
export const NOVEDAD_LEIDA_DURA_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Las que estaban "vistas" antes de guardar la fecha de lectura (todas se
 * marcaban juntas al abrir el modal) cuentan como leídas el día del cambio:
 * vencen 3 días después, como cualquier otra.
 */
export const LEIDAS_SIN_FECHA_DESDE = Date.parse('2026-11-18T12:00:00-03:00')

type Lecturas = { novedadesVistas: readonly string[]; novedadesLeidasEn: Readonly<Record<string, number>> }

/** Cuándo se leyó (ms epoch), o null si todavía no. */
export function leidaEn(id: string, a: Lecturas): number | null {
    const en = a.novedadesLeidasEn[id]
    if (typeof en === 'number') return en
    return a.novedadesVistas.includes(id) ? LEIDAS_SIN_FECHA_DESDE : null
}

/** Las que se muestran: las no leídas y las leídas hace menos de 3 días, en el orden de `NOVEDADES`. */
export function novedadesVigentes(a: Lecturas, ahora: number, lista: readonly Novedad[] = NOVEDADES): Novedad[] {
    return lista.filter(n => {
        const en = leidaEn(n.id, a)
        return en === null || ahora - en < NOVEDAD_LEIDA_DURA_MS
    })
}

/** Devuelve las novedades que todavía no fueron vistas en este dispositivo. */
export function novedadesSinVer(
    vistas: readonly string[],
    lista: readonly Novedad[] = NOVEDADES,
): Novedad[] {
    const vistasSet = new Set(vistas)
    return lista.filter(n => !vistasSet.has(n.id))
}

/** Índice de la primera novedad sin ver, o 0 si todas ya fueron vistas. */
export function indiceInicialNovedades(
    vistas: readonly string[],
    lista: readonly Novedad[] = NOVEDADES,
): number {
    const vistasSet = new Set(vistas)
    const idx = lista.findIndex(n => !vistasSet.has(n.id))
    return idx >= 0 ? idx : 0
}

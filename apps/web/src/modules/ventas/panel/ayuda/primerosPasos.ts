// ─── Primeros pasos: crear la primera categoría y el primer producto ─────────
//
// Lógica pura (sin React): qué hay que mostrarle a quien acaba de entrar al
// panel. Un solo objetivo, en orden: categoría → producto → listo.
//
// `cumplidas` son los ids que la API deduce de la base (GET /business/tutorial:
// 'categorias' si hay alguna, 'producto' si hay alguno sin borrar). Nada se
// tilda a mano: el paso termina cuando el dato existe de verdad.

export type PasoInicial = 'categoria' | 'producto' | 'listo'

export function pasoInicial(cumplidas: readonly string[]): PasoInicial {
    if (cumplidas.includes('producto')) return 'listo'
    // Con producto no hace falta categoría (es opcional): el paso 1 solo
    // existe para quien todavía no tiene ninguna ni producto.
    return cumplidas.includes('categorias') ? 'producto' : 'categoria'
}

/** Sección del panel donde se hace cada paso. */
export const SECCION_DEL_PASO = { categoria: 'categorias', producto: 'catalogo' } as const

export const COPY_PASO = {
    categoria: {
        numero: 1,
        titulo: 'Creá tu primera categoría',
        texto: 'Las categorías ordenan tu tienda, por ejemplo "Remeras" o "Zapatillas". Con una alcanza para empezar.',
        boton: 'Crear categoría',
    },
    producto: {
        numero: 2,
        titulo: 'Ahora cargá tu primer producto',
        texto: 'Poné el nombre, una foto, el precio y el stock. El resto lo podés completar después.',
        boton: 'Crear producto',
    },
} as const

/** Frase corta de la tira que acompaña mientras la persona hace el paso. */
export function textoDeTira(paso: 'categoria' | 'producto', vista: string | undefined): string {
    if (paso === 'categoria') return 'Paso 1 de 2 · Tocá "Nueva categoría" y ponele un nombre.'
    return vista === 'nuevo'
        ? 'Paso 2 de 2 · Completá nombre, foto, precio y stock, y tocá "Publicar".'
        : 'Paso 2 de 2 · Tocá "Crear producto".'
}

export type VistaPrimerosPasos =
    | { tipo: 'nada' }
    /** Tarjeta que pide empezar (aparece fuera de la pantalla del paso). */
    | { tipo: 'modal'; paso: 'categoria' | 'producto' }
    /** Tira fina dentro de la pantalla del paso. */
    | { tipo: 'tira'; paso: 'categoria' | 'producto'; texto: string }
    /** Cierre: el producto ya existe. */
    | { tipo: 'listo' }

export interface EntradaPrimerosPasos {
    /** null = todavía no se sabe (cargando o la API falló). */
    cumplidas: readonly string[] | null
    seccion: string
    vista?: string
    /** Tocó "Más tarde" hace poco. */
    pospuesto: boolean
    /** Ya vio el modal o la tira alguna vez: el cierre solo se muestra a quien lo vio. */
    enCurso: boolean
}

export function decidirPrimerosPasos(e: EntradaPrimerosPasos): VistaPrimerosPasos {
    if (!e.cumplidas) return { tipo: 'nada' }
    const paso = pasoInicial(e.cumplidas)
    if (paso === 'listo') return e.enCurso ? { tipo: 'listo' } : { tipo: 'nada' }
    // En la pantalla del paso, la tira acompaña aunque haya dicho "Más tarde":
    // si llegó solo hasta acá, guiarlo es lo que quiere.
    if (e.seccion === SECCION_DEL_PASO[paso]) return { tipo: 'tira', paso, texto: textoDeTira(paso, e.vista) }
    // El pedido de empezar sale en el Inicio ("apenas entrás al panel") y en un
    // solo lugar más: al volver de crear la categoría, que es justo cuando toca
    // el segundo paso. En el resto del panel no se interrumpe a nadie (puede
    // estar verificando su correo, atendiendo un pedido…).
    const alEntrar = e.seccion === 'dashboard'
    const recienCreoCategoria = paso === 'producto' && e.seccion === 'categorias'
    if (!alEntrar && !recienCreoCategoria) return { tipo: 'nada' }
    if (alEntrar && e.pospuesto) return { tipo: 'nada' }
    return { tipo: 'modal', paso }
}

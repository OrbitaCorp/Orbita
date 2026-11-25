// El vocabulario con el que se escriben los manuales que lee Orbi: el de Tienda
// (modules/ventas/panel/manual/contenido.ts) y el de cada módulo nuevo
// (modules/<módulo>/manual.ts). Un tema es una lista de bloques; adentro del
// texto van dos marcas y nada más: **negrita** para la palabra que importa y
// [[Botón]] con el nombre exacto de un botón de la pantalla.
//
// Es una librería: no sabe de ningún módulo (eslint lo vigila), así cada uno
// escribe su manual sin importar a Tienda.

export type Bloque =
    /** Texto corrido. Admite **negrita** y [[botón]]. */
    | { tipo: 'parrafo'; texto: string }
    /** Bullets sueltos. */
    | { tipo: 'lista'; items: string[] }
    /** Pasos numerados: es una receta, se sigue en orden. */
    | { tipo: 'pasos'; items: { titulo: string; texto: string }[] }
    /** Definiciones: "este número / este campo significa esto". */
    | { tipo: 'campos'; titulo?: string; items: { label: string; texto: string }[] }
    /** Chips de estado con su color real de la pantalla y qué quiere decir. */
    | { tipo: 'estados'; items: { label: string; color: string; texto: string }[] }
    /** Recuadro destacado. */
    | { tipo: 'nota'; variante: 'tip' | 'aviso' | 'dato'; texto: string }

const PREFIJO_DE_NOTA = { tip: 'Consejo', aviso: 'Ojo', dato: 'Dato' } as const

/**
 * Texto plano para el modelo: sin **negrita**, y cada [[Botón]] entre comillas
 * — es el nombre exacto que la persona va a ver en la pantalla, y Orbi tiene
 * que poder citarlo tal cual.
 */
export function plano(texto: string): string {
    return texto.replace(/\*\*/g, '').replace(/\[\[([^\]]+)\]\]/g, '"$1"')
}

export function textoDeBloque(b: Bloque): string {
    switch (b.tipo) {
        case 'parrafo': return plano(b.texto)
        case 'nota': return `${PREFIJO_DE_NOTA[b.variante]}: ${plano(b.texto)}`
        case 'lista': return b.items.map(i => `- ${plano(i)}`).join('\n')
        case 'pasos': return b.items.map((i, n) => `${n + 1}. ${plano(i.titulo)}: ${plano(i.texto)}`).join('\n')
        case 'campos': return [
            ...(b.titulo ? [`${plano(b.titulo)}:`] : []),
            ...b.items.map(i => `- ${plano(i.label)}: ${plano(i.texto)}`),
        ].join('\n')
        case 'estados': return b.items.map(i => `- ${plano(i.label)}: ${plano(i.texto)}`).join('\n')
    }
}

/** Todo el texto de un bloque, con sus marcas: para buscar los [[botones]] que nombra. */
export function textosCrudos(b: Bloque): string[] {
    switch (b.tipo) {
        case 'parrafo': case 'nota': return [b.texto]
        case 'lista': return b.items
        case 'pasos': return b.items.flatMap(i => [i.titulo, i.texto])
        case 'campos': return [...(b.titulo ? [b.titulo] : []), ...b.items.flatMap(i => [i.label, i.texto])]
        case 'estados': return b.items.flatMap(i => [i.label, i.texto])
    }
}

/** Los botones que nombra un texto: lo que va entre [[ y ]]. */
export const botonesDel = (texto: string): string[] => [...texto.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1])

// ─── Encontrar en la pantalla lo que un paso del tutorial señala ─────────────
//
// Los recorridos no dependen de que cada pantalla lleve una marca: señalan un
// botón o un texto tal como la persona lo ve ("Nuevo pedido", "Paleta de
// colores"). Si la pantalla cambia y el texto ya no existe, ese paso se muestra
// sin resaltar nada (o se salta, si es opcional) y recorridos.test.ts avisa: ahí
// se comprueba que cada texto señalado siga existiendo en el código.
//
// Para los casos donde un texto no alcanza, un elemento puede llevar
// `data-ayuda="nombre"` y señalarse con { ayuda: 'nombre' }.

export type Donde =
    | { ayuda: string }
    /** Un botón o enlace por su rótulo. `parcial`: alcanza con que empiece así ("Pendientes 5"). */
    | { boton: string; parcial?: boolean }
    /** Un texto cualquiera de la pantalla. `tarjeta`: resalta la caja que lo contiene, no solo el texto. */
    | { texto: string; parcial?: boolean; tarjeta?: boolean }

/** Sin tildes, sin mayúsculas, sin símbolos de flecha o tilde, con espacios simples. */
export function normalizar(t: string): string {
    return t
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[→✓+↗←]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function coincide(texto: string, buscado: string, parcial?: boolean): boolean {
    const t = normalizar(texto)
    const b = normalizar(buscado)
    return parcial ? t.startsWith(b) : t === b
}

/** Lo que la ayuda misma dibuja no cuenta como "la pantalla". */
const esNuestro = (el: Element) => !!el.closest('[data-ayuda-ui]')

function visible(el: Element): boolean {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
}

function buscarTexto(raiz: Element, buscado: string, parcial?: boolean): HTMLElement | null {
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
        const crudo = n.textContent ?? ''
        if (!crudo.trim() || !coincide(crudo, buscado, parcial)) continue
        const el = n.parentElement
        if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName) || esNuestro(el) || !visible(el)) continue
        return el
    }
    return null
}

/** Sube hasta la caja (con borde o sombra) que contiene al elemento: la "tarjeta". */
function tarjetaDe(el: HTMLElement): HTMLElement {
    let actual = el
    for (let i = 0; i < 6; i++) {
        const padre = actual.parentElement
        if (!padre || padre.tagName === 'MAIN' || padre === document.body) break
        actual = padre
        const estilo = getComputedStyle(actual)
        if (parseFloat(estilo.borderTopWidth) > 0 || estilo.boxShadow !== 'none') return actual
    }
    return el
}

export function ubicar(donde: Donde): HTMLElement | null {
    if ('ayuda' in donde) {
        const candidatos = document.querySelectorAll<HTMLElement>(`[data-ayuda="${donde.ayuda}"]`)
        return Array.from(candidatos).find(visible) ?? null
    }
    if ('boton' in donde) {
        const candidatos = document.querySelectorAll<HTMLElement>('button, a, [role="button"]')
        return Array.from(candidatos).find(el => !esNuestro(el) && visible(el) && coincide(el.textContent ?? '', donde.boton, donde.parcial)) ?? null
    }
    // Primero en el contenido de la pantalla: el mismo texto puede estar en el menú o en la barra de arriba.
    for (const raiz of [document.querySelector('main'), document.body]) {
        if (!raiz) continue
        const el = buscarTexto(raiz, donde.texto, donde.parcial)
        if (el) return donde.tarjeta ? tarjetaDe(el) : el
    }
    return null
}

/** El contenedor con scroll más cercano (en el panel, el <main>, no la ventana). */
function conScroll(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
    }
    return null
}

/**
 * Trae el elemento a la vista, una sola vez y sin animación. En el celular la
 * explicación ocupa el pie de la pantalla, así que se lo deja arriba y no al medio.
 */
export function traerAVista(el: HTMLElement, movil: boolean): void {
    const r = el.getBoundingClientRect()
    const margenAbajo = movil ? 230 : 40
    const entra = r.top >= 70 && r.bottom <= window.innerHeight - margenAbajo
    if (entra) return
    const alto = window.innerHeight
    el.scrollIntoView({ block: movil || r.height > alto * 0.5 ? 'start' : 'center' })
    if (movil || r.height > alto * 0.5) conScroll(el)?.scrollBy({ top: -90 })
}

// ─── Resolución de anclas en el DOM real del panel ───────────────────────────
//
// El layout del panel NO tiene ids ni data-attributes (relevado en
// AdminLayout/Sidebar/Header): se ancla por clases semánticas existentes,
// aria-label/title, o texto de botón. Todos los helpers devuelven null si el
// elemento no está — cada variante decide su fallback (tarjeta centrada).

/**
 * Sintaxis de ancla (string):
 *   'centro'                → sin ancla: tarjeta centrada.
 *   'sidebar:Pedidos'       → botón del nav del sidebar cuyo texto/title empieza así.
 *   'boton:Crear producto'  → primer <button> visible cuyo texto empieza así.
 *   'boton-title:Enviar'    → primer <button> con ese atributo title.
 *   'header:campana' | 'header:buscador' | 'header:tema' | 'header:usuario' | 'header:orbi' | 'header:menu'
 *   cualquier otra cosa     → selector CSS tal cual (document.querySelector).
 */
export function resolverAncla(ancla: string): HTMLElement | null {
    if (typeof document === 'undefined' || ancla === 'centro') return null

    // Cadena de fallbacks: 'boton:Conectar cuenta || .cfg-sidebar-item[title="Pagos"]'
    // prueba cada ancla en orden y devuelve la primera que exista.
    if (ancla.includes(' || ')) {
        for (const parte of ancla.split(' || ')) {
            const el = resolverAncla(parte.trim())
            if (el) return el
        }
        return null
    }

    if (ancla.startsWith('sidebar:')) return botonSidebar(ancla.slice(8))
    if (ancla.startsWith('boton-title:')) return document.querySelector<HTMLElement>(`button[title="${ancla.slice(12)}"]`)
    if (ancla.startsWith('boton:')) return botonPorTexto(ancla.slice(6))
    if (ancla.startsWith('header:')) return anclaHeader(ancla.slice(7))

    try { return document.querySelector<HTMLElement>(ancla) } catch { return null }
}

/** Botón de módulo del sidebar, por su label (expandido) o title (colapsado). */
export function botonSidebar(texto: string): HTMLElement | null {
    const nav = document.querySelector('.admin-sidebar nav')
    if (!nav) return null
    const botones = Array.from(nav.querySelectorAll<HTMLElement>('button'))
    return (
        botones.find(b => (b.textContent ?? '').trim().startsWith(texto)) ??
        botones.find(b => b.getAttribute('title') === texto) ??
        null
    )
}

function botonPorTexto(texto: string): HTMLElement | null {
    // Acepta alternativas separadas por '|' — ej. 'Publicar tienda|Tienda online'
    // para un botón cuyo label cambia según el estado del negocio.
    // Scopeado a .admin-main: 'boton:' significa botones de la PANTALLA. El
    // sidebar va antes en el DOM y sus sub-items (ej. 'Crear producto') le
    // ganarían el match al CTA real — para el menú ya existe 'sidebar:'.
    const opciones = texto.split('|')
    const raiz = document.querySelector('.admin-main') ?? document
    const botones = Array.from(raiz.querySelectorAll<HTMLElement>('button')).filter(esVisible)
    for (const op of opciones) {
        const hit =
            botones.find(b => (b.textContent ?? '').trim().startsWith(op)) ??
            botones.find(b => (b.textContent ?? '').includes(op))
        if (hit) return hit
    }
    return null
}

function anclaHeader(id: string): HTMLElement | null {
    switch (id) {
        case 'buscador': return document.querySelector<HTMLElement>('.admin-search-wrap')
        case 'menu': return document.querySelector<HTMLElement>('[aria-label="Abrir menú"]')
        case 'tema': return document.querySelector<HTMLElement>('[aria-label="Modo oscuro"], [aria-label="Modo claro"]')
        case 'campana': return document.querySelector('svg.lucide-bell')?.closest('button') ?? null
        case 'usuario': return document.querySelector('.admin-user-name')?.closest('button') ?? null
        case 'orbi': return document.querySelector<HTMLElement>('[title="Orbi AI (Ctrl+K)"]')
        default: return null
    }
}

export function esVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = window.getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
}

export interface RectAncla { top: number; left: number; width: number; height: number }

/** Rect en viewport (para overlays position:fixed), con un margen de aire. */
export function rectDe(el: HTMLElement, margen = 6): RectAncla {
    const r = el.getBoundingClientRect()
    return {
        top: r.top - margen,
        left: r.left - margen,
        width: r.width + margen * 2,
        height: r.height + margen * 2,
    }
}

/** Scrollea el ancla a la vista dentro del contenedor del panel. */
export function traerALaVista(el: HTMLElement): void {
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch { /* jsdom/viejos */ }
}

// src/lib/fonts.ts — Google Fonts que un negocio puede elegir para su tienda
// (Apariencia → Tipografía). Vivía antes en un módulo del PANEL
// (panel/configuracion/mock/apariencia.mock.ts) — se mueve acá porque ahora
// también lo necesita el núcleo de la tienda del cliente (_app.tsx,
// lib/storefront/forceSSR.ts) para aplicar la fuente elegida de verdad en el
// storefront real, no solo en la vista previa del editor. Un archivo neutral
// en vez de que el storefront importe desde una carpeta "mock" de un módulo
// de panel.

export const GOOGLE_FONTS: Record<string, string> = {
    'Geist': 'Geist',
    'Inter': 'Inter',
    'Playfair Display': 'Playfair+Display:wght@400;600;800',
    'Poppins': 'Poppins:wght@400;600;700',
    'Montserrat': 'Montserrat:wght@400;600;800',
    'Lato': 'Lato:wght@400;700',
    'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
}

export const FONT_DESCRIPCIONES: Record<string, string> = {
    'Geist': 'Moderna, sin serifa',
    'Inter': 'Neutra, profesional',
    'Playfair Display': 'Elegante, con serifa',
    'Poppins': 'Amigable, redondeada',
    'Montserrat': 'Bold, impactante',
    'Lato': 'Ligera, legible',
    'Cormorant Garamond': 'Clásica, serifa fina',
}

// Inyecta el <link> de Google Fonts una sola vez por fuente — uso client-side
// (el editor de Apariencia, para la vista previa en vivo mientras se elige).
// Para SSR real (la tienda del cliente) usar googleFontsHref() más abajo.
export function loadFont(name: string) {
    if (name === 'Geist' || typeof document === 'undefined') return
    const id = 'gf-' + name.replace(/\W/g, '')
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[name]}&display=swap`
    document.head.appendChild(link)
}

export function fontStack(name: string): string {
    if (name === 'Geist') return '"Geist", Inter, sans-serif'
    if (name === 'Playfair Display') return '"Playfair Display", Georgia, serif'
    if (name === 'Cormorant Garamond') return '"Cormorant Garamond", Georgia, serif'
    // Solo nombres conocidos de acá en más: esto termina interpolado sin
    // escapar dentro de un <style> inyectado en el storefront real
    // (_app.tsx) — un `name` arbitrario (dato guardado por el propio dueño
    // del negocio, sin más validación que la del DTO del backend) podría
    // cortar el <style>/CSS si no se lo filtra acá, en el único lugar por
    // el que pasan TODOS los consumidores (panel y storefront).
    if (!(name in GOOGLE_FONTS)) return '"Geist", Inter, sans-serif'
    return `"${name}", "Geist", sans-serif`
}

// Arma UNA sola URL de Google Fonts combinando varias familias (heading +
// body pueden ser distintas) — mismo criterio que _document.tsx ya usa para
// pedir Geist+Geist Mono+Sora en una sola request en vez de tres. "Geist" se
// saltea: ya viene precargada globalmente (ver _document.tsx), pedirla de
// nuevo acá sería una segunda descarga redundante. Devuelve null si no queda
// ninguna fuente real que pedir (negocio con todo en "Geist").
export function googleFontsHref(names: (string | null | undefined)[]): string | null {
    const familias = [...new Set(names.filter((n): n is string => !!n && n !== 'Geist' && n in GOOGLE_FONTS))]
    if (familias.length === 0) return null
    const query = familias.map(n => `family=${GOOGLE_FONTS[n]}`).join('&')
    return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

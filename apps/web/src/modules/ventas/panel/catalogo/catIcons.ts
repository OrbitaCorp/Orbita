// src/modules/ventas/panel/catalogo/catIcons.ts
// Catálogo de íconos y colores que puede tener una categoría. No son datos de
// prueba: es la paleta que ofrece el editor. El valor elegido se guarda como
// string en `Category.icon` / `Category.color`.

export const CAT_ICONS = [
    'shirt', 'package', 'tag', 'bag', 'layers', 'gem',
    'watch', 'star', 'heart', 'grid', 'crown', 'zap',
    'box', 'palette', 'glasses',
    // Ampliado 2026-08-16 — el set original era casi todo indumentaria y no
    // cubría otros rubros comunes (electrónica, hogar, comida, deportes,
    // etc.), quedando corto para un negocio que no vende ropa.
    'smartphone', 'laptop', 'headphones', 'gamepad',
    'home', 'sofa', 'lamp',
    'utensils', 'coffee', 'wine',
    'dumbbell', 'bike',
    'scissors', 'book', 'baby', 'toybrick', 'pawprint', 'car',
] as const

export type CatIconKey = typeof CAT_ICONS[number]

export const CAT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#0F172A', '#6B7280']

// Slug con reemplazo explícito de acentos del español. El backend genera el
// suyo igual al guardar; este se usa para mostrarlo mientras se escribe.
export function slugify(s: string): string {
    const acentos: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }
    return s.toLowerCase()
        .replace(/[áéíóúüñ]/g, c => acentos[c] ?? c)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

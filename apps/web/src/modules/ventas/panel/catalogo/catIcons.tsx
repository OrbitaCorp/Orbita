// src/modules/ventas/panel/catalogo/catIcons.tsx
// Catálogo de íconos y colores que puede tener una categoría. No son datos de
// prueba: es la paleta que ofrece el editor. El valor elegido se guarda como
// string en `Category.icon` / `Category.color`.
//
// El mapa de íconos (CAT_ICONS → componente de lucide-react real) vive acá,
// no solo en Categorias.tsx (panel), porque el storefront (Inicio.tsx,
// CatPill) también tiene que poder dibujar el ícono QUE DE VERDAD ELIGIÓ el
// vendedor — antes el storefront ni siquiera lo intentaba, mostraba el mismo
// emoji fijo (🛍️) para TODAS las categorías sin importar lo que el panel
// tuviera guardado (bug encontrado 2026-08-25). Un solo lugar para mantener
// la lista, sin duplicar el mapeo string → ícono en dos archivos. (Extensión
// .tsx porque CatIcon de acá abajo devuelve JSX.)

import type { ComponentType } from 'react'
import {
  Tag, Package, Shirt, Layers, ShoppingBag, Gem, Watch, Star, Heart,
  LayoutGrid, Crown, Zap, Box, Palette, Glasses,
  Smartphone, Laptop, Headphones, Gamepad, Home, Sofa, Lamp,
  Utensils, Coffee, Wine, Dumbbell, Bike, Scissors, Book, Baby,
  ToyBrick, PawPrint, Car,
} from 'lucide-react'

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

// ─── Mapa de íconos (movido de Categorias.tsx 2026-08-25) ──────────────────

type IconComp = ComponentType<{ size?: number; strokeWidth?: number }>

export const ICON_MAP: Record<CatIconKey, IconComp> = {
    shirt:   Shirt,
    package: Package,
    tag:     Tag,
    bag:     ShoppingBag,
    layers:  Layers,
    gem:     Gem,
    watch:   Watch,
    star:    Star,
    heart:   Heart,
    grid:    LayoutGrid,
    crown:   Crown,
    zap:     Zap,
    box:     Box,
    palette: Palette,
    glasses: Glasses,
    smartphone: Smartphone,
    laptop:     Laptop,
    headphones: Headphones,
    gamepad:    Gamepad,
    home:       Home,
    sofa:       Sofa,
    lamp:       Lamp,
    utensils:   Utensils,
    coffee:     Coffee,
    wine:       Wine,
    dumbbell:   Dumbbell,
    bike:       Bike,
    scissors:   Scissors,
    book:       Book,
    baby:       Baby,
    toybrick:   ToyBrick,
    pawprint:   PawPrint,
    car:        Car,
}

// Ícono real de una categoría a partir del string guardado (`Category.icon`)
// — cae a `Tag` si el valor no matchea ninguna clave conocida (dato viejo/
// corrupto, o simplemente null). Un solo componente para panel y storefront.
export function CatIcon({ icono, size = 16, strokeWidth = 1.8 }: { icono: string; size?: number; strokeWidth?: number }) {
    const IC = ICON_MAP[icono as CatIconKey] ?? Tag
    return <IC size={size} strokeWidth={strokeWidth} />
}

// Slug con reemplazo explícito de acentos del español. El backend genera el
// suyo igual al guardar; este se usa para mostrarlo mientras se escribe.
export function slugify(s: string): string {
    const acentos: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }
    return s.toLowerCase()
        .replace(/[áéíóúüñ]/g, c => acentos[c] ?? c)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

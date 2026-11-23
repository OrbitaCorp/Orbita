// Catálogo de diseños de las promos del paquete Avanzado. Una temática es el
// mismo juego con otra piel, y los mismos colores se usan en anuncios y en la
// oferta relámpago: una tienda puede tener las tres cosas de Navidad.
//
// Sumar una temática o un formato: .claude/skills/disenos-promos/SKILL.md. Los
// ids tienen que estar también en apps/api/src/common/disenos-promos.ts (el
// test catalogo.test.ts lo exige).

import type { CSSProperties } from 'react'
import {
    banderines, circ, copo, corazon, corbata, estrellitas, flor, fuego,
    globo, huevo, luces, murcielago, nube, papelitos, pino, sol,
} from './dibujos'

export type PaletaEscena = {
    cielo: string; suelo: string; suelo2: string; raya: string
    a: string; b: string; c: string; agua: string; agua2: string; t: string
}
export type PaletaUi = { card: string; tx: string; mu: string; bt: string; on: string; r: number }
export type PiezaTematica = 'pelota' | 'corazon' | 'huevo' | 'calabaza' | 'estrella' | 'flor' | 'bola'

export interface Tematica {
    id: string
    nombre: string
    grupo: 'estilo' | 'temporada'
    cuando: string
    // Meses en que aplica (1-12): ordenan la galería desde la próxima fecha.
    meses?: number[]
    fuente: string
    // Lo que va en el pedido a Google Fonts. Sin esto, usa la del sistema.
    fuenteGoogle?: string
    pieza: PiezaTematica
    filtro?: 'papel' | 'tiza'
    trazo?: { color: string; ancho: number }
    trama?: boolean
    p: PaletaEscena
    ui: PaletaUi
    decor: (p: PaletaEscena) => string
}

const FUENTES = {
    sans: { fuente: 'Inter, system-ui, sans-serif', fuenteGoogle: 'Inter:wght@400;600;700' },
    fraunces: { fuente: 'Fraunces, Georgia, serif', fuenteGoogle: 'Fraunces:wght@600' },
    caveat: { fuente: 'Caveat, cursive', fuenteGoogle: 'Caveat:wght@700' },
    bebas: { fuente: '"Bebas Neue", Impact, sans-serif', fuenteGoogle: 'Bebas+Neue' },
    dm: { fuente: '"DM Serif Display", Georgia, serif', fuenteGoogle: 'DM+Serif+Display' },
    baloo: { fuente: '"Baloo 2", system-ui, sans-serif', fuenteGoogle: 'Baloo+2:wght@700' },
    cormorant: { fuente: '"Cormorant Garamond", Georgia, serif', fuenteGoogle: 'Cormorant+Garamond:wght@600' },
    archivo: { fuente: '"Archivo Black", Impact, sans-serif', fuenteGoogle: 'Archivo+Black' },
    jost: { fuente: 'Jost, system-ui, sans-serif', fuenteGoogle: 'Jost:wght@500;700' },
}

export const TEMATICAS: Tematica[] = [
    // `clasico` es el dibujo original de cada juego (escenas.tsx): su paleta de
    // acá solo la usan anuncios y ofertas.
    { id: 'clasico', nombre: 'Clásico', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.sans, pieza: 'pelota',
      p: { cielo: '#BFE0F2', suelo: '#6FAE63', suelo2: '#5E9C54', raya: '#FFFFFF', a: '#E4572E', b: '#FFFFFF', c: '#F3B61F', agua: '#3E9FCF', agua2: '#2F86B4', t: '#22303A' },
      ui: { card: '#FFFFFF', tx: '#16202A', mu: '#56616C', bt: '#16202A', on: '#FFFFFF', r: 14 },
      decor: () => nube(70, 48, 1, '#fff') + nube(320, 34, 0.8, '#fff') + nube(205, 80, 0.55, '#fff') },
    { id: 'papel', nombre: 'Papel recortado', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.fraunces, pieza: 'pelota', filtro: 'papel',
      p: { cielo: '#F3EADB', suelo: '#E3D3B8', suelo2: '#D8C6A6', raya: '#2B2A28', a: '#D9513A', b: '#FBF6EC', c: '#E9B44C', agua: '#8FB8B0', agua2: '#7AA69E', t: '#2B2A28' },
      ui: { card: '#FBF6EC', tx: '#2B2A28', mu: '#655D50', bt: '#B93F2A', on: '#FFFFFF', r: 4 },
      decor: p => `<g filter="url(#promoPapel)">${circ(330, 52, 28, p.c)}${nube(84, 60, 1, '#FBF6EC')}</g>` },
    { id: 'pizarra', nombre: 'Pizarra', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.caveat, pieza: 'pelota', filtro: 'tiza',
      p: { cielo: '#24382F', suelo: '#2C453A', suelo2: '#2C453A', raya: '#EDEBDD', a: '#EDEBDD', b: '#24382F', c: '#F2C14E', agua: '#2F4F44', agua2: '#395C50', t: '#EDEBDD' },
      ui: { card: '#1E3028', tx: '#EDEBDD', mu: '#B9C2B6', bt: '#EDEBDD', on: '#1E3028', r: 6 },
      decor: () => '<g stroke="#EDEBDD" fill="none" opacity=".5" stroke-width="1.5"><path d="M30 40h60M30 52h40M310 34l26 26M336 34l-26 26"/><circle cx="210" cy="44" r="14"/></g>' },
    { id: 'linea', nombre: 'Línea', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.jost, pieza: 'pelota', trazo: { color: '#111', ancho: 1.6 },
      p: { cielo: '#FFFFFF', suelo: '#FFFFFF', suelo2: '#FFFFFF', raya: '#111111', a: '#FFFFFF', b: '#FFFFFF', c: '#111111', agua: '#FFFFFF', agua2: '#FFFFFF', t: '#111111' },
      ui: { card: '#FFFFFF', tx: '#111111', mu: '#555555', bt: '#111111', on: '#FFFFFF', r: 0 },
      decor: () => '<g fill="none" stroke="#111" stroke-width="1.2"><circle cx="340" cy="46" r="20"/><path d="M40 52q14-16 28 0t28 0"/></g>' },
    { id: 'riso', nombre: 'Risografía', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.archivo, pieza: 'pelota', trama: true,
      p: { cielo: '#F2EFE6', suelo: '#F0566E', suelo2: '#E8485F', raya: '#2B4BD6', a: '#2B4BD6', b: '#F2EFE6', c: '#F0566E', agua: '#2B4BD6', agua2: '#2440BD', t: '#1D2F8F' },
      ui: { card: '#F2EFE6', tx: '#1D2F8F', mu: '#3E4E9E', bt: '#2B4BD6', on: '#FFFFFF', r: 0 },
      decor: () => circ(318, 60, 40, '#F0566E', 'opacity=".85"') + circ(290, 48, 28, '#2B4BD6', 'opacity=".7"') },
    { id: 'noche', nombre: 'Noche', grupo: 'estilo', cuando: 'Todo el año', ...FUENTES.fraunces, pieza: 'pelota',
      p: { cielo: '#121A33', suelo: '#1C2747', suelo2: '#18213D', raya: '#8EA2D8', a: '#F4C95D', b: '#E9EDF7', c: '#F4C95D', agua: '#1F3566', agua2: '#274178', t: '#E9EDF7' },
      ui: { card: '#141C36', tx: '#EEF1F8', mu: '#AEB8D2', bt: '#F4C95D', on: '#141C36', r: 12 },
      decor: () => estrellitas('#fff', 24) + circ(335, 46, 20, '#F4C95D') + circ(343, 40, 17, '#121A33') },

    { id: 'verano', nombre: 'Verano', grupo: 'temporada', cuando: 'Enero y febrero', meses: [1, 2], ...FUENTES.baloo, pieza: 'pelota',
      p: { cielo: '#8FD8E8', suelo: '#F2D9A0', suelo2: '#EACB88', raya: '#FFFFFF', a: '#F2643D', b: '#FFFFFF', c: '#FFC93C', agua: '#2BA6C6', agua2: '#1E8FAD', t: '#12414F' },
      ui: { card: '#FFFDF7', tx: '#12414F', mu: '#3E6570', bt: '#0F7C96', on: '#FFFFFF', r: 18 },
      decor: () => sol(335, 50, 22, '#FFC93C') + nube(90, 52, 0.9, '#fff') },
    { id: 'carnaval', nombre: 'Carnaval', grupo: 'temporada', cuando: 'Febrero', meses: [2], ...FUENTES.baloo, pieza: 'estrella',
      p: { cielo: '#2B1A5A', suelo: '#3A2478', suelo2: '#321F69', raya: '#FFD23F', a: '#FF3D81', b: '#FFFFFF', c: '#FFD23F', agua: '#25B5C9', agua2: '#1E9CAE', t: '#FFFFFF' },
      ui: { card: '#2B1A5A', tx: '#FFFFFF', mu: '#CFC6E8', bt: '#FFD23F', on: '#2B1A5A', r: 10 },
      decor: () => papelitos(['#FF3D81', '#FFD23F', '#25B5C9', '#fff']) + banderines(4, ['#FF3D81', '#FFD23F', '#25B5C9']) },
    { id: 'valentin', nombre: 'San Valentín', grupo: 'temporada', cuando: '14 de febrero', meses: [2], ...FUENTES.dm, pieza: 'corazon',
      p: { cielo: '#FBE3E6', suelo: '#F4B8C1', suelo2: '#EFA8B3', raya: '#FFFFFF', a: '#C81E4A', b: '#FFFFFF', c: '#F27C97', agua: '#E88CA0', agua2: '#DA7890', t: '#5C1226' },
      ui: { card: '#FFF7F8', tx: '#4A0F20', mu: '#7D4453', bt: '#B81A43', on: '#FFFFFF', r: 20 },
      decor: () => corazon(52, 44, 1.3, '#F27C97') + corazon(345, 36, 1.7, '#E8486F') + corazon(120, 88, 0.7, '#F7A8B8') + corazon(286, 92, 0.8, '#F7A8B8') + corazon(212, 26, 0.6, '#F27C97') },
    { id: 'pascuas', nombre: 'Pascuas', grupo: 'temporada', cuando: 'Marzo o abril', meses: [3, 4], ...FUENTES.baloo, pieza: 'huevo',
      p: { cielo: '#EAF4D9', suelo: '#B8D98A', suelo2: '#A9CE78', raya: '#FFFFFF', a: '#8F6FD1', b: '#FFF8E7', c: '#F5B83D', agua: '#8CCFC6', agua2: '#76BFB5', t: '#3D3A5C' },
      ui: { card: '#FFFDF5', tx: '#2F2C4A', mu: '#5F5B78', bt: '#6C4FB8', on: '#FFFFFF', r: 22 },
      decor: () => huevo(48, 60, 1.3, '#F5B83D', '#fff') + huevo(350, 52, 1.5, '#F27BA5', '#fff') + huevo(112, 34, 0.9, '#7CC6E8', '#fff') + huevo(286, 30, 0.9, '#8F6FD1', '#fff') },
    // Sin el nombre de los eventos comerciales conocidos: son marcas de terceros.
    { id: 'ofertas', nombre: 'Semana de ofertas', grupo: 'temporada', cuando: 'Mayo y noviembre', meses: [5, 11], ...FUENTES.bebas, pieza: 'pelota',
      p: { cielo: '#111111', suelo: '#1E1E1E', suelo2: '#181818', raya: '#FFE600', a: '#FFE600', b: '#FFFFFF', c: '#FF3B30', agua: '#2A2A2A', agua2: '#333333', t: '#FFFFFF' },
      ui: { card: '#111111', tx: '#FFFFFF', mu: '#BDBDBD', bt: '#FFE600', on: '#111111', r: 0 },
      decor: () => '<g fill="#FFE600" font-family="Bebas Neue,Impact,sans-serif" font-size="46" opacity=".16"><text x="8" y="50">% OFF</text><text x="262" y="102">% OFF</text></g>' },
    { id: 'patria', nombre: 'Fiestas patrias', grupo: 'temporada', cuando: 'Mayo, junio y julio', meses: [5, 6, 7], ...FUENTES.fraunces, pieza: 'pelota',
      p: { cielo: '#CFE8F7', suelo: '#F7FBFE', suelo2: '#E8F3FA', raya: '#74ACDF', a: '#74ACDF', b: '#FFFFFF', c: '#F6B40E', agua: '#74ACDF', agua2: '#5E99CE', t: '#1E3A5F' },
      ui: { card: '#FFFFFF', tx: '#1E3A5F', mu: '#4F6780', bt: '#2F6FA8', on: '#FFFFFF', r: 12 },
      decor: () => banderines(6, ['#74ACDF', '#FFFFFF', '#74ACDF']) + sol(340, 70, 13, '#F6B40E') },
    { id: 'padre', nombre: 'Día del Padre', grupo: 'temporada', cuando: 'Junio', meses: [6], ...FUENTES.dm, pieza: 'pelota',
      p: { cielo: '#2A3B52', suelo: '#3A4E69', suelo2: '#334660', raya: '#D9B48F', a: '#D9B48F', b: '#F1EDE6', c: '#B5533C', agua: '#3E6A8A', agua2: '#356079', t: '#F1EDE6' },
      ui: { card: '#F7F3EC', tx: '#22303F', mu: '#55616E', bt: '#2A3B52', on: '#FFFFFF', r: 6 },
      decor: () => corbata(52, 46, 1.3, '#B5533C', '#D9B48F') + corbata(350, 44, 1.5, '#D9B48F', '#2A3B52') + corbata(130, 32, 0.8, '#6D87A8', '#F1EDE6') + corbata(282, 34, 0.8, '#6D87A8', '#F1EDE6') },
    { id: 'infancias', nombre: 'Día de las Infancias', grupo: 'temporada', cuando: 'Agosto', meses: [8], ...FUENTES.baloo, pieza: 'estrella',
      p: { cielo: '#FFE89C', suelo: '#7ED0A5', suelo2: '#6CC497', raya: '#FFFFFF', a: '#FF6B6B', b: '#FFFFFF', c: '#4D96FF', agua: '#4D96FF', agua2: '#3C84EC', t: '#24324A' },
      ui: { card: '#FFFFFF', tx: '#24324A', mu: '#56627A', bt: '#CF3442', on: '#FFFFFF', r: 24 },
      decor: () => globo(48, 44, 1.15, '#FF6B6B') + globo(92, 62, 0.9, '#4D96FF') + globo(346, 40, 1.2, '#7ED0A5') + globo(304, 66, 0.85, '#B57BFF') + nube(200, 34, 0.7, '#fff') },
    { id: 'primavera', nombre: 'Primavera', grupo: 'temporada', cuando: 'Septiembre', meses: [9], ...FUENTES.fraunces, pieza: 'flor',
      p: { cielo: '#E4F3E2', suelo: '#A8D59A', suelo2: '#99CB8A', raya: '#FFFFFF', a: '#F27BA5', b: '#FFFFFF', c: '#F9C74F', agua: '#84C7D9', agua2: '#71B8CB', t: '#2F4A35' },
      ui: { card: '#FFFEF9', tx: '#2B4431', mu: '#587060', bt: '#2F7A50', on: '#FFFFFF', r: 18 },
      decor: () => flor(50, 50, 12, '#F27BA5', '#F9C74F') + flor(345, 44, 14, '#F9A03F', '#fff') + flor(118, 26, 7, '#B58BE0', '#F9C74F') + flor(280, 86, 8, '#F27BA5', '#F9C74F') + flor(205, 62, 6, '#fff', '#F9C74F') },
    { id: 'madre', nombre: 'Día de la Madre', grupo: 'temporada', cuando: 'Octubre', meses: [10], ...FUENTES.cormorant, pieza: 'flor',
      p: { cielo: '#F5E6DF', suelo: '#D9B8AC', suelo2: '#CFAA9D', raya: '#FFFFFF', a: '#A8476A', b: '#FFF8F4', c: '#D98E73', agua: '#B5A0C4', agua2: '#A38FB4', t: '#4A2435' },
      ui: { card: '#FFF9F5', tx: '#43202F', mu: '#765462', bt: '#8E3A59', on: '#FFFFFF', r: 16 },
      decor: () => '<path d="M0 86Q60 40 130 24M400 78Q340 38 270 20" stroke="#7D8F6E" stroke-width="2" fill="none"/>' + flor(62, 52, 9, '#A8476A', '#F2D3B3') + flor(126, 26, 7, '#D98E73', '#fff') + flor(340, 46, 10, '#A8476A', '#F2D3B3') + flor(274, 22, 7, '#D98E73', '#fff') },
    { id: 'halloween', nombre: 'Halloween', grupo: 'temporada', cuando: '31 de octubre', meses: [10], ...FUENTES.archivo, pieza: 'calabaza',
      p: { cielo: '#1C1430', suelo: '#2A1E45', suelo2: '#241A3C', raya: '#FF8A1F', a: '#FF8A1F', b: '#F4EFE2', c: '#8FE05A', agua: '#2C3A55', agua2: '#34466A', t: '#F4EFE2' },
      ui: { card: '#1C1430', tx: '#F4EFE2', mu: '#BDB4CF', bt: '#FF8A1F', on: '#1C1430', r: 8 },
      decor: () => circ(326, 58, 34, '#F5E7B8') + murcielago(96, 46, 1.4, '#0d0918') + murcielago(290, 44, 1, '#0d0918') + murcielago(180, 28, 0.9, '#3b2d5e') + estrellitas('#fff', 12) },
    { id: 'navidad', nombre: 'Navidad', grupo: 'temporada', cuando: 'Diciembre', meses: [11, 12], ...FUENTES.dm, pieza: 'bola',
      p: { cielo: '#14342B', suelo: '#EEF2EE', suelo2: '#DFE7E1', raya: '#C8102E', a: '#C8102E', b: '#FFFFFF', c: '#E8B84A', agua: '#1F5A6E', agua2: '#1A4E60', t: '#14342B' },
      ui: { card: '#FFFDF8', tx: '#14342B', mu: '#48635A', bt: '#B3122B', on: '#FFFFFF', r: 14 },
      decor: () => luces(3, ['#E8B84A', '#C8102E', '#FFFFFF', '#58B368']) + copo(60, 74, 7, '#DDE9E4') + copo(345, 84, 9, '#DDE9E4') + copo(130, 54, 5, '#DDE9E4') + copo(268, 58, 6, '#DDE9E4') + pino(34, 205, 74, '#1F5A42') + pino(372, 205, 88, '#1F5A42') + pino(76, 205, 46, '#2A7053') },
    { id: 'anio', nombre: 'Año Nuevo', grupo: 'temporada', cuando: '31 de diciembre', meses: [12, 1], ...FUENTES.cormorant, pieza: 'estrella',
      p: { cielo: '#0E1020', suelo: '#1A1C33', suelo2: '#151729', raya: '#E3C26F', a: '#E3C26F', b: '#FFFFFF', c: '#E86A92', agua: '#20264A', agua2: '#283058', t: '#F3EFE3' },
      ui: { card: '#0E1020', tx: '#F3EFE3', mu: '#B4B3C4', bt: '#E3C26F', on: '#0E1020', r: 6 },
      decor: () => estrellitas('#fff', 16) + fuego(78, 54, 28, '#E3C26F') + fuego(322, 46, 34, '#E86A92') + fuego(202, 30, 18, '#7FD1E8') },
]

const POR_ID = new Map(TEMATICAS.map(t => [t.id, t]))
export const tematicaDe = (id: string | null | undefined) => (id ? POR_ID.get(id) ?? null : null)

// La pieza que no es de una temática conocida (dato viejo o de otra versión)
// cae al diseño original en vez de romper la tienda.
export const esTematicaConPiel = (id: string | null | undefined) => !!id && id !== 'clasico' && POR_ID.has(id)

function mesesHasta(t: Tematica, mesActual: number) {
    return Math.min(...(t.meses ?? [mesActual]).map(m => (m - mesActual + 12) % 12))
}

// Las de temporada primero y desde la próxima fecha: en noviembre lo primero
// que ve el dueño es Navidad, no San Valentín.
export function tematicasOrdenadas(filtro: 'todas' | 'temporada' | 'estilo', hoy = new Date()) {
    const mes = hoy.getMonth() + 1
    const estilos = TEMATICAS.filter(t => t.grupo === 'estilo')
    const temporada = TEMATICAS.filter(t => t.grupo === 'temporada').sort((a, b) => mesesHasta(a, mes) - mesesHasta(b, mes))
    return filtro === 'estilo' ? estilos : filtro === 'temporada' ? temporada : [...temporada, ...estilos]
}

// ─── Formatos ────────────────────────────────────────────────────────────────

export type PresentacionJuego = 'centro' | 'lado' | 'hoja'
export const PRESENTACIONES: { id: PresentacionJuego; nombre: string }[] = [
    { id: 'centro', nombre: 'Ventana al centro' },
    { id: 'lado', nombre: 'Panel al costado' },
    { id: 'hoja', nombre: 'Hoja desde abajo' },
]

// `mini`: rectángulos (izq, arriba, ancho, alto, opacidad, en %) de la miniatura.
export type Mini = [number, number, number, number, number?][]

export type FormatoAnuncio = 'barra' | 'centro' | 'partido' | 'esquina' | 'cinta' | 'hoja' | 'cupon' | 'pantalla' | 'pestana'
export const FORMATOS_ANUNCIO: { id: FormatoAnuncio; nombre: string; desc: string; mini: Mini }[] = [
    { id: 'barra', nombre: 'Barra flotante', desc: 'Abajo, sin tapar la portada', mini: [[22, 77, 56, 14]] },
    { id: 'centro', nombre: 'Ventana clásica', desc: 'Al centro de la pantalla', mini: [[30, 26, 40, 56]] },
    { id: 'partido', nombre: 'Foto y texto', desc: 'Para lucir un producto', mini: [[20, 24, 30, 60, 0.45], [50, 24, 30, 60]] },
    { id: 'esquina', nombre: 'Tarjeta en la esquina', desc: 'Discreta, no interrumpe', mini: [[5, 45, 30, 48]] },
    { id: 'cinta', nombre: 'Cinta superior', desc: 'Una línea bajo el menú', mini: [[0, 11, 100, 11]] },
    { id: 'hoja', nombre: 'Hoja inferior', desc: 'Cómoda en celular', mini: [[0, 68, 100, 32]] },
    { id: 'cupon', nombre: 'Cupón recortable', desc: 'Cuando hay un código', mini: [[24, 32, 40, 38], [66, 32, 10, 38, 0.5]] },
    { id: 'pantalla', nombre: 'Pantalla completa', desc: 'Para un lanzamiento', mini: [[0, 0, 100, 100, 0.85]] },
    { id: 'pestana', nombre: 'Pestaña lateral', desc: 'Queda a mano, se abre al tocar', mini: [[93, 30, 7, 40]] },
]

export type FormatoOferta = 'cartelera' | 'reloj' | 'tablero' | 'vidriera' | 'tarjetas' | 'tira' | 'marquesina'
export const FORMATOS_OFERTA: { id: FormatoOferta; nombre: string; desc: string; mini: Mini }[] = [
    { id: 'cartelera', nombre: 'Cartel y productos', desc: 'La de siempre', mini: [[6, 20, 28, 50], [37, 20, 17, 50, 0.3], [56, 20, 17, 50, 0.3], [75, 20, 17, 50, 0.3]] },
    { id: 'reloj', nombre: 'Reloj grande', desc: 'El tiempo es el mensaje', mini: [[6, 20, 88, 44]] },
    { id: 'tablero', nombre: 'Tablero de números', desc: 'Como un cartel de estación', mini: [[18, 28, 14, 32], [35, 28, 14, 32], [52, 28, 14, 32], [69, 28, 14, 32]] },
    { id: 'vidriera', nombre: 'Un producto protagonista', desc: 'Foto grande con el reloj', mini: [[0, 11, 100, 67, 0.8]] },
    { id: 'tarjetas', nombre: 'Reloj en cada producto', desc: 'Dentro de la grilla', mini: [[6, 22, 19, 42, 0.3], [29, 22, 19, 42, 0.3], [52, 22, 19, 42, 0.3], [75, 22, 19, 42, 0.3], [6, 54, 19, 10], [29, 54, 19, 10], [52, 54, 19, 10], [75, 54, 19, 10]] },
    { id: 'tira', nombre: 'Tira fina', desc: 'Ocupa una sola línea', mini: [[0, 11, 100, 10]] },
    { id: 'marquesina', nombre: 'Marquesina', desc: 'Texto que corre', mini: [[0, 11, 100, 10], [0, 27, 100, 2, 0.25]] },
]

export const DISENOS_BASICOS = [
    { id: 'tienda', nombre: 'Color de tu tienda' },
    { id: 'claro', nombre: 'Claro' },
    { id: 'oscuro', nombre: 'Oscuro' },
]

// ─── Colores resueltos ───────────────────────────────────────────────────────

export interface DisenoResuelto {
    card: string; tx: string; mu: string; bt: string; on: string; r: number; fuente: string
    tematica: Tematica | null
}

const SANS = 'inherit'

// `tienda` y `claro` se apoyan en las variables de la tienda: en el panel, la
// vista previa las define con el color real del negocio (MarcoTienda).
export function resolverDiseno(id: string | null | undefined): DisenoResuelto {
    const t = tematicaDe(id)
    if (t) return { ...t.ui, fuente: t.fuente, tematica: t }
    if (id === 'claro') return { card: '#FFFFFF', tx: '#14181F', mu: '#596270', bt: 'var(--color-primary)', on: 'var(--color-on-primary)', r: 12, fuente: SANS, tematica: null }
    if (id === 'oscuro') return { card: '#14181F', tx: '#FFFFFF', mu: '#B8BEC8', bt: '#FFFFFF', on: '#14181F', r: 12, fuente: SANS, tematica: null }
    return {
        card: 'var(--color-primary)', tx: 'var(--color-on-primary)',
        mu: 'color-mix(in srgb, var(--color-on-primary) 86%, transparent)',
        bt: 'var(--color-on-primary)', on: 'var(--color-primary)', r: 14, fuente: SANS, tematica: null,
    }
}

// Variables propias (--pr-*) y no --color-*: con el diseño "de la tienda" el
// botón invierte primario y texto, y redefinir --color-primary en base a sí
// misma sería una referencia circular.
export const varsDiseno = (d: DisenoResuelto) => ({
    '--pr-c': d.card, '--pr-x': d.tx, '--pr-m': d.mu, '--pr-b': d.bt, '--pr-o': d.on,
    '--pr-r': `${d.r}px`, '--pr-f': d.fuente,
}) as CSSProperties

// Para lo que ya está escrito con los tokens de la tienda (la ventana del juego,
// la cartelera). Solo con una temática: sin ella no se pisa nada.
export function varsTematicaComoTienda(id: string | null | undefined): CSSProperties | undefined {
    if (!esTematicaConPiel(id)) return undefined
    const t = tematicaDe(id)!, u = t.ui
    return {
        '--color-bg': u.card, '--color-surface': u.card,
        '--color-surface-alt': `color-mix(in srgb, ${u.tx} 7%, ${u.card})`,
        '--color-text': u.tx, '--color-body': u.tx, '--color-muted': u.mu, '--color-subtle': u.mu,
        '--color-border': `color-mix(in srgb, ${u.tx} 18%, ${u.card})`,
        '--color-border-strong': `color-mix(in srgb, ${u.tx} 34%, ${u.card})`,
        '--color-primary': u.bt, '--color-on-primary': u.on,
        '--color-primary-bg': `color-mix(in srgb, ${u.bt} 12%, ${u.card})`,
        '--promo-fuente': t.fuente, color: u.tx,
    } as CSSProperties
}

// Las fuentes de una temática se piden recién cuando se usa: una tienda con un
// juego de Navidad no tiene por qué bajar las diecinueve.
export function cargarFuenteTematica(id: string | null | undefined) {
    if (typeof document === 'undefined') return
    const spec = tematicaDe(id)?.fuenteGoogle
    if (!spec) return
    const domId = 'promo-font-' + spec.replace(/\W/g, '')
    if (document.getElementById(domId)) return
    const link = document.createElement('link')
    link.id = domId
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
    document.head.appendChild(link)
}


// DEMO INTERNA — plantillas del sitio de un negocio de turnos.
//
// Cada rubro tiene SUS cinco plantillas: una barbería elige entre cinco
// barberías, no entre una clínica y un gimnasio. Una plantilla no es una paleta:
// es una identidad completa (colores, par tipográfico, bordes, composición de
// la portada, forma de las tarjetas y de las fotos, textura de fondo) con
// nombre propio y pensada para ese rubro.
//
// Cómo está armado:
//  · LOOKS son las identidades visuales (veinticuatro), sin nombre de rubro.
//  · CATALOGO dice, rubro por rubro, cuáles cinco usa, cómo se llaman ahí y para
//    quién es cada una. La primera es la de fábrica: con esa se ve el sitio de
//    ejemplo del rubro.
//  · aplicarPlantilla() viste un tema con la plantilla (y con los ajustes que
//    el dueño le haya hecho en Apariencia: acento, letra, bordes y foto).
//
// No importa nada de tema.ts en ejecución (solo tipos): tema.ts es quien usa
// esto para armar el tema de cada rubro.
import type { RubroTurnos } from '@/modules/turnos/datos'
import type { EstiloTema, TemaNegocio } from './tema'

export type Paleta = TemaNegocio['c']
export type EstiloBoton = 'relleno' | 'borde' | 'suave'

// ─── Tipografías ─────────────────────────────────────────────────────────────

export interface ParTipografico {
  id: string; nombre: string; titulo: string; texto: string; fh: string; fb: string
  /** Títulos en mayúsculas. */
  mayus?: boolean
  /** Peso de los títulos: una serif fina y una condensada no piden lo mismo. */
  peso: number
  /** Specs de Google Fonts (css2), para cargar el par en el sitio y en la vista previa. */
  google: string[]
}

const CORMORANT = 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600'

export const TIPOGRAFIAS: ParTipografico[] = [
  { id: 'clasica', nombre: 'Clásica', titulo: 'Cormorant Garamond', texto: 'Manrope', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Manrope', system-ui, sans-serif", peso: 600, google: [CORMORANT, 'Manrope:wght@400;500;600;700;800'] },
  { id: 'atelier', nombre: 'Atelier', titulo: 'Cormorant Garamond', texto: 'Jost', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Jost', system-ui, sans-serif", peso: 500, google: [CORMORANT, 'Jost:wght@400;500;600;700'] },
  { id: 'delicada', nombre: 'Delicada', titulo: 'Cormorant Garamond', texto: 'Nunito', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", peso: 600, google: [CORMORANT, 'Nunito:wght@400;600;700;800'] },
  { id: 'editorial', nombre: 'Editorial', titulo: 'Libre Baskerville', texto: 'Nunito', fh: "'Libre Baskerville', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", peso: 700, google: ['Libre+Baskerville:ital,wght@0,400;0,700;1,400', 'Nunito:wght@400;600;700;800'] },
  { id: 'fraunces', nombre: 'Artesanal', titulo: 'Fraunces', texto: 'Nunito', fh: "'Fraunces', 'Libre Baskerville', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", peso: 600, google: ['Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600', 'Nunito:wght@400;600;700;800'] },
  { id: 'jakarta', nombre: 'Profesional', titulo: 'Plus Jakarta Sans', texto: 'Inter', fh: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", peso: 700, google: ['Plus+Jakarta+Sans:wght@500;600;700;800', 'Inter:wght@400;500;600;700'] },
  { id: 'serena', nombre: 'Serena', titulo: 'Manrope', texto: 'Inter', fh: "'Manrope', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", peso: 700, google: ['Manrope:wght@400;600;700;800', 'Inter:wght@400;500;600;700'] },
  { id: 'moderna', nombre: 'Moderna', titulo: 'Space Grotesk', texto: 'Inter', fh: "'Space Grotesk', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", peso: 700, google: ['Space+Grotesk:wght@400;500;700', 'Inter:wght@400;500;600;700'] },
  { id: 'nitida', nombre: 'Nítida', titulo: 'Outfit', texto: 'Inter', fh: "'Outfit', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", peso: 700, google: ['Outfit:wght@400;600;700;800', 'Inter:wght@400;500;600;700'] },
  { id: 'amable', nombre: 'Amable', titulo: 'Quicksand', texto: 'Nunito', fh: "'Quicksand', system-ui, sans-serif", fb: "'Nunito', system-ui, sans-serif", peso: 700, google: ['Quicksand:wght@400;500;600;700', 'Nunito:wght@400;600;700;800'] },
  { id: 'cercana', nombre: 'Cercana', titulo: 'Poppins', texto: 'Lato', fh: "'Poppins', system-ui, sans-serif", fb: "'Lato', system-ui, sans-serif", peso: 700, google: ['Poppins:wght@400;600;700;800', 'Lato:wght@400;700'] },
  { id: 'barlow', nombre: 'Deportiva', titulo: 'Barlow Condensed', texto: 'Barlow', fh: "'Barlow Condensed', 'Oswald', Impact, sans-serif", fb: "'Barlow', 'Inter', system-ui, sans-serif", mayus: true, peso: 800, google: ['Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800', 'Barlow:wght@400;500;600;700'] },
  { id: 'impacto', nombre: 'Impacto', titulo: 'Oswald', texto: 'Inter', fh: "'Oswald', Impact, sans-serif", fb: "'Inter', system-ui, sans-serif", mayus: true, peso: 700, google: ['Oswald:wght@400;500;600;700', 'Inter:wght@400;500;600;700'] },
  { id: 'potente', nombre: 'Potente', titulo: 'Montserrat', texto: 'Inter', fh: "'Montserrat', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", mayus: true, peso: 800, google: ['Montserrat:wght@400;600;800;900', 'Inter:wght@400;500;600;700'] },
]

export const tipografiaPorId = (id: string) => TIPOGRAFIAS.find(t => t.id === id) ?? TIPOGRAFIAS[0]

// ─── Color ───────────────────────────────────────────────────────────────────

const canales = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Texto legible arriba de un color de fondo: el que más contraste da entre
 * casi negro y blanco. El corte en 0,179 de luminancia es donde los dos
 * contrastes se cruzan; con un corte más alto, el blanco sobre un coral o un
 * dorado quedaba por debajo de 4,5:1.
 */
export function textoSobre(hex: string): string {
  const c = canales(hex)
  if (!c) return '#FFFFFF'
  const [r, g, b] = c.map(v => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111111' : '#FFFFFF'
}

export const esHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)

/** Mezcla dos colores hex: `t` = cuánto del segundo (0 a 1). */
export function mezclar(a: string, b: string, t: number): string {
  const ca = canales(a), cb = canales(b)
  if (!ca || !cb) return a
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()
}

const rgba = (hex: string, alfa: number) => { const c = canales(hex); return c ? `rgba(${c[0]},${c[1]},${c[2]},${alfa})` : hex }

/** La paleta de una plantilla con otro color de acento: recalcula lo que depende de él. */
export function paletaCon(p: Paleta, color: string): Paleta {
  if (!esHex(color) || color.toLowerCase() === p.primary.toLowerCase()) return p
  const sobre = textoSobre(color)
  // Si el fondo de la plantilla no es un hex (no pasa hoy), el tinte cae al color con transparencia.
  const tinte = canales(p.bg) ? mezclar(color, p.bg, 0.86) : `color-mix(in srgb, ${color} 14%, transparent)`
  return { ...p, primary: color, primaryH: mezclar(color, sobre === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.14), onPrimary: sobre, primaryBg: tinte }
}

// Estados sobre fondo oscuro y sobre fondo claro (todos ≥ 4.5:1 contra bg y surface).
export const E_OSCURO = { ok: '#4ADE80', aviso: '#FBBF24', lleno: '#FCA5A5', estrella: '#F5B83D' }
export const E_CLARO = { ok: '#15703A', aviso: '#9A4A06', lleno: '#B42318', estrella: '#B7791F' }

// ─── Identidades ─────────────────────────────────────────────────────────────

interface Look {
  /** Dos o tres palabras: el carácter visual. */
  caracter: string
  oscuro: boolean
  estilo: EstiloTema
  composicion: TemaNegocio['composicion']
  tarjeta: TemaNegocio['tarjeta']
  forma: TemaNegocio['forma']
  textura: TemaNegocio['textura']
  /** id de TIPOGRAFIAS. */
  tipo: string
  radio: number
  boton: EstiloBoton
  c: Paleta
  /** Segundo color de la plantilla: detalles y la luz ambiente de la portada. */
  acento: string
  /** Colores de acento que combinan con el fondo; el primero es el de fábrica. */
  acentos: string[]
}

const LOOKS = {
  // ── Oscuras ──
  oro: {
    caracter: 'Oscura y dorada', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'filete', forma: 'recta', textura: 'grano', tipo: 'clasica', radio: 3, boton: 'relleno',
    c: { bg: '#0C0B09', surface: '#15130F', surfaceAlt: '#1F1C16', border: '#352F25', text: '#F7F1E6', body: '#D9D0C1', muted: '#A89E8E', primary: '#D2A96A', primaryH: '#E3BD82', onPrimary: '#15110A', primaryBg: 'rgba(210,169,106,0.14)' },
    acento: '#C2664A', acentos: ['#D2A96A', '#D4A5A5', '#C8C8C8', '#E07A5F', '#B79CE0', '#8FC7B8'],
  },
  carbon: {
    caracter: 'Negra y lima', oscuro: true, estilo: 'box', composicion: 'impacto', tarjeta: 'corte', forma: 'recta', textura: 'trama', tipo: 'barlow', radio: 2, boton: 'relleno',
    c: { bg: '#08080A', surface: '#121215', surfaceAlt: '#1B1B20', border: '#2E2E35', text: '#FAFAFA', body: '#D4D4D8', muted: '#A1A1AA', primary: '#D4FF3A', primaryH: '#E4FF7A', onPrimary: '#0A0A0A', primaryBg: 'rgba(212,255,58,0.12)' },
    acento: '#FF5A36', acentos: ['#D4FF3A', '#FF5A1F', '#38BDF8', '#F43F5E', '#FACC15', '#A78BFA'],
  },
  noche: {
    caracter: 'Azul noche', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'suave', forma: 'redonda', textura: 'ninguna', tipo: 'nitida', radio: 14, boton: 'relleno',
    c: { bg: '#0A0E1F', surface: '#121833', surfaceAlt: '#1B2347', border: '#283262', text: '#F2F4FF', body: '#C5CBE8', muted: '#8F98C2', primary: '#8B9CFF', primaryH: '#A5B2FF', onPrimary: '#0A0E1F', primaryBg: 'rgba(139,156,255,0.16)' },
    acento: '#5EEAD4', acentos: ['#8B9CFF', '#5EEAD4', '#F0ABFC', '#FDBA74', '#7DD3FC', '#FCA5A5'],
  },
  cesped: {
    caracter: 'Verde césped', oscuro: true, estilo: 'box', composicion: 'impacto', tarjeta: 'corte', forma: 'recta', textura: 'trama', tipo: 'potente', radio: 6, boton: 'relleno',
    c: { bg: '#07140D', surface: '#0E2016', surfaceAlt: '#16301F', border: '#22452E', text: '#F4FBF6', body: '#CFE3D5', muted: '#8FB09A', primary: '#3DDC84', primaryH: '#63E69C', onPrimary: '#04120A', primaryBg: 'rgba(61,220,132,0.14)' },
    acento: '#FACC15', acentos: ['#3DDC84', '#FACC15', '#FB923C', '#38BDF8', '#F4F4F5', '#F472B6'],
  },
  vino: {
    caracter: 'Bordó y ámbar', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'filete', forma: 'arco', textura: 'grano', tipo: 'delicada', radio: 6, boton: 'relleno',
    c: { bg: '#140A0C', surface: '#1E1013', surfaceAlt: '#2A171B', border: '#46272D', text: '#FBF1EC', body: '#E2CFCB', muted: '#B59C99', primary: '#E3B27A', primaryH: '#EEC596', onPrimary: '#1A0C0E', primaryBg: 'rgba(227,178,122,0.14)' },
    acento: '#C2485B', acentos: ['#E3B27A', '#F2A7A0', '#E7D6C4', '#D98A6A', '#C9A9E8', '#9FD3C7'],
  },
  grafito: {
    caracter: 'Grafito y naranja', oscuro: true, estilo: 'box', composicion: 'impacto', tarjeta: 'corte', forma: 'recta', textura: 'trama', tipo: 'moderna', radio: 8, boton: 'relleno',
    c: { bg: '#101214', surface: '#181B1F', surfaceAlt: '#22262B', border: '#363B42', text: '#F5F6F7', body: '#D1D5DA', muted: '#9AA1AA', primary: '#FF8A3D', primaryH: '#FFA366', onPrimary: '#1A0E05', primaryBg: 'rgba(255,138,61,0.14)' },
    acento: '#38BDF8', acentos: ['#FF8A3D', '#FACC15', '#38BDF8', '#F4F4F5', '#F87171', '#86EFAC'],
  },
  lujo: {
    caracter: 'Negra y rosé', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'filete', forma: 'arco', textura: 'grano', tipo: 'atelier', radio: 2, boton: 'relleno',
    c: { bg: '#0B0A0D', surface: '#141217', surfaceAlt: '#1D1A21', border: '#342F3B', text: '#F8F4F1', body: '#DCD3D0', muted: '#A99E9D', primary: '#E8C4B0', primaryH: '#F2D6C6', onPrimary: '#1A1210', primaryBg: 'rgba(232,196,176,0.14)' },
    acento: '#B79CE0', acentos: ['#E8C4B0', '#E6D3A3', '#D9C2F0', '#F3B6C4', '#CFCFCF', '#A9D6CC'],
  },
  neon: {
    caracter: 'Violeta eléctrico', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'suave', forma: 'redonda', textura: 'ninguna', tipo: 'nitida', radio: 16, boton: 'relleno',
    c: { bg: '#0B0714', surface: '#150E24', surfaceAlt: '#1F1535', border: '#36275C', text: '#F6F1FF', body: '#D5C9F0', muted: '#A294C8', primary: '#C59BFF', primaryH: '#D7B8FF', onPrimary: '#12081F', primaryBg: 'rgba(197,155,255,0.16)' },
    acento: '#F472B6', acentos: ['#C59BFF', '#F472B6', '#67E8F9', '#FDE047', '#FB923C', '#86EFAC'],
  },
  bosque: {
    caracter: 'Verde profundo', oscuro: true, estilo: 'estudio', composicion: 'cine', tarjeta: 'filete', forma: 'arco', textura: 'grano', tipo: 'clasica', radio: 10, boton: 'relleno',
    c: { bg: '#0C1410', surface: '#131E18', surfaceAlt: '#1B2A22', border: '#2D4236', text: '#F1F7F2', body: '#CFE0D4', muted: '#94AD9B', primary: '#D6C08A', primaryH: '#E4D2A4', onPrimary: '#131A12', primaryBg: 'rgba(214,192,138,0.14)' },
    acento: '#7FB5A8', acentos: ['#D6C08A', '#9FD3B4', '#E8D9C0', '#E0A07A', '#C8C8C8', '#B9A8E0'],
  },
  // ── Claras ──
  atelier: {
    caracter: 'Crema y terracota', oscuro: false, estilo: 'atelier', composicion: 'partido', tarjeta: 'papel', forma: 'arco', textura: 'papel', tipo: 'atelier', radio: 18, boton: 'relleno',
    c: { bg: '#FBF6F1', surface: '#FFFFFF', surfaceAlt: '#F4E9E1', border: '#E6D5C9', text: '#2B1D1A', body: '#4E3B36', muted: '#755F58', primary: '#9C4A3C', primaryH: '#833A2E', onPrimary: '#FFFFFF', primaryBg: '#F6E2DB' },
    acento: '#6E7B5A', acentos: ['#9C4A3C', '#8A5A2B', '#7B4EA3', '#B8446B', '#2F7A6B', '#56642B'],
  },
  clinica: {
    caracter: 'Clara y serena', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', forma: 'redonda', textura: 'puntos', tipo: 'jakarta', radio: 16, boton: 'relleno',
    c: { bg: '#FFFFFF', surface: '#F4F9F8', surfaceAlt: '#E6F1EF', border: '#D3E3E0', text: '#082B30', body: '#2C474B', muted: '#51666A', primary: '#0B6E66', primaryH: '#085850', onPrimary: '#FFFFFF', primaryBg: '#DFF2EF' },
    acento: '#C2621B', acentos: ['#0B6E66', '#2563EB', '#0E7490', '#7C3AED', '#15803D', '#BE185D'],
  },
  taller: {
    caracter: 'Papel y terracota', oscuro: false, estilo: 'taller', composicion: 'collage', tarjeta: 'papel', forma: 'arco', textura: 'papel', tipo: 'fraunces', radio: 20, boton: 'relleno',
    c: { bg: '#F7F1E7', surface: '#FFFCF6', surfaceAlt: '#EFE4D3', border: '#DFCFB8', text: '#2A1F17', body: '#4A3B2F', muted: '#6B5B4C', primary: '#A8481F', primaryH: '#8E3B18', onPrimary: '#FFFFFF', primaryBg: '#F4DFD0' },
    acento: '#55663A', acentos: ['#A8481F', '#6B7F3A', '#2F5D8A', '#A23B5B', '#8A5A00', '#5B4B8A'],
  },
  cosmos: {
    caracter: 'Blanca y azul', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', forma: 'redonda', textura: 'puntos', tipo: 'moderna', radio: 12, boton: 'relleno',
    c: { bg: '#FFFFFF', surface: '#F5F8FF', surfaceAlt: '#E8EEFB', border: '#D9E2F3', text: '#0B1533', body: '#33415E', muted: '#5C6B8A', primary: '#2563EB', primaryH: '#1D4ED8', onPrimary: '#FFFFFF', primaryBg: '#E6EEFF' },
    acento: '#0E7490', acentos: ['#2563EB', '#4F46E5', '#0E7490', '#7C3AED', '#0F766E', '#BE185D'],
  },
  rose: {
    caracter: 'Rosa empolvado', oscuro: false, estilo: 'atelier', composicion: 'partido', tarjeta: 'papel', forma: 'arco', textura: 'ninguna', tipo: 'delicada', radio: 22, boton: 'relleno',
    c: { bg: '#FFF8F6', surface: '#FFFFFF', surfaceAlt: '#FBE9E6', border: '#F1D9D5', text: '#3A1F28', body: '#5C3A45', muted: '#80596A', primary: '#B8446B', primaryH: '#9E365A', onPrimary: '#FFFFFF', primaryBg: '#FBE3EA' },
    acento: '#9C5A3C', acentos: ['#B8446B', '#9C5A3C', '#7B4EA3', '#C2410C', '#2F7A6B', '#9F1239'],
  },
  calma: {
    caracter: 'Salvia y arena', oscuro: false, estilo: 'taller', composicion: 'collage', tarjeta: 'suave', forma: 'arco', textura: 'papel', tipo: 'amable', radio: 24, boton: 'suave',
    c: { bg: '#F6F7F2', surface: '#FFFFFF', surfaceAlt: '#E9EDE3', border: '#DCE2D3', text: '#1F2A22', body: '#3D4A40', muted: '#5F6C5A', primary: '#4E7A5B', primaryH: '#3F6649', onPrimary: '#FFFFFF', primaryBg: '#E2EDE4' },
    acento: '#8A6A3B', acentos: ['#4E7A5B', '#8A6A3B', '#3F6F82', '#7A5C86', '#A2543B', '#56642B'],
  },
  editorial: {
    caracter: 'Blanco y negro', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'filete', forma: 'recta', textura: 'ninguna', tipo: 'editorial', radio: 2, boton: 'borde',
    c: { bg: '#FAFAF7', surface: '#FFFFFF', surfaceAlt: '#EFEFEA', border: '#DEDED6', text: '#141414', body: '#3A3A38', muted: '#66665F', primary: '#141414', primaryH: '#333333', onPrimary: '#FFFFFF', primaryBg: '#ECECE6' },
    acento: '#B42318', acentos: ['#141414', '#B42318', '#1D4ED8', '#7A5C2E', '#0F766E', '#6D28D9'],
  },
  vintage: {
    caracter: 'Crema y verde botella', oscuro: false, estilo: 'taller', composicion: 'collage', tarjeta: 'papel', forma: 'recta', textura: 'papel', tipo: 'clasica', radio: 6, boton: 'relleno',
    c: { bg: '#F4EEE1', surface: '#FBF7EE', surfaceAlt: '#EAE0CC', border: '#D8CBB0', text: '#1F2A24', body: '#3B4A41', muted: '#5F6B60', primary: '#1F5A46', primaryH: '#17483A', onPrimary: '#FFFFFF', primaryBg: '#DCE8E0' },
    acento: '#8C2F2A', acentos: ['#1F5A46', '#8C2F2A', '#1E3A5F', '#7A5C2E', '#5B3A6B', '#2B2B2B'],
  },
  lavanda: {
    caracter: 'Lila suave', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', forma: 'redonda', textura: 'puntos', tipo: 'amable', radio: 20, boton: 'relleno',
    c: { bg: '#FAF8FF', surface: '#FFFFFF', surfaceAlt: '#EFEAFB', border: '#DED6F2', text: '#251B3D', body: '#45395F', muted: '#675B85', primary: '#6D4AC7', primaryH: '#5A3BAD', onPrimary: '#FFFFFF', primaryBg: '#EAE2FB' },
    acento: '#B8446B', acentos: ['#6D4AC7', '#B8446B', '#0E7490', '#4F46E5', '#0F766E', '#9C4A3C'],
  },
  oceano: {
    caracter: 'Azul agua', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', forma: 'redonda', textura: 'puntos', tipo: 'nitida', radio: 18, boton: 'relleno',
    c: { bg: '#F7FBFE', surface: '#FFFFFF', surfaceAlt: '#E5F1FA', border: '#CFE2F1', text: '#072A40', body: '#2B4A5F', muted: '#4F6A7D', primary: '#0B6BA8', primaryH: '#095889', onPrimary: '#FFFFFF', primaryBg: '#DCEEFA' },
    acento: '#0F766E', acentos: ['#0B6BA8', '#0F766E', '#4F46E5', '#0E7490', '#7C3AED', '#C2410C'],
  },
  energia: {
    caracter: 'Clara y naranja', oscuro: false, estilo: 'clinica', composicion: 'collage', tarjeta: 'suave', forma: 'redonda', textura: 'ninguna', tipo: 'cercana', radio: 14, boton: 'relleno',
    c: { bg: '#FFFBF7', surface: '#FFFFFF', surfaceAlt: '#FFEEE0', border: '#F5DBC6', text: '#2A1608', body: '#54382A', muted: '#7A5C4C', primary: '#C8410F', primaryH: '#A8350A', onPrimary: '#FFFFFF', primaryBg: '#FFE6D6' },
    acento: '#0E7490', acentos: ['#C8410F', '#B4233A', '#0E7490', '#7C3AED', '#15803D', '#1D4ED8'],
  },
  menta: {
    caracter: 'Verde menta', oscuro: false, estilo: 'clinica', composicion: 'partido', tarjeta: 'suave', forma: 'redonda', textura: 'puntos', tipo: 'serena', radio: 16, boton: 'relleno',
    c: { bg: '#F5FBF8', surface: '#FFFFFF', surfaceAlt: '#E2F3EB', border: '#CBE5D8', text: '#0E2A1F', body: '#2F4A3E', muted: '#52695D', primary: '#0F7A54', primaryH: '#0B6444', onPrimary: '#FFFFFF', primaryBg: '#D9F0E5' },
    acento: '#0B6BA8', acentos: ['#0F7A54', '#0B6BA8', '#7C3AED', '#C2410C', '#56642B', '#BE185D'],
  },
  miel: {
    caracter: 'Marfil y miel', oscuro: false, estilo: 'taller', composicion: 'collage', tarjeta: 'papel', forma: 'redonda', textura: 'papel', tipo: 'cercana', radio: 18, boton: 'relleno',
    c: { bg: '#FFFCF2', surface: '#FFFFFF', surfaceAlt: '#FFF3CC', border: '#F0E2B0', text: '#1F1A0A', body: '#453C1E', muted: '#6B6038', primary: '#8A5A00', primaryH: '#714900', onPrimary: '#FFFFFF', primaryBg: '#FDEFC4' },
    acento: '#2F5D8A', acentos: ['#8A5A00', '#A8481F', '#2F5D8A', '#15703A', '#7B4EA3', '#1F1A0A'],
  },
  arena: {
    caracter: 'Arena y caramelo', oscuro: false, estilo: 'atelier', composicion: 'partido', tarjeta: 'papel', forma: 'arco', textura: 'papel', tipo: 'atelier', radio: 14, boton: 'relleno',
    c: { bg: '#FAF5EE', surface: '#FFFFFF', surfaceAlt: '#F0E6D8', border: '#E1D3BF', text: '#2C2118', body: '#4D3F33', muted: '#6F6052', primary: '#8C5A2B', primaryH: '#744821', onPrimary: '#FFFFFF', primaryBg: '#F1E2D0' },
    acento: '#4E7A5B', acentos: ['#8C5A2B', '#9C4A3C', '#4E7A5B', '#3F6F82', '#7A5C86', '#2C2118'],
  },
  coral: {
    caracter: 'Coral vivo', oscuro: false, estilo: 'taller', composicion: 'collage', tarjeta: 'papel', forma: 'redonda', textura: 'ninguna', tipo: 'cercana', radio: 18, boton: 'relleno',
    c: { bg: '#FFF7F5', surface: '#FFFFFF', surfaceAlt: '#FFE7E1', border: '#F6D2C9', text: '#32140F', body: '#5A332C', muted: '#7D554D', primary: '#C2362B', primaryH: '#A32A20', onPrimary: '#FFFFFF', primaryBg: '#FFE0DA' },
    acento: '#7B4EA3', acentos: ['#C2362B', '#B8446B', '#7B4EA3', '#0E7490', '#8A5A00', '#2F7A6B'],
  },
} satisfies Record<string, Look>

type LookId = keyof typeof LOOKS

// ─── Catálogo: las cinco de cada rubro ───────────────────────────────────────
// [identidad, nombre en ese rubro, para quién es]. La primera es la de fábrica.

type Entrada = [LookId, string, string]

const CATALOGO: Record<string, [Entrada, Entrada, Entrada, Entrada, Entrada]> = {
  // Belleza y cuidado personal
  barberia: [
    ['oro', 'Navaja', 'La barbería clásica: madera, cuero y detalles dorados.'],
    ['vintage', 'Barrio', 'La de toda la vida: crema, verde botella y letras de cartel.'],
    ['grafito', 'Fade', 'Urbana y directa, para un público joven.'],
    ['noche', 'Club', 'Azul noche y prolija: barbería con aire de club privado.'],
    ['editorial', 'Oficio', 'Blanco y negro, sobria: que hablen los cortes.'],
  ],
  peluqueria: [
    ['oro', 'Salón', 'Elegante y oscura, para un salón con firma propia.'],
    ['rose', 'Brushing', 'Luminosa y femenina: color, peinados y eventos.'],
    ['arena', 'Raíz', 'Tonos tierra y calma, para un salón de autor.'],
    ['lavanda', 'Color', 'Fresca y moderna: ideal si hacés mucha colorimetría.'],
    ['editorial', 'Tijera', 'Minimalista, tipo revista de moda.'],
  ],
  estilista: [
    ['oro', 'Firma', 'Tu nombre como marca: oscura y con carácter.'],
    ['arena', 'Casa', 'Cálida y cercana, para quien atiende en su espacio o a domicilio.'],
    ['rose', 'Rosé', 'Suave y luminosa, pensada para novias y eventos.'],
    ['editorial', 'Portfolio', 'Limpia, para que tus trabajos sean lo primero que se ve.'],
    ['lavanda', 'Aura', 'Fresca y liviana, con un toque de color.'],
  ],
  maquillaje: [
    ['atelier', 'Atelier', 'Cálida y editorial: el estudio de una maquilladora.'],
    ['lujo', 'Backstage', 'Negra y rosé, para novias y producciones.'],
    ['rose', 'Rubor', 'Rosa empolvado, delicada y luminosa.'],
    ['coral', 'Labial', 'Vibrante y joven: sociales, quince y egresos.'],
    ['editorial', 'Revista', 'Blanco y negro para lucir tus fotos.'],
  ],
  estetica: [
    ['atelier', 'Cabina', 'Cálida y prolija: transmite cuidado desde la portada.'],
    ['lavanda', 'Seda', 'Suave y luminosa, para faciales y aparatología.'],
    ['menta', 'Piel', 'Fresca y limpia, con aire de clínica de piel.'],
    ['arena', 'Nude', 'Tonos piel y arena, serena y elegante.'],
    ['lujo', 'Lumière', 'Oscura y sofisticada, para un centro premium.'],
  ],
  unas: [
    ['atelier', 'Nail bar', 'Cálida y cuidada, como un salón boutique.'],
    ['rose', 'Rosé', 'Rosa empolvado: delicada y bien femenina.'],
    ['lavanda', 'Lila', 'Fresca y divertida, para diseños y nail art.'],
    ['coral', 'Esmalte', 'Colorida y joven, llama la atención en Instagram.'],
    ['lujo', 'Glam', 'Negra y rosé, para un servicio de lujo.'],
  ],
  pestanas: [
    ['atelier', 'Mirada', 'Cálida y elegante: un estudio de pestañas con oficio.'],
    ['lujo', 'Noir', 'Oscura y sofisticada, con detalles rosé.'],
    ['rose', 'Rubor', 'Rosa empolvado, delicada y luminosa.'],
    ['lavanda', 'Velo', 'Suave y moderna, con aire fresco.'],
    ['editorial', 'Línea', 'Minimalista: que se luzcan tus antes y después.'],
  ],
  depilacion: [
    ['atelier', 'Piel', 'Cálida y prolija, para un centro de confianza.'],
    ['menta', 'Fresca', 'Limpia y liviana: transmite higiene y cuidado.'],
    ['rose', 'Suave', 'Rosa empolvado, delicada.'],
    ['cosmos', 'Láser', 'Blanca y tecnológica, para depilación definitiva.'],
    ['arena', 'Seda', 'Tonos arena, serena y elegante.'],
  ],
  spa: [
    ['atelier', 'Refugio', 'Cálida y cuidada: invita a entrar.'],
    ['calma', 'Salvia', 'Verde salvia y arena, para bajar un cambio.'],
    ['arena', 'Termas', 'Tonos tierra, como un spa de montaña.'],
    ['bosque', 'Bosque', 'Oscura y profunda, para un spa nocturno o de hotel.'],
    ['oceano', 'Agua', 'Clara y azul: circuitos de agua e hidromasajes.'],
  ],
  tatuajes: [
    ['oro', 'Tinta', 'Oscura y con oficio: el estudio clásico.'],
    ['grafito', 'Aguja', 'Industrial y directa, para un estudio urbano.'],
    ['vino', 'Old school', 'Bordó y ámbar, con aire tradicional.'],
    ['neon', 'Neón', 'Violeta eléctrico: color, anime y diseños nuevos.'],
    ['editorial', 'Blackwork', 'Blanco y negro puro, para línea fina y black.'],
  ],

  // Salud
  consulta: [
    ['clinica', 'Consultorio', 'Clara y serena: confianza desde el primer vistazo.'],
    ['cosmos', 'Clara', 'Blanca y azul, moderna y ordenada.'],
    ['menta', 'Vital', 'Verde y fresca, cercana para tus pacientes.'],
    ['editorial', 'Matrícula', 'Sobria y formal, tu nombre adelante.'],
    ['oceano', 'Cielo', 'Azul suave, tranquila y luminosa.'],
  ],
  'centro-medico': [
    ['clinica', 'Centro', 'Clara e institucional, para varias especialidades.'],
    ['cosmos', 'Especialidades', 'Blanca y azul, ordenada y fácil de recorrer.'],
    ['oceano', 'Salud', 'Azul agua, amable y profesional.'],
    ['menta', 'Bienestar', 'Verde y cercana, para medicina familiar.'],
    ['editorial', 'Institucional', 'Sobria, con el foco en los profesionales.'],
  ],
  clinica: [
    ['clinica', 'Clínica', 'Clara y serena, la identidad de una clínica moderna.'],
    ['oceano', 'Azul', 'Azul agua: transmite calma en la sala de espera.'],
    ['cosmos', 'Moderna', 'Blanca y tecnológica, para estudios y diagnóstico.'],
    ['menta', 'Verde', 'Fresca y cercana.'],
    ['editorial', 'Sobria', 'Formal, sin distracciones.'],
  ],
  odonto: [
    ['clinica', 'Sonrisa', 'Clara y limpia: lo que se espera de un consultorio dental.'],
    ['oceano', 'Esmalte', 'Azul agua, fresca y luminosa.'],
    ['cosmos', 'Brillo', 'Blanca y moderna, para estética dental.'],
    ['menta', 'Menta', 'Verde menta, amable para toda la familia.'],
    ['lavanda', 'Suave', 'Lila y cercana: ideal si atendés chicos.'],
  ],
  'medicina-estetica': [
    ['clinica', 'Clínica', 'Clara y médica: seguridad antes que nada.'],
    ['lujo', 'Lumen', 'Negra y rosé, para una clínica premium.'],
    ['arena', 'Nude', 'Tonos piel, elegante y serena.'],
    ['rose', 'Rosé', 'Rosa empolvado, delicada.'],
    ['editorial', 'Derma', 'Sobria y científica.'],
  ],
  kinesio: [
    ['clinica', 'Movimiento', 'Clara y profesional, para rehabilitación.'],
    ['energia', 'Activa', 'Naranja y con energía: kinesiología deportiva.'],
    ['oceano', 'Fluir', 'Azul agua, tranquila.'],
    ['menta', 'Recupero', 'Verde y cercana.'],
    ['cosmos', 'Kine', 'Blanca y moderna, ordenada.'],
  ],
  psico: [
    ['clinica', 'Espacio', 'Clara y serena: un lugar de confianza.'],
    ['calma', 'Pausa', 'Salvia y arena, para bajar un cambio.'],
    ['editorial', 'Diván', 'Sobria y prolija, tu nombre adelante.'],
    ['arena', 'Cálida', 'Tonos tierra, cercana y humana.'],
    ['lavanda', 'Escucha', 'Lila suave, liviana y amable.'],
  ],
  nutricion: [
    ['clinica', 'Balance', 'Clara y profesional.'],
    ['menta', 'Verde', 'Fresca y natural, como un plato bien armado.'],
    ['energia', 'Citrus', 'Naranja y vital: nutrición deportiva.'],
    ['miel', 'Miel', 'Cálida y cercana.'],
    ['editorial', 'Plan', 'Sobria, con el foco en tu método.'],
  ],
  podologia: [
    ['clinica', 'Paso', 'Clara y limpia, transmite cuidado.'],
    ['oceano', 'Pisada', 'Azul agua, fresca.'],
    ['menta', 'Cuidado', 'Verde y amable.'],
    ['cosmos', 'Clara', 'Blanca y ordenada.'],
    ['arena', 'Arena', 'Tonos tierra, serena.'],
  ],
  fono: [
    ['clinica', 'Voz', 'Clara y profesional.'],
    ['lavanda', 'Eco', 'Lila y amable: ideal si atendés chicos.'],
    ['energia', 'Palabra', 'Naranja y alegre.'],
    ['cosmos', 'Clara', 'Blanca y ordenada.'],
    ['miel', 'Sol', 'Cálida y cercana.'],
  ],
  'medicina-alternativa': [
    ['clinica', 'Armonía', 'Clara y serena.'],
    ['calma', 'Zen', 'Salvia y arena: invita a la calma.'],
    ['arena', 'Tierra', 'Tonos tierra, cálida y natural.'],
    ['bosque', 'Raíz', 'Verde profundo, para un espacio holístico.'],
    ['lavanda', 'Aura', 'Lila suave, liviana.'],
  ],

  // Deporte y bienestar
  gym: [
    ['carbon', 'Hierro', 'Negra y lima: pura energía de gimnasio.'],
    ['grafito', 'Fuerza', 'Grafito y naranja, industrial.'],
    ['neon', 'Pulso', 'Violeta eléctrico, para clases y música.'],
    ['cosmos', 'Fit', 'Blanca y azul: gimnasio de barrio, claro y ordenado.'],
    ['energia', 'Sudor', 'Clara y naranja, cercana y con empuje.'],
  ],
  crossfit: [
    ['carbon', 'Box', 'Negra y lima, la identidad del box.'],
    ['grafito', 'WOD', 'Grafito y naranja, cruda y directa.'],
    ['neon', 'RX', 'Violeta eléctrico, para una comunidad joven.'],
    ['cesped', 'Rig', 'Verde oscuro y potente.'],
    ['editorial', 'Tiza', 'Blanco y negro, como el pizarrón del WOD.'],
  ],
  funcional: [
    ['carbon', 'Circuito', 'Negra y lima, intensa.'],
    ['energia', 'Energía', 'Clara y naranja: grupos reducidos y buena onda.'],
    ['grafito', 'Kettlebell', 'Grafito y naranja, industrial.'],
    ['cosmos', 'Activo', 'Blanca y azul, ordenada.'],
    ['cesped', 'Aire libre', 'Verde: para entrenar en la plaza o el parque.'],
  ],
  electro: [
    ['carbon', 'Impulso', 'Negra y lima, tecnológica.'],
    ['neon', 'Voltaje', 'Violeta eléctrico, futurista.'],
    ['cosmos', 'Pulso', 'Blanca y azul, limpia y clara.'],
    ['oceano', 'Onda', 'Azul agua, serena.'],
    ['grafito', 'EMS', 'Grafito y naranja, deportiva.'],
  ],
  canchas: [
    ['carbon', 'Tribuna', 'Negra y lima: el complejo de noche.'],
    ['cesped', 'Césped', 'Verde césped, como la cancha.'],
    ['grafito', 'Nocturno', 'Grafito y naranja, con luz de reflector.'],
    ['noche', 'Estadio', 'Azul noche, prolija.'],
    ['energia', 'Potrero', 'Clara y naranja, de club de barrio.'],
  ],
  yoga: [
    ['calma', 'Prana', 'Salvia y arena: calma desde la portada.'],
    ['arena', 'Shala', 'Tonos tierra, cálida y simple.'],
    ['bosque', 'Bosque', 'Verde profundo, para clases al atardecer.'],
    ['lavanda', 'Loto', 'Lila suave y liviana.'],
    ['oceano', 'Respira', 'Azul agua, clara y abierta.'],
  ],
  danza: [
    ['neon', 'Escenario', 'Violeta eléctrico: luces, música y movimiento.'],
    ['vino', 'Milonga', 'Bordó y ámbar, para tango y ritmos de salón.'],
    ['coral', 'Ritmo', 'Coral y alegre: salsa, bachata y urbanos.'],
    ['grafito', 'Urbano', 'Grafito y naranja, para hip hop y street.'],
    ['editorial', 'Barra', 'Blanco y negro, para ballet y danza contemporánea.'],
  ],
  'artes-marciales': [
    ['carbon', 'Dojo', 'Negra y potente: disciplina y carácter.'],
    ['vino', 'Cinturón', 'Bordó y ámbar, tradicional.'],
    ['grafito', 'Tatami', 'Grafito y naranja, de competencia.'],
    ['noche', 'Honor', 'Azul noche, sobria.'],
    ['editorial', 'Kata', 'Blanco y negro, limpia.'],
  ],
  natacion: [
    ['oceano', 'Pileta', 'Azul agua: se respira cloro del bueno.'],
    ['noche', 'Profundo', 'Azul noche, para un club con historia.'],
    ['cosmos', 'Andarivel', 'Blanca y azul, ordenada.'],
    ['menta', 'Laguna', 'Verde agua, fresca.'],
    ['energia', 'Verano', 'Clara y naranja: colonia y pileta libre.'],
  ],

  // Clases
  clases: [
    ['taller', 'Aula', 'Cálida y artesanal: clases con dedicación.'],
    ['cosmos', 'Apunte', 'Blanca y azul, ordenada: apoyo escolar y exámenes.'],
    ['miel', 'Tiza', 'Marfil y miel, cercana.'],
    ['lavanda', 'Idioma', 'Lila y moderna: idiomas y conversación.'],
    ['editorial', 'Cuaderno', 'Blanco y negro, prolija.'],
  ],
  talleres: [
    ['taller', 'Taller', 'Papel y terracota: se nota que se trabaja con las manos.'],
    ['vintage', 'Oficio', 'Crema y verde botella, con aire de taller antiguo.'],
    ['coral', 'Manos', 'Coral y alegre, para talleres de fin de semana.'],
    ['miel', 'Barro', 'Marfil y miel, cálida.'],
    ['calma', 'Encuentro', 'Salvia y arena, tranquila.'],
  ],
}

// ─── Plantillas ──────────────────────────────────────────────────────────────

export interface PlantillaSitio {
  id: string
  nombre: string
  /** Dos o tres palabras: el carácter visual. */
  caracter: string
  /** Una línea: para qué negocio va. */
  para: string
  /** La de fábrica del rubro: con esa se ve el sitio de ejemplo. */
  fabrica: boolean
  oscuro: boolean
  /** Portada con la foto de fondo o con el texto a un lado (sale de `composicion`). */
  hero: 'sangre' | 'partido'
  estilo: EstiloTema
  composicion: TemaNegocio['composicion']
  tarjeta: TemaNegocio['tarjeta']
  forma: TemaNegocio['forma']
  textura: TemaNegocio['textura']
  /** id de TIPOGRAFIAS. */
  tipo: string
  radio: number
  boton: EstiloBoton
  c: Paleta
  acento: string
  acentos: string[]
  /** Foto de portada con la que se muestra (una de las del rubro). */
  foto: string
}

const heroDe = (c: TemaNegocio['composicion']): 'sangre' | 'partido' => (c === 'cine' || c === 'impacto' ? 'sangre' : 'partido')

/**
 * Las cinco plantillas de un rubro. `fotos` son las del negocio (portada y
 * galería): cada plantilla se muestra con una distinta, así las miniaturas no
 * son la misma foto pintada de otro color.
 */
export function plantillasDe(rubro: Pick<RubroTurnos, 'key'>, fotos: string[]): PlantillaSitio[] {
  const entradas = CATALOGO[rubro.key] ?? CATALOGO.barberia
  const unicas = [...new Set(fotos)]
  return entradas.map(([lookId, nombre, para], i) => {
    const look: Look = LOOKS[lookId]
    return {
      id: `${rubro.key}-${lookId}`, nombre, para, fabrica: i === 0, ...look, hero: heroDe(look.composicion),
      foto: unicas[i % Math.max(1, unicas.length)] ?? '',
    }
  })
}

/** La identidad de fábrica de un rubro (la primera de sus cinco). */
export const lookDeFabrica = (rubroKey: string): LookId => (CATALOGO[rubroKey] ?? CATALOGO.barberia)[0][0]

/** Los ajustes que el dueño le puede hacer a una plantilla desde Apariencia. */
export interface AjustesPlantilla { color?: string; tipo?: string; radio?: number; foto?: string }

const formaBoton = (radio: number): TemaNegocio['boton'] => (radio <= 4 ? 'recto' : radio >= 20 ? 'pildora' : 'suave')

/** El tema `t` vestido con la plantilla `p` (y con los ajustes del dueño, si los hay). El negocio —nombre, horarios, textos— no cambia. */
export function aplicarPlantilla(t: TemaNegocio, p: PlantillaSitio, a: AjustesPlantilla = {}): TemaNegocio {
  const tipo = tipografiaPorId(a.tipo ?? p.tipo)
  const c = paletaCon(p.c, a.color ?? p.c.primary)
  const radio = a.radio ?? p.radio
  return {
    ...t,
    oscuro: p.oscuro, hero: p.hero, estilo: p.estilo, composicion: p.composicion, tarjeta: p.tarjeta, forma: p.forma, textura: p.textura,
    boton: formaBoton(radio), radio, c,
    fh: tipo.fh, fb: tipo.fb, mayus: tipo.mayus, pesoTitulo: tipo.peso, fuentes: tipo.google,
    e: { ...(p.oscuro ? E_OSCURO : E_CLARO), acento: p.acento },
    grad: `radial-gradient(880px 470px at 88% -4%, ${rgba(c.primary, p.oscuro ? 0.2 : 0.14)}, transparent 62%), radial-gradient(680px 410px at 0% 104%, ${rgba(p.acento, p.oscuro ? 0.16 : 0.13)}, transparent 60%)`,
    fotoHero: a.foto || p.foto || t.fotoHero,
  }
}

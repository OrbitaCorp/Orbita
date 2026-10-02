// Estado de presentación del Orbi nuevo: lo que NO es la conversación (esa
// vive en components/orbi/useOrbiStore, compartida con el motor de envío).
// Cambiar de vista no recarga nada porque todo esto vive arriba de las vistas.
import { create } from 'zustand'

export const ANCHO_MINIMO = 320
export const ANCHO_MAXIMO = 560
export const ANCHO_POR_DEFECTO = 400
const CLAVE_ANCHO = 'orbi:ancho'

export function anchoValido(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return ANCHO_POR_DEFECTO
  return Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, Math.round(n)))
}

function leer(clave: string): string | null {
  try { return window.localStorage.getItem(clave) } catch { return null }
}
function guardar(clave: string, valor: string): void {
  try { window.localStorage.setItem(clave, valor) } catch { /* modo privado: no se recuerda */ }
}

/** La sesión del borrador: la abierta, o "nueva" si todavía no tiene id. */
export const claveDeBorrador = (conversationId: string | null) => conversationId ?? 'nueva'

interface EstadoV2 {
  ancho: number
  /** Texto a medio escribir por sesión: elegir otra no limpia el de la actual. */
  borradores: Record<string, string>
  /** Título de la sesión abierta (el de la API, o el primer mensaje mientras tanto). */
  titulo: string | null
  hoja: 'media' | 'completa'
  selectorAbierto: boolean
  setAncho: (px: number) => void
  cargarAncho: () => void
  setBorrador: (clave: string, texto: string) => void
  setTitulo: (titulo: string | null) => void
  setHoja: (hoja: 'media' | 'completa') => void
  setSelectorAbierto: (abierto: boolean) => void
}

export const useOrbiV2 = create<EstadoV2>((set) => ({
  ancho: ANCHO_POR_DEFECTO,
  borradores: {},
  titulo: null,
  hoja: 'media',
  selectorAbierto: false,
  setAncho: (px) => {
    const ancho = anchoValido(px)
    set({ ancho })
    guardar(CLAVE_ANCHO, String(ancho))
  },
  cargarAncho: () => {
    const guardado = leer(CLAVE_ANCHO)
    if (guardado !== null) set({ ancho: anchoValido(guardado) })
  },
  setBorrador: (clave, texto) => set(s => ({ borradores: { ...s.borradores, [clave]: texto } })),
  setTitulo: (titulo) => set({ titulo }),
  setHoja: (hoja) => set({ hoja }),
  setSelectorAbierto: (selectorAbierto) => set({ selectorAbierto }),
}))

/** Título provisorio de una sesión nueva: el primer mensaje, recortado (la API guarda el suyo con la misma regla). */
export function tituloProvisorio(mensaje: string): string {
  const limpio = mensaje.replace(/\s+/g, ' ').trim()
  const letras = Array.from(limpio)
  if (letras.length <= 60) return limpio
  const corte = letras.slice(0, 59).join('')
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio >= 30 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:]+$/u, '')}…`
}

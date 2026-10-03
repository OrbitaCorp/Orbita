// Lo que se ve de lo que hizo Orbi en un mensaje (diseño A3·2, 3 y 5): una
// fila por consulta, el resumen plegado y el estado de cada tarjeta. Sale del
// stream de hoy (action_start / action_complete / action_pending); el tiempo se
// mide en el navegador. Funciones puras: las piezas solo las dibujan.
import type { OrbiAction } from '@/components/orbi/types'
import { esNavegacion, esTarjetaDeAccion } from '@/components/orbi/sesionOrbi'

/** Las tarjetas vencen a los 10 minutos (TTL_MS de PendingActionService). */
export const VENCE_EN_MS = 10 * 60 * 1000

const FRASES: Record<string, { enCurso: string; hecho: string; error: string }> = {
  listOrders: { enCurso: 'Buscando pedidos', hecho: 'Buscó pedidos', error: 'No pudo leer los pedidos' },
  getOrderDetail: { enCurso: 'Abriendo el pedido', hecho: 'Abrió el pedido', error: 'No pudo abrir el pedido' },
  listProducts: { enCurso: 'Revisando el catálogo', hecho: 'Revisó el catálogo', error: 'No pudo leer el catálogo' },
  listCustomers: { enCurso: 'Buscando clientes', hecho: 'Buscó clientes', error: 'No pudo leer los clientes' },
  getCustomerDetail: { enCurso: 'Abriendo la ficha del cliente', hecho: 'Abrió la ficha del cliente', error: 'No pudo abrir la ficha' },
  listDiscounts: { enCurso: 'Revisando descuentos', hecho: 'Revisó los descuentos', error: 'No pudo leer los descuentos' },
  getSalesReport: { enCurso: 'Consultando ventas', hecho: 'Consultó ventas', error: 'No pudo leer las ventas' },
  getProductReport: { enCurso: 'Consultando productos más vendidos', hecho: 'Consultó los más vendidos', error: 'No pudo leer el reporte' },
  getCustomerReport: { enCurso: 'Consultando clientes', hecho: 'Consultó clientes', error: 'No pudo leer el reporte' },
  getResumenDelPeriodo: { enCurso: 'Sacando los números del período', hecho: 'Sacó los números del período', error: 'No pudo sacar los números' },
  leerTemaDelManual: { enCurso: 'Leyendo el manual', hecho: 'Leyó el manual', error: 'No pudo leer el manual' },
  estadoPrimerosPasos: { enCurso: 'Revisando tus primeros pasos', hecho: 'Revisó tus primeros pasos', error: 'No pudo revisar los primeros pasos' },
  accesoDelEquipo: { enCurso: 'Revisando el equipo', hecho: 'Revisó el equipo', error: 'No pudo revisar el equipo' },
  generateDescription: { enCurso: 'Escribiendo la descripción', hecho: 'Escribió la descripción', error: 'No pudo escribir la descripción' },
}

const GENERICA = { enCurso: 'Trabajando', hecho: 'Consultó tus datos', error: 'Algo no salió' }

export type EstadoDeFila = 'en_curso' | 'ok' | 'error'

export interface FilaDeActividad {
  id: string
  estado: EstadoDeFila
  etiqueta: string
  resumen?: string
  /** Ms de la consulta; sin fin todavía, lo que lleva. */
  ms?: number
}

/**
 * El resumen que acompaña la etiqueta, a partir del label del servidor
 * ("Encontré 4 pedidos" → "4 encontrados"). Lo que no se reconoce no se
 * muestra: mejor una fila corta que una frase que se repite.
 */
export function resumenDelResultado(label: string | undefined): string | undefined {
  if (!label) return undefined
  const encontre = /^Encontré (\d+) /.exec(label)
  if (encontre) {
    const n = Number(encontre[1])
    return n === 0 ? 'ninguno' : `${n} ${n === 1 ? 'encontrado' : 'encontrados'}`
  }
  const pedido = /^Pedido (#\d+)$/.exec(label)
  if (pedido) return pedido[1]
  const tema = /^Manual: (.+)$/.exec(label)
  if (tema) return tema[1]
  return undefined
}

/** Las acciones que son consultas (no tarjetas ni el botón de ir a otra pantalla). */
export function esConsulta(a: OrbiAction): boolean {
  return !esTarjetaDeAccion(a) && a.tool !== 'navigateTo' && a.tool !== 'selectWizardOption'
}

/**
 * El stream de hoy manda una consulta fallida como action_complete con el
 * label de error del servidor ("Error listando pedidos", "No pude…").
 */
export function fallo(a: OrbiAction): boolean {
  return a.status === 'error' || (a.status === 'complete' && /^(Error|No pude)\b/.test(a.result ?? ''))
}

export function filaDe(a: OrbiAction, ahora: number): FilaDeActividad {
  const frases = FRASES[a.tool] ?? GENERICA
  const estado: EstadoDeFila = a.status === 'active' ? 'en_curso' : fallo(a) ? 'error' : 'ok'
  const ms = a.inicio !== undefined ? Math.max(0, (a.fin ?? (estado === 'en_curso' ? ahora : a.inicio)) - a.inicio) : undefined
  return {
    id: a.id,
    estado,
    etiqueta: estado === 'en_curso' ? frases.enCurso : estado === 'error' ? frases.error : frases.hecho,
    resumen: estado === 'ok' ? resumenDelResultado(a.result) : undefined,
    ms,
  }
}

/** "0,8 s", "12 s", "1 min 5 s". */
export function duracion(ms: number): string {
  if (ms < 10_000) return `${(Math.round(ms / 100) / 10).toFixed(1).replace('.', ',')} s`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`
}

/** "Revisó 3 cosas · 6 s", con "· 1 falló" si hubo errores. Null si no hubo consultas. */
export function resumenPlegado(acciones: OrbiAction[]): { texto: string; tiempo?: string } | null {
  const consultas = acciones.filter(esConsulta)
  if (!consultas.length) return null
  const fallas = consultas.filter(fallo).length
  const n = consultas.length
  const texto = `Revisó ${n} ${n === 1 ? 'cosa' : 'cosas'}${fallas ? ` · ${fallas} ${fallas === 1 ? 'falló' : 'fallaron'}` : ''}`
  const inicios = consultas.map(a => a.inicio).filter((x): x is number => x !== undefined)
  const fines = consultas.map(a => a.fin).filter((x): x is number => x !== undefined)
  const tiempo = inicios.length && fines.length ? duracion(Math.max(...fines) - Math.min(...inicios)) : undefined
  return { texto, tiempo }
}

export const NOMBRE_DE_SECCION: Record<string, string> = {
  dashboard: 'Inicio', pedidos: 'Pedidos', catalogo: 'Productos', categorias: 'Categorías', clientes: 'Clientes',
  reportes: 'Reportes', configuracion: 'Configuración', descuentos: 'Descuentos', cupones: 'Cupones',
  mensajes: 'Mensajes', perfil: 'Mi perfil', avanzado: 'Avanzado', manual: 'Manual',
}

/** Los botones "Ir a …" del mensaje, sin repetir destino. */
export function destinosDe(acciones: OrbiAction[]): { id: string; path: string; label: string }[] {
  const vistos = new Set<string>()
  return acciones.filter(esNavegacion).flatMap(a => {
    const path = String(a.data!.path)
    if (vistos.has(path)) return []
    vistos.add(path)
    let label: string
    if (a.tool === 'navigateTo') {
      const seccion = String(a.data!.seccion ?? '')
      label = `Ir a ${NOMBRE_DE_SECCION[seccion] ?? seccion}`
    } else {
      label = a.result && /^(Ir|Abrir) /.test(a.result) ? a.result : 'Ir a la pantalla'
    }
    return [{ id: a.id, path, label }]
  })
}

// ─── Tarjeta de aprobación ───────────────────────────────────────────────────

export type TonoDeTarjeta = 'espera' | 'ok' | 'neutro' | 'error' | 'duda'

export interface VistaDeTarjeta {
  chip: string
  tono: TonoDeTarjeta
  /** "vence 14:42" o la hora en que se resolvió. */
  hora?: string
  pie?: string
  confirmable: boolean
  reintentable: boolean
  atenuada: boolean
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })

export function venceEn(a: OrbiAction): number | undefined {
  return a.inicio !== undefined ? a.inicio + VENCE_EN_MS : undefined
}

export function vistaDeTarjeta(a: OrbiAction, ahora: number): VistaDeTarjeta {
  const vence = venceEn(a)
  const base = { confirmable: false, reintentable: false, atenuada: false }
  switch (a.status) {
    case 'pending':
      if (vence !== undefined && ahora >= vence) {
        return { ...base, chip: 'Venció', tono: 'neutro', hora: hora(vence), pie: 'Pasaron 10 minutos sin respuesta. Pedile a Orbi que lo proponga de nuevo.', atenuada: true }
      }
      return { ...base, chip: 'Esperando tu aprobación', tono: 'espera', hora: vence !== undefined ? `vence ${hora(vence)}` : undefined, confirmable: true }
    case 'active':
      return { ...base, chip: 'Aplicando…', tono: 'espera' }
    case 'complete':
      return { ...base, chip: 'Aplicado', tono: 'ok', hora: a.fin !== undefined ? hora(a.fin) : undefined, pie: a.result ?? 'Lo confirmaste vos' }
    case 'rejected':
      return { ...base, chip: 'Cancelado', tono: 'neutro', hora: a.fin !== undefined ? hora(a.fin) : undefined, pie: a.nota ?? 'No se hizo ningún cambio.', atenuada: true }
    case 'error':
      return { ...base, chip: a.titulo ?? 'No se pudo', tono: 'error', pie: a.result }
    case 'unknown':
      return { ...base, chip: 'No sé si se aplicó', tono: 'duda', pie: a.result, reintentable: true }
  }
}

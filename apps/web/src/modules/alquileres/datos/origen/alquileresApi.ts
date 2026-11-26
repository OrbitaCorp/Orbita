// El cliente de la API de Alquileres (apps/api/src/alquileres): lo que no es
// una reserva. Hoy, lo que el alojamiento cobró por Airbnb, importado del
// archivo de ganancias. Las propiedades, las reservas, los bloqueos y el
// calendario de Airbnb siguen siendo del motor compartido (lib/reservasApi).
//
// Las rutas del panel (/alquileres/...) van con la sesión del panel
// (authedFetch), igual que lib/reservasApi. Los errores salen como
// ReservasApiError con el mensaje de la API, que ya viene en castellano y
// listo para mostrar ("Al archivo le falta la columna del monto…").
// Contrato: apps/api/src/alquileres/README.md.
import { authedFetch } from '@/lib/auth/authClient'
import { mensajeDeError } from '@/lib/api'
import { ReservasApiError, query } from '@/lib/reservasApi/cliente'
import type { ISO } from '@/lib/reservas/fechas'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

/** Lo que el archivo trae, antes de guardar nada. */
export interface VistaPreviaApi {
  estadias: number
  /** La primera entrada y la última salida de lo leído. */
  desde: string | null
  hasta: string | null
  totales: { moneda: string; neto: number; estadias: number }[]
  /** Filas que no se pudieron leer, con el número de fila del archivo (el encabezado es la 1). */
  descartadas: { linea: number; motivo: string }[]
  /** Filas que no son de una estadía (transferencias al banco, o ajustes de estadías que no están importadas): no se importan. */
  otrasFilas: number
  /** Ajustes sueltos que se suman a estadías ya importadas (el archivo de otro período). */
  ajustes: number
  /** Cada aviso del archivo, con la propiedad que ya tiene unida si la tiene. */
  avisos: { nombre: string; estadias: number; recursoId: string | null }[]
}

export interface ImportadoApi { creadas: number; actualizadas: number; sinImportar: number }

export interface IngresoExternoApi {
  id: string
  recursoId: string
  canal: 'airbnb'
  codigo: string
  entrada: string
  salida: string
  noches: number
  huesped: string | null
  montoBruto: number
  comision: number
  limpieza: number
  montoNeto: number
  moneda: string
}

/** De todo lo importado del negocio, no solo del rango pedido. */
export interface ResumenDeGanancias { estadias: number; ultimaImportacion: string | null; hasta: string | null }

export interface IngresosApi { filas: IngresoExternoApi[]; resumen: ResumenDeGanancias }

/** A qué propiedad corresponde un aviso del archivo; `null` es "no importarlo". */
export interface UnionDeAviso { nombre: string; recursoId: string | null }

async function delPanel<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${API_BASE}/alquileres${path}`, init)
  const esJson = res.headers.get('content-type')?.includes('application/json')
  const body = esJson ? await res.json().catch(() => null) : null
  if (!res.ok) throw new ReservasApiError(res.status, mensajeDeError(res.status, body))
  return body as T
}

const conCuerpo = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const alquileresPanel = {
  /** Las estadías importadas que tocan el rango (los dos días incluidos), y el resumen de todo. */
  ingresos: (desde: ISO, hasta: ISO) => delPanel<IngresosApi>(`/ingresos${query({ desde, hasta })}`),
  /** Lee el archivo y cuenta qué trae. No guarda nada. 400 con el motivo si no se entiende. */
  vistaPreviaDeAirbnb: (texto: string) => delPanel<VistaPreviaApi>('/ingresos/airbnb/vista-previa', conCuerpo({ texto })),
  /** Guarda. Tienen que venir todos los avisos del archivo, cada uno con su propiedad o con `null`. Todo o nada. */
  importarDeAirbnb: (texto: string, avisos: UnionDeAviso[]) => delPanel<ImportadoApi>('/ingresos/airbnb/importar', conCuerpo({ texto, avisos })),
  /** Borra todo lo importado de Airbnb. Las uniones de avisos se conservan. */
  borrarLoDeAirbnb: () => delPanel<{ ok: true; borradas: number }>('/ingresos/airbnb', { method: 'DELETE' }),
}

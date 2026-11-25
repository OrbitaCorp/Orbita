// Lo propio de Turnos que la config de reservas guarda sin interpretar
// (`ReservaConfig.datos`, campo libre del motor compartido desde el 24/11).
// Decisión del 24/11 (Auditoría de Turnos, "Dónde vive lo que el motor no
// tiene"): las reglas que el motor no aplica y el equipo viven acá, en dos
// partes:
//
//   publico  lo que el sitio necesita para dibujar la reserva y la política
//            (sale en la config pública como `publico`): elegir profesional,
//            qué datos se piden, tolerancia, qué pasa con la seña fuera de
//            plazo y la cuenta de clientes.
//   turnos   solo el panel: la grilla de horarios y el equipo (personas,
//            roles y cómo cobra cada uno) hasta que existan las cuentas del
//            equipo.
//
// El motor reemplaza `datos` entero en cada PUT, y lo escriben pantallas
// distintas (Reglas, Equipo): por eso se escribe siempre leyendo lo último
// guardado y cambiando solo la parte propia (conCambios).
//
// Lo que se lee se valida campo por campo: es JSON libre, puede venir de una
// versión vieja del panel o estar incompleto. Lo que no tiene la forma
// esperada se ignora y vale lo de fábrica.
import type { BeneficiosCuenta, PoliticaReserva } from '@/modules/turnos/datos/negocio'
import type { Persona, Rol } from '@/modules/turnos/datos/equipo'

export interface CamposPaciente { obraSocial: boolean; dni: boolean; motivo: boolean }

export interface PublicoTurnos {
  elegirRecurso?: boolean
  cualquiera?: boolean
  campos?: CamposPaciente
  tolerancia?: number
  senaFueraDePlazo?: PoliticaReserva['senaFueraDePlazo']
  cuentas?: BeneficiosCuenta
}

export interface PrivadoTurnos {
  /** Cada cuántos minutos arranca un turno; se aplica como `pasoMinutos` de cada agenda. */
  grilla?: number
  equipo?: { personas: Persona[]; roles: Rol[] }
}

export interface DatosTurnos { publico: PublicoTurnos; turnos: PrivadoTurnos }

/** Las reglas de la pantalla que viven en `datos`. Las que no vengan valen lo de fábrica de la pantalla. */
export interface ExtrasReglas {
  grilla: number
  elegirRecurso: boolean
  cualquiera: boolean
  campos: CamposPaciente
  tolerancia: number
  senaFueraDePlazo: PoliticaReserva['senaFueraDePlazo']
  cuentas: BeneficiosCuenta
}

/** Lo guardado, en la forma de la pantalla. */
export function extrasDeDatos(datos: unknown): Partial<ExtrasReglas> {
  const { publico, turnos } = leerDatos(datos)
  return sinVacios({ ...publico, grilla: turnos.grilla })
}

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null)
const bool = (x: unknown) => (typeof x === 'boolean' ? x : undefined)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const sinVacios = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/** `datos` de la config como lo usa Turnos. Nunca falla: lo que no sirve queda afuera. */
export function leerDatos(datos: unknown): DatosTurnos {
  const d = obj(datos) ?? {}
  const p = obj(d.publico) ?? {}
  const t = obj(d.turnos) ?? {}
  const campos = obj(p.campos)
  const cuentas = obj(p.cuentas)
  const equipo = obj(t.equipo)
  const fuera = p.senaFueraDePlazo === 'se-pierde' || p.senaFueraDePlazo === 'queda-a-favor' ? p.senaFueraDePlazo : undefined
  return {
    publico: sinVacios({
      elegirRecurso: bool(p.elegirRecurso),
      cualquiera: bool(p.cualquiera),
      campos: campos ? { obraSocial: campos.obraSocial === true, dni: campos.dni === true, motivo: campos.motivo === true } : undefined,
      tolerancia: num(p.tolerancia),
      senaFueraDePlazo: fuera,
      cuentas: cuentas && typeof cuentas.activo === 'boolean'
        ? { activo: cuentas.activo, bienvenida: num(cuentas.bienvenida) ?? 0, sellos: num(cuentas.sellos) ?? 0, promos: cuentas.promos === true }
        : undefined,
    }),
    turnos: sinVacios({
      grilla: num(t.grilla),
      equipo: equipo && Array.isArray(equipo.personas) && Array.isArray(equipo.roles)
        ? { personas: equipo.personas as Persona[], roles: equipo.roles as Rol[] }
        : undefined,
    }),
  }
}

/**
 * El `datos` que hay que mandar: el guardado, con la parte que cambia. Lo que
 * no es de Turnos (claves que puso otro) se conserva tal cual.
 */
export function conCambios(guardado: unknown, cambio: { publico?: Partial<PublicoTurnos>; turnos?: Partial<PrivadoTurnos> }): Record<string, unknown> {
  const d = obj(guardado) ?? {}
  return {
    ...d,
    publico: { ...(obj(d.publico) ?? {}), ...(cambio.publico ?? {}) },
    turnos: { ...(obj(d.turnos) ?? {}), ...(cambio.turnos ?? {}) },
  }
}

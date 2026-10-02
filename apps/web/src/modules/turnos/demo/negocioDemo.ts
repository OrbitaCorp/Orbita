// DEMO INTERNA — lo que el alta y la configuración le dejan al resto de la demo.
//
// Sin backend, cada pantalla de /turnos-demo arma sus datos sola. Esto es el
// hilo que las une: lo que el dueño contesta en el alta (nombre, logo, dónde
// atiende, horarios, qué página quiere) y lo que después cambia en Configuración
// (forma y diseño del sitio, plantilla, horarios, reglas de reserva, beneficios
// de la cuenta) queda guardado en el navegador, y el sitio, la reserva y el
// panel lo leen de acá.
//
// Vive en localStorage (y no en sessionStorage) para que también lo vean la
// vista previa en iframe y los links que se abren en otra pestaña. La tira de
// la demo muestra cuándo hay un alta cargada y deja borrarla.
import { useSyncExternalStore } from 'react'
import type { RubroTurnos, ServicioTipo } from '@/modules/turnos/datos'
import type { Semana } from '@/modules/turnos/horario'

/** Las dos formas de página pública que puede elegir un negocio de turnos. */
export type FormaSitio = 'web' | 'simple'

/** Los diseños de la página simple. Mismo contenido, otra composición. */
export type DisenoSimple = 'tarjeta' | 'portada' | 'partida' | 'editorial' | 'enlaces'
export const DISENOS_SIMPLE: DisenoSimple[] = ['tarjeta', 'portada', 'partida', 'editorial', 'enlaces']

/** Dónde se presta el servicio: en el local del negocio, en la casa del cliente o las dos. */
export type Modalidad = 'local' | 'domicilio'

/**
 * La cuenta del cliente es SIEMPRE opcional: reservar pide nombre y celular,
 * nada más. Lo que define el dueño es si ofrece cuenta y qué gana quien la crea.
 */
export interface BeneficiosCuenta {
  /** El negocio ofrece crear una cuenta. */
  activo: boolean
  /** % de descuento en el primer turno con cuenta. 0 = sin descuento. */
  bienvenida: number
  /** Turnos para completar la tarjeta de sellos. 0 = sin tarjeta. */
  sellos: number
  /** Avisos de promos exclusivas por WhatsApp. */
  promos: boolean
}

/** Lo que el dueño cargó en el alta. Solo se aplica al rubro con el que la hizo. */
export interface IdentidadDemo {
  rubro: string
  nombre: string
  /** Descripción corta. '' = se usa la del rubro. */
  descripcion: string
  telefono: string
  slug: string
  /** Data URL chica (el alta la achica a 256 px) o null. */
  logo: string | null
  modalidades: Modalidad[]
  /** '' si no atiende en un local. */
  direccion: string
  ciudad: string
  /** Zonas de atención a domicilio, en texto libre. */
  zonas: string
  /** [día, horario] con índice 0 = lunes y '' = cerrado: el mismo formato que TemaNegocio.horarios. */
  horarios: Semana
  /** Los servicios tal como quedaron en el alta (nunca vacío). */
  servicios: ServicioTipo[]
  /** Seña al reservar, en % del precio. 0 = sin seña. */
  sena: number
}

/** La plantilla elegida en Apariencia y sus ajustes. Solo vale para el rubro con el que se guardó. */
export interface AparienciaDemo {
  rubro: string
  plantilla: string
  /** Color de acento (#RRGGBB). */
  color: string
  /** id del par tipográfico. */
  tipo: string
  /** Radio de los bordes, en px. */
  radio: number
  /** Foto de portada; '' = la de la plantilla. */
  foto: string
}

/**
 * Lo que el sitio le cuenta al cliente de las reglas de reserva: sale de
 * Configuración → Reglas de reserva. El resto de las reglas vive en esa pantalla.
 */
export interface PoliticaReserva {
  /** Horas antes del turno hasta las que se puede cancelar o cambiar sin cargo. 0 = hasta último momento. */
  cancelaHasta: number
  /** Qué pasa con la seña si se cancela fuera de plazo o no se viene. */
  senaFueraDePlazo: 'se-pierde' | 'queda-a-favor'
  /** Minutos de tolerancia: pasado ese tiempo el turno se da por perdido. */
  tolerancia: number
}

export interface NegocioDemo {
  identidad: IdentidadDemo | null
  forma: FormaSitio
  /** Diseño de la página simple. */
  simple: DisenoSimple
  cuentas: BeneficiosCuenta
  /** El horario guardado en Configuración → Horarios, y para qué rubro. */
  horarios: { rubro: string; dias: Semana } | null
  apariencia: AparienciaDemo | null
  politica: PoliticaReserva
  /** Las funciones de Avanzado que el dueño prendió o apagó (id → on). Lo que no está acá vale lo de fábrica. */
  avanzado: Record<string, boolean>
}

export const BENEFICIOS_INICIALES: BeneficiosCuenta = { activo: true, bienvenida: 10, sellos: 6, promos: true }
export const POLITICA_INICIAL: PoliticaReserva = { cancelaHasta: 24, senaFueraDePlazo: 'se-pierde', tolerancia: 10 }

const INICIAL: NegocioDemo = {
  identidad: null, forma: 'web', simple: 'tarjeta', cuentas: BENEFICIOS_INICIALES, horarios: null, apariencia: null, politica: POLITICA_INICIAL, avanzado: {},
}
const CLAVE = 'orbita_turnos_demo_negocio'

let cache: NegocioDemo = INICIAL
let leido = false
const oyentes = new Set<() => void>()

const esModalidad = (m: unknown): m is Modalidad => m === 'local' || m === 'domicilio'

/** Lo guardado puede ser de una versión anterior de la demo: se queda solo con lo que hoy existe. */
function sanear(g: Partial<NegocioDemo>): NegocioDemo {
  const identidad = g.identidad
    ? { ...g.identidad, modalidades: (g.identidad.modalidades ?? []).filter(esModalidad) }
    : null
  // Un negocio que solo atendía "online" (opción que ya no existe) pasa a atender en su local.
  if (identidad && identidad.modalidades.length === 0) identidad.modalidades = ['local']
  return {
    ...INICIAL, ...g, identidad,
    simple: DISENOS_SIMPLE.includes(g.simple as DisenoSimple) ? g.simple as DisenoSimple : INICIAL.simple,
    cuentas: { ...BENEFICIOS_INICIALES, ...g.cuentas },
    politica: { ...POLITICA_INICIAL, ...g.politica },
    horarios: g.horarios?.dias?.length === 7 ? g.horarios : null,
    apariencia: g.apariencia?.plantilla ? g.apariencia : null,
    avanzado: g.avanzado && typeof g.avanzado === 'object' ? g.avanzado : {},
  }
}

function leer(): NegocioDemo {
  if (leido) return cache
  leido = true
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    if (crudo) cache = sanear(JSON.parse(crudo) as Partial<NegocioDemo>)
  } catch { /* sin acceso al almacenamiento o JSON roto: quedan los valores de fábrica */ }
  return cache
}

function escribir(n: NegocioDemo) {
  cache = n
  leido = true
  try { window.localStorage.setItem(CLAVE, JSON.stringify(n)) } catch { /* cuota llena: queda solo en memoria */ }
  oyentes.forEach(f => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  // Otra pestaña (o el iframe de la vista previa) cambió algo: se vuelve a leer.
  const alCambiar = (e: StorageEvent) => { if (e.key === CLAVE) { leido = false; f() } }
  window.addEventListener('storage', alCambiar)
  return () => { oyentes.delete(f); window.removeEventListener('storage', alCambiar) }
}

/** El negocio de la demo. En el servidor (y en el primer pintado) son los valores de fábrica. */
export function useNegocioDemo() {
  const demo = useSyncExternalStore(suscribir, leer, () => INICIAL)
  return {
    demo,
    guardar: (cambio: Partial<NegocioDemo>) => escribir({ ...leer(), ...cambio }),
    reiniciar: () => escribir(INICIAL),
  }
}

// ─── Modalidades por rubro ───────────────────────────────────────────────────
// Lo que se asume cuando el dueño todavía no pasó por el alta: casi todos
// atienden en su local; algunos rubros además van a la casa del cliente.
const A_DOMICILIO = new Set(['estilista', 'maquillaje', 'kinesio', 'podologia', 'clases'])

export function modalidadesRubro(r: RubroTurnos): Modalidad[] {
  return ['local', ...(A_DOMICILIO.has(r.key) ? ['domicilio' as const] : [])]
}

/** Las modalidades del negocio: las del alta si es de este rubro; si no, las típicas del rubro. */
export function modalidadesDe(r: RubroTurnos, demo: NegocioDemo): Modalidad[] {
  const propias = demo.identidad?.rubro === r.key ? demo.identidad.modalidades : null
  return propias?.length ? propias : modalidadesRubro(r)
}

/** Una cancha o una clase con cupo no se llevan a domicilio. */
export function modalidadesPosibles(r: RubroTurnos): Modalidad[] {
  return r.modo === 'cancha' || r.modo === 'cupo' ? ['local'] : ['local', 'domicilio']
}

export const MODALIDAD_TXT: Record<Modalidad, string> = { local: 'En el local', domicilio: 'A domicilio' }

// ─── Reglas de reserva, en palabras ──────────────────────────────────────────

/** "hasta 24 h antes", "hasta 2 días antes", "hasta último momento". */
export function plazoTxt(horas: number): string {
  if (horas <= 0) return 'hasta último momento'
  if (horas < 24) return `hasta ${horas} h antes`
  const dias = horas / 24
  return Number.isInteger(dias) && dias > 1 ? `hasta ${dias} días antes` : `hasta ${horas} h antes`
}

/** La regla de cancelación tal como la lee el cliente al reservar. */
export const cancelacionTxt = (p: PoliticaReserva) => `Cancelación sin cargo ${plazoTxt(p.cancelaHasta)}`

/**
 * La política completa, como va en los Términos del sitio: cambios y
 * cancelaciones, y llegadas tarde. La misma que el dueño ve armarse en
 * Configuración → Reglas de reserva.
 */
export function politicaTxt(p: PoliticaReserva): { cambios: string; tarde: string } {
  const fuera = p.senaFueraDePlazo === 'se-pierde' ? 'no se devuelve' : 'te queda a favor para otro turno'
  return {
    cambios: `Podés cancelar o reprogramar sin cargo ${plazoTxt(p.cancelaHasta)}, desde Mis turnos o desde el link del recordatorio. Si pagaste una seña y cancelás a tiempo, se devuelve al mismo medio de pago.${p.cancelaHasta > 0 ? ` Pasado ese plazo, o si no venís, la seña ${fuera}.` : ` Si no venís, la seña ${fuera}.`}`,
    tarde: p.tolerancia > 0
      ? `Guardamos tu lugar ${p.tolerancia} minutos. Después de ese tiempo el turno puede darse a otra persona o acortarse para no demorar al siguiente.`
      : 'Los turnos empiezan a la hora reservada: si llegás tarde, puede acortarse para no demorar al siguiente.',
  }
}

// ─── Beneficios, en palabras ─────────────────────────────────────────────────

export interface BeneficioTxt { id: 'bienvenida' | 'sellos' | 'promos'; titulo: string; texto: string }

/** Lo que gana quien crea su cuenta, tal como lo configuró el dueño. Vacío = no hay cuenta para ofrecer. */
export function beneficiosTxt(c: BeneficiosCuenta, r: RubroTurnos): BeneficioTxt[] {
  if (!c.activo) return []
  const turno = r.modo === 'cupo' ? 'clase' : r.modo === 'cancha' ? 'reserva' : 'turno'
  const out: BeneficioTxt[] = []
  if (c.bienvenida > 0) out.push({ id: 'bienvenida', titulo: `${c.bienvenida}% de bienvenida`, texto: `En tu ${r.modo === 'cupo' || r.modo === 'cancha' ? 'primera' : 'primer'} ${turno} con cuenta.` })
  if (c.sellos > 0) out.push({ id: 'sellos', titulo: 'Tarjeta de sellos', texto: `Cada ${turno} suma un sello: al completar ${c.sellos}, tenés un premio.` })
  if (c.promos) out.push({ id: 'promos', titulo: 'Promos antes que nadie', texto: 'Te avisamos por WhatsApp cuando hay una promo o se libera un horario.' })
  return out
}

// DEMO INTERNA — pasos, datos y validaciones del alta única de Órbita: un solo
// recorrido que arranca eligiendo el módulo (Tienda, Turnos, Alquileres o
// Gimnasio) y después pide lo que ese módulo necesita. Todo vive en el
// navegador: no hay API ni se crea ningún negocio. Las reglas de validación
// copian las del alta real de Tienda (modules/onboarding/SetupUnificado) para
// que el recorrido se sienta igual.
//
// Los pasos propios de Alquileres y de Gimnasio (qué alquilás, rubro,
// actividades, precios) los escribe cada módulo en su onboarding/pasos.tsx: acá
// solo se ordenan, y se validan con sus funciones, que llegan bajo demanda
// (ContextoAlta.validarReservas). Este archivo no importa nada de esos dos
// módulos: lo usan el alta real y /onboarding/plan, que no los bajan nunca.
// El alta puede importar de los módulos; ningún módulo importa del alta.
import { DIAS, type RubroTurnos } from '@/modules/turnos/datos'
import {
  BENEFICIOS_INICIALES, modalidadesPosibles, modalidadesRubro,
  type BeneficiosCuenta, type FormaSitio, type IdentidadDemo, type Modalidad,
} from '@/modules/turnos/datos/negocio'
import { JORNADA_INICIAL, errorJornada, jornadaTxt, type Jornada } from '@/modules/turnos/horario'
import { TEXTOS } from './textos'

// ─── Pasos ───────────────────────────────────────────────────────────────────

export type Modulo = 'tienda' | 'turnos' | 'alquileres' | 'gimnasio'
export const MODULOS_ORDEN: readonly Modulo[] = ['tienda', 'turnos', 'alquileres', 'gimnasio']
/** Para leer el ?modulo= de la URL sin confiar en lo que venga. */
export const esModulo = (x: unknown): x is Modulo => typeof x === 'string' && (MODULOS_ORDEN as readonly string[]).includes(x)

export type PasoId =
  | 'modulo' | 'tipo' | 'rubro' | 'servicios'
  | 'tipo-alquiler' | 'que-alquilas' | 'rubro-gym' | 'actividades' | 'planes'
  | 'negocio' | 'ubicacion' | 'pagina' | 'cuenta' | 'pago'
export interface Paso { id: PasoId; label: string }

// "Precios" y no "Planes" en el arco: el último paso ya habla del plan de Órbita.
const ROTULO: Record<PasoId, string> = {
  modulo: 'Módulo', tipo: 'Qué vendés', rubro: 'Rubro', servicios: 'Servicios',
  'tipo-alquiler': 'Qué alquilás', 'que-alquilas': 'Tus espacios', 'rubro-gym': 'Rubro', actividades: 'Actividades', planes: 'Precios',
  negocio: 'Tu negocio', ubicacion: 'Ubicación', pagina: 'Tu página', cuenta: 'Tu cuenta', pago: 'Pago',
}
const lista = (ids: PasoId[]): readonly Paso[] => ids.map(id => ({ id, label: ROTULO[id] }))

// Antes de elegir módulo se ve la columna que comparten todos los caminos; al
// elegir, el arco suma las estaciones propias de ese módulo.
const PASOS: Record<Modulo | 'ninguno', readonly Paso[]> = {
  ninguno: lista(['modulo', 'negocio', 'ubicacion', 'cuenta', 'pago']),
  tienda: lista(['modulo', 'tipo', 'negocio', 'ubicacion', 'cuenta', 'pago']),
  turnos: lista(['modulo', 'rubro', 'servicios', 'negocio', 'ubicacion', 'pagina', 'cuenta', 'pago']),
  alquileres: lista(['modulo', 'tipo-alquiler', 'que-alquilas', 'negocio', 'ubicacion', 'pagina', 'cuenta', 'pago']),
  gimnasio: lista(['modulo', 'rubro-gym', 'actividades', 'planes', 'negocio', 'ubicacion', 'pagina', 'cuenta', 'pago']),
}

/** Los pasos del módulo. `rotulos` cambia el nombre de alguna estación (ej. "Tu salón" en vez de "Tus espacios"). */
export function pasosDe(m: Modulo | null, rotulos?: Partial<Record<PasoId, string>>): readonly Paso[] {
  const pasos = PASOS[m ?? 'ninguno']
  return rotulos ? pasos.map(p => ({ ...p, label: rotulos[p.id] ?? p.label })) : pasos
}

// Los pasos propios de Alquileres y de Gimnasio: sus pantallas y sus reglas son de cada módulo.
const PASOS_RESERVAS: readonly PasoId[] = ['tipo-alquiler', 'que-alquilas', 'rubro-gym', 'actividades', 'planes']
export const esPasoReservas = (id: PasoId) => PASOS_RESERVAS.includes(id)

// Módulos que el alta REAL muestra pero todavía no deja elegir: la tarjeta sale
// como "Próximamente" y Tienda sigue su flujo de siempre. En las demos
// (localhost) se recorren los cuatro. Para habilitar uno en producción alcanza
// con sacarlo de acá: su recorrido ya está armado.
export const MODULOS_PROXIMAMENTE: readonly Modulo[] = ['turnos', 'alquileres', 'gimnasio']
export const moduloHabilitado = (m: Modulo | null, real: boolean): m is Modulo => m !== null && (!real || !MODULOS_PROXIMAMENTE.includes(m))

// ─── Datos ───────────────────────────────────────────────────────────────────

export interface ServicioAlta { id: string; nombre: string; duracion: number; precio: number }

export interface DatosAlta {
  modulo: Modulo | null
  /** Tienda: subrubros elegidos (keys de subrubrosTienda.ts). */
  tipos: string[]
  /** Tienda: con carrito y cobro, o solo catálogo con consulta. */
  modoVenta: 'ecommerce' | 'vidriera'
  /** Data URL de 256 px (se achica al subirlo) o null. */
  logo: string | null
  negocio: string
  descripcion: string
  telefono: string
  slug: string
  /** null = todavía no las tocó: valen las típicas del rubro (en Tienda, el local). */
  modalidades: Modalidad[] | null
  direccion: string
  ciudad: string
  latLng: [number, number]
  /** Turnos a domicilio: barrios o localidades, en texto libre. */
  zonas: string
  /** 0 = lunes … 6 = domingo. */
  dias: number[]
  /** Turnos: horario de atención, partido en mañana y tarde. */
  jornada: Jornada
  /** Turnos: sitio web completo o página simple. */
  forma: FormaSitio
  /** Turnos: la cuenta opcional del cliente y lo que gana con ella. */
  cuentas: BeneficiosCuenta
  /** Alquileres y Gimnasio: la foto de portada elegida en "Tu página" (null = la primera que se ofrece). */
  portada: string | null
  nombre: string
  email: string
  clave: string
  clave2: string
  acepta: boolean
  plan: 'base' | 'avanzado'
  /** Código de descuento ya validado, o ''. */
  codigo: string
}

// Obelisco: donde arranca el mapa hasta que se busca una dirección.
// Donde arranca el mapa: Puerto Iguazú, la ciudad donde hoy funciona Órbita.
const PUERTO_IGUAZU: [number, number] = [-25.5972, -54.5786]

export const DATOS_INICIALES: DatosAlta = {
  modulo: null, tipos: [], modoVenta: 'ecommerce',
  logo: null, negocio: '', descripcion: '', telefono: '', slug: '',
  modalidades: null, direccion: '', ciudad: '', latLng: PUERTO_IGUAZU, zonas: '',
  dias: [0, 1, 2, 3, 4, 5], jornada: JORNADA_INICIAL,
  forma: 'web', cuentas: BENEFICIOS_INICIALES, portada: null,
  nombre: '', email: '', clave: '', clave2: '', acepta: false,
  plan: 'base', codigo: '',
}

export const DESCRIPCION_MODO: Record<RubroTurnos['modo'], string> = {
  profesional: 'Cada cliente elige con quién se atiende. Cada profesional tiene sus días y horarios.',
  recurso:     'Los turnos ocupan una sala o cabina. Sirve cuando varios atienden en el mismo espacio.',
}

export const DURACIONES = [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240]

/** Sin acentos ni mayúsculas: para buscar y para armar el link. */
export const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// 30 caracteres de tope: el link entero tiene que entrar en el QR de la
// pantalla final (QR.tsx llega a 78 bytes).
export const aSlug = (s: string) => plano(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)

// Mientras se escribe se deja el guion del final: si se lo sacara en cada tecla
// (como hace aSlug) no habría forma de tipear "mi-negocio", porque el guion o
// el espacio desaparecerían antes de llegar a la letra siguiente.
export const aSlugEscribiendo = (s: string) => plano(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 30)

export const slugDe = (d: DatosAlta) => aSlug(d.slug || d.negocio) || 'mi-negocio'

export const serviciosIniciales = (r: RubroTurnos): ServicioAlta[] =>
  r.servicios.map((s, i) => ({ id: `${r.key}-${i}`, nombre: s.nombre, duracion: s.duracion, precio: s.precio }))

export const iniciales = (nombre: string) => nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

// ─── Dónde atiende ───────────────────────────────────────────────────────────

/** Lo que pide el paso "Ubicación" según el módulo (los textos van en textos.ts). */
interface ReglasUbicacion {
  /** Dónde puede atender. Con una sola opción el paso no pregunta: va directo a la dirección. */
  modalidades: Modalidad[]
  /** La ciudad es obligatoria: sale en la página y en cada reserva. */
  ciudad: boolean
  /** Días y horarios de atención: de acá sale la agenda de Turnos. Los demás los ajustan en su panel. */
  horario: boolean
}

/**
 * En Turnos se atiende en el local, a domicilio o las dos. En Tienda son las
 * mismas dos casillas con otro texto ("Local físico" y "Online / A domicilio",
 * como en el alta real). Una cancha, un salón, una cabaña o un gimnasio se usan
 * siempre en el lugar.
 */
export const UBICACION: Record<Modulo, ReglasUbicacion> = {
  tienda: { modalidades: ['local', 'domicilio'], ciudad: false, horario: false },
  turnos: { modalidades: modalidadesPosibles(), ciudad: true, horario: true },
  alquileres: { modalidades: ['local'], ciudad: true, horario: false },
  gimnasio: { modalidades: ['local'], ciudad: true, horario: false },
}

/** Qué opciones se ofrecen en "¿Dónde atendés?". */
export const modalidadesOfrecidas = (d: DatosAlta): Modalidad[] => UBICACION[d.modulo ?? 'tienda'].modalidades

/** Las marcadas (o, si todavía no tocó nada, las típicas del rubro), siempre dentro de las ofrecidas. */
export function modalidadesAlta(d: DatosAlta, rubro: RubroTurnos | null): Modalidad[] {
  const ofrecidas = modalidadesOfrecidas(d)
  // Con una sola opción no hay nada que marcar (y lo que quedó de otro módulo no cuenta).
  if (ofrecidas.length === 1) return ofrecidas
  const base = d.modalidades ?? (d.modulo === 'turnos' && rubro ? modalidadesRubro(rubro) : ['local'])
  return ofrecidas.filter(m => base.includes(m))
}

/** "09:00 – 13:00 · 16:00 – 20:00": la mañana y la tarde que quedaron prendidas. */
export const horarioTxt = (d: DatosAlta) => jornadaTxt(d.jornada)

/** "Lun a sáb" si son corridos, "Lun, mié y vie" si no. */
export { diasTxt } from '@/modules/turnos/horario'

/** Lo que el alta de Turnos le deja al resto de la demo (sitio, reserva y panel). */
export function identidadDe(d: DatosAlta, rubro: RubroTurnos, servicios: ServicioAlta[], sena: number): IdentidadDemo {
  const modalidades = modalidadesAlta(d, rubro)
  const validos = servicios.filter(s => s.nombre.trim()).map(s => ({ nombre: s.nombre.trim(), duracion: s.duracion, precio: s.precio }))
  return {
    rubro: rubro.key, nombre: d.negocio.trim(), descripcion: d.descripcion.trim(), telefono: d.telefono.trim(), slug: slugDe(d), logo: d.logo,
    modalidades,
    direccion: modalidades.includes('local') ? d.direccion.trim() : '',
    ciudad: modalidades.includes('local') ? d.ciudad.trim() : '',
    // A domicilio se atiende dentro de la ciudad del negocio: no se piden zonas aparte.
    zonas: modalidades.includes('domicilio') ? d.ciudad.trim() : '',
    horarios: DIAS.map((dia, i) => [dia, d.dias.includes(i) ? horarioTxt(d) : '']),
    servicios: validos.length ? validos : rubro.servicios,
    sena,
  }
}

// ─── Chequeos simulados ──────────────────────────────────────────────────────
// El alta real le pregunta a la API si el subdominio y el email están libres.
// Acá no hay API: se espera un momento y se contesta contra dos listitas, para
// que se vean los tres estados (verificando, disponible, en uso).

export type Chequeo = 'vacio' | 'verificando' | 'libre' | 'ocupado'

const SUBDOMINIOS_EN_USO = new Set(['demo', 'tienda', 'turnos', 'orbita', 'admin', 'panel', 'app', 'www', 'api', 'negocio', 'mi-negocio', 'prueba', 'test', 'tefaltacalle'])
const EMAILS_EN_USO = new Set(['demo@orbita.site', 'hola@orbita.site', 'prueba@orbita.site'])

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** `verificado` es el último valor por el que ya "contestó el servidor". */
export const chequeoSubdominio = (slug: string, verificado: string): Chequeo =>
  aSlug(slug).length < 3 ? 'vacio' : verificado !== slug ? 'verificando' : SUBDOMINIOS_EN_USO.has(aSlug(slug)) ? 'ocupado' : 'libre'

export const chequeoEmail = (email: string, verificado: string): Chequeo => {
  const e = email.trim().toLowerCase()
  return !EMAIL_OK.test(e) ? 'vacio' : verificado !== e ? 'verificando' : EMAILS_EN_USO.has(e) ? 'ocupado' : 'libre'
}

// ─── Código de descuento (simulado) ──────────────────────────────────────────

/** El único código que "existe" en la demo. Devuelve el % de descuento, o 0 si no vale. */
export const CODIGO_DEMO = 'ORBITA20'
export const descuentoDe = (codigo: string) => (codigo.trim().toUpperCase() === CODIGO_DEMO ? 20 : 0)

// ─── Validación ──────────────────────────────────────────────────────────────

export type Errores = Record<string, string>
export interface ContextoAlta {
  rubro: RubroTurnos | null
  servicios: ServicioAlta[]
  sub: Chequeo
  mail: Chequeo
  /**
   * Las reglas de los pasos propios de Alquileres y de Gimnasio, con lo cargado
   * en ellos. Son de cada módulo y llegan con su código (cargaReservas.ts):
   * null = todavía no llegó, y el paso no deja seguir.
   */
  validarReservas: ((id: PasoId) => Errores) | null
}

/** Errores del paso, por campo. Vacío = se puede seguir. */
export function validar(id: PasoId, d: DatosAlta, c: ContextoAlta): Errores {
  // Los pasos propios de Alquileres y de Gimnasio los valida cada módulo.
  if (esPasoReservas(id)) return c.validarReservas?.(id) ?? { cargando: 'Un segundo: estamos cargando este paso.' }
  const e: Errores = {}
  if (id === 'modulo' && !d.modulo) e.modulo = 'Elegí un módulo para seguir.'
  if (id === 'tipo' && d.tipos.length === 0) e.tipos = 'Elegí al menos un rubro para seguir.'
  if (id === 'rubro' && !c.rubro) e.rubro = 'Elegí un rubro para seguir.'
  if (id === 'servicios') {
    if (c.servicios.length === 0) e.servicios = 'Cargá al menos un servicio para abrir tu agenda.'
    c.servicios.forEach(s => { if (!s.nombre.trim()) e[`servicio-${s.id}`] = 'Ponele un nombre.' })
  }
  if (id === 'negocio') {
    if (d.negocio.trim().length < 2) e.negocio = 'Escribí el nombre de tu negocio.'
    if (d.telefono.replace(/\D/g, '').length < 8) e.telefono = 'Escribí un teléfono con código de área.'
    if (aSlug(d.slug).length < 3) e.slug = 'Elegí un subdominio de 3 letras o números como mínimo.'
    else if (c.sub === 'ocupado') e.slug = 'Ese subdominio ya está en uso. Probá con otro.'
    else if (c.sub === 'verificando') e.slug = 'Estamos viendo si está libre. Probá de nuevo en un segundo.'
  }
  if (id === 'ubicacion') {
    const modulo = d.modulo ?? 'tienda'
    const reglas = UBICACION[modulo]
    const textos = TEXTOS[modulo].ubicacion
    const m = modalidadesAlta(d, c.rubro)
    if (m.length === 0) e.modalidades = 'Marcá al menos una opción.'
    if (m.includes('local') && d.direccion.trim().length < 4) e.direccion = textos.errorDireccion
    if (reglas.ciudad && d.ciudad.trim().length < 3) e.ciudad = textos.errorCiudad
    if (reglas.horario) {
      if (d.dias.length === 0) e.dias = 'Marcá al menos un día de atención.'
      const horario = errorJornada(d.jornada)
      if (horario) e.horario = horario
    }
  }
  if (id === 'cuenta') {
    if (d.nombre.trim().length < 3) e.nombre = 'Escribí tu nombre y apellido.'
    if (!EMAIL_OK.test(d.email.trim())) e.email = 'Revisá el email: le falta algo.'
    else if (c.mail === 'ocupado') e.email = 'Ya hay una cuenta con ese email. Usá otro o iniciá sesión.'
    else if (c.mail === 'verificando') e.email = 'Estamos verificando el email. Probá de nuevo en un segundo.'
    if (d.clave.length < 8) e.clave = 'Usá 8 caracteres o más.'
    if (!d.clave2) e.clave2 = 'Repetí la contraseña.'
    else if (d.clave2 !== d.clave) e.clave2 = 'Las contraseñas no coinciden.'
    if (!d.acepta) e.acepta = 'Necesitamos que aceptes los términos para crear la cuenta.'
  }
  return e
}

// DEMO INTERNA — datos de ejemplo del vertical Turnos & Agenda (2026-09-26).
// Solo visual: nada de esto sale de la API ni se guarda en ninguna base. Lo usan
// las pantallas de /turnos-demo (localhost; en producción dan 404).
//
// Cuando exista el backend de turnos, este archivo es la referencia de qué
// necesita cada rubro (forma de agendar, seña, servicios típicos), no la fuente
// de datos: el catálogo real de rubros vive en apps/api/src/onboarding.
import type { LucideIcon } from 'lucide-react'
import type { AparienciaDemo, IdentidadDemo } from './demo/negocioDemo'
import {
  AHORA_DEMO, HOY_SEMANA, SEMANA_CANCHAS, SEMANA_CLASES, SEMANA_PARTIDA, cruzar, diasAbiertos, diasTxt, tramosDe, tramosDelDia, tramosTxt,
  type Semana, type Tramo,
} from './horario'
import {
  Scissors, Sparkles, Stethoscope, Hospital, Smile, Brain, Dumbbell, Flame, Zap, Trophy,
  Flower2, Music, Swords, Waves, BookOpen, Brush, Hand, Eye, Feather, Flower, PenTool,
  Syringe, Activity, Apple, Footprints, Ear, Leaf, UserRound, Building2, Presentation,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FamiliaId = 'belleza' | 'salud' | 'deporte' | 'clases'

/** Cómo se ocupa la agenda: define qué elige el cliente al reservar. */
export type ModoAgenda =
  | 'profesional' // cada turno es con una persona (barbero, médico, kinesiólogo)
  | 'recurso'     // una sala, cabina o box, sin importar quién atiende
  | 'cancha'      // alquiler de un espacio por hora (fútbol, pádel)
  | 'cupo'        // clase grupal con cupo máximo (crossfit, yoga, danza)

export interface ServicioTipo {
  nombre: string
  /** Minutos. */
  duracion: number
  /** Precio de ejemplo en ARS. */
  precio: number
}

export interface RubroTurnos {
  key: string
  familia: FamiliaId
  label: string
  descripcion: string
  Icon: LucideIcon
  modo: ModoAgenda
  /** Seña sugerida al reservar, en % del precio. 0 = no pide seña. */
  sena: number
  /** Cómo se llama a quien atiende y a quien reserva en este rubro. */
  profesional: string
  cliente: string
  servicios: ServicioTipo[]
  /**
   * Lo que el dueño cargó en el alta de la demo para este rubro (lo pone
   * useRubroDemo). Si está, el negocio de ejemplo se reemplaza por el suyo: el
   * tema (storefront/tema.ts) toma de acá el nombre, el logo, dónde atiende y
   * los horarios. Los rubros del catálogo (RUBROS) nunca lo traen.
   */
  alta?: IdentidadDemo
  /**
   * El horario que el dueño guardó en Configuración → Horarios para este rubro
   * (también lo pone useRubroDemo). Pisa al del alta y al de ejemplo.
   */
  horarios?: Semana
  /** La plantilla que el dueño eligió en Configuración → Apariencia para este rubro, con sus ajustes. */
  apariencia?: AparienciaDemo
}

export const FAMILIAS: { id: FamiliaId; label: string; descripcion: string; Icon: LucideIcon }[] = [
  { id: 'belleza', label: 'Belleza y cuidado personal', descripcion: 'Agenda por profesional o por cabina', Icon: Sparkles },
  { id: 'salud',   label: 'Salud',                      descripcion: 'Consultorios, pacientes y obras sociales', Icon: Stethoscope },
  { id: 'deporte', label: 'Deporte y bienestar',        descripcion: 'Clases con cupo, canchas y membresías', Icon: Dumbbell },
  { id: 'clases',  label: 'Clases',                     descripcion: 'Particulares o grupales', Icon: BookOpen },
]

export const MODO_LABEL: Record<ModoAgenda, string> = {
  profesional: 'Por profesional',
  recurso:     'Por sala o cabina',
  cancha:      'Por cancha',
  cupo:        'Clases con cupo',
}

// ─── Rubros ───────────────────────────────────────────────────────────────────
// Las keys que ya existen en el catálogo de la API (barberia, estetica, clinica,
// odonto, psico, gym, clases) se conservan tal cual.

export const RUBROS_TURNOS: RubroTurnos[] = [
  // Belleza y cuidado personal
  { key: 'barberia', familia: 'belleza', label: 'Barbería', descripcion: 'Cortes, barba y agenda por barbero', Icon: Scissors, modo: 'profesional', sena: 0, profesional: 'Barbero', cliente: 'Cliente', servicios: [
    { nombre: 'Corte clásico', duracion: 30, precio: 12000 },
    { nombre: 'Corte + barba', duracion: 45, precio: 16500 },
    { nombre: 'Perfilado de barba', duracion: 20, precio: 7000 },
    { nombre: 'Afeitado con toalla caliente', duracion: 30, precio: 9500 },
    { nombre: 'Corte infantil', duracion: 25, precio: 9000 },
  ] },
  { key: 'peluqueria', familia: 'belleza', label: 'Peluquería', descripcion: 'Corte, color y peinados', Icon: Scissors, modo: 'profesional', sena: 20, profesional: 'Estilista', cliente: 'Cliente', servicios: [
    { nombre: 'Corte y brushing', duracion: 60, precio: 22000 },
    { nombre: 'Coloración completa', duracion: 120, precio: 48000 },
    { nombre: 'Mechas / balayage', duracion: 180, precio: 85000 },
    { nombre: 'Alisado con keratina', duracion: 150, precio: 70000 },
    { nombre: 'Peinado para evento', duracion: 60, precio: 30000 },
  ] },
  { key: 'estilista', familia: 'belleza', label: 'Estilista independiente', descripcion: 'Tu agenda propia, a domicilio o en tu espacio', Icon: UserRound, modo: 'profesional', sena: 30, profesional: 'Estilista', cliente: 'Cliente', servicios: [
    { nombre: 'Corte', duracion: 45, precio: 18000 },
    { nombre: 'Color', duracion: 90, precio: 40000 },
    { nombre: 'Asesoría de imagen', duracion: 60, precio: 35000 },
    { nombre: 'Servicio a domicilio', duracion: 90, precio: 45000 },
  ] },
  { key: 'maquillaje', familia: 'belleza', label: 'Maquillaje', descripcion: 'Eventos, novias y producciones', Icon: Brush, modo: 'profesional', sena: 50, profesional: 'Maquilladora', cliente: 'Clienta', servicios: [
    { nombre: 'Maquillaje social', duracion: 60, precio: 35000 },
    { nombre: 'Maquillaje de novia + prueba', duracion: 120, precio: 120000 },
    { nombre: 'Maquillaje para fotos', duracion: 60, precio: 40000 },
    { nombre: 'Clase de automaquillaje', duracion: 90, precio: 45000 },
  ] },
  { key: 'estetica', familia: 'belleza', label: 'Centro de estética', descripcion: 'Tratamientos faciales y corporales por cabina', Icon: Sparkles, modo: 'recurso', sena: 20, profesional: 'Cosmetóloga', cliente: 'Clienta', servicios: [
    { nombre: 'Limpieza facial profunda', duracion: 60, precio: 28000 },
    { nombre: 'Peeling químico', duracion: 45, precio: 35000 },
    { nombre: 'Drenaje linfático', duracion: 60, precio: 30000 },
    { nombre: 'Radiofrecuencia corporal', duracion: 45, precio: 32000 },
    { nombre: 'Dermaplaning', duracion: 40, precio: 26000 },
  ] },
  { key: 'unas', familia: 'belleza', label: 'Uñas / manicuría', descripcion: 'Esmaltado, kapping y esculpidas', Icon: Hand, modo: 'profesional', sena: 0, profesional: 'Manicura', cliente: 'Clienta', servicios: [
    { nombre: 'Esmaltado semipermanente', duracion: 45, precio: 12000 },
    { nombre: 'Kapping gel', duracion: 60, precio: 16000 },
    { nombre: 'Uñas esculpidas', duracion: 120, precio: 28000 },
    { nombre: 'Belleza de pies', duracion: 60, precio: 15000 },
    { nombre: 'Retiro + mantenimiento', duracion: 30, precio: 8000 },
  ] },
  { key: 'pestanas', familia: 'belleza', label: 'Pestañas y cejas', descripcion: 'Extensiones, lifting y diseño', Icon: Eye, modo: 'profesional', sena: 30, profesional: 'Lashista', cliente: 'Clienta', servicios: [
    { nombre: 'Extensiones pelo a pelo', duracion: 120, precio: 32000 },
    { nombre: 'Lifting de pestañas', duracion: 60, precio: 20000 },
    { nombre: 'Perfilado y laminado de cejas', duracion: 45, precio: 16000 },
    { nombre: 'Service de extensiones', duracion: 60, precio: 18000 },
  ] },
  { key: 'depilacion', familia: 'belleza', label: 'Depilación', descripcion: 'Cera y láser por zonas', Icon: Feather, modo: 'recurso', sena: 0, profesional: 'Operadora', cliente: 'Cliente', servicios: [
    { nombre: 'Láser — zona chica', duracion: 15, precio: 14000 },
    { nombre: 'Láser — piernas completas', duracion: 45, precio: 42000 },
    { nombre: 'Cera — cavado', duracion: 20, precio: 9000 },
    { nombre: 'Cera — piernas', duracion: 40, precio: 13000 },
  ] },
  { key: 'spa', familia: 'belleza', label: 'Spa y masajes', descripcion: 'Masajes, circuitos y días de spa', Icon: Flower, modo: 'recurso', sena: 30, profesional: 'Masajista', cliente: 'Cliente', servicios: [
    { nombre: 'Masaje descontracturante', duracion: 60, precio: 30000 },
    { nombre: 'Piedras calientes', duracion: 75, precio: 38000 },
    { nombre: 'Circuito de aguas', duracion: 120, precio: 45000 },
    { nombre: 'Día de spa para dos', duracion: 240, precio: 150000 },
  ] },
  { key: 'tatuajes', familia: 'belleza', label: 'Tatuajes y piercing', descripcion: 'Sesiones por artista con seña', Icon: PenTool, modo: 'profesional', sena: 30, profesional: 'Artista', cliente: 'Cliente', servicios: [
    { nombre: 'Consulta de diseño', duracion: 30, precio: 0 },
    { nombre: 'Tatuaje chico', duracion: 60, precio: 45000 },
    { nombre: 'Sesión de 3 horas', duracion: 180, precio: 140000 },
    { nombre: 'Piercing (incluye joya)', duracion: 20, precio: 25000 },
  ] },

  // Salud
  { key: 'consulta', familia: 'salud', label: 'Consulta médica particular', descripcion: 'Un consultorio, tu agenda y tus pacientes', Icon: Stethoscope, modo: 'profesional', sena: 0, profesional: 'Médico/a', cliente: 'Paciente', servicios: [
    { nombre: 'Consulta', duracion: 30, precio: 35000 },
    { nombre: 'Control', duracion: 20, precio: 25000 },
    { nombre: 'Consulta a domicilio', duracion: 40, precio: 48000 },
    { nombre: 'Apto físico', duracion: 20, precio: 20000 },
  ] },
  { key: 'centro-medico', familia: 'salud', label: 'Centro médico', descripcion: 'Varias especialidades y profesionales', Icon: Building2, modo: 'profesional', sena: 0, profesional: 'Profesional', cliente: 'Paciente', servicios: [
    { nombre: 'Clínica médica', duracion: 20, precio: 30000 },
    { nombre: 'Pediatría', duracion: 20, precio: 30000 },
    { nombre: 'Cardiología', duracion: 30, precio: 42000 },
    { nombre: 'Ginecología', duracion: 30, precio: 40000 },
    { nombre: 'Dermatología', duracion: 20, precio: 38000 },
  ] },
  { key: 'clinica', familia: 'salud', label: 'Clínica', descripcion: 'Consultorios, estudios y guardias', Icon: Hospital, modo: 'recurso', sena: 0, profesional: 'Profesional', cliente: 'Paciente', servicios: [
    { nombre: 'Consulta de especialista', duracion: 30, precio: 40000 },
    { nombre: 'Ecografía', duracion: 30, precio: 45000 },
    { nombre: 'Electrocardiograma', duracion: 20, precio: 25000 },
    { nombre: 'Laboratorio (extracción)', duracion: 10, precio: 18000 },
  ] },
  { key: 'odonto', familia: 'salud', label: 'Clínica odontológica', descripcion: 'Tratamientos por etapas y sillones', Icon: Smile, modo: 'profesional', sena: 0, profesional: 'Odontólogo/a', cliente: 'Paciente', servicios: [
    { nombre: 'Consulta y diagnóstico', duracion: 30, precio: 30000 },
    { nombre: 'Limpieza', duracion: 45, precio: 38000 },
    { nombre: 'Arreglo de caries', duracion: 45, precio: 55000 },
    { nombre: 'Blanqueamiento', duracion: 90, precio: 150000 },
    { nombre: 'Control de ortodoncia', duracion: 20, precio: 35000 },
  ] },
  { key: 'medicina-estetica', familia: 'salud', label: 'Clínica de medicina estética', descripcion: 'Tratamientos médicos con seña', Icon: Syringe, modo: 'profesional', sena: 30, profesional: 'Médico/a', cliente: 'Paciente', servicios: [
    { nombre: 'Consulta de evaluación', duracion: 30, precio: 30000 },
    { nombre: 'Toxina botulínica', duracion: 30, precio: 280000 },
    { nombre: 'Ácido hialurónico', duracion: 45, precio: 320000 },
    { nombre: 'Mesoterapia', duracion: 40, precio: 90000 },
    { nombre: 'Plasma rico en plaquetas', duracion: 60, precio: 120000 },
  ] },
  { key: 'kinesio', familia: 'salud', label: 'Kinesiólogo o fisioterapeuta', descripcion: 'Sesiones y tratamientos en serie', Icon: Activity, modo: 'profesional', sena: 0, profesional: 'Kinesiólogo/a', cliente: 'Paciente', servicios: [
    { nombre: 'Evaluación inicial', duracion: 45, precio: 30000 },
    { nombre: 'Sesión de kinesiología', duracion: 45, precio: 22000 },
    { nombre: 'Rehabilitación deportiva', duracion: 60, precio: 28000 },
    { nombre: 'Drenaje linfático', duracion: 60, precio: 26000 },
    { nombre: 'Pack de 10 sesiones', duracion: 45, precio: 190000 },
  ] },
  { key: 'psico', familia: 'salud', label: 'Psicología', descripcion: 'Sesiones recurrentes fijas', Icon: Brain, modo: 'profesional', sena: 0, profesional: 'Psicólogo/a', cliente: 'Paciente', servicios: [
    { nombre: 'Primera entrevista', duracion: 50, precio: 35000 },
    { nombre: 'Sesión individual', duracion: 50, precio: 30000 },
    { nombre: 'Sesión de pareja', duracion: 60, precio: 42000 },
    { nombre: 'Orientación a padres', duracion: 50, precio: 32000 },
  ] },
  { key: 'nutricion', familia: 'salud', label: 'Nutricionista', descripcion: 'Planes y controles periódicos', Icon: Apple, modo: 'profesional', sena: 0, profesional: 'Nutricionista', cliente: 'Paciente', servicios: [
    { nombre: 'Primera consulta + plan', duracion: 60, precio: 38000 },
    { nombre: 'Control', duracion: 30, precio: 22000 },
    { nombre: 'Antropometría', duracion: 30, precio: 20000 },
    { nombre: 'Plan para deportistas', duracion: 45, precio: 30000 },
  ] },
  { key: 'podologia', familia: 'salud', label: 'Podología', descripcion: 'Atención y tratamientos de pie', Icon: Footprints, modo: 'profesional', sena: 0, profesional: 'Podólogo/a', cliente: 'Paciente', servicios: [
    { nombre: 'Atención podológica', duracion: 45, precio: 22000 },
    { nombre: 'Uña encarnada', duracion: 45, precio: 30000 },
    { nombre: 'Estudio de la pisada', duracion: 40, precio: 35000 },
    { nombre: 'Plantillas a medida', duracion: 30, precio: 60000 },
  ] },
  { key: 'fono', familia: 'salud', label: 'Fonoaudiología', descripcion: 'Evaluaciones y sesiones de tratamiento', Icon: Ear, modo: 'profesional', sena: 0, profesional: 'Fonoaudiólogo/a', cliente: 'Paciente', servicios: [
    { nombre: 'Evaluación', duracion: 60, precio: 32000 },
    { nombre: 'Sesión de tratamiento', duracion: 45, precio: 24000 },
    { nombre: 'Audiometría', duracion: 30, precio: 26000 },
  ] },
  { key: 'medicina-alternativa', familia: 'salud', label: 'Medicina alternativa', descripcion: 'Acupuntura, reiki, homeopatía y más', Icon: Leaf, modo: 'profesional', sena: 20, profesional: 'Terapeuta', cliente: 'Consultante', servicios: [
    { nombre: 'Acupuntura', duracion: 50, precio: 26000 },
    { nombre: 'Reiki', duracion: 60, precio: 22000 },
    { nombre: 'Reflexología', duracion: 45, precio: 20000 },
    { nombre: 'Consulta homeopática', duracion: 60, precio: 30000 },
  ] },

  // Deporte y bienestar
  { key: 'gym', familia: 'deporte', label: 'Gimnasio', descripcion: 'Clases con cupo, pases y membresías', Icon: Dumbbell, modo: 'cupo', sena: 0, profesional: 'Profe', cliente: 'Socio/a', servicios: [
    { nombre: 'Musculación (turno libre)', duracion: 60, precio: 0 },
    { nombre: 'Spinning', duracion: 45, precio: 0 },
    { nombre: 'Localizada', duracion: 60, precio: 0 },
    { nombre: 'Pase diario', duracion: 60, precio: 6000 },
    { nombre: 'Rutina personalizada', duracion: 60, precio: 18000 },
  ] },
  { key: 'crossfit', familia: 'deporte', label: 'Crossfit', descripcion: 'WODs con cupo por horario', Icon: Flame, modo: 'cupo', sena: 0, profesional: 'Coach', cliente: 'Atleta', servicios: [
    { nombre: 'WOD', duracion: 60, precio: 0 },
    { nombre: 'Open box', duracion: 90, precio: 0 },
    { nombre: 'Halterofilia', duracion: 60, precio: 0 },
    { nombre: 'Clase de prueba', duracion: 60, precio: 0 },
  ] },
  { key: 'funcional', familia: 'deporte', label: 'Entrenamiento funcional', descripcion: 'Grupos reducidos y personal training', Icon: Activity, modo: 'cupo', sena: 0, profesional: 'Entrenador/a', cliente: 'Alumno/a', servicios: [
    { nombre: 'Funcional grupal', duracion: 60, precio: 0 },
    { nombre: 'HIIT', duracion: 45, precio: 0 },
    { nombre: 'Personal training', duracion: 60, precio: 25000 },
    { nombre: 'Clase al aire libre', duracion: 60, precio: 0 },
  ] },
  { key: 'electro', familia: 'deporte', label: 'Electroestimulación', descripcion: 'Sesiones cortas por equipo', Icon: Zap, modo: 'recurso', sena: 0, profesional: 'Entrenador/a', cliente: 'Cliente', servicios: [
    { nombre: 'Sesión EMS', duracion: 20, precio: 18000 },
    { nombre: 'Sesión EMS + masaje', duracion: 40, precio: 28000 },
    { nombre: 'Evaluación corporal', duracion: 30, precio: 12000 },
    { nombre: 'Pack de 8 sesiones', duracion: 20, precio: 128000 },
  ] },
  { key: 'canchas', familia: 'deporte', label: 'Centro deportivo', descripcion: 'Alquiler de canchas por hora', Icon: Trophy, modo: 'cancha', sena: 50, profesional: 'Encargado', cliente: 'Cliente', servicios: [
    { nombre: 'Fútbol 5', duracion: 60, precio: 45000 },
    { nombre: 'Fútbol 7', duracion: 60, precio: 65000 },
    { nombre: 'Pádel', duracion: 90, precio: 36000 },
    { nombre: 'Tenis', duracion: 60, precio: 28000 },
  ] },
  { key: 'yoga', familia: 'deporte', label: 'Yoga / pilates', descripcion: 'Clases con cupo y reformers', Icon: Flower2, modo: 'cupo', sena: 0, profesional: 'Instructora', cliente: 'Alumno/a', servicios: [
    { nombre: 'Hatha yoga', duracion: 60, precio: 0 },
    { nombre: 'Vinyasa', duracion: 60, precio: 0 },
    { nombre: 'Pilates reformer', duracion: 50, precio: 0 },
    { nombre: 'Clase suelta', duracion: 60, precio: 12000 },
  ] },
  { key: 'danza', familia: 'deporte', label: 'Danza y baile', descripcion: 'Estilos, niveles y cupos', Icon: Music, modo: 'cupo', sena: 0, profesional: 'Profe', cliente: 'Alumno/a', servicios: [
    { nombre: 'Salsa — inicial', duracion: 60, precio: 0 },
    { nombre: 'Tango', duracion: 90, precio: 0 },
    { nombre: 'Ritmos urbanos', duracion: 60, precio: 0 },
    { nombre: 'Clase suelta', duracion: 60, precio: 10000 },
  ] },
  { key: 'artes-marciales', familia: 'deporte', label: 'Artes marciales', descripcion: 'Disciplinas, grupos y graduaciones', Icon: Swords, modo: 'cupo', sena: 0, profesional: 'Sensei', cliente: 'Alumno/a', servicios: [
    { nombre: 'Jiu-jitsu', duracion: 90, precio: 0 },
    { nombre: 'Kickboxing', duracion: 60, precio: 0 },
    { nombre: 'Karate infantil', duracion: 60, precio: 0 },
    { nombre: 'Clase de prueba', duracion: 60, precio: 0 },
  ] },
  { key: 'natacion', familia: 'deporte', label: 'Natación', descripcion: 'Andariveles, clases y pileta libre', Icon: Waves, modo: 'cupo', sena: 0, profesional: 'Profe', cliente: 'Alumno/a', servicios: [
    { nombre: 'Natación adultos', duracion: 45, precio: 0 },
    { nombre: 'Matronatación', duracion: 45, precio: 0 },
    { nombre: 'Pileta libre', duracion: 60, precio: 0 },
    { nombre: 'Aquagym', duracion: 45, precio: 0 },
  ] },

  // Clases
  { key: 'clases', familia: 'clases', label: 'Clases particulares', descripcion: 'Apoyo escolar, idiomas y música', Icon: BookOpen, modo: 'profesional', sena: 0, profesional: 'Profe', cliente: 'Alumno/a', servicios: [
    { nombre: 'Clase individual', duracion: 60, precio: 15000 },
    { nombre: 'Clase a domicilio', duracion: 60, precio: 19000 },
    { nombre: 'Clase de prueba', duracion: 30, precio: 0 },
    { nombre: 'Pack de 4 clases', duracion: 60, precio: 54000 },
  ] },
  { key: 'talleres', familia: 'clases', label: 'Clases grupales / talleres', descripcion: 'Talleres con fecha y cupo', Icon: Presentation, modo: 'cupo', sena: 50, profesional: 'Tallerista', cliente: 'Participante', servicios: [
    { nombre: 'Taller de cerámica', duracion: 120, precio: 25000 },
    { nombre: 'Taller de cocina', duracion: 150, precio: 32000 },
    { nombre: 'Curso intensivo (4 encuentros)', duracion: 120, precio: 90000 },
    { nombre: 'Clase abierta', duracion: 90, precio: 0 },
  ] },
]

export const rubroPorKey = (key: string) => RUBROS_TURNOS.find(r => r.key === key) ?? RUBROS_TURNOS[0]
export const esSalud = (r: RubroTurnos) => r.familia === 'salud'

// ─── Formato ──────────────────────────────────────────────────────────────────

export const pesos = (n: number) => n === 0 ? 'Incluido' : `$${n.toLocaleString('es-AR')}`
export const duracionTxt = (min: number) =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`

// ─── Agenda de ejemplo ────────────────────────────────────────────────────────
// Un día tipo, armado a partir del rubro elegido: mismos turnos en todos los
// rubros, cambian los nombres de servicios y de quién atiende.

export type EstadoTurno = 'confirmado' | 'pendiente' | 'en-curso' | 'completado' | 'ausente' | 'cancelado'

export const ESTADO_TURNO: Record<EstadoTurno, { label: string; fg: string; bg: string; dot: string }> = {
  confirmado: { label: 'Confirmado', fg: 'var(--chip-success-fg)', bg: 'var(--color-success-bg)', dot: '#10B981' },
  pendiente:  { label: 'Sin confirmar', fg: 'var(--chip-warning-fg)', bg: 'var(--color-warning-bg)', dot: '#F59E0B' },
  'en-curso': { label: 'En curso', fg: 'var(--chip-primary-fg)', bg: 'var(--color-primary-bg)', dot: '#3B82F6' },
  completado: { label: 'Atendido', fg: 'var(--color-muted)', bg: 'var(--color-surface-alt)', dot: '#94A3B8' },
  ausente:    { label: 'Ausente', fg: 'var(--chip-error-fg)', bg: 'var(--color-error-bg)', dot: '#EF4444' },
  cancelado:  { label: 'Cancelado', fg: 'var(--color-muted)', bg: 'var(--color-surface-alt)', dot: '#94A3B8' },
}

export interface Recurso {
  id: string; nombre: string; rol: string; color: string
  /** Horario propio, en texto ("16:00 – 20:00"). '' = atiende en el horario del negocio. */
  horario: string
  /** Días que atiende (0 = lunes). */
  atiende: number[]
  /** Los mismos días, en texto: "Lun a sáb". */
  dias: string
}
export interface Cliente { id: string; nombre: string; telefono: string; visitas: number; ultima: string; gastado: number; nota?: string; obraSocial?: string }
export interface Turno {
  id: string
  recursoId: string
  clienteId: string
  servicio: string
  /** Minutos desde las 00:00. */
  inicio: number
  duracion: number
  precio: number
  estado: EstadoTurno
  senaPagada?: boolean
  nota?: string
}

// Colores de agenda: salen de la paleta de chips del sistema, legibles en claro y oscuro.
const COLORES = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899']

const NOMBRES_PROF = ['Martín Sosa', 'Lucía Benítez', 'Tomás Ferreyra', 'Carla Méndez']
const NOMBRES_RECURSO: Record<ModoAgenda, string[]> = {
  profesional: NOMBRES_PROF,
  recurso:     ['Cabina 1', 'Cabina 2', 'Cabina 3'],
  cancha:      ['Cancha 1', 'Cancha 2', 'Cancha 3 (techada)'],
  cupo:        ['Salón principal', 'Sala 2'],
}

/**
 * La semana de atención del negocio: la que guardó en Configuración → Horarios,
 * la que cargó en el alta o, si todavía no tocó nada, la de ejemplo según cómo
 * agenda. Es UNA sola para el sitio, la reserva y el panel.
 */
export const semanaDe = (r: RubroTurnos): Semana =>
  r.horarios?.length === 7 ? r.horarios
    : r.alta?.horarios.length === 7 ? r.alta.horarios
      : r.modo === 'cupo' ? SEMANA_CLASES : r.modo === 'cancha' ? SEMANA_CANCHAS : SEMANA_PARTIDA

export function recursosDe(r: RubroTurnos): Recurso[] {
  // Los rubros "por sala" nombran distinto su espacio: consultorio, cabina o equipo.
  const base = r.modo === 'recurso'
    ? (r.familia === 'salud' ? ['Consultorio 1', 'Consultorio 2', 'Consultorio 3'] : r.familia === 'deporte' ? ['Equipo 1', 'Equipo 2', 'Equipo 3'] : NOMBRES_RECURSO.recurso)
    : NOMBRES_RECURSO[r.modo]
  const nombres = base.slice(0, 3)
  const semana = semanaDe(r)
  const abiertos = diasAbiertos(semana)
  const tipico = tramosDe(semana[abiertos[0]]?.[1])
  const persona = r.modo === 'profesional'
  return nombres.map((nombre, i) => {
    // Las personas no trabajan todas igual: el segundo no viene el primer día de la semana y el
    // tercero atiende solo a la tarde. Así la agenda muestra gente con días y horarios distintos.
    // Una cancha o una cabina están siempre que el negocio abre.
    const atiende = persona && i === 1 && abiertos.length > 2 ? abiertos.slice(1) : abiertos
    return {
      id: `r${i + 1}`,
      nombre,
      rol: persona ? r.profesional : r.modo === 'cancha' ? 'Cancha' : 'Espacio',
      color: COLORES[i % COLORES.length],
      horario: persona && i === 2 && tipico.length > 1 ? tramosTxt([tipico[tipico.length - 1]]) : '',
      atiende,
      dias: diasTxt(atiende),
    }
  })
}

/** Los tramos en que una agenda atiende un día de la semana (0 = lunes), siempre dentro del horario del negocio. [] = ese día no atiende. */
export function tramosDeRecurso(rec: Recurso, semana: Semana, dia: number): Tramo[] {
  if (!rec.atiende.includes(dia)) return []
  const negocio = tramosDelDia(semana, dia)
  return rec.horario ? cruzar(negocio, tramosDe(rec.horario)) : negocio
}

/** La semana de una agenda: la del negocio, recortada a sus días y a su horario. */
export const semanaDeRecurso = (rec: Recurso, semana: Semana): Semana =>
  semana.map(([d], i) => [d, tramosTxt(tramosDeRecurso(rec, semana, i))])

/** El horario de una agenda en texto, para mostrar: el propio o, si sigue al negocio, el del primer día que atiende. */
export const horarioDeRecurso = (rec: Recurso, semana: Semana): string =>
  rec.horario || semana[rec.atiende.find(d => semana[d]?.[1]) ?? -1]?.[1] || ''

export const CLIENTES: Cliente[] = [
  { id: 'c1', nombre: 'Sofía Ramírez', telefono: '11 5555-0101', visitas: 14, ultima: '12/09', gastado: 212000, nota: 'Prefiere turnos a la mañana' },
  { id: 'c2', nombre: 'Juan Pérez', telefono: '11 5555-0102', visitas: 3, ultima: '02/09', gastado: 41000 },
  { id: 'c3', nombre: 'Valentina Gómez', telefono: '11 5555-0103', visitas: 22, ultima: '19/09', gastado: 356000, nota: 'Clienta frecuente' },
  { id: 'c4', nombre: 'Nicolás Torres', telefono: '11 5555-0104', visitas: 1, ultima: '—', gastado: 0 },
  { id: 'c5', nombre: 'Camila López', telefono: '11 5555-0105', visitas: 8, ultima: '15/09', gastado: 118000 },
  { id: 'c6', nombre: 'Mateo Díaz', telefono: '11 5555-0106', visitas: 5, ultima: '10/09', gastado: 64000, nota: 'Faltó 1 vez sin avisar' },
  { id: 'c7', nombre: 'Agustina Ruiz', telefono: '11 5555-0107', visitas: 11, ultima: '20/09', gastado: 167000 },
  { id: 'c8', nombre: 'Lautaro Castro', telefono: '11 5555-0108', visitas: 2, ultima: '28/08', gastado: 24000 },
]

// Datos de salud: inventados, sin diagnósticos. La ficha real va a necesitar
// su propio tratamiento de datos sensibles (Ley 25.326 / 26.529).
const OBRAS_SOCIALES = ['OSDE 210', 'Particular', 'Swiss Medical', 'Galeno', 'Particular', 'IOMA', 'Particular', 'OSDE 310']
export const clientesDe = (r: RubroTurnos): Cliente[] =>
  esSalud(r) ? CLIENTES.map((c, i) => ({ ...c, obraSocial: OBRAS_SOCIALES[i] })) : CLIENTES

const h = (hh: number, mm = 0) => hh * 60 + mm

// El día de ejemplo: para cada agenda (r1, r2, r3), a qué altura de la mañana o
// de la tarde cae cada turno. No son horas fijas: `en` son minutos desde que
// arranca ese tramo, así el mismo día sirve para un negocio que abre de 9 a 13
// y de 16 a 20 y para uno que abre de 8 a 12 y de 17 a 21.
type Marca = 'ausente' | 'cancelado' | 'pendiente'
interface Plan { id: string; recurso: number; tarde?: boolean; en: number; cliente: string; servicio: number; marca?: Marca; nota?: string }
const PLAN: Plan[] = [
  { id: 't1', recurso: 0, en: 0, cliente: 'c1', servicio: 0 },
  { id: 't2', recurso: 0, en: 60, cliente: 'c2', servicio: 1 },
  { id: 't3', recurso: 0, en: 120, cliente: 'c3', servicio: 2 },
  { id: 't4', recurso: 0, en: 180, cliente: 'c4', servicio: 0, marca: 'pendiente', nota: 'Pidió confirmar por WhatsApp' },
  { id: 't5', recurso: 0, tarde: true, en: 0, cliente: 'c5', servicio: 1 },
  { id: 't6', recurso: 0, tarde: true, en: 90, cliente: 'c7', servicio: 0, marca: 'pendiente' },
  { id: 't7', recurso: 0, tarde: true, en: 180, cliente: 'c8', servicio: 3 },
  { id: 't8', recurso: 1, en: 30, cliente: 'c6', servicio: 3, marca: 'ausente' },
  { id: 't9', recurso: 1, en: 90, cliente: 'c8', servicio: 1 },
  { id: 't10', recurso: 1, en: 180, cliente: 'c5', servicio: 2, marca: 'cancelado' },
  { id: 't11', recurso: 1, tarde: true, en: 30, cliente: 'c1', servicio: 0 },
  { id: 't12', recurso: 1, tarde: true, en: 120, cliente: 'c3', servicio: 4 },
  { id: 't13', recurso: 2, tarde: true, en: 0, cliente: 'c2', servicio: 1 },
  { id: 't14', recurso: 2, tarde: true, en: 90, cliente: 'c7', servicio: 3, marca: 'pendiente' },
  { id: 't15', recurso: 2, tarde: true, en: 180, cliente: 'c6', servicio: 0 },
]

/** Dónde arranca la "mañana" y la "tarde" de una jornada, sea partida o de corrido. */
function bloquesDe(jornada: Tramo[]): { manana: Tramo | null; tarde: Tramo | null } {
  if (jornada.length === 0) return { manana: null, tarde: null }
  if (jornada.length > 1) return { manana: jornada[0], tarde: jornada[jornada.length - 1] }
  const [a, b] = jornada[0]
  if (a >= h(13)) return { manana: null, tarde: [a, b] }
  if (b <= h(14)) return { manana: [a, b], tarde: null }
  // De corrido: la "tarde" arranca después del mediodía, dentro del mismo tramo.
  const medio = Math.min(b, Math.max(a + 240, h(14)))
  return { manana: [a, medio], tarde: medio < b ? [medio, b] : null }
}

/**
 * La agenda de ejemplo de un día. `jornadas` trae los tramos en que atiende cada
 * agenda (r1, r2, r3; [] = ese día no atiende) y `ahora` la hora de la demo si
 * el día es hoy (null = otro día: no hay nada "en curso").
 *
 * Los turnos se acomodan uno atrás del otro dentro de cada tramo con la duración
 * real de cada servicio: nunca se pisan ni caen fuera de horario, sea cual sea
 * el rubro. El estado sale de la hora: lo que ya terminó está atendido, lo que
 * está pasando está en curso y lo que falta, confirmado o sin confirmar.
 */
export function turnosDe(r: RubroTurnos, jornadas?: Tramo[][], ahora: number | null = AHORA_DEMO): Turno[] {
  const s = r.servicios
  const out: Turno[] = []
  // Sin jornadas, las de hoy del negocio de ejemplo: las de sus tres agendas (recursosDe).
  const semana = semanaDe(r)
  const agendas = jornadas ?? recursosDe(r).map(x => tramosDeRecurso(x, semana, HOY_SEMANA))
  agendas.forEach((jornada, k) => {
    const bloques = bloquesDe(jornada)
    for (const tarde of [false, true]) {
      const tramo = tarde ? bloques.tarde : bloques.manana
      if (!tramo) continue
      let libre = tramo[0]
      for (const p of PLAN) {
        if (p.recurso !== k || !!p.tarde !== tarde) continue
        const sv = s[p.servicio % s.length]
        // En punto o y media: el que sigue arranca cuando termina el anterior, redondeado.
        const inicio = Math.ceil(Math.max(libre, tramo[0] + p.en) / 30) * 30
        if (inicio + sv.duracion > tramo[1]) continue
        libre = inicio + sv.duracion
        const fin = inicio + sv.duracion
        const estado: EstadoTurno = p.marca === 'cancelado' ? 'cancelado'
          : ahora === null ? (p.marca === 'pendiente' ? 'pendiente' : 'confirmado')
          : fin <= ahora ? (p.marca === 'ausente' ? 'ausente' : 'completado')
          : inicio <= ahora ? 'en-curso'
          : p.marca === 'pendiente' ? 'pendiente' : 'confirmado'
        out.push({
          id: p.id, recursoId: `r${k + 1}`, clienteId: p.cliente, servicio: sv.nombre, inicio, duracion: sv.duracion, precio: sv.precio, estado,
          senaPagada: r.sena > 0 && estado !== 'pendiente', ...(p.nota && estado === 'pendiente' ? { nota: p.nota } : {}),
        })
      }
    }
  })
  return out
}

export const horaTxt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// ─── Clases con cupo ──────────────────────────────────────────────────────────

export interface ClaseCupo { id: string; dia: number; inicio: number; duracion: number; nombre: string; profe: string; cupo: number; anotados: number; sala: string }

export function clasesDe(r: RubroTurnos): ClaseCupo[] {
  const nombres = r.servicios.filter(s => s.precio === 0).map(s => s.nombre)
  // Con una sola actividad sin cargo (talleres) la grilla entera repetiría el mismo nombre.
  const lista = nombres.length > 1 ? nombres : r.servicios.map(s => s.nombre)
  const profes = ['Caro', 'Nico', 'Flor', 'Seba']
  // A qué altura de la mañana o de la tarde cae cada clase: [es de la tarde, minutos desde que abre
  // ese turno]. Con el horario de ejemplo (7 a 13 y 17 a 22) dan las 7:00, 8:30, 10:00, 12:00,
  // 18:00, 19:15 y 20:30; si el dueño cambia el horario, las clases se corren con él.
  const CUANDO: [boolean, number][] = [[false, 0], [false, 90], [false, 180], [false, 300], [true, 60], [true, 135], [true, 210]]
  const semana = semanaDe(r)
  const out: ClaseCupo[] = []
  let n = 0
  for (let dia = 0; dia < 6; dia++) {
    const bloques = bloquesDe(tramosDelDia(semana, dia))
    for (let k = 0; k < CUANDO.length; k++) {
      if ((dia + k) % 3 === 2 && k !== 4) continue // huecos para que la grilla respire
      if (dia === 5 && k > 4) continue           // sábado sin la última franja
      const [tarde, en] = CUANDO[k]
      const tramo = tarde ? bloques.tarde : bloques.manana
      if (!tramo || tramo[0] + en + 60 > tramo[1]) continue // ese día no hay ese turno, o la clase no entra
      const cupo = [12, 15, 20, 10][(dia + k) % 4]
      const anotados = Math.min(cupo, Math.round(cupo * [0.4, 1, 0.75, 0.9, 1, 0.55, 0.3][(dia * 2 + k) % 7]))
      out.push({ id: `k${n++}`, dia, inicio: tramo[0] + en, duracion: 60, nombre: lista[(dia + k) % lista.length], profe: profes[(dia + k) % profes.length], cupo, anotados, sala: (dia + k) % 2 ? 'Sala 2' : 'Salón principal' })
    }
  }
  return out
}

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ─── Contexto de la demo ──────────────────────────────────────────────────────
// El rubro elegido viaja por ?rubro= para que cada link del índice abra la
// misma pantalla con los datos de otro rubro.

export const RUBRO_DEFAULT = 'barberia'

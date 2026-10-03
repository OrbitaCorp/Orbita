// Catálogo de rubros de Turnos & Agenda: FUENTE DE VERDAD del backend.
//
// Con esto se siembra un negocio de turnos nuevo: de acá salen el modo de
// agenda, los servicios típicos, la seña sugerida, cómo se le dice a quien
// atiende y a quien reserva, el horario y las reglas de reserva con las que
// arranca. Es un catálogo estático: no hay tabla de rubros.
//
// Las 32 keys son las de la demo (apps/web/src/modules/turnos/datos.ts →
// RUBROS_TURNOS). `Business.industry` y `AppointmentSettings.rubroKey` guardan
// la key. El frontend tiene su propia copia con los íconos de lucide; acá el
// ícono viaja como nombre (igual que RUBROS en onboarding.service.ts).
//
// Todavía NO está conectado al alta: en onboarding.service.ts los rubros de
// turnos siguen con `disponible: false`. Lo conecta la sesión del alta.
import type { AppointmentAgendaMode, AppointmentModality } from '@prisma/client';
import type { SemanaTurnos, Tramo } from '../horarios/horarios';

export type FamiliaTurnos = 'belleza' | 'salud' | 'deporte' | 'clases';

export interface ServicioTipico {
  nombre: string;
  /** Minutos. */
  duracion: number;
  /** Precio de ejemplo en ARS. 0 = "Incluido". */
  precio: number;
}

export interface RubroTurnos {
  key: string;
  familia: FamiliaTurnos;
  label: string;
  descripcion: string;
  /** Nombre del ícono de lucide-react. */
  icon: string;
  /** Cómo se ocupa la agenda: define qué elige el cliente al reservar. */
  modo: AppointmentAgendaMode;
  /** Seña sugerida al reservar, en % del precio. 0 = no pide seña. */
  sena: number;
  /** Cómo se llama a quien atiende y a quien reserva en este rubro. */
  profesional: string;
  cliente: string;
  servicios: ServicioTipico[];
}

export const FAMILIAS_TURNOS: { id: FamiliaTurnos; label: string; descripcion: string; icon: string }[] = [
  { id: 'belleza', label: 'Belleza y cuidado personal', descripcion: 'Agenda por profesional o por cabina', icon: 'Sparkles' },
  { id: 'salud', label: 'Salud', descripcion: 'Consultorios, pacientes y obras sociales', icon: 'Stethoscope' },
  { id: 'deporte', label: 'Deporte y bienestar', descripcion: 'Clases con cupo, canchas y membresías', icon: 'Dumbbell' },
  { id: 'clases', label: 'Clases', descripcion: 'Particulares o grupales', icon: 'BookOpen' },
];

export const MODO_LABEL: Record<AppointmentAgendaMode, string> = {
  PROFESSIONAL: 'Por profesional',
  RESOURCE: 'Por sala o cabina',
  COURT: 'Por cancha',
  CLASS: 'Clases con cupo',
};

// Generado desde la demo (datos.ts). Si se agrega un rubro allá, agregarlo acá:
// test/unit/appointments.catalogo.unit-spec.ts compara las dos listas.
export const RUBROS_TURNOS: RubroTurnos[] = [
  {
    key: 'barberia', familia: 'belleza', label: 'Barbería', descripcion: 'Cortes, barba y agenda por barbero', icon: 'Scissors',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Barbero', cliente: 'Cliente',
    servicios: [
      { nombre: 'Corte clásico', duracion: 30, precio: 12000 },
      { nombre: 'Corte + barba', duracion: 45, precio: 16500 },
      { nombre: 'Perfilado de barba', duracion: 20, precio: 7000 },
      { nombre: 'Afeitado con toalla caliente', duracion: 30, precio: 9500 },
      { nombre: 'Corte infantil', duracion: 25, precio: 9000 },
    ],
  },
  {
    key: 'peluqueria', familia: 'belleza', label: 'Peluquería', descripcion: 'Corte, color y peinados', icon: 'Scissors',
    modo: 'PROFESSIONAL', sena: 20, profesional: 'Estilista', cliente: 'Cliente',
    servicios: [
      { nombre: 'Corte y brushing', duracion: 60, precio: 22000 },
      { nombre: 'Coloración completa', duracion: 120, precio: 48000 },
      { nombre: 'Mechas / balayage', duracion: 180, precio: 85000 },
      { nombre: 'Alisado con keratina', duracion: 150, precio: 70000 },
      { nombre: 'Peinado para evento', duracion: 60, precio: 30000 },
    ],
  },
  {
    key: 'estilista', familia: 'belleza', label: 'Estilista independiente', descripcion: 'Tu agenda propia, a domicilio o en tu espacio', icon: 'UserRound',
    modo: 'PROFESSIONAL', sena: 30, profesional: 'Estilista', cliente: 'Cliente',
    servicios: [
      { nombre: 'Corte', duracion: 45, precio: 18000 },
      { nombre: 'Color', duracion: 90, precio: 40000 },
      { nombre: 'Asesoría de imagen', duracion: 60, precio: 35000 },
      { nombre: 'Servicio a domicilio', duracion: 90, precio: 45000 },
    ],
  },
  {
    key: 'maquillaje', familia: 'belleza', label: 'Maquillaje', descripcion: 'Eventos, novias y producciones', icon: 'Brush',
    modo: 'PROFESSIONAL', sena: 50, profesional: 'Maquilladora', cliente: 'Clienta',
    servicios: [
      { nombre: 'Maquillaje social', duracion: 60, precio: 35000 },
      { nombre: 'Maquillaje de novia + prueba', duracion: 120, precio: 120000 },
      { nombre: 'Maquillaje para fotos', duracion: 60, precio: 40000 },
      { nombre: 'Clase de automaquillaje', duracion: 90, precio: 45000 },
    ],
  },
  {
    key: 'estetica', familia: 'belleza', label: 'Centro de estética', descripcion: 'Tratamientos faciales y corporales por cabina', icon: 'Sparkles',
    modo: 'RESOURCE', sena: 20, profesional: 'Cosmetóloga', cliente: 'Clienta',
    servicios: [
      { nombre: 'Limpieza facial profunda', duracion: 60, precio: 28000 },
      { nombre: 'Peeling químico', duracion: 45, precio: 35000 },
      { nombre: 'Drenaje linfático', duracion: 60, precio: 30000 },
      { nombre: 'Radiofrecuencia corporal', duracion: 45, precio: 32000 },
      { nombre: 'Dermaplaning', duracion: 40, precio: 26000 },
    ],
  },
  {
    key: 'unas', familia: 'belleza', label: 'Uñas / manicuría', descripcion: 'Esmaltado, kapping y esculpidas', icon: 'Hand',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Manicura', cliente: 'Clienta',
    servicios: [
      { nombre: 'Esmaltado semipermanente', duracion: 45, precio: 12000 },
      { nombre: 'Kapping gel', duracion: 60, precio: 16000 },
      { nombre: 'Uñas esculpidas', duracion: 120, precio: 28000 },
      { nombre: 'Belleza de pies', duracion: 60, precio: 15000 },
      { nombre: 'Retiro + mantenimiento', duracion: 30, precio: 8000 },
    ],
  },
  {
    key: 'pestanas', familia: 'belleza', label: 'Pestañas y cejas', descripcion: 'Extensiones, lifting y diseño', icon: 'Eye',
    modo: 'PROFESSIONAL', sena: 30, profesional: 'Lashista', cliente: 'Clienta',
    servicios: [
      { nombre: 'Extensiones pelo a pelo', duracion: 120, precio: 32000 },
      { nombre: 'Lifting de pestañas', duracion: 60, precio: 20000 },
      { nombre: 'Perfilado y laminado de cejas', duracion: 45, precio: 16000 },
      { nombre: 'Service de extensiones', duracion: 60, precio: 18000 },
    ],
  },
  {
    key: 'depilacion', familia: 'belleza', label: 'Depilación', descripcion: 'Cera y láser por zonas', icon: 'Feather',
    modo: 'RESOURCE', sena: 0, profesional: 'Operadora', cliente: 'Cliente',
    servicios: [
      { nombre: 'Láser — zona chica', duracion: 15, precio: 14000 },
      { nombre: 'Láser — piernas completas', duracion: 45, precio: 42000 },
      { nombre: 'Cera — cavado', duracion: 20, precio: 9000 },
      { nombre: 'Cera — piernas', duracion: 40, precio: 13000 },
    ],
  },
  {
    key: 'spa', familia: 'belleza', label: 'Spa y masajes', descripcion: 'Masajes, circuitos y días de spa', icon: 'Flower',
    modo: 'RESOURCE', sena: 30, profesional: 'Masajista', cliente: 'Cliente',
    servicios: [
      { nombre: 'Masaje descontracturante', duracion: 60, precio: 30000 },
      { nombre: 'Piedras calientes', duracion: 75, precio: 38000 },
      { nombre: 'Circuito de aguas', duracion: 120, precio: 45000 },
      { nombre: 'Día de spa para dos', duracion: 240, precio: 150000 },
    ],
  },
  {
    key: 'tatuajes', familia: 'belleza', label: 'Tatuajes y piercing', descripcion: 'Sesiones por artista con seña', icon: 'PenTool',
    modo: 'PROFESSIONAL', sena: 30, profesional: 'Artista', cliente: 'Cliente',
    servicios: [
      { nombre: 'Consulta de diseño', duracion: 30, precio: 0 },
      { nombre: 'Tatuaje chico', duracion: 60, precio: 45000 },
      { nombre: 'Sesión de 3 horas', duracion: 180, precio: 140000 },
      { nombre: 'Piercing (incluye joya)', duracion: 20, precio: 25000 },
    ],
  },
  {
    key: 'consulta', familia: 'salud', label: 'Consulta médica particular', descripcion: 'Un consultorio, tu agenda y tus pacientes', icon: 'Stethoscope',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Médico/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Consulta', duracion: 30, precio: 35000 },
      { nombre: 'Control', duracion: 20, precio: 25000 },
      { nombre: 'Consulta a domicilio', duracion: 40, precio: 48000 },
      { nombre: 'Apto físico', duracion: 20, precio: 20000 },
    ],
  },
  {
    key: 'centro-medico', familia: 'salud', label: 'Centro médico', descripcion: 'Varias especialidades y profesionales', icon: 'Building2',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Profesional', cliente: 'Paciente',
    servicios: [
      { nombre: 'Clínica médica', duracion: 20, precio: 30000 },
      { nombre: 'Pediatría', duracion: 20, precio: 30000 },
      { nombre: 'Cardiología', duracion: 30, precio: 42000 },
      { nombre: 'Ginecología', duracion: 30, precio: 40000 },
      { nombre: 'Dermatología', duracion: 20, precio: 38000 },
    ],
  },
  {
    key: 'clinica', familia: 'salud', label: 'Clínica', descripcion: 'Consultorios, estudios y guardias', icon: 'Hospital',
    modo: 'RESOURCE', sena: 0, profesional: 'Profesional', cliente: 'Paciente',
    servicios: [
      { nombre: 'Consulta de especialista', duracion: 30, precio: 40000 },
      { nombre: 'Ecografía', duracion: 30, precio: 45000 },
      { nombre: 'Electrocardiograma', duracion: 20, precio: 25000 },
      { nombre: 'Laboratorio (extracción)', duracion: 10, precio: 18000 },
    ],
  },
  {
    key: 'odonto', familia: 'salud', label: 'Clínica odontológica', descripcion: 'Tratamientos por etapas y sillones', icon: 'Smile',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Odontólogo/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Consulta y diagnóstico', duracion: 30, precio: 30000 },
      { nombre: 'Limpieza', duracion: 45, precio: 38000 },
      { nombre: 'Arreglo de caries', duracion: 45, precio: 55000 },
      { nombre: 'Blanqueamiento', duracion: 90, precio: 150000 },
      { nombre: 'Control de ortodoncia', duracion: 20, precio: 35000 },
    ],
  },
  {
    key: 'medicina-estetica', familia: 'salud', label: 'Clínica de medicina estética', descripcion: 'Tratamientos médicos con seña', icon: 'Syringe',
    modo: 'PROFESSIONAL', sena: 30, profesional: 'Médico/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Consulta de evaluación', duracion: 30, precio: 30000 },
      { nombre: 'Toxina botulínica', duracion: 30, precio: 280000 },
      { nombre: 'Ácido hialurónico', duracion: 45, precio: 320000 },
      { nombre: 'Mesoterapia', duracion: 40, precio: 90000 },
      { nombre: 'Plasma rico en plaquetas', duracion: 60, precio: 120000 },
    ],
  },
  {
    key: 'kinesio', familia: 'salud', label: 'Kinesiólogo o fisioterapeuta', descripcion: 'Sesiones y tratamientos en serie', icon: 'Activity',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Kinesiólogo/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Evaluación inicial', duracion: 45, precio: 30000 },
      { nombre: 'Sesión de kinesiología', duracion: 45, precio: 22000 },
      { nombre: 'Rehabilitación deportiva', duracion: 60, precio: 28000 },
      { nombre: 'Drenaje linfático', duracion: 60, precio: 26000 },
      { nombre: 'Pack de 10 sesiones', duracion: 45, precio: 190000 },
    ],
  },
  {
    key: 'psico', familia: 'salud', label: 'Psicología', descripcion: 'Sesiones recurrentes fijas', icon: 'Brain',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Psicólogo/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Primera entrevista', duracion: 50, precio: 35000 },
      { nombre: 'Sesión individual', duracion: 50, precio: 30000 },
      { nombre: 'Sesión de pareja', duracion: 60, precio: 42000 },
      { nombre: 'Orientación a padres', duracion: 50, precio: 32000 },
    ],
  },
  {
    key: 'nutricion', familia: 'salud', label: 'Nutricionista', descripcion: 'Planes y controles periódicos', icon: 'Apple',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Nutricionista', cliente: 'Paciente',
    servicios: [
      { nombre: 'Primera consulta + plan', duracion: 60, precio: 38000 },
      { nombre: 'Control', duracion: 30, precio: 22000 },
      { nombre: 'Antropometría', duracion: 30, precio: 20000 },
      { nombre: 'Plan para deportistas', duracion: 45, precio: 30000 },
    ],
  },
  {
    key: 'podologia', familia: 'salud', label: 'Podología', descripcion: 'Atención y tratamientos de pie', icon: 'Footprints',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Podólogo/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Atención podológica', duracion: 45, precio: 22000 },
      { nombre: 'Uña encarnada', duracion: 45, precio: 30000 },
      { nombre: 'Estudio de la pisada', duracion: 40, precio: 35000 },
      { nombre: 'Plantillas a medida', duracion: 30, precio: 60000 },
    ],
  },
  {
    key: 'fono', familia: 'salud', label: 'Fonoaudiología', descripcion: 'Evaluaciones y sesiones de tratamiento', icon: 'Ear',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Fonoaudiólogo/a', cliente: 'Paciente',
    servicios: [
      { nombre: 'Evaluación', duracion: 60, precio: 32000 },
      { nombre: 'Sesión de tratamiento', duracion: 45, precio: 24000 },
      { nombre: 'Audiometría', duracion: 30, precio: 26000 },
    ],
  },
  {
    key: 'medicina-alternativa', familia: 'salud', label: 'Medicina alternativa', descripcion: 'Acupuntura, reiki, homeopatía y más', icon: 'Leaf',
    modo: 'PROFESSIONAL', sena: 20, profesional: 'Terapeuta', cliente: 'Consultante',
    servicios: [
      { nombre: 'Acupuntura', duracion: 50, precio: 26000 },
      { nombre: 'Reiki', duracion: 60, precio: 22000 },
      { nombre: 'Reflexología', duracion: 45, precio: 20000 },
      { nombre: 'Consulta homeopática', duracion: 60, precio: 30000 },
    ],
  },
  {
    key: 'gym', familia: 'deporte', label: 'Gimnasio', descripcion: 'Clases con cupo, pases y membresías', icon: 'Dumbbell',
    modo: 'CLASS', sena: 0, profesional: 'Profe', cliente: 'Socio/a',
    servicios: [
      { nombre: 'Musculación (turno libre)', duracion: 60, precio: 0 },
      { nombre: 'Spinning', duracion: 45, precio: 0 },
      { nombre: 'Localizada', duracion: 60, precio: 0 },
      { nombre: 'Pase diario', duracion: 60, precio: 6000 },
      { nombre: 'Rutina personalizada', duracion: 60, precio: 18000 },
    ],
  },
  {
    key: 'crossfit', familia: 'deporte', label: 'Crossfit', descripcion: 'WODs con cupo por horario', icon: 'Flame',
    modo: 'CLASS', sena: 0, profesional: 'Coach', cliente: 'Atleta',
    servicios: [
      { nombre: 'WOD', duracion: 60, precio: 0 },
      { nombre: 'Open box', duracion: 90, precio: 0 },
      { nombre: 'Halterofilia', duracion: 60, precio: 0 },
      { nombre: 'Clase de prueba', duracion: 60, precio: 0 },
    ],
  },
  {
    key: 'funcional', familia: 'deporte', label: 'Entrenamiento funcional', descripcion: 'Grupos reducidos y personal training', icon: 'Activity',
    modo: 'CLASS', sena: 0, profesional: 'Entrenador/a', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Funcional grupal', duracion: 60, precio: 0 },
      { nombre: 'HIIT', duracion: 45, precio: 0 },
      { nombre: 'Personal training', duracion: 60, precio: 25000 },
      { nombre: 'Clase al aire libre', duracion: 60, precio: 0 },
    ],
  },
  {
    key: 'electro', familia: 'deporte', label: 'Electroestimulación', descripcion: 'Sesiones cortas por equipo', icon: 'Zap',
    modo: 'RESOURCE', sena: 0, profesional: 'Entrenador/a', cliente: 'Cliente',
    servicios: [
      { nombre: 'Sesión EMS', duracion: 20, precio: 18000 },
      { nombre: 'Sesión EMS + masaje', duracion: 40, precio: 28000 },
      { nombre: 'Evaluación corporal', duracion: 30, precio: 12000 },
      { nombre: 'Pack de 8 sesiones', duracion: 20, precio: 128000 },
    ],
  },
  {
    key: 'canchas', familia: 'deporte', label: 'Centro deportivo', descripcion: 'Alquiler de canchas por hora', icon: 'Trophy',
    modo: 'COURT', sena: 50, profesional: 'Encargado', cliente: 'Cliente',
    servicios: [
      { nombre: 'Fútbol 5', duracion: 60, precio: 45000 },
      { nombre: 'Fútbol 7', duracion: 60, precio: 65000 },
      { nombre: 'Pádel', duracion: 90, precio: 36000 },
      { nombre: 'Tenis', duracion: 60, precio: 28000 },
    ],
  },
  {
    key: 'yoga', familia: 'deporte', label: 'Yoga / pilates', descripcion: 'Clases con cupo y reformers', icon: 'Flower2',
    modo: 'CLASS', sena: 0, profesional: 'Instructora', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Hatha yoga', duracion: 60, precio: 0 },
      { nombre: 'Vinyasa', duracion: 60, precio: 0 },
      { nombre: 'Pilates reformer', duracion: 50, precio: 0 },
      { nombre: 'Clase suelta', duracion: 60, precio: 12000 },
    ],
  },
  {
    key: 'danza', familia: 'deporte', label: 'Danza y baile', descripcion: 'Estilos, niveles y cupos', icon: 'Music',
    modo: 'CLASS', sena: 0, profesional: 'Profe', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Salsa — inicial', duracion: 60, precio: 0 },
      { nombre: 'Tango', duracion: 90, precio: 0 },
      { nombre: 'Ritmos urbanos', duracion: 60, precio: 0 },
      { nombre: 'Clase suelta', duracion: 60, precio: 10000 },
    ],
  },
  {
    key: 'artes-marciales', familia: 'deporte', label: 'Artes marciales', descripcion: 'Disciplinas, grupos y graduaciones', icon: 'Swords',
    modo: 'CLASS', sena: 0, profesional: 'Sensei', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Jiu-jitsu', duracion: 90, precio: 0 },
      { nombre: 'Kickboxing', duracion: 60, precio: 0 },
      { nombre: 'Karate infantil', duracion: 60, precio: 0 },
      { nombre: 'Clase de prueba', duracion: 60, precio: 0 },
    ],
  },
  {
    key: 'natacion', familia: 'deporte', label: 'Natación', descripcion: 'Andariveles, clases y pileta libre', icon: 'Waves',
    modo: 'CLASS', sena: 0, profesional: 'Profe', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Natación adultos', duracion: 45, precio: 0 },
      { nombre: 'Matronatación', duracion: 45, precio: 0 },
      { nombre: 'Pileta libre', duracion: 60, precio: 0 },
      { nombre: 'Aquagym', duracion: 45, precio: 0 },
    ],
  },
  {
    key: 'clases', familia: 'clases', label: 'Clases particulares', descripcion: 'Apoyo escolar, idiomas y música', icon: 'BookOpen',
    modo: 'PROFESSIONAL', sena: 0, profesional: 'Profe', cliente: 'Alumno/a',
    servicios: [
      { nombre: 'Clase individual', duracion: 60, precio: 15000 },
      { nombre: 'Clase a domicilio', duracion: 60, precio: 19000 },
      { nombre: 'Clase de prueba', duracion: 30, precio: 0 },
      { nombre: 'Pack de 4 clases', duracion: 60, precio: 54000 },
    ],
  },
  {
    key: 'talleres', familia: 'clases', label: 'Clases grupales / talleres', descripcion: 'Talleres con fecha y cupo', icon: 'Presentation',
    modo: 'CLASS', sena: 50, profesional: 'Tallerista', cliente: 'Participante',
    servicios: [
      { nombre: 'Taller de cerámica', duracion: 120, precio: 25000 },
      { nombre: 'Taller de cocina', duracion: 150, precio: 32000 },
      { nombre: 'Curso intensivo (4 encuentros)', duracion: 120, precio: 90000 },
      { nombre: 'Clase abierta', duracion: 90, precio: 0 },
    ],
  },
];

export const KEYS_RUBROS_TURNOS: string[] = RUBROS_TURNOS.map((r) => r.key);

/** El rubro de esa key, o undefined: quien siembra un negocio decide qué hacer si no existe (no hay un "por defecto" silencioso). */
export const rubroTurnosPorKey = (key: string): RubroTurnos | undefined => RUBROS_TURNOS.find((r) => r.key === key);

export const esSalud = (r: RubroTurnos): boolean => r.familia === 'salud';

// ─── Cómo se nombra cada cosa según el rubro ─────────────────────────────────
// Un consultorio no tiene "clientes" ni un gimnasio "turnos". Los mails y los
// mensajes automáticos sacan las palabras de acá.

export interface VozTurnos {
  /** "clientes" / "pacientes" / "alumnos". */
  clientes: string;
  cliente: string;
  /** "turno" / "clase" / "reserva". */
  turno: string;
  turnos: string;
  /** "barbero" / "cancha" / "sala" / "consultorio" / "cabina". */
  recurso: string;
}

export function vozDe(r: RubroTurnos): VozTurnos {
  const clientes = esSalud(r) ? 'pacientes' : r.modo === 'CLASS' ? 'alumnos' : 'clientes';
  const cliente = esSalud(r) ? 'paciente' : r.modo === 'CLASS' ? 'alumno' : 'cliente';
  const turno = r.modo === 'CLASS' ? 'clase' : r.modo === 'COURT' ? 'reserva' : 'turno';
  const recurso = r.modo === 'PROFESSIONAL' ? r.profesional.toLowerCase() : r.modo === 'COURT' ? 'cancha' : r.modo === 'CLASS' ? 'sala' : esSalud(r) ? 'consultorio' : 'cabina';
  return { clientes, cliente, turno, turnos: `${turno}s`, recurso };
}

// ─── Con qué arranca un negocio nuevo ────────────────────────────────────────

const h = (hora: number, minutos = 0): number => hora * 60 + minutos;
const semanaCon = (lunesAViernes: Tramo[], sabado: Tramo[], domingo: Tramo[] = []): SemanaTurnos =>
  Array.from({ length: 7 }, (_, i) => (i < 5 ? lunesAViernes : i === 5 ? sabado : domingo).map(([a, b]) => [a, b] as Tramo));

/** Mañana y tarde, con el corte del mediodía: 9 a 13 y 16 a 20, de lunes a sábado. */
export const SEMANA_PARTIDA: SemanaTurnos = semanaCon([[h(9), h(13)], [h(16), h(20)]], [[h(9), h(13)], [h(16), h(20)]]);
/** Donde hay clases con cupo se abre temprano y se cierra tarde. */
export const SEMANA_CLASES: SemanaTurnos = semanaCon([[h(7), h(13)], [h(17), h(22)]], [[h(7), h(13)], [h(17), h(20)]]);
/** Las canchas se alquilan sobre todo a la tarde y a la noche. */
export const SEMANA_CANCHAS: SemanaTurnos = semanaCon([[h(9), h(13)], [h(16), h(23)]], [[h(9), h(13)], [h(15), h(23)]]);

/** El horario con el que arranca un negocio que todavía no cargó el suyo (una copia: se puede mutar). */
export function semanaInicialDe(r: RubroTurnos): SemanaTurnos {
  const base = r.modo === 'CLASS' ? SEMANA_CLASES : r.modo === 'COURT' ? SEMANA_CANCHAS : SEMANA_PARTIDA;
  return base.map((dia) => dia.map(([a, b]) => [a, b] as Tramo));
}

// Rubros que, además del local, van a la casa del cliente.
const A_DOMICILIO = new Set(['estilista', 'maquillaje', 'kinesio', 'podologia', 'clases']);

/** Las modalidades típicas del rubro, para cuando el dueño todavía no eligió. */
export function modalidadesInicialesDe(r: RubroTurnos): AppointmentModality[] {
  return ['ON_SITE', ...(A_DOMICILIO.has(r.key) ? (['HOME'] as const) : [])];
}

/** Una cancha o una clase con cupo no se llevan a domicilio. */
export function modalidadesPosibles(r: RubroTurnos): AppointmentModality[] {
  return r.modo === 'COURT' || r.modo === 'CLASS' ? ['ON_SITE'] : ['ON_SITE', 'HOME'];
}

/** Los minutos de grilla que se pueden elegir en cada modo. */
export const grillasDe = (r: RubroTurnos): number[] => (r.modo === 'COURT' ? [30, 60, 90] : [15, 30, 60]);

/**
 * Las reglas de reserva con las que arranca el rubro: los mismos valores de
 * fábrica que la pantalla "Reglas de reserva" de la demo. Los nombres son los
 * de las columnas de AppointmentSettings, así se pueden volcar tal cual.
 */
export function reglasInicialesDe(r: RubroTurnos) {
  const cupo = r.modo === 'CLASS';
  const salud = esSalud(r);
  return {
    minAdvanceMin: salud ? 240 : 120,
    maxAdvanceDays: cupo ? 14 : 30,
    slotMin: r.modo === 'COURT' ? 60 : 30,
    bufferMin: r.familia === 'belleza' ? 5 : 0,
    confirmation: (r.sena > 0 ? 'auto' : salud ? 'manual' : 'auto') as 'auto' | 'manual',
    letChooseResource: true,
    offerAnyResource: true,
    maxActivePerCustomer: cupo ? 0 : 2,
    waitlistEnabled: cupo || r.modo === 'COURT',
    waitlistAcceptMin: 30,
    classDefaultCapacity: 15,
    classOpenDays: 7,
    classMinEnrolled: 3,
    askInsurance: salud,
    askDni: salud,
    askReason: salud && r.key !== 'psico',
    rescheduleEnabled: true,
    rescheduleUntilHours: 12,
    rescheduleMax: 2,
    depositEnabled: r.sena > 0,
    depositType: 'percent' as 'percent' | 'fixed',
    depositPercent: r.sena || 30,
    depositFixed: 5000,
    depositForNoShows: true,
    cancelUntilHours: 24,
    depositOutOfWindow: 'forfeit' as 'forfeit' | 'credit',
    toleranceMin: 10,
    accountEnabled: true,
    welcomeDiscountPercent: 10,
    loyaltyStamps: 6,
    promosEnabled: true,
  };
}

/** Cómo se llaman las agendas de ejemplo de un negocio que no cargó las suyas. */
export function nombresDeEspacios(r: RubroTurnos): string[] {
  if (r.modo === 'COURT') return ['Cancha 1', 'Cancha 2', 'Cancha 3'];
  if (r.modo === 'CLASS') return ['Salón principal', 'Sala 2'];
  if (r.modo === 'RESOURCE') {
    if (esSalud(r)) return ['Consultorio 1', 'Consultorio 2', 'Consultorio 3'];
    if (r.familia === 'deporte') return ['Equipo 1', 'Equipo 2', 'Equipo 3'];
    return ['Cabina 1', 'Cabina 2', 'Cabina 3'];
  }
  return [];
}

/** Cómo figura el tipo de agenda debajo de su nombre: el oficio, "Cancha" o "Espacio". */
export const etiquetaDeAgenda = (r: RubroTurnos): string => (r.modo === 'PROFESSIONAL' ? r.profesional : r.modo === 'COURT' ? 'Cancha' : 'Espacio');

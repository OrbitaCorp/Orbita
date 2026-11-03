// Plan diario de los módulos nuevos de Órbita (super admin → Módulos).
//
// Módulos es solo visual (pedido de Ale, 26/10/2026: "solo visual, nada de
// backend"): el plan vive acá, en el código, y lo que cada uno tilda queda en
// su navegador (estado.ts). No hay API ni base de datos detrás.
//
// Un plan por módulo: Turnos, Alquileres y Gimnasio. Tienda no lleva plan
// porque ya está en producción. Cada tarea es diaria, con día, quién la hace,
// criterio de listo y la semana del ciclo a la que pertenece en los dos
// horizontes (2 meses y 1 mes). Las tareas transversales de Ale (lib de
// reservas, sección Módulos, alta única, cierre) van en el plan de Gimnasio
// con el prefijo "Transversal: ", porque Gimnasio es su módulo.
//
// Una lista de tareas por módulo y no una por semana: al pasar al horizonte de
// 1 mes las tareas se reagrupan en otras semanas, y lo tildado se guarda por
// tarea, así cambiar de horizonte no pierde nada. El estado de cada semana
// (pendiente, en curso, hecha, atrasada) sale de sus tareas.
//
// Ciclo: arranca el lunes 26/10/2026 y termina el viernes 18/12/2026 (2 meses)
// o el viernes 20/11/2026 (1 mes). En el de 1 mes las semanas 1 a 4 son
// iguales, la estadía de Alquileres queda afuera (semana1m: null) y las
// semanas 5 a 8 se comprimen en la 3 o la 4. La fecha en el ciclo de 1 mes es
// el lunes de `semana1m` más el día de la semana de la tarea.
//
// Una tarea se tilda solo con su entrada de auditoría (entradas.ts). La que ya
// se hizo en sesión se envuelve con documentada(): nace con la key de su
// entrada pero sin tildar, hasta que la confirme su responsable.
//
// Los ids de las tareas (t1, t2…) son por posición y lo tildado en cada
// navegador se guarda con ellos: sumá tareas al final, no en el medio.

export type ConPlan = 'turnos' | 'alquileres' | 'gimnasio'
export type Persona = 'Ale' | 'Mateo' | 'Alan'
export const PERSONAS: Persona[] = ['Ale', 'Mateo', 'Alan']

export const CICLO = { inicio: '2026-10-26', fin2m: '2026-12-18', fin1m: '2026-11-20' } as const

export interface Tarea {
  /** t1, t2… por posición dentro del plan. */
  id: string
  texto: string
  /** AAAA-MM-DD, siempre un día hábil del ciclo de 2 meses. */
  dia: string
  quien: Persona
  /** Qué tiene que pasar para marcarla hecha. */
  criterio: string
  /** Semana del ciclo de 2 meses (1 a 8). */
  semana: number
  /** Semana del ciclo de 1 mes (1 a 4), o null si queda fuera de ese ciclo. */
  semana1m: number | null
  /** Key de la entrada (entradas.ts) que documenta una tarea hecha en sesión. */
  auditoria?: string
}

export interface PlanModulo {
  modulo: ConPlan
  nombre: string
  responsable: Persona
  foco: string
  /** El título de cada semana del ciclo de 2 meses, en orden (1 a 8). */
  semanas: string[]
  /** El de las 4 semanas del ciclo de 1 mes: la 3 y la 4 absorben tareas de la 5 a la 8. */
  semanas1m: string[]
  tareas: Tarea[]
}

const DIA_MS = 86_400_000
function utc(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

// Semana del ciclo de 2 meses a la que pertenece una fecha (1 = la del 26/10).
export function semanaDelCiclo(dia: string): number {
  return Math.floor((utc(dia) - utc(CICLO.inicio)) / (7 * DIA_MS)) + 1
}

type Borrador = Omit<Tarea, 'id'>

// Una tarea. La semana sale de la fecha para que nunca queden desfasadas. En
// el ciclo de 1 mes, las semanas 1 a 4 quedan iguales y las 5 a 8 se
// comprimen a la semana 4 (el cierre) salvo que se diga otra cosa: null la
// saca del ciclo, 3 la adelanta.
function t(dia: string, quien: Persona, texto: string, criterio: string, semana1m?: number | null): Borrador {
  const semana = semanaDelCiclo(dia)
  const s1m = semana1m !== undefined ? semana1m : semana <= 4 ? semana : 4
  return { texto, dia, quien, criterio, semana, semana1m: s1m }
}

// Una tarea que ya se hizo en sesión, con la key de la entrada que la
// documenta (entradas.ts). Nace igual sin tildar.
function documentada(tarea: Borrador, auditoria: string): Borrador {
  return { ...tarea, auditoria }
}

// `semanas`: el título de cada semana del ciclo de 2 meses, en orden (1 a 8);
// `semanas1m`, el de las 4 del ciclo de 1 mes.
function plan(modulo: ConPlan, nombre: string, responsable: Persona, foco: string, semanas: string[], semanas1m: string[], tareas: Borrador[]): PlanModulo {
  return { modulo, nombre, responsable, foco, semanas, semanas1m, tareas: tareas.map((x, i) => ({ id: `t${i + 1}`, ...x })) }
}

const TUR = (slug: string) => `auditoria.turnos.2026-10-26-${slug}`
const ALQ = (slug: string) => `auditoria.alquileres.2026-10-26-${slug}`
const GIM = (slug: string) => `auditoria.gimnasio.2026-10-26-${slug}`
// Las del rediseño de los paneles que se terminó el 27/10 (Turnos-2, Gimnasio-2 y el kit).
const TUR27 = (slug: string) => `auditoria.turnos.2026-10-27-${slug}`
const GIM27 = (slug: string) => `auditoria.gimnasio.2026-10-27-${slug}`
// Las del backend compartido de reservas (03/11).
const GIM3 = (slug: string) => `auditoria.gimnasio.2026-11-03-${slug}`

// ─── Turnos · Mateo ───────────────────────────────────────────────────────────
const TURNOS = plan('turnos', 'Turnos', 'Mateo',
  'Plan diario de Turnos del ciclo 26/10 al 18/12: borrar el backend viejo, mover canchas y clases a sus módulos, panel minimalista y storefront responsive, y desde el 03/11 conectar el panel y el sitio al backend compartido de reservas (apps/api/src/reservas). Cada tarea se marca hecha con su entrada de auditoría.',
  [
    'Borrar el backend y consolidar shared',
    'Rubros movidos a Alquileres y Gimnasio',
    'Panel y storefront sobre el backend compartido',
    'Correcciones y revisión cruzada',
    'Turnos en el alta única',
    'Pulido de panel y storefront',
    'QA responsive',
    'Correcciones, auditoría y cierre',
  ],
  [
    'Borrar el backend y consolidar shared',
    'Rubros movidos a Alquileres y Gimnasio',
    'Panel y storefront sobre el backend compartido, y Turnos en el alta única',
    'Correcciones, pulido, QA y cierre',
  ],
  [
    // Semana 1 · borrar el backend y consolidar shared
    documentada(t('2026-10-26', 'Mateo', 'Inventariar el backend de Turnos (appointments) y todo lo que lo importa', 'Lista de archivos y referencias de apps/api a borrar, anotada en la entrada de auditoría de la tarea'), TUR('backend-borrado')),
    documentada(t('2026-10-27', 'Mateo', 'Borrar el módulo appointments de la API con sus DTOs, tests y rutas', 'pnpm typecheck y pnpm test:unit en verde; ninguna ruta /appointments responde'), TUR('backend-borrado')),
    documentada(t('2026-10-28', 'Mateo', 'Limpiar el código muerto de Turnos en apps/web (hooks, componentes y mocks sin uso)', 'eslint sin variables sin usar y tsc --noEmit en verde en modules/turnos'), TUR('codigo-muerto')),
    documentada(t('2026-10-29', 'Mateo', 'Consolidar _shared/ y shared/ de Turnos en una sola carpeta con un index', 'Queda una sola carpeta shared/ y todos los imports de Turnos apuntan ahí'), TUR('codigo-muerto')),
    documentada(t('2026-10-30', 'Mateo', 'Recorrer Turnos de punta a punta después de la limpieza', '/turnos-demo abre sin errores en consola y se pasa por alta, agenda y reserva'), TUR('qa-responsive-turnos')),
    // Semana 2 · rubros movidos
    documentada(t('2026-11-02', 'Mateo', 'Sacar el rubro canchas de Turnos y derivarlo a Alquileres modo cancha', 'El selector de rubro de Turnos no ofrece canchas y el alta manda a Alquileres'), TUR('rubros-fuera-de-turnos')),
    documentada(t('2026-11-03', 'Mateo', 'Sacar las clases con cupo de Turnos y derivarlas a Gimnasio', 'Sin lógica de cupo en modules/turnos; el alta manda a Gimnasio'), TUR('rubros-fuera-de-turnos')),
    documentada(t('2026-11-04', 'Mateo', 'Borrar plantillas y datos de ejemplo de los rubros que se fueron', 'Ningún mock de canchas ni de clases en modules/turnos; tsc en verde'), TUR('rubros-fuera-de-turnos')),
    t('2026-11-05', 'Mateo', 'Revisar los rubros que quedan en Turnos (peluquería, consultorio, estética, taller)', 'Cada rubro abre con su plantilla y sus horarios por defecto correctos'),
    documentada(t('2026-11-06', 'Mateo', 'Registrar la limpieza de Turnos en Auditoría con el árbol de carpetas antes y después', 'Entrada tipo tarea con los archivos tocados y las dos capturas del árbol'), TUR('codigo-muerto')),
    // Semana 3 · panel minimalista y storefront responsive
    t('2026-11-09', 'Mateo', 'Panel de Turnos: la agenda del día como pantalla principal', 'Al entrar se ve la agenda de hoy con turnos y huecos, sin tarjetas de más'),
    t('2026-11-10', 'Mateo', 'Panel de Turnos: alta rápida de un turno desde la agenda', 'Un turno se carga en menos de cinco toques desde la agenda, con cliente y servicio'),
    documentada(t('2026-11-11', 'Mateo', 'Storefront de Turnos: elegir servicio, profesional y horario a 390 px', 'Flujo completo en celular sin scroll horizontal y con botones de 44 px'), TUR('qa-responsive-turnos')),
    documentada(t('2026-11-12', 'Mateo', 'Storefront de Turnos: confirmación y Mis turnos responsive', 'Confirmación y lista de turnos legibles a 390, 768 y 1280'), TUR('qa-responsive-turnos')),
    documentada(t('2026-11-13', 'Mateo', 'Pasada de modo oscuro del panel y del storefront de Turnos', 'Ningún color fijo: todo con tokens --color-* y contraste AA en oscuro'), TUR27('contraste-aa-y-chat-neutro')),
    // Semana 4 · correcciones y revisión cruzada
    documentada(t('2026-11-17', 'Mateo', 'Corregir lo que dejó la pasada responsive de Turnos', 'Sin pendientes abiertos en la entrada de auditoría del 13/11'), TUR('qa-responsive-turnos')),
    t('2026-11-19', 'Mateo', 'Revisión cruzada: reservar una cancha en Alquileres como cliente y anotar fallas', 'Fallas registradas como entrada de auditoría en Alquileres, con pasos para reproducir'),
    // Semana 5 · Turnos en el alta única
    t('2026-11-24', 'Mateo', 'Turnos en el alta única: paso de rubro y plantilla', 'El alta única crea un negocio de Turnos con su plantilla y horarios', 3),
    t('2026-11-26', 'Mateo', 'Datos de demo prolijos para Turnos (servicios, profesionales, horarios)', 'Un negocio de demo con tres servicios y dos profesionales, sin textos de relleno'),
    // Semana 6 · pulido
    documentada(t('2026-11-30', 'Mateo', 'Pulido del panel de Turnos: agenda, estados y pantallas vacías', 'Cada estado de un turno tiene color y texto propios; los vacíos explican qué hacer'), TUR27('contraste-aa-y-chat-neutro')),
    documentada(t('2026-12-01', 'Mateo', 'Pulido del panel de Turnos: clientes y horarios de trabajo', 'Se edita el horario semanal y los feriados sin salir del panel'), TUR27('recordatorios-hoy-y-ficha-con-historial')),
    t('2026-12-02', 'Mateo', 'Pulido del storefront de Turnos: textos, errores y estados de carga', 'Ningún error crudo de la API llega a la pantalla; carga con esqueletos'),
    t('2026-12-03', 'Mateo', 'Pulido del storefront de Turnos: oscuro y tablet', 'Pasada a 768 px y en oscuro sin colores fijos ni cortes'),
    documentada(t('2026-12-04', 'Mateo', 'Entrada de auditoría del pulido de Turnos con antes y después', 'Entrada tipo diseño con las capturas de antes y después del panel y la tienda'), TUR('todo-en-el-sidebar')),
    // Semana 7 · QA responsive
    documentada(t('2026-12-07', 'Mateo', 'QA de Turnos a 390 px (panel y storefront)', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'), TUR27('qa-rediseno')),
    documentada(t('2026-12-08', 'Mateo', 'QA de Turnos a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'), TUR27('qa-rediseno')),
    documentada(t('2026-12-09', 'Mateo', 'QA de Turnos a 1280 px', 'Lista de fallas a 1280 px registrada en Auditoría'), TUR27('qa-rediseno')),
    documentada(t('2026-12-10', 'Mateo', 'Correcciones de la QA de Turnos', 'Todas las fallas de las tres pasadas cerradas o registradas como decisión'), TUR27('qa-rediseno')),
    t('2026-12-11', 'Mateo', 'Capturas de la QA de Turnos para el documento', 'Una captura por pantalla en los tres anchos, subidas y enlazadas en la entrada'),
    // Semana 8 · cierre
    t('2026-12-14', 'Mateo', 'Correcciones finales de Turnos', 'Sin fallas abiertas en las entradas de auditoría de Turnos'),
    t('2026-12-15', 'Mateo', 'Auditoría completa de Turnos: entradas al día y archivos tocados', 'Toda tarea hecha tiene su entrada y cada entrada lista sus archivos'),
    t('2026-12-16', 'Mateo', 'Capturas finales de Turnos para el documento del sistema', 'Capturas finales del panel y del storefront enlazadas en la última entrada'),
    t('2026-12-17', 'Mateo', 'Cierre de Turnos: resumen del ciclo y entrega a Ale', 'Entrada de cierre con lo hecho, lo que quedó afuera y lo que sigue'),
    // Sumadas el 03/11: Turnos sobre el backend compartido de reservas (apps/api/src/reservas, cliente en lib/reservasApi).
    t('2026-11-10', 'Mateo', 'Turnos sobre el backend compartido: Servicios, Equipo y Espacios leen y escriben /reservas (recursos PROFESIONAL y ESPACIO, servicios)', 'Un servicio y un profesional creados desde el panel aparecen en GET /reservas/servicios y /reservas/recursos; la config del módulo existe (PUT /reservas/config)'),
    t('2026-11-11', 'Mateo', 'Turnos sobre el backend compartido: la agenda y Nuevo turno usan /reservas (crear, mover, cancelar, cobrar) y la disponibilidad del panel', 'Dos turnos pisados desde dos pestañas: el segundo muestra el 409 de la API tal cual y la agenda lo ve ocupado al recargar'),
    t('2026-11-12', 'Mateo', 'Turnos sobre el backend compartido: el sitio reserva con retener + confirmar, con la cuenta regresiva de la retención', 'Un turno elegido y abandonado se libera solo al vencer la retención; uno confirmado llega por email con su enlace'),
    t('2026-11-13', 'Mateo', 'Turnos: la página /mi-turno/<token> del sitio (ver, cancelar y reprogramar según la política del negocio)', 'El enlace del email abre la reserva; cancelar fuera del plazo muestra el motivo que manda la API y no un error crudo'),
  ])

// ─── Alquileres · Alan ────────────────────────────────────────────────────────
const ALQUILERES = plan('alquileres', 'Alquileres', 'Alan',
  'Plan diario de Alquileres del ciclo 26/10 al 18/12: alta con paso de tipo, modo cancha, modo bloque, estadía (si entra en el ciclo), panel y calendarios .ics, y desde el 03/11 canchas, salones y estadías sobre el backend compartido de reservas. Cada tarea se marca hecha con su entrada de auditoría.',
  [
    'Lectura y diseño del alta',
    'Alta y modo cancha',
    'Modo bloque',
    'Checkpoint, backend compartido y estadía, parte 1',
    'Estadía, parte 2',
    'Panel y calendarios .ics',
    'QA responsive',
    'Correcciones, auditoría y cierre',
  ],
  [
    'Lectura y diseño del alta',
    'Alta y modo cancha',
    'Modo bloque',
    'Checkpoint, panel, QA y cierre',
  ],
  [
    // Semana 1 · lectura y diseño del alta
    t('2026-10-29', 'Alan', 'Leer la lib de reservas y el módulo Alquileres actual; anotar dudas', 'Dudas y propuesta de modelo anotadas en la entrada de auditoría'),
    documentada(t('2026-10-30', 'Alan', 'Diseñar el alta de Alquileres: paso de tipo (cancha, bloque o estadía)', 'Boceto del paso de tipo aprobado por Ale antes del lunes'), ALQ('alta-de-alquileres')),
    // Semana 2 · alta y modo cancha
    documentada(t('2026-11-02', 'Alan', 'Alta de Alquileres: paso de tipo (cancha, bloque o estadía)', 'El alta pregunta el tipo y lo guarda; en /alquileres-demo se ve el paso'), ALQ('alta-de-alquileres')),
    documentada(t('2026-11-03', 'Alan', 'Modo cancha: canchas con duración del turno y precio', 'Se cargan dos canchas con duración y precio distintos y se listan en la tienda'), ALQ('modo-cancha')),
    documentada(t('2026-11-04', 'Alan', 'Modo cancha: grilla de horarios con disponibilidad (lib/reservas/disponibilidad)', 'La grilla no ofrece turnos solapados; tests de la lib en verde'), ALQ('modo-cancha')),
    documentada(t('2026-11-05', 'Alan', 'Modo cancha: reserva desde la tienda con confirmación', 'Se reserva una cancha a una hora y aparece en Mis reservas'), ALQ('modo-cancha')),
    documentada(t('2026-11-06', 'Alan', 'Modo cancha: pasada a 390 px y entrada de auditoría', 'Sin scroll horizontal a 390 px; entrada tipo tarea con capturas'), ALQ('qa-responsive-alquileres')),
    // Semana 3 · modo bloque
    documentada(t('2026-11-09', 'Alan', 'Modo bloque: el salón como recurso con bloques de horas y precio', 'Un salón con bloques de mañana, tarde y noche, cada uno con su precio'), ALQ('modo-bloque')),
    documentada(t('2026-11-10', 'Alan', 'Modo bloque: calendario mensual con bloques libres y ocupados', 'El calendario marca el día con bloques libres y no deja elegir un ocupado'), ALQ('modo-bloque')),
    documentada(t('2026-11-11', 'Alan', 'Modo bloque: reserva con seña y datos del evento', 'La reserva guarda fecha, bloque, seña y datos del festejo, y aparece en Mis reservas'), ALQ('modo-bloque')),
    documentada(t('2026-11-12', 'Alan', 'Modo bloque: política de cancelación y mail de confirmación (stub)', 'La política se muestra antes de confirmar y el mail sale en modo STUB en local'), ALQ('modo-bloque')),
    documentada(t('2026-11-13', 'Alan', 'Modo bloque: pasada a 390 px, oscuro y entrada de auditoría', 'Sin colores fijos ni scroll horizontal; entrada tipo tarea con capturas'), ALQ('qa-responsive-alquileres')),
    // Semana 4 · checkpoint y estadía parte 1 (fuera del ciclo de 1 mes)
    t('2026-11-16', 'Ale', 'Checkpoint: ¿la estadía entra en este ciclo?', 'Decisión registrada en la auditoría de Alquileres y horizonte elegido en Módulos'),
    documentada(t('2026-11-17', 'Alan', 'Estadía parte 1: el alojamiento como recurso con noches mínimas y horarios de check-in y check-out', 'Se carga un alojamiento con noches mínimas y horarios; se ve en la tienda', null), ALQ('modo-estadia')),
    documentada(t('2026-11-18', 'Alan', 'Estadía parte 1: cálculo de noches y precio (lib/reservas/estadia)', 'El total coincide con los tests de la lib para tres rangos distintos', null), ALQ('modo-estadia')),
    documentada(t('2026-11-19', 'Alan', 'Estadía parte 1: disponibilidad por rango de noches', 'Un rango que pisa una reserva existente no se puede elegir', null), ALQ('modo-estadia')),
    documentada(t('2026-11-20', 'Alan', 'Estadía parte 1: reserva base desde la tienda', 'Se reserva un rango de noches y aparece en Mis reservas', null), ALQ('modo-estadia')),
    // Semana 5 · estadía parte 2 (fuera del ciclo de 1 mes)
    documentada(t('2026-11-23', 'Alan', 'Estadía parte 2: selector de rango de fechas con dos calendarios', 'El rango se elige con dos toques y respeta las noches mínimas', null), ALQ('modo-estadia')),
    documentada(t('2026-11-24', 'Alan', 'Estadía parte 2: temporadas con precio por noche', 'Un rango que cruza dos temporadas cobra cada noche a su precio', null), ALQ('modo-estadia')),
    t('2026-11-25', 'Alan', 'Estadía parte 2: exportar la reserva como .ics (lib/reservas/ics)', 'El .ics abre en Google Calendar con las fechas y el nombre correctos', null),
    documentada(t('2026-11-26', 'Alan', 'Estadía parte 2: Mis reservas con rango y cancelación', 'La reserva muestra el rango y se cancela según la política', null), ALQ('modo-estadia')),
    documentada(t('2026-11-27', 'Alan', 'Estadía parte 2: pasada responsive y entrada de auditoría', 'Selector y confirmación legibles a 390, 768 y 1280; entrada con capturas', null), ALQ('qa-responsive-alquileres')),
    // Semana 6 · panel y calendarios .ics
    documentada(t('2026-11-30', 'Alan', 'Panel de Alquileres: reservas del día y de la semana', 'Al entrar se ven las reservas de hoy y de la semana por recurso'), ALQ('todo-en-el-sidebar')),
    documentada(t('2026-12-01', 'Alan', 'Panel de Alquileres: clientes e ingresos', 'Lista de clientes con sus reservas e ingresos por mes y por recurso'), ALQ('ingresos-tablero')),
    documentada(t('2026-12-02', 'Alan', 'Panel de Alquileres: configuración de recursos y precios', 'Se editan recursos, precios y políticas sin salir del panel'), ALQ('secciones-nuevas')),
    t('2026-12-03', 'Alan', 'Calendarios .ics: suscripción por recurso desde el panel', 'Cada recurso tiene un link .ics que Google Calendar acepta y actualiza'),
    t('2026-12-04', 'Alan', 'Calendarios .ics probados en Google y Apple; entrada de auditoría', 'Las reservas se ven en los dos calendarios; entrada con capturas'),
    // Semana 7 · QA responsive
    documentada(t('2026-12-07', 'Alan', 'QA de Alquileres a 390 px (panel y tienda)', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'), ALQ('qa-rediseno')),
    documentada(t('2026-12-08', 'Alan', 'QA de Alquileres a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'), ALQ('qa-rediseno')),
    documentada(t('2026-12-09', 'Alan', 'QA de Alquileres a 1280 px', 'Lista de fallas a 1280 px registrada en Auditoría'), ALQ('qa-rediseno')),
    t('2026-12-10', 'Alan', 'Correcciones de la QA de Alquileres', 'Todas las fallas de las tres pasadas cerradas o registradas como decisión'),
    t('2026-12-11', 'Alan', 'Capturas de la QA de Alquileres para el documento', 'Una captura por pantalla en los tres anchos, enlazadas en la entrada'),
    // Semana 8 · cierre
    t('2026-12-14', 'Alan', 'Correcciones finales de Alquileres', 'Sin fallas abiertas en las entradas de auditoría de Alquileres'),
    t('2026-12-15', 'Alan', 'Auditoría completa de Alquileres: entradas al día y archivos tocados', 'Toda tarea hecha tiene su entrada y cada entrada lista sus archivos'),
    t('2026-12-16', 'Alan', 'Capturas finales de Alquileres para el documento del sistema', 'Capturas finales del panel y de la tienda enlazadas en la última entrada'),
    t('2026-12-17', 'Alan', 'Cierre de Alquileres: resumen del ciclo y entrega a Ale', 'Entrada de cierre con lo hecho, lo que quedó afuera (la estadía, si no entró) y lo que sigue'),
    // Sumadas el 03/11: Alquileres sobre el backend compartido de reservas.
    t('2026-11-17', 'Alan', 'Alquileres sobre el backend compartido: canchas y salones leen /reservas (franjas seguidas, bloques con margen de limpieza)', 'La grilla de una cancha sale de GET disponibilidad y ofrece hasta maximoSeguidos franjas; un salón ofrece sus bloques desde el horario del recurso'),
    t('2026-11-18', 'Alan', 'Alquileres sobre el backend compartido: estadías con disponibilidad/noches, fechaHasta y las noches mínimas del recurso', 'Un rango que pisa una reserva no se puede elegir y el total por noches coincide con el precio que devuelve la API'),
    t('2026-11-19', 'Alan', 'Alquileres: la página /mi-reserva/<token> del sitio y Mis reservas sobre /mi/:token', 'Desde el enlace del email se ve, se cancela y se reprograma según la política del negocio, con sus mensajes'),
    t('2026-11-20', 'Alan', 'Alquileres: Bloquear, Reservas e Ingresos del panel sobre /reservas (bloqueos, agenda, pago y /resumen)', 'Un bloqueo avisa cuántas reservas quedaron adentro; Ingresos muestra lo cobrado del mes según /resumen'),
  ])

// ─── Gimnasio · Ale (más lo transversal) ──────────────────────────────────────
const GIMNASIO = plan('gimnasio', 'Gimnasio', 'Ale',
  'Plan diario de Gimnasio del ciclo 26/10 al 18/12: grilla de clases con cupo, planes y socios, check-in, página pública, panel e ingresos, y desde el 03/11 las clases sobre el backend compartido. Lleva además lo transversal de Ale: lib de reservas, sección Módulos, alta única, el backend compartido de reservas y cierre del ciclo.',
  [
    'Lib de reservas y esqueleto de Módulos',
    'Backend compartido, grilla de clases y reserva de lugar',
    'Pases, planes y socios',
    'Backend compartido en Gimnasio, check-in y página pública',
    'Alta única con los cuatro módulos',
    'Panel e ingresos',
    'QA responsive',
    'Correcciones, auditoría y cierre',
  ],
  [
    'Lib de reservas y esqueleto de Módulos',
    'Backend compartido, grilla de clases y reserva de lugar',
    'Pases, planes, socios y alta única',
    'Check-in, página pública, panel, QA y cierre',
  ],
  [
    // Semana 1 · lib de reservas y esqueleto de Módulos
    documentada(t('2026-10-26', 'Ale', 'Transversal: lib de reservas, fechas y solapamiento (lib/reservas/fechas y solapamiento)', 'Tests de vitest en verde; funciones puras sin DOM ni fetch'), GIM('lib-reservas')),
    documentada(t('2026-10-27', 'Ale', 'Transversal: lib de reservas, disponibilidad y precio', 'Tests en verde para huecos, cupos y precios por franja'), GIM('lib-reservas')),
    documentada(t('2026-10-28', 'Ale', 'Transversal: lib de reservas, estadía y .ics', 'Tests en verde para noches, temporadas y un .ics válido'), GIM('lib-reservas')),
    documentada(t('2026-10-29', 'Ale', 'Transversal: esqueleto de la sección Módulos del superadmin (tarjetas, plan, auditoría y resumen)', 'La pestaña Módulos abre con las cuatro tarjetas y el plan de cada módulo'), GIM('seccion-modulos')),
    documentada(t('2026-10-30', 'Ale', 'Transversal: datos del plan y primera entrada de auditoría por módulo', 'La sección Módulos muestra los tres planes y cada módulo tiene al menos una entrada'), GIM('seccion-modulos')),
    // Semana 2 · grilla de clases y reserva de lugar
    documentada(t('2026-11-02', 'Ale', 'Gimnasio: modelo de clase (disciplina, profe, cupo y horario semanal)', 'Se cargan tres clases con cupo y horario y se listan en la demo'), GIM('grilla-y-reserva')),
    documentada(t('2026-11-03', 'Ale', 'Gimnasio: grilla semanal de clases en la tienda', 'La grilla muestra la semana con el cupo libre de cada clase, legible a 390 px'), GIM('grilla-y-reserva')),
    documentada(t('2026-11-04', 'Ale', 'Gimnasio: reservar un lugar en una clase con cupo (lib/reservas)', 'Con el cupo lleno no se puede reservar; la reserva aparece en Mis clases'), GIM('grilla-y-reserva')),
    documentada(t('2026-11-05', 'Ale', 'Gimnasio: lista de espera y cancelación del lugar', 'Al cancelar, el primero de la lista de espera toma el lugar'), GIM('grilla-y-reserva')),
    documentada(t('2026-11-06', 'Ale', 'Gimnasio: pasada a 390 px de la grilla y entrada de auditoría', 'Sin scroll horizontal; entrada tipo tarea con capturas'), GIM('qa-responsive-gimnasio')),
    // Semana 3 · pases, planes y socios
    documentada(t('2026-11-09', 'Ale', 'Gimnasio: planes (mensual, pase libre y por cantidad de clases)', 'Los tres tipos de plan se crean y se muestran con su precio'), GIM('planes')),
    documentada(t('2026-11-10', 'Ale', 'Gimnasio: socios con plan vigente y vencimiento', 'Un socio tiene plan, fecha de vencimiento y estado al día o vencido'), GIM('socios-vencimientos')),
    documentada(t('2026-11-11', 'Ale', 'Gimnasio: pases por clase que se descuentan al reservar', 'Reservar descuenta un pase y sin pases no deja reservar'), GIM('planes')),
    documentada(t('2026-11-12', 'Ale', 'Gimnasio: renovación del plan y aviso de vencimiento (mail en stub)', 'Renovar extiende el vencimiento; el aviso sale en modo STUB en local'), GIM('socios-vencimientos')),
    documentada(t('2026-11-13', 'Ale', 'Gimnasio: pasada responsive de planes y socios; entrada de auditoría', 'Planes y socios legibles a 390, 768 y 1280; entrada con capturas'), GIM('qa-responsive-gimnasio')),
    // Semana 4 · check-in y página pública
    documentada(t('2026-11-16', 'Ale', 'Gimnasio: check-in del socio desde el panel', 'Se busca un socio por nombre y se registra su ingreso con fecha y hora'), GIM('check-in-y-pagina-publica')),
    t('2026-11-17', 'Ale', 'Gimnasio: el check-in avisa si el plan está vencido', 'Con plan vencido el check-in muestra el aviso y ofrece renovar'),
    documentada(t('2026-11-18', 'Ale', 'Gimnasio: página pública con horarios, planes y cómo llegar', 'La página carga sin sesión y muestra grilla, planes y dirección'), GIM('check-in-y-pagina-publica')),
    t('2026-11-19', 'Ale', 'Gimnasio: página pública responsive y en oscuro', 'Sin colores fijos ni scroll horizontal a 390, 768 y 1280'),
    t('2026-11-20', 'Ale', 'Transversal: checkpoint de mitad de ciclo en Módulos (semáforos y atrasos)', 'Semáforo de cada módulo revisado; atrasos reasignados o registrados como decisión'),
    // Semana 5 · alta única (en el ciclo de 1 mes va a la semana 3)
    documentada(t('2026-11-23', 'Ale', 'Transversal: alta única, paso de módulo (Tienda, Turnos, Gimnasio o Alquileres)', 'El alta arranca eligiendo el módulo y recuerda la elección', 3), GIM('alta-unica')),
    documentada(t('2026-11-24', 'Ale', 'Transversal: alta única, rubro y plantilla según el módulo', 'Cada módulo ofrece sus rubros y su plantilla por defecto', 3), GIM('alta-unica')),
    documentada(t('2026-11-25', 'Ale', 'Transversal: alta única, pago y creación del negocio con el módulo elegido', 'Un alta de prueba por módulo crea el negocio con el módulo correcto', 3), GIM('alta-unica')),
    documentada(t('2026-11-26', 'Ale', 'Transversal: alta única a 390 px y en oscuro', 'Sin scroll horizontal ni colores fijos en los cuatro caminos', 3), GIM('alta-unica')),
    documentada(t('2026-11-27', 'Ale', 'Transversal: entrada de auditoría del alta única con antes y después', 'Entrada tipo diseño con capturas del alta vieja y la nueva', 3), GIM('alta-paso-modulo')),
    // Semana 6 · panel e ingresos
    documentada(t('2026-11-30', 'Ale', 'Gimnasio: panel con las clases de hoy y su ocupación', 'Al entrar se ven las clases de hoy con cupo usado y lista de espera'), GIM('clases-como-listado')),
    documentada(t('2026-12-01', 'Ale', 'Gimnasio: ingresos por plan y por mes', 'Ingresos del mes por tipo de plan, con comparación contra el mes anterior'), GIM27('ingresos-comparaciones-honestas')),
    documentada(t('2026-12-02', 'Ale', 'Gimnasio: socios vencidos y por vencer en el panel', 'Lista de socios por vencer en siete días y vencidos, con acción de renovar'), GIM('alumnos')),
    documentada(t('2026-12-03', 'Ale', 'Gimnasio: configuración (horarios, disciplinas y profesionales)', 'Se editan horarios, disciplinas y profes sin salir del panel'), GIM('secciones-nuevas')),
    documentada(t('2026-12-04', 'Ale', 'Gimnasio: pasada responsive del panel; entrada de auditoría', 'Panel legible a 390, 768 y 1280; entrada con capturas'), GIM27('qa-rediseno')),
    // Semana 7 · QA responsive
    documentada(t('2026-12-07', 'Ale', 'QA de Gimnasio a 390 px (panel y tienda)', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'), GIM27('qa-rediseno')),
    documentada(t('2026-12-08', 'Ale', 'QA de Gimnasio a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'), GIM27('qa-rediseno')),
    documentada(t('2026-12-09', 'Ale', 'QA de Gimnasio a 1280 px', 'Lista de fallas a 1280 px registrada en Auditoría'), GIM27('qa-rediseno')),
    t('2026-12-10', 'Ale', 'Transversal: QA responsive del superadmin (Módulos y Auditoría) a 390, 768 y 1280', 'Tarjetas en una columna y tablas como listas a 390 px; sin scroll horizontal'),
    documentada(t('2026-12-11', 'Ale', 'Correcciones de la QA de Gimnasio', 'Todas las fallas de las tres pasadas cerradas o registradas como decisión'), GIM27('qa-rediseno')),
    // Semana 8 · cierre
    t('2026-12-14', 'Ale', 'Correcciones finales de Gimnasio', 'Sin fallas abiertas en las entradas de auditoría de Gimnasio'),
    t('2026-12-15', 'Ale', 'Auditoría completa de Gimnasio: entradas al día y archivos tocados', 'Toda tarea hecha tiene su entrada y cada entrada lista sus archivos'),
    t('2026-12-16', 'Ale', 'Capturas finales de Gimnasio para el documento del sistema', 'Capturas finales del panel y de la tienda enlazadas en la última entrada'),
    t('2026-12-17', 'Ale', 'Transversal: cierre del ciclo en Módulos (resumen por módulo y decisiones)', 'Los tres módulos con su entrada de cierre y el resumen sin atrasos sin explicar'),
    t('2026-12-18', 'Ale', 'Transversal: retro del ciclo y plan del siguiente', 'Retro registrada en Auditoría y plan del próximo ciclo cargado en modules/superadmin/modulos/plan.ts'),
    // Sumadas el 03/11: el backend compartido de reservas (hecho en sesión) y Gimnasio sobre él.
    documentada(t('2026-11-02', 'Ale', 'Transversal: merge de origin/main en la rama de los módulos (139 commits) y typecheck de la web en Windows', 'La rama contiene origin/main, typecheck de web y api en verde, tests de la web en verde'), GIM3('merge-con-main')),
    documentada(t('2026-11-02', 'Ale', 'Transversal: backend compartido de reservas, modelo y migración (tablas reservas_*, restricción de exclusión, RLS y permisos)', 'Migración aplicada en dev, prisma validate en verde, las siete tablas con RLS y los tres permisos repartidos'), GIM3('backend-compartido-de-reservas')),
    documentada(t('2026-11-03', 'Ale', 'Transversal: backend compartido de reservas, el motor (candado por recurso, retenciones que vencen, cancelación con lista de espera, reprogramación) y sus tests', 'Unitarios y e2e en verde contra dev: seis pedidos simultáneos entran uno; ocho personas por tres lugares entran tres'), GIM3('backend-compartido-de-reservas')),
    documentada(t('2026-11-03', 'Ale', 'Transversal: rutas del panel y del sitio de reservas, cliente tipado en lib/reservasApi y contrato en el README del módulo', 'Las rutas de /reservas y /storefront/:slug/reservas responden; lib/reservasApi compila y sus tests pasan; el README dice cómo las usa cada módulo'), GIM3('backend-compartido-de-reservas')),
    t('2026-11-04', 'Ale', 'Transversal: desplegar el backend compartido de reservas (migración en producción y deploy.sh), cuando Ale lo decida', 'Migración 20261103120000_reservas aplicada en producción con prisma-prod.sh y Cloud Run sirviendo la revisión que responde /reservas'),
    t('2026-11-16', 'Ale', 'Gimnasio sobre el backend compartido: las clases con cupo como recursos CLASE con sus sesiones en el horario', 'Las clases del panel se crean con POST/PUT de /reservas/recursos y la grilla del sitio sale de GET disponibilidad con cupo y libres'),
    t('2026-11-17', 'Ale', 'Gimnasio sobre el backend compartido: reservar un lugar con cantidad y la lista de espera con /espera', 'Con la clase llena el sitio ofrece la lista de espera; al cancelar uno, el primero toma el lugar y recibe su email'),
    t('2026-11-18', 'Ale', 'Gimnasio: la página /mi-clase/<token> del sitio y Mis clases sobre /mi/:token', 'Desde el enlace del email se ve y se cancela el lugar según la política del negocio'),
    t('2026-11-19', 'Ale', 'Gimnasio: Clases e Ingresos del panel sobre /reservas y /resumen', 'Las clases de hoy con su ocupación y la lista de espera salen de la API; Ingresos muestra lo cobrado según /resumen'),
    t('2026-12-01', 'Ale', 'Transversal: cobro online de la seña con Mercado Pago sobre /reservas (si Ale lo decide)', 'Una reserva con seña se paga con MP y el webhook la deja CONFIRMADA; sin MP conectado se registra a mano como hoy'),
    t('2026-12-02', 'Ale', 'Transversal: recordatorios del día anterior colgados del cron de las 22 h y avisos de reservas en la campanita del panel', 'El recordatorio sale una sola vez por reserva (idempotente por email_logs) y una reserva nueva aparece en la campanita'),
    documentada(t('2026-11-04', 'Ale', 'Transversal: el kit toma el Kpi con variación, useBorrador + BarraGuardar y la cabecera del Modal; las copias de los tres módulos se borran', 'Un solo Kpi, una sola barra y un solo Modal en design-system/reservas; eslint sin imports cruzados; las pantallas se ven igual (capturas antes y después)'), GIM3('kit-kpi-guardar-modal')),
  ])

export const PLANES: PlanModulo[] = [TURNOS, ALQUILERES, GIMNASIO]

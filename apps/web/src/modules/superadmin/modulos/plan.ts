// Plan diario de los módulos nuevos de Órbita (super admin → Módulos).
//
// Módulos es solo visual (pedido de Ale, 26/10/2026: "solo visual, nada de
// backend"): el plan vive acá, en el código, y lo que cada uno tilda queda en
// su navegador (estado.ts). No hay API ni base de datos detrás.
//
// CICLO 2 (pedido de Ale, 04/11/2026: "la idea es que empecemos todo limpios,
// ya cada uno con su módulo; se empieza a partir de mañana"). Arranca el
// jueves 05/11/2026 y termina el miércoles 23/12/2026 (2 meses) o el viernes
// 27/11/2026 (1 mes). El ciclo 1 (26/10 al 04/11) quedó cerrado: los tres
// paneles están al estándar de Órbita, el kit unificado, el backend compartido
// de reservas en producción y las demos corren con datos del navegador. Todo
// eso está en la pestaña Auditoría como historial; acá ninguna tarea nace
// documentada ni tildada. Lo que se tilde en el navegador va a una clave nueva
// (estado.ts), así lo marcado en el ciclo 1 no se mezcla.
//
// Un plan por módulo: Turnos (Mateo), Alquileres (Alan) y Gimnasio (Ale).
// Tienda no lleva plan porque ya está en producción. El trabajo del ciclo es
// el mismo para los tres, cada uno en su módulo: conectar el panel y el sitio
// al motor de reservas compartido (apps/api/src/reservas, por lib/reservasApi),
// que el alta real cree un negocio de verdad, QA con datos reales y la
// propuesta para salir de "Próximamente". Lo transversal de Ale (Módulos, alta
// única, cobro, recordatorios, cierre) va en el plan de Gimnasio con el
// prefijo "Transversal: ", porque Gimnasio es su módulo.
//
// Cada tarea es diaria, con día, quién la hace, criterio de listo y la semana
// del ciclo a la que pertenece en los dos horizontes. Las semanas van de lunes
// a viernes; la primera es corta (jueves y viernes) y la última también (lunes
// a miércoles, antes de Navidad). Sin tareas los feriados: 20/11 y 08/12.
//
// Una lista de tareas por módulo y no una por semana: al pasar al horizonte de
// 1 mes las tareas se reagrupan en otras semanas, y lo tildado se guarda por
// tarea, así cambiar de horizonte no pierde nada. En el de 1 mes las semanas 1
// a 4 son iguales, la estadía de Alquileres queda afuera (semana1m: null), las
// semanas 5 y 6 van a la 3 y las 7 y 8 a la 4. La fecha en el ciclo de 1 mes
// es el lunes de `semana1m` más el día de la semana de la tarea.
//
// Una tarea se tilda solo con su entrada de auditoría (entradas.ts). Cuando
// algo se hace en sesión, la tarea se envuelve con documentada(): nace con la
// key de su entrada pero sin tildar, hasta que la confirme su responsable.
//
// Los ids de las tareas (t1, t2…) son por posición y lo tildado en cada
// navegador se guarda con ellos: sumá tareas al final, no en el medio.

export type ConPlan = 'turnos' | 'alquileres' | 'gimnasio'
export type Persona = 'Ale' | 'Mateo' | 'Alan'
export const PERSONAS: Persona[] = ['Ale', 'Mateo', 'Alan']

// `inicio` es el primer día con tareas (jueves); `lunes`, el lunes de esa
// semana: las semanas se cuentan desde ahí, de lunes a viernes.
export const CICLO = { inicio: '2026-11-05', lunes: '2026-11-02', fin2m: '2026-12-23', fin1m: '2026-11-27' } as const

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

// Semana del ciclo de 2 meses a la que pertenece una fecha (1 = la del 05/11,
// que se cuenta desde el lunes 02/11).
export function semanaDelCiclo(dia: string): number {
  return Math.floor((utc(dia) - utc(CICLO.lunes)) / (7 * DIA_MS)) + 1
}

type Borrador = Omit<Tarea, 'id'>

// Una tarea. La semana sale de la fecha para que nunca queden desfasadas. En
// el ciclo de 1 mes, las semanas 1 a 4 quedan iguales; las 5 y 6 van a la 3 y
// las 7 y 8 a la 4, salvo que se diga otra cosa: null la saca del ciclo.
function t(dia: string, quien: Persona, texto: string, criterio: string, semana1m?: number | null): Borrador {
  const semana = semanaDelCiclo(dia)
  const s1m = semana1m !== undefined ? semana1m : semana <= 4 ? semana : semana <= 6 ? 3 : 4
  return { texto, dia, quien, criterio, semana, semana1m: s1m }
}

// Una tarea que ya se hizo en sesión, con la key de la entrada que la
// documenta (entradas.ts). Nace igual sin tildar. En el ciclo 2 ninguna
// arranca así: se usa a medida que las sesiones hagan tareas del plan.
export function documentada(tarea: Borrador, auditoria: string): Borrador {
  return { ...tarea, auditoria }
}

// `semanas`: el título de cada semana del ciclo de 2 meses, en orden (1 a 8);
// `semanas1m`, el de las 4 del ciclo de 1 mes.
function plan(modulo: ConPlan, nombre: string, responsable: Persona, foco: string, semanas: string[], semanas1m: string[], tareas: Borrador[]): PlanModulo {
  return { modulo, nombre, responsable, foco, semanas, semanas1m, tareas: tareas.map((x, i) => ({ id: `t${i + 1}`, ...x })) }
}

// ─── Turnos · Mateo ───────────────────────────────────────────────────────────
const TURNOS = plan('turnos', 'Turnos', 'Mateo',
  'Ciclo 2, del jueves 05/11 al miércoles 23/12: Turnos arranca al día (panel al estándar de Órbita, kit compartido, backend de reservas en producción) y el trabajo es conectar el panel y el sitio al motor de reservas, que el alta real cree un negocio de verdad y dejarlo listo para salir de "Próximamente". Una tarea por día, con su entrada de auditoría.',
  [
    'Arranque: el mapa del módulo sobre el backend',
    'Catálogo sobre el backend: servicios, equipo y espacios',
    'Agenda y reservas del panel sobre el backend',
    'El sitio reserva de verdad',
    'Alta real, Mis turnos y Resumen',
    'Mensajes, ganancias y clientes',
    'QA responsive y en oscuro con datos reales',
    'Correcciones y cierre del ciclo',
  ],
  [
    'Arranque: el mapa del módulo sobre el backend',
    'Catálogo sobre el backend: servicios, equipo y espacios',
    'Agenda, reservas y el sitio sobre el backend',
    'Alta real, QA y cierre',
  ],
  [
    // Semana 1 · arranque (jueves y viernes)
    documentada(t('2026-11-05', 'Mateo', 'Leer el contrato del backend compartido y armar el mapa pantalla → ruta de Turnos', 'Tabla pantalla → ruta (panel y sitio) en una entrada de auditoría, con lo que el backend no cubre marcado'), 'auditoria.turnos.2026-11-13-mapa-sobre-el-backend'),
    t('2026-11-05', 'Mateo', 'Crear el negocio de prueba de Turnos en dev con su ReservaConfig (PUT /reservas/config)', 'El negocio existe en la base de dev con config de Turnos: horario semanal, retención y política de cancelación'),
    documentada(t('2026-11-06', 'Mateo', 'Separar en el panel de Turnos la capa de datos: un origen (demo o API) por sección, sin tocar las pantallas', 'Cada sección lee de una función de datos propia; la demo sigue igual en /turnos-demo'), 'auditoria.turnos.2026-11-13-capa-de-datos-por-origen'),
    documentada(t('2026-11-06', 'Mateo', 'Registrar en Auditoría qué necesita Turnos del backend que hoy no existe (o la constancia de que no falta nada)', 'Entrada con la lista de faltantes, avisada a Ale si hay algo que tocar en lo compartido'), 'auditoria.turnos.2026-11-13-mapa-sobre-el-backend'),
    // Semana 2 · catálogo
    t('2026-11-09', 'Mateo', 'Servicios sobre /reservas/servicios: alta, edición, pausa y precio', 'Un servicio creado en el panel aparece en GET /reservas/servicios y en el sitio'),
    t('2026-11-10', 'Mateo', 'Equipo sobre /reservas/recursos como PROFESIONAL, con horario propio y sus servicios', 'Cada profesional es un recurso con horario y servicios; pausarlo lo saca de la disponibilidad'),
    t('2026-11-11', 'Mateo', 'Espacios (sala, cabina, box) como recursos ESPACIO', 'Un espacio se crea y se asigna; la disponibilidad lo respeta'),
    t('2026-11-12', 'Mateo', 'Horarios y feriados del negocio sobre la config y los bloqueos', 'Cambiar el horario semanal o cargar un feriado cambia GET disponibilidad en el acto'),
    t('2026-11-13', 'Mateo', 'Reglas de reserva (anticipación, cancelación, seña, tope por persona) sobre la config', 'Cada regla guardada se refleja en lo que acepta POST /retener del sitio'),
    // Semana 3 · agenda y reservas del panel (el 20/11 es feriado)
    t('2026-11-16', 'Mateo', 'Agenda del día por profesional sobre GET /reservas y la disponibilidad', 'La agenda muestra las reservas reales del día con su estado y los huecos libres'),
    t('2026-11-17', 'Mateo', 'Nueva reserva a mano desde el panel (POST /reservas) con cliente, servicio, profesional y horario', 'La reserva aparece en la agenda y el cliente recibe su email'),
    t('2026-11-18', 'Mateo', 'Confirmar, completar, marcar ausente, cancelar y reprogramar desde la agenda', 'Cada acción cambia el estado y el historial; un 409 se muestra con el mensaje de la API'),
    t('2026-11-19', 'Mateo', 'Pagos: registrar seña y saldo (POST :id/pago) y el detalle de la reserva con su historial', 'El pago nunca supera el total; el detalle muestra cada cambio con quién y por qué'),
    t('2026-11-19', 'Mateo', 'Lista de espera del panel sobre /reservas/espera', 'Se ve quién espera cada horario y se lo puede quitar'),
    // Semana 4 · el sitio
    t('2026-11-23', 'Mateo', 'Sitio: elegir servicio y profesional desde la API (config pública, servicios y recursos)', 'El sitio lista lo mismo que el panel, sin datos del navegador'),
    t('2026-11-24', 'Mateo', 'Sitio: calendario y horarios desde GET disponibilidad, con la anticipación mínima y máxima', 'Los horarios ofrecidos son los libres de verdad; un horario ya tomado no se ofrece'),
    t('2026-11-25', 'Mateo', 'Sitio: retener y confirmar con clave de idempotencia (POST /retener y /mi/:token/confirmar)', 'Doble clic no duplica; la reserva vence si no se confirma en el tiempo de retención'),
    t('2026-11-26', 'Mateo', 'Sitio: /mi-turno/<token> con cancelar y reprogramar según la política del negocio', 'El enlace del email abre la reserva; cancelar fuera de plazo se rechaza con el mensaje de la API'),
    t('2026-11-27', 'Mateo', 'Sitio: la seña (monto y si se devuelve) y los emails de confirmación y cancelación revisados', 'Los emails llegan en STUB con los datos correctos; el aviso de seña dice lo mismo que la config'),
    // Semana 5 · alta real, Mis turnos y Resumen
    t('2026-11-30', 'Mateo', 'El alta real de Turnos crea el negocio con su ReservaConfig y sus profesionales', 'Un alta de prueba en dev termina con la config y los recursos creados por la API'),
    t('2026-12-01', 'Mateo', 'Mis turnos del cliente con sesión (reservas vinculadas a la cuenta)', 'Un cliente logueado ve sus turnos futuros y pasados'),
    t('2026-12-02', 'Mateo', 'Resumen del panel (hoy, semana, ocupación) sobre GET /reservas/resumen', 'Los indicadores del Resumen salen de la API y coinciden con la agenda'),
    t('2026-12-03', 'Mateo', 'Sacar lo que quedó de la demo en las secciones conectadas (datos del navegador, cálculos locales)', 'localStorage solo en la demo de modules/turnos; typecheck y eslint en cero'),
    t('2026-12-04', 'Mateo', 'Pasada en oscuro y a 390 px de las secciones conectadas del panel', 'Sin colores fijos ni scroll horizontal en Agenda, Servicios, Equipo, Espacios y Pagos'),
    // Semana 6 · mensajes, ganancias y clientes (el 08/12 es feriado)
    t('2026-12-07', 'Mateo', 'Recordatorios y mensajes: plantillas por evento y el texto para WhatsApp (wa.me) desde la reserva real', 'Desde una reserva se abre WhatsApp con el mensaje armado; las plantillas se guardan en la config'),
    t('2026-12-09', 'Mateo', 'Ganancias sobre /reservas/resumen por período y por profesional', 'Ganancias del mes coincide con la suma de los pagos registrados'),
    t('2026-12-10', 'Mateo', 'Clientes de Turnos a partir de las reservas reales (historial por cliente)', 'La ficha de un cliente lista sus turnos y su última visita'),
    t('2026-12-11', 'Mateo', 'Entrada de auditoría de la conexión al backend, con capturas de panel y sitio', 'Entrada tipo diseño con antes (demo) y después (API) a 1280 y 390'),
    // Semana 7 · QA
    t('2026-12-14', 'Mateo', 'QA de Turnos a 390 px (panel y sitio) con datos reales', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'),
    t('2026-12-15', 'Mateo', 'QA de Turnos a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'),
    t('2026-12-16', 'Mateo', 'QA de Turnos a 1280 px y en oscuro', 'Lista de fallas a 1280 px y en oscuro registrada en Auditoría'),
    t('2026-12-17', 'Mateo', 'Correcciones de la QA de Turnos', 'Todas las fallas de las tres pasadas cerradas o registradas como decisión'),
    t('2026-12-18', 'Mateo', 'Prueba cruzada: Alan y Ale reservan un turno en el sitio de Turnos y anotan fallas', 'Las fallas de la prueba cruzada registradas en Auditoría'),
    // Semana 8 · cierre (lunes a miércoles)
    t('2026-12-21', 'Mateo', 'Correcciones finales de Turnos', 'Sin fallas abiertas en las entradas de Turnos'),
    t('2026-12-22', 'Mateo', 'Propuesta para sacar Turnos de "Próximamente": qué falta y qué decide Ale', 'Entrada tipo decisión con la lista de lo que falta y la propuesta'),
    t('2026-12-23', 'Mateo', 'Cierre de Turnos: resumen del ciclo y entrega a Ale', 'Entrada de cierre con lo hecho, lo que quedó afuera y lo que sigue'),
    // Sumada el 04/11 (pedido de Ale: "tener mucho cuidado" con los rubros): el sidebar cambia según el modo de agenda.
    t('2026-11-06', 'Mateo', 'Revisar qué muestra el sidebar del panel en cada rubro de Turnos (por profesional: Equipo; por sala o cabina: Espacios) y dejarlo escrito', 'Tabla rubro → secciones del sidebar en Auditoría, con lo que cambia por modo y por modalidad (a domicilio); ninguna sección vacía en ningún rubro'),
  ])

// ─── Alquileres · Alan ────────────────────────────────────────────────────────
const ALQUILERES = plan('alquileres', 'Alquileres', 'Alan',
  'Ciclo 2, del jueves 05/11 al miércoles 23/12: Alquileres arranca al día (tres modos, varios salones, por noche y por mes, Qué hay libre) y el trabajo es llevar canchas, salones y estadías al motor de reservas compartido, que el sitio reserve de verdad y que el alta real cree un negocio de verdad. Una tarea por día, con su entrada de auditoría.',
  [
    'Arranque: el mapa del módulo sobre el backend',
    'Canchas sobre el backend',
    'Salones y eventos sobre el backend',
    'Estadías sobre el backend',
    'El sitio reserva de verdad',
    'Qué hay libre, ingresos y alta real',
    'QA responsive y en oscuro con datos reales',
    'Correcciones y cierre del ciclo',
  ],
  [
    'Arranque: el mapa del módulo sobre el backend',
    'Canchas sobre el backend',
    'Salones y el sitio sobre el backend',
    'Qué hay libre, alta real, QA y cierre',
  ],
  [
    // Semana 1 · arranque (jueves y viernes)
    t('2026-11-05', 'Alan', 'Leer el contrato del backend compartido y armar el mapa pantalla → ruta de Alquileres', 'Tabla pantalla → ruta (panel y sitio) por modo, con lo que el backend no cubre marcado (por mes, paquetes, temporadas)'),
    t('2026-11-05', 'Alan', 'Crear el negocio de prueba de Alquileres en dev con su ReservaConfig y una cancha', 'El negocio existe en dev con config de Alquileres y GET /reservas/recursos devuelve la cancha'),
    t('2026-11-06', 'Alan', 'Separar en el panel de Alquileres la capa de datos: un origen (demo o API) por sección', 'Cada sección lee de una función de datos propia; la demo sigue igual con ?tipo='),
    t('2026-11-06', 'Alan', 'Definir con Ale cómo entran al backend los paquetes por salón, las temporadas y el alquiler por mes (datos del recurso o tarifa nueva)', 'Decisión registrada en Auditoría con la forma elegida y avisada antes de tocar lo compartido'),
    // Semana 2 · canchas
    t('2026-11-09', 'Alan', 'Canchas y extras como recursos CANCHA (duración de la franja, turnos seguidos, extras en datos)', 'Una cancha creada en el panel sale en GET /reservas/recursos con sus extras'),
    t('2026-11-10', 'Alan', 'Precios por horario sobre el recurso (franjas) y la seña de la config', 'El precio que muestra el sitio para una franja coincide con el del panel'),
    t('2026-11-11', 'Alan', 'Calendario y agenda de canchas sobre GET agenda y la disponibilidad', 'La grilla del día muestra reservas reales y huecos libres por cancha'),
    t('2026-11-12', 'Alan', 'Reserva a mano, confirmar, cancelar, reprogramar y pagos de canchas desde el panel', 'Cada acción cambia el estado; un 409 se muestra con el mensaje de la API'),
    t('2026-11-13', 'Alan', 'Bloqueos (mantenimiento, lluvia) sobre /reservas/bloqueos, por cancha o todas', 'Un bloqueo saca los horarios de la disponibilidad y avisa cuántas reservas afecta'),
    // Semana 3 · salones (el 20/11 es feriado)
    t('2026-11-16', 'Alan', 'Salones como recursos SALON: la duración del recurso es el bloque y la limpieza el margen', 'Burbujas Eventos tiene sus dos salones en la API con bloques y limpieza'),
    t('2026-11-17', 'Alan', 'Paquetes por salón y extras del negocio en datos del recurso, con el precio calculado como hoy', 'Un paquete elegido en el sitio da el mismo total que lib/reservas/precio'),
    t('2026-11-18', 'Alan', 'Eventos y el calendario mensual sobre GET agenda, con filtro por salón', 'El mes marca los días con bloques libres y no deja elegir uno ocupado'),
    t('2026-11-19', 'Alan', 'Depósito y pagos del salón sobre POST :id/pago, con el saldo en el detalle', 'El depósito registrado se descuenta del saldo y el detalle lo muestra'),
    t('2026-11-19', 'Alan', 'Pasada en oscuro y a 390 px de canchas y salones conectados', 'Sin colores fijos ni scroll horizontal en Agenda, Canchas, Salones y Eventos'),
    // Semana 4 · estadías (fuera del ciclo de 1 mes)
    t('2026-11-23', 'Alan', 'Estadía: propiedades como recursos ALOJAMIENTO con check-in, check-out y noches mínimas en datos', 'Cabañas del Bosque tiene sus propiedades en la API y GET disponibilidad/noches responde', null),
    t('2026-11-24', 'Alan', 'Estadía: temporadas y precio por noche según lo decidido en la semana 1', 'El total de una estadía en el sitio coincide con lib/reservas/estadia', null),
    t('2026-11-25', 'Alan', 'Estadía: calendario de ocupación y reserva a mano con fecha y fechaHasta', 'Una estadía creada ocupa sus noches y otra que se pise recibe 409', null),
    t('2026-11-26', 'Alan', 'Estadía: alquiler por mes (contratos) según lo decidido en la semana 1', 'Un contrato por mes se crea, ocupa el período y se termina desde el panel', null),
    t('2026-11-27', 'Alan', 'Estadía: limpieza entre huéspedes y bloqueos de la propiedad', 'El margen de limpieza y un bloqueo sacan noches de la disponibilidad', null),
    // Semana 5 · el sitio
    t('2026-11-30', 'Alan', 'Sitio: portada, canchas, salones y propiedades desde la API (config pública y recursos)', 'El sitio lista lo mismo que el panel, sin datos del navegador'),
    t('2026-12-01', 'Alan', 'Sitio: reservar una cancha (franjas seguidas) con retener y confirmar e idempotencia', 'Doble clic no duplica; la retención vence si no se confirma'),
    t('2026-12-02', 'Alan', 'Sitio: reservar un salón con paquete y extras, y una estadía por noches', 'Las dos reservas llegan a la agenda del panel con su total y su seña'),
    t('2026-12-03', 'Alan', 'Sitio: /mi-reserva/<token> con cancelar y reprogramar según la política, y los emails revisados', 'El enlace del email abre la reserva; los emails en STUB tienen los datos correctos'),
    t('2026-12-04', 'Alan', 'Sitio: Mis reservas del cliente con sesión', 'Un cliente logueado ve sus reservas futuras y pasadas'),
    // Semana 6 · Qué hay libre, ingresos y alta real (el 08/12 es feriado)
    t('2026-12-07', 'Alan', 'Qué hay libre sobre GET disponibilidad y disponibilidad/noches, por cancha, salón y propiedad', 'La respuesta de Qué hay libre coincide con la agenda real del día'),
    t('2026-12-09', 'Alan', 'Ingresos sobre GET /reservas/resumen por modo y por recurso', 'Ingresos del mes coincide con la suma de los pagos registrados'),
    t('2026-12-10', 'Alan', 'El alta real de Alquileres crea el negocio con su config y sus recursos según el modo', 'Un alta de prueba en dev termina con la config y los recursos creados por la API'),
    t('2026-12-11', 'Alan', 'Entrada de auditoría de la conexión al backend, con capturas de panel y sitio', 'Entrada tipo diseño con antes (demo) y después (API) a 1280 y 390'),
    // Semana 7 · QA
    t('2026-12-14', 'Alan', 'QA de Alquileres a 390 px (panel y sitio) con datos reales', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'),
    t('2026-12-15', 'Alan', 'QA de Alquileres a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'),
    t('2026-12-16', 'Alan', 'QA de Alquileres a 1280 px y en oscuro', 'Lista de fallas a 1280 px y en oscuro registrada en Auditoría'),
    t('2026-12-17', 'Alan', 'Correcciones de la QA de Alquileres', 'Todas las fallas de las tres pasadas cerradas o registradas como decisión'),
    t('2026-12-18', 'Alan', 'Prueba cruzada: Mateo y Ale reservan una cancha y un salón en el sitio de Alquileres y anotan fallas', 'Las fallas de la prueba cruzada registradas en Auditoría'),
    // Semana 8 · cierre (lunes a miércoles)
    t('2026-12-21', 'Alan', 'Correcciones finales de Alquileres', 'Sin fallas abiertas en las entradas de Alquileres'),
    t('2026-12-22', 'Alan', 'Propuesta para sacar Alquileres de "Próximamente": qué falta y qué decide Ale', 'Entrada tipo decisión con la lista de lo que falta y la propuesta'),
    t('2026-12-23', 'Alan', 'Cierre de Alquileres: resumen del ciclo y entrega a Ale', 'Entrada de cierre con lo hecho, lo que quedó afuera y lo que sigue'),
  ])

// ─── Gimnasio · Ale (y lo transversal) ────────────────────────────────────────
const GIMNASIO = plan('gimnasio', 'Gimnasio', 'Ale',
  'Ciclo 2, del jueves 05/11 al miércoles 23/12: Gimnasio arranca al día (panel al estándar, clases con cupo, alumnos, planes y check-in en demo) y el trabajo es llevar las clases al motor de reservas compartido, decidir dónde viven planes, pases y alumnos, que el sitio reserve de verdad y que el alta real cree un negocio de verdad. Lo transversal (Módulos, alta única, cobro, recordatorios, cierre) va acá con el prefijo "Transversal: ".',
  [
    'Arranque: el mapa del módulo y la API en producción',
    'Clases y salas sobre el backend',
    'Alumnos, planes y pases',
    'El sitio reserva de verdad y el checkpoint de Módulos',
    'Check-in, alta real y los módulos en el alta',
    'Ingresos, mensajes y lo que decide Ale',
    'QA responsive y en oscuro, también del superadmin',
    'Correcciones y cierre del ciclo',
  ],
  [
    'Arranque: el mapa del módulo y la API en producción',
    'Clases y salas sobre el backend',
    'Alumnos, planes y el sitio sobre el backend',
    'Check-in, alta real, QA y cierre',
  ],
  [
    // Semana 1 · arranque (jueves y viernes)
    t('2026-11-05', 'Ale', 'Leer el contrato del backend compartido y armar el mapa pantalla → ruta de Gimnasio', 'Tabla pantalla → ruta por sección, con planes, pases y alumnos marcados como "no son reservas"'),
    t('2026-11-05', 'Ale', 'Transversal: verificar la API en producción (Cloud Run con /reservas respondiendo) y dar por cerrado el deploy en Módulos', 'GET /api/v1/reservas/config responde 401 (no 404) en api.orbita.site; la decisión del deploy figura tomada'),
    t('2026-11-06', 'Ale', 'Crear el negocio de prueba de Gimnasio en dev con su ReservaConfig y dos clases como CLASE con cupo', 'GET /reservas/recursos devuelve las clases con cupo y sesiones en el horario'),
    t('2026-11-06', 'Ale', 'Transversal: avisar a Mateo y Alan el arranque del ciclo, la tarjeta de lo compartido y la regla de avisar antes de tocarlo', 'Los dos confirmaron que vieron Módulos en producción y su plan'),
    // Semana 2 · clases y salas
    t('2026-11-09', 'Ale', 'Clases y salas como recursos CLASE: cupo, duración, sesiones en el horario y profe en datos', 'Una clase creada en el panel sale en GET /reservas/recursos con sus sesiones'),
    t('2026-11-10', 'Ale', 'Grilla semanal del panel sobre GET disponibilidad con cupo y lugares libres', 'La grilla muestra las sesiones reales con cuántos lugares quedan'),
    t('2026-11-11', 'Ale', 'Reservar un lugar (cantidad) desde el panel y la lista de espera con /reservas/espera', 'Con la clase llena el panel ofrece la espera; al cancelar, el primero toma el lugar'),
    t('2026-11-12', 'Ale', 'Cancelar, marcar ausente y completar lugares desde la clase del día', 'Cada acción cambia el estado y el historial; un 409 se muestra con el mensaje de la API'),
    t('2026-11-13', 'Ale', 'Días sin clases y feriados sobre /reservas/bloqueos', 'Un bloqueo saca las sesiones de la grilla y avisa cuántas reservas afecta'),
    // Semana 3 · alumnos, planes y pases (el 20/11 es feriado)
    t('2026-11-16', 'Ale', 'Definir dónde viven planes, pases y alumnos (propuesta: tablas propias de Gimnasio en la API, fuera de reservas)', 'Decisión registrada en Auditoría con el modelo elegido'),
    t('2026-11-17', 'Ale', 'Alumnos sobre la API según lo decidido: alta, plan vigente y vencimiento', 'Un alumno creado en el panel tiene plan y fecha de vencimiento en la base'),
    t('2026-11-18', 'Ale', 'Planes (mensual, pase libre, por cantidad de clases) sobre la API', 'Los tres tipos de plan se crean y se muestran con su precio'),
    t('2026-11-19', 'Ale', 'Pases que se descuentan al reservar un lugar y renovación del plan', 'Reservar descuenta un pase; sin pases no deja reservar; renovar extiende el vencimiento'),
    t('2026-11-19', 'Ale', 'Transversal: los planes de Mateo y Alan al día en Módulos (atrasos y entradas por confirmar)', 'Ningún atraso sin explicar; lo documentado confirmado o marcado'),
    // Semana 4 · el sitio y el checkpoint
    t('2026-11-23', 'Ale', 'Sitio: grilla pública de clases desde la API (config pública y recursos)', 'El sitio muestra las mismas sesiones y cupos que el panel'),
    t('2026-11-24', 'Ale', 'Sitio: reservar un lugar con retener y confirmar e idempotencia, y anotarse en la espera', 'Doble clic no duplica; con la clase llena el sitio ofrece la espera'),
    t('2026-11-25', 'Ale', 'Sitio: /mi-clase/<token> con cancelar según la política, y los emails revisados', 'El enlace del email abre el lugar; los emails en STUB tienen los datos correctos'),
    t('2026-11-26', 'Ale', 'Sitio: Mis clases del alumno con sesión', 'Un alumno logueado ve sus clases futuras y pasadas'),
    t('2026-11-27', 'Ale', 'Transversal: checkpoint de mitad de ciclo en Módulos (semáforos y atrasos de los tres)', 'Semáforo de cada módulo revisado; atrasos reasignados o registrados como decisión'),
    // Semana 5 · check-in, alta real y los módulos en el alta
    t('2026-11-30', 'Ale', 'Check-in del alumno desde el panel, con aviso si el plan está vencido', 'Buscar un alumno registra su ingreso; con plan vencido muestra el aviso y ofrece renovar'),
    t('2026-12-01', 'Ale', 'El alta real de Gimnasio crea el negocio con su config y sus clases', 'Un alta de prueba en dev termina con la config y las clases creadas por la API'),
    t('2026-12-02', 'Ale', 'Transversal: el alta única crea el negocio de Turnos y de Alquileres con lo que cada módulo definió', 'Un alta de prueba por módulo en dev deja la config y los recursos creados'),
    t('2026-12-03', 'Ale', 'Transversal: decidir cuándo sale cada módulo de "Próximamente" (qué falta en cada uno)', 'Decisión registrada en Auditoría con fecha o condición por módulo'),
    t('2026-12-04', 'Ale', 'Pasada en oscuro y a 390 px de las secciones conectadas de Gimnasio', 'Sin colores fijos ni scroll horizontal en Clases, Alumnos, Planes y Check-in'),
    // Semana 6 · ingresos, mensajes y lo que decide Ale (el 08/12 es feriado)
    t('2026-12-07', 'Ale', 'Ingresos por plan y por mes sobre la API, con comparación honesta contra el mes anterior', 'Ingresos del mes coincide con la suma de pagos y renovaciones'),
    t('2026-12-09', 'Ale', 'Transversal: recordatorio del día anterior colgado del cron de las 22 h (si Ale lo decide)', 'El recordatorio sale una sola vez por reserva (idempotente), o la decisión queda registrada como no'),
    t('2026-12-10', 'Ale', 'Transversal: cobro online de la seña con Mercado Pago sobre /reservas (si Ale lo decide)', 'Una reserva con seña se paga con MP y el webhook la confirma, o la decisión queda registrada como no'),
    t('2026-12-11', 'Ale', 'Entrada de auditoría de la conexión al backend, con capturas de panel y sitio', 'Entrada tipo diseño con antes (demo) y después (API) a 1280 y 390'),
    // Semana 7 · QA
    t('2026-12-14', 'Ale', 'QA de Gimnasio a 390 px (panel y sitio) con datos reales', 'Lista de fallas a 390 px registrada en Auditoría; sin scroll horizontal'),
    t('2026-12-15', 'Ale', 'QA de Gimnasio a 768 px', 'Lista de fallas a 768 px registrada en Auditoría'),
    t('2026-12-16', 'Ale', 'QA de Gimnasio a 1280 px y en oscuro', 'Lista de fallas a 1280 px y en oscuro registrada en Auditoría'),
    t('2026-12-17', 'Ale', 'Transversal: QA del superadmin (Módulos y Auditoría) a 390, 768 y 1280', 'Tarjetas en una columna y tablas como listas a 390 px; sin scroll horizontal'),
    t('2026-12-18', 'Ale', 'Correcciones de la QA de Gimnasio y prueba cruzada con Mateo y Alan', 'Fallas cerradas o registradas como decisión; la prueba cruzada anotada en Auditoría'),
    // Semana 8 · cierre (lunes a miércoles)
    t('2026-12-21', 'Ale', 'Correcciones finales de Gimnasio', 'Sin fallas abiertas en las entradas de Gimnasio'),
    t('2026-12-22', 'Ale', 'Transversal: cierre del ciclo en Módulos (resumen por módulo y decisiones)', 'Los tres módulos con su entrada de cierre y el resumen sin atrasos sin explicar'),
    t('2026-12-23', 'Ale', 'Transversal: retro del ciclo y plan del siguiente', 'Retro registrada en Auditoría y plan del próximo ciclo cargado en modules/superadmin/modulos/plan.ts'),
  ])

export const PLANES: PlanModulo[] = [TURNOS, ALQUILERES, GIMNASIO]

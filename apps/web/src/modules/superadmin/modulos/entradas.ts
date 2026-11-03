// Entradas de auditoría de los módulos nuevos (super admin → Módulos →
// pestaña Auditoría de cada módulo).
//
// Cada entrada documenta algo que YA se hizo: una tarea del plan, un cambio de
// diseño (con capturas antes y después) o una decisión de producto (con la
// opción elegida y el porqué). Las decisiones que todavía nadie tomó van
// aparte, en decisiones.ts.
//
// Viven en el código, como el plan: Módulos es solo visual, sin API. Las que
// deja una sesión de trabajo nacen "pendientes de confirmación del
// responsable"; confirmarlas en la pantalla queda en el navegador de quien
// confirma (estado.ts). Para que una confirmación sea de todos, se anota acá
// con `confirmada` (AAAA-MM-DD): la entrada y las tareas que documenta quedan
// hechas para cualquiera que abra Módulos.
//
// Formato (lo arma `entrada()`, no se escribe a mano):
// - key `auditoria.<modulo>.<AAAA-MM-DD>-<slug>`, con modulo turnos, alquileres
//   o gimnasio. Lo transversal (lib de reservas, sección Módulos, alta única)
//   va en gimnasio, el módulo de Ale, con `transversal: true` y el título con
//   el prefijo "Transversal: ", igual que sus tareas del plan.
// - informe en Markdown que arranca avisando que lo generó una sesión y sigue
//   con Qué se hizo, Quién, Cuándo, Archivos (`ruta:línea` desde la raíz del
//   repo), Antes / Después (solo diseño) y Decisión y porqué (solo decisión).
// - `quien` es quien lo hizo y su responsable: el que la confirma.
//
// Capturas: van en apps/web/public/auditoria/modulos/<modulo>/ y se pasan por
// nombre de archivo, con el ancho (1280 o 390) en el nombre: de ahí saca el
// front la proporción. En un diseño, una por ancho antes y después; en una
// tarea, las del después con comoQuedo(). Se sirven desde la web pública:
// nada con datos reales de clientes.
//
// Para que una tarea del plan apunte a su entrada, en plan.ts se envuelve la
// tarea con documentada(t(...), '<key de la entrada>').

import type { ConPlan, Persona } from './plan'

export type TipoEntrada = 'tarea' | 'diseño' | 'decisión'

export interface Entrada {
  key: string
  modulo: ConPlan
  tipo: TipoEntrada
  /** Cruza módulos: va en Gimnasio y el título empieza con "Transversal: ". */
  transversal: boolean
  titulo: string
  /** Una línea: es lo que se ve en la lista sin abrir la entrada. */
  foco: string
  /** Quién lo hizo y la confirma; en una decisión abierta, quién la decide. */
  quien: Persona
  /** AAAA-MM-DD en que se hizo (o se abrió la decisión). */
  fecha: string
  informe: string
  /** Decisión que todavía no se tomó (decisiones.ts): no se confirma, se decide. */
  abierta: boolean
  /** Escrita en el código o cargada en este navegador desde la hoja de Módulos. */
  origen: 'codigo' | 'navegador'
  /** Confirmada para todos (AAAA-MM-DD), anotado en el código. */
  confirmada: string | null
}

export const AVISO_SESION = '> **Generada en sesión, pendiente de confirmación del responsable.**'

// Una captura por ancho: nombre del archivo dentro de la carpeta del módulo.
export interface Capturas {
  1280: string
  390: string
}

interface Base {
  modulo: ConPlan
  // Día en que se hizo (AAAA-MM-DD). Va en la key.
  fecha: string
  // Slug de la tarea: minúsculas, números y guiones.
  slug: string
  quien: Persona
  titulo: string
  foco: string
  // Markdown: qué se hizo.
  que: string
  // `ruta:línea` desde la raíz del repo, uno por archivo creado o tocado.
  archivos: string[]
  transversal?: boolean
  confirmada?: string
}

// Cada tipo exige lo suyo: un diseño sin capturas o una decisión sin porqué
// no compilan.
export type DatosEntrada = Base & (
  | { tipo: 'tarea' }
  | { tipo: 'diseño'; antes: Capturas; despues: Capturas }
  | { tipo: 'decisión'; decision: string; porque: string }
)

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

export const urlCaptura = (modulo: ConPlan, archivo: string) => `/auditoria/modulos/${modulo}/${archivo}`

// Un párrafo por ancho: el front muestra cada par antes/después lado a lado
// desde 768 px y apilado abajo de eso (MarkdownInforme).
function capturas(modulo: ConPlan, antes: Capturas, despues: Capturas): string {
  return ([1280, 390] as const)
    .map((ancho) => `![Antes · ${ancho}](${urlCaptura(modulo, antes[ancho])})\n![Después · ${ancho}](${urlCaptura(modulo, despues[ancho])})`)
    .join('\n\n')
}

// Cómo quedó, en una tarea: los módulos nuevos no tienen un "antes". Un
// párrafo hecho solo de imágenes, que el front muestra como galería.
function comoQuedo(modulo: ConPlan, ...lista: [titulo: string, archivo: string][]): string {
  return `**Cómo quedó:**\n\n${lista.map(([titulo, archivo]) => `![${titulo}](${urlCaptura(modulo, archivo)})`).join('\n')}`
}

export function entrada(d: DatosEntrada): Entrada {
  const secciones = [
    AVISO_SESION,
    '## Qué se hizo', d.que.trim(),
    '## Quién', d.quien,
    '## Cuándo', fechaLarga(d.fecha),
    '## Archivos', d.archivos.map((a) => `- \`${a}\``).join('\n'),
  ]
  if (d.tipo === 'diseño') secciones.push('## Antes / Después', capturas(d.modulo, d.antes, d.despues))
  if (d.tipo === 'decisión') secciones.push('## Decisión y porqué', `**Decisión:** ${d.decision.trim()}\n\n**Porqué:** ${d.porque.trim()}`)
  return {
    key: `auditoria.${d.modulo}.${d.fecha}-${d.slug}`,
    modulo: d.modulo,
    tipo: d.tipo,
    transversal: d.transversal ?? false,
    titulo: d.titulo,
    foco: d.foco,
    quien: d.quien,
    fecha: d.fecha,
    informe: secciones.join('\n\n'),
    abierta: false,
    origen: 'codigo',
    confirmada: d.confirmada ?? null,
  }
}

// ─── Entradas ─────────────────────────────────────────────────────────────────
// Las primeras son del 26/10/2026, la sesión que armó los módulos nuevos (la
// primera de todas es la de la sección Módulos: los tests del front la usan de
// ejemplo). Después vienen las del rediseño de los paneles al estándar de
// Órbita (26 y 27/10): Alquileres, Gimnasio y lo transversal del kit.

const F = '2026-10-26'
const F27 = '2026-10-27'
// El backend compartido de reservas (sesión del 03/11/2026).
const F3 = '2026-11-03'

export const ENTRADAS: Entrada[] = [
  // ─── Transversal · la sección Módulos ───────────────────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'seccion-modulos', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: sección Módulos del superadmin',
    foco: 'Pestaña Módulos del superadmin con el plan diario de Turnos, Alquileres y Gimnasio, sus entradas de auditoría y las decisiones abiertas. Solo visual: los datos viven en la web y lo que se marca, en el navegador.',
    que: `Se creó la sección Módulos del superadmin (Interno → Módulos, \`/superadmin?seccion=modulos\`): cuatro tarjetas (Tienda, Turnos, Gimnasio y Alquileres) con responsable, fin estimado, progreso y semáforo, y la vista de cada módulo con las pestañas Plan, Auditoría y Resumen.

- **Plan:** cada semana de lunes a viernes con sus tareas (día, quién, criterio de listo y estado), en el horizonte de 2 meses (26/10 al 18/12) o de 1 mes (al 20/11, sin la estadía de Alquileres).
- **Auditoría:** las entradas del módulo, filtrables por tipo (tarea hecha, cambio de diseño, decisión), con qué se hizo, quién, cuándo, archivos con su línea, capturas antes y después y la decisión con su porqué. Las decisiones que nadie tomó todavía figuran como abiertas, con quién las decide.
- **Resumen:** progreso, tareas por confirmar, atrasos, próximo hito, avance por responsable y decisiones abiertas.
- **Solo visual:** el plan (\`plan.ts\`), las entradas (\`entradas.ts\`) y las decisiones abiertas (\`decisiones.ts\`) son datos de la web, en \`modules/superadmin/modulos/\`. Lo que se tilda, se confirma o se carga como entrada nueva, y el horizonte elegido, queda en el navegador (\`estado.ts\`), y la pantalla lo avisa: "Se guarda en este navegador". La API no tiene nada de Módulos y la Auditoría general no cambia.
- **Reglas:** una tarea se tilda solo con su entrada; confirmar una entrada tilda las tareas que documenta; los responsables van por nombre de pila (Ale, Mateo y Alan), sin cuentas del superadmin.
- **Capturas:** los informes muestran imágenes \`https://\` o de \`/auditoria/…\` con proporción fija, y el antes y el después lado a lado desde 768 px.

La primera versión guardaba todo en el tablero de auditoría de la API (commit 82f05); el mismo 26/10 pasó a ser solo visual (decisión "Módulos es solo visual, sin backend"). Las capturas son de la QA, antes de ese cambio: ahí el responsable figura con la cuenta de su cargo ("Ale · CPO") y todavía no está el aviso "Se guarda en este navegador".

${comoQuedo('gimnasio', ['Plan de Gimnasio · 1280', 'superadmin-modulos-plan-1280.webp'], ['Plan de Gimnasio · 390', 'superadmin-modulos-plan-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/superadmin/Modulos.tsx:360',
      'apps/web/src/modules/superadmin/Modulos.tsx:199',
      'apps/web/src/modules/superadmin/Modulos.tsx:1102',
      'apps/web/src/modules/superadmin/Modulos.tsx:441',
      'apps/web/src/modules/superadmin/modulos/plan.ts:1',
      'apps/web/src/modules/superadmin/modulos/entradas.ts:1',
      'apps/web/src/modules/superadmin/modulos/decisiones.ts:1',
      'apps/web/src/modules/superadmin/modulos/estado.ts:1',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:35',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:223',
      'apps/web/src/modules/superadmin/SuperAdminDashboard.tsx:140',
      'apps/web/src/modules/superadmin/modulos/datos.test.ts:1',
    ],
  }),

  // ─── Turnos · Mateo ─────────────────────────────────────────────────────────
  entrada({
    modulo: 'turnos', fecha: F, slug: 'backend-borrado', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Backend de Turnos borrado: cinco ramas sin mergear',
    foco: 'Se borraron las cinco ramas con el módulo appointments de la API, que nunca llegó a main: Turnos queda como demo sin backend, igual que Alquileres y Gimnasio.',
    que: `Se borraron las ramas del backend de Turnos, en local y en GitHub:

| Rama | Último commit |
|---|---|
| \`feat/turnos-real\` (local y remota) | \`e30d2c22d1a2\` |
| \`feat/turnos-real-p1\` | \`b3c7b49c8fba\` |
| \`feat/turnos-real-p3\` | \`6af5564ac59d\` |
| \`feat/turnos-real-p4\` | \`cddbe8e86ee7\` |
| \`feat/turnos-real-web-base\` | \`07c7fb3b4390\` |

Lo que tenían (el inventario que pedía la tarea del 26/10):
- \`apps/api/src/appointments/\`: el contrato (CONTRATO.md), el módulo y sus tipos, el catálogo de rubros y roles, disponibilidad y horarios; el panel (turnos, configuración, servicios, recursos, cobro y mensajes); la gestión (clientes, equipo con roles y pagos, ganancias con liquidación); y Avanzado (precios por horario, turno fijo, recuperar clientes, gift cards, lista de espera, membresías y fidelidad, paquetes y sus rutas públicas).
- Dos migraciones, \`20261003120000_appointments\` y \`20261003120100_appointments_permisos\`, y unas mil líneas de \`schema.prisma\`.
- Cambios en \`auth\`, \`roles\`, \`common/permisos\`, \`businesses\`, \`storefront\` y \`subscriptions\`, tests unitarios y tres e2e (P1, P3 y P4).
- \`feat/turnos-real-web-base\` sumaba además, en \`apps/web\`, el cliente tipado de esa API, los adaptadores API ↔ demo y los hooks de React Query.

Nada de eso estaba en \`main\`: no hubo que revertir código ni migrar ninguna base, y la API no tiene ninguna ruta \`/appointments\`. Turnos queda sin API, con los datos de ejemplo de \`modules/turnos/datos/\`, y su demo solo existe en localhost.

No se corrió \`git gc\`: los commits siguen en el repo local, y una rama se recupera con \`git branch feat/turnos-real e30d2c22d1a2\` mientras no se limpie.`,
    archivos: [
      'apps/web/src/modules/turnos/datos/index.ts:3-6',
      'apps/web/src/pages/turnos-demo/index.tsx:20-22',
      'apps/web/src/lib/reservas/README.md:53-56',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'datos-demo-una-capa', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Datos de demo de Turnos en una sola capa',
    foco: 'Los datos de ejemplo de Turnos viven en modules/turnos/datos/ (rubros, agenda, equipo y lo que carga el dueño); las pantallas no inventan datos por su cuenta.',
    que: `Los mocks sueltos de Turnos pasaron a una carpeta, \`modules/turnos/datos/\`, con un archivo por tema:
- \`index.ts\`: rubros, servicios, agendas, turnos y clientes de ejemplo (antes \`modules/turnos/datos.ts\`).
- \`agenda.ts\`: el calendario alrededor del día de la demo y los horarios libres (antes \`admin/agendaDemo.ts\`).
- \`equipo.ts\`: roles, permisos, personas y cómo cobra cada una (antes \`admin/equipoDemo.ts\`).
- \`negocio.ts\`: lo que el dueño cargó en el alta y en Configuración (antes \`demo/negocioDemo.ts\`).

Las pantallas leen siempre de ahí. Lo que carga el dueño queda en el navegador (localStorage), así lo ven también la vista previa y las pestañas nuevas; lo que se toca en el panel (turnos, clientes, equipo) vive en memoria y vuelve a los datos de ejemplo al recargar o al cambiar de rubro. Es la misma forma que después siguieron Alquileres y Gimnasio (\`datos/index.ts\` y \`datos/negocio.ts\`).`,
    archivos: [
      'apps/web/src/modules/turnos/datos/index.ts:1-11',
      'apps/web/src/modules/turnos/datos/agenda.ts:1-4',
      'apps/web/src/modules/turnos/datos/equipo.ts:1-3',
      'apps/web/src/modules/turnos/datos/negocio.ts:1-12',
      'apps/web/src/modules/turnos/datos/negocio.ts:172',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:17-20',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'rubros-fuera-de-turnos', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Canchas y clases con cupo fuera de Turnos',
    foco: 'Turnos agenda solo por profesional o por sala: canchas pasó a Alquileres y los ocho rubros de clases con cupo, a Gimnasio.',
    que: `\`ModoAgenda\` quedó en dos modos: \`'profesional'\` (cada turno es con una persona) y \`'recurso'\` (una sala, cabina o box). Antes también tenía \`'cancha'\` y \`'cupo'\`.

- Salieron de \`RUBROS_TURNOS\` nueve rubros: canchas (modo cancha) y gimnasio, crossfit, entrenamiento funcional, yoga y pilates, danza, artes marciales, natación y talleres (modo cupo).
- Con ellos se fueron sus temas y plantillas de sitio (\`storefront/tema.ts\` y \`plantillas.ts\`), la sección Clases del panel (\`admin/Clases.tsx\`, 313 líneas) y los textos que prometían canchas o cupos ("Por persona, por sala, por cancha o por cupo" en la sección de rubros).
- La familia "deporte" quedó como "Bienestar", con un solo rubro: electroestimulación (el negocio de ejemplo pasó a llamarse "Volt EMS").
- En el alta única, canchas se arma eligiendo Alquileres y las clases con cupo eligiendo Gimnasio, en el paso Módulo, y el buscador de rubros de Turnos ya no sugiere pádel ni yoga (QA del alta, 88a99). En el alta real esos dos módulos salen como "Próximamente".

En \`modules/turnos\` no quedó ningún dato de canchas ni de clases con cupo.`,
    archivos: [
      'apps/web/src/modules/turnos/datos/index.ts:13-15',
      'apps/web/src/modules/turnos/datos/index.ts:32-34',
      'apps/web/src/modules/turnos/datos/index.ts:89',
      'apps/web/src/modules/turnos/storefront/tema.ts:187',
      'apps/web/src/modules/turnos/landing/RubrosTurnos.tsx:42',
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:28',
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:33',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'codigo-muerto', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Código muerto de Turnos borrado y una sola carpeta compartida',
    foco: 'Se borraron 25 archivos de Turnos que nadie usaba (18 estaban vacíos) y quedó una sola carpeta compartida, _shared/.',
    que: `Se borró todo lo que nadie importaba. La mayoría eran archivos vacíos (0 bytes) que quedaron de una estructura vieja:
- \`shared/\` (CalendarioBase, useDisponibilidad, useReserva) y \`_shared/hooks/\` (useDisponibilidad, useReserva, useServicio): los hooks "repetidos" de las dos carpetas estaban vacíos.
- \`barberia/\` (cuatro archivos): vacía, y nadie la importaba.
- Cinco componentes de \`_shared/components/\` (CalendarioBase, FlujoReservaBase, SelectorCabina, SelectorCancha, SlotDisponible), \`layout/FooterTurnos\`, \`layout/NavbarTurnos\` y \`storefront/Servicios\`: vacíos.

Con código:
- \`admin/Clases.tsx\` (313 líneas): las clases con cupo, que pasaron a Gimnasio.
- Cinco funciones de Avanzado: Fidelidad, GiftCards, Recuperar, TurnoFijo y Plantillas (unas 700 líneas).
- \`_shared/orbita/Cielo.tsx\`: las estrellas del fondo, que no van con el panel minimalista.
- Exports y CSS que nadie usaba.

Así, consolidar \`_shared/\` y \`shared/\` fue borrar \`shared/\`: lo compartido de Turnos queda en una sola carpeta, \`_shared/\` (ChipEstado, QR y el lenguaje visual en \`orbita/\`). Las funciones para achicar una imagen en el navegador, que vivían dentro del alta, pasaron a \`lib/achicarImagen.ts\`: las usan el alta y la Apariencia de Turnos, que no se importan entre sí. Turnos quedó con eslint sin errores y \`tsc\` en verde.

Árbol de \`modules/turnos/\` (carpetas y cantidad de archivos):

\`\`\`
Antes (98675)                     Después
_shared/components/    7          _shared/components/    2
_shared/hooks/         3          _shared/orbita/        4
_shared/orbita/        5          admin/                15
admin/                18          admin/avanzado/        7
admin/avanzado/       12          admin/configuracion/  12
admin/configuracion/  12          datos/                 4
barberia/              4          demo/                  1
datos.ts                          horario.ts
demo/                  2          landing/               3
horario.ts                        layout/                1
landing/               3          storefront/           12
layout/                3          storefront/reserva/   10
onboarding/           21
shared/                3
storefront/           13
storefront/reserva/   10
\`\`\`

\`onboarding/\` no se borró: es el alta, que se mudó a \`modules/onboarding/alta\` (entrada transversal del alta, en Gimnasio).

**Diferencias con el plan:** la tarea del 29/10 pedía una carpeta \`shared/\` con un index; quedó la que tenía código, \`_shared/\`, sin index: cada import apunta a su archivo. La del 6/11 pedía "dos capturas del árbol": va como texto, arriba.`,
    archivos: [
      'apps/web/src/lib/achicarImagen.ts:1-4',
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:25-27',
      'apps/web/src/modules/turnos/_shared/components/ChipEstado.tsx:1',
      'apps/web/src/modules/turnos/_shared/orbita/estilo.tsx:1-8',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'turnos-minimalista', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Turnos minimalista: un acento, sin degradados ni brillo',
    foco: 'El panel de Turnos pasó a un solo color de acento, una tipografía y nada decorativo: sin degradados, sin brillos ni estrellas de fondo, sombras solo donde algo flota.',
    que: `Una sola hoja de estilo (prefijo \`tuo-\`) para el panel, el índice y la landing de la demo, con reglas fijas:
- **Un acento:** el primario del design system. \`--tuo-grad\` pasó del degradado azul a índigo (#2563EB → #4F46E5) al primario plano, y los indicadores del Resumen dejaron de tener un color cada uno.
- **Una tipografía:** Geist en títulos y cuerpo (antes los títulos iban en Sora) y Geist Mono en horas y números.
- **Nada decorativo:** el bloque oscuro del día es plano, sin el cielo de estrellas de \`Cielo.tsx\` ni el brillo detrás del dial; los botones sin degradado ni halo; las tendencias, una línea fina sin relleno.
- **Tokens:** todo pinta con \`--color-*\`, así el claro y el oscuro salen solos; en oscuro el texto sobre el primario usa \`--color-on-primary\` para llegar a AA.

La QA del 26/10 (251ec) sacó lo que quedaba: degradados en OrbitaDia, Avanzado, los indicadores y el marco del teléfono. La jerarquía la dan el tamaño, el peso y el espacio.

En las capturas, el Resumen antes (estrellas, halo en "Nuevo turno", indicadores de colores con relleno) y después.`,
    antes: { 1280: 'panel-resumen-antes-1280.webp', 390: 'panel-resumen-antes-390.webp' },
    despues: { 1280: 'panel-resumen-despues-1280.webp', 390: 'panel-resumen-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/_shared/orbita/estilo.tsx:1-8',
      'apps/web/src/modules/turnos/_shared/orbita/estilo.tsx:21-23',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:45',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:271',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'turnos-navegacion', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Navegación del panel de Turnos: Hoy y Negocio',
    foco: 'El menú del panel quedó en dos grupos: Hoy (Resumen y Agenda) y Negocio (Clientes, Configuración y Avanzado). Servicios, equipo, espacios y ganancias pasaron adentro de Configuración.',
    que: `Antes el menú tenía tres grupos y ocho entradas: Día a día (Resumen, Agenda), Tu negocio (Servicios, Equipo, Clientes, Ganancias) y Ajustes (Configuración, Avanzado). Ahora son dos grupos y cinco entradas:
- **Hoy:** Resumen y Agenda.
- **Negocio:** Clientes, Configuración y Avanzado.

Servicios, Equipo, Espacios (solo en los rubros por sala o cabina) y Ganancias son cosas que se arman una vez: pasaron adentro de Configuración, como "Servicios y precios", "Espacios", "Equipo y roles" y "Ganancias y pagos". Alguien del equipo cuyo rol no puede configurar las sigue viendo como secciones sueltas, recortadas a lo suyo ("Mis ganancias", "Mis clientes").

En celular el menú va en el cajón (botón de menú) y Configuración muestra sus secciones en una tira de chips: en la captura a 390 se ve el comienzo de esa tira, igual antes y después. El cambio se ve a 1280.`,
    antes: { 1280: 'panel-configuracion-antes-1280.webp', 390: 'panel-configuracion-antes-390.webp' },
    despues: { 1280: 'panel-configuracion-despues-1280.webp', 390: 'panel-configuracion-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:6-11',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:191-200',
      'apps/web/src/modules/turnos/admin/configuracion/datos.ts:20-31',
      'apps/web/src/modules/turnos/admin/configuracion/datos.ts:29',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'turnos-avanzado', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Avanzado de Turnos con tres funciones',
    foco: 'Avanzado pasó de ocho herramientas a tres (Precios por horario, Paquetes y bonos, Membresías y abonos), agrupadas por lo que resuelven: llenar la agenda y cobrar mejor.',
    que: `Avanzado era una vidriera de ocho herramientas ("2 de 7 funciones" activas, "Ver las 3 recomendadas", "Las 5 plantillas de tu rubro"). Ahora tiene tres:
- **Llenar la agenda:** Precios por horario (descuento en los horarios flojos).
- **Cobrar mejor:** Paquetes y bonos, y Membresías y abonos (plata por adelantado).

El bloque de arriba quedó plano, sin el planeta ni las estrellas, y dice cuántas están prendidas ("1 de 3 funciones"). El filtro "Recomendadas" solo aparece si el rubro tiene alguna (antes podía decir "Ver las 0 recomendadas"), y tocar "Avanzado" en el menú vuelve al inicio de Avanzado aunque haya una función abierta. Qué funciones quedan es una decisión aparte ("Avanzado se queda con Membresías, Paquetes y Precios por horario").`,
    antes: { 1280: 'panel-avanzado-antes-1280.webp', 390: 'panel-avanzado-antes-390.webp' },
    despues: { 1280: 'panel-avanzado-despues-1280.webp', 390: 'panel-avanzado-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:1-5',
      'apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts:10-13',
      'apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts:39',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:218-222',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'avanzado-tres-funciones', tipo: 'decisión', quien: 'Mateo',
    titulo: 'Avanzado se queda con Membresías, Paquetes y Precios por horario',
    foco: 'De las funciones de Avanzado de Turnos sobreviven tres; Fidelidad, Gift cards, Recuperar, Turno fijo y la galería de Plantillas se borraron.',
    que: `En Turnos, Avanzado ofrece solo Membresías y abonos, Paquetes y bonos y Precios por horario. Fidelidad, Gift cards, Recuperar (clientes que no vuelven) y Turno fijo salieron del menú y del código, igual que la galería de Plantillas de Avanzado: las cinco plantillas del rubro se siguen eligiendo en Configuración → Apariencia.`,
    decision: 'Avanzado de Turnos tiene tres funciones: Membresías, Paquetes y Precios por horario. Las otras cinco se borran, no solo se esconden.',
    porque: 'Es la decisión 5 del pedido de Ale ("Secciones de Avanzado que sobreviven en Turnos: Membresías, Paquetes y PreciosHorario"). Son las que un negocio de turnos usa de verdad: repartir la demanda y cobrar por adelantado. El pedido decía sacarlas de la navegación; se borró también el código porque eran pantallas visuales sin backend (Turnos no tiene API) y sin entrada en el menú eran código muerto. Si alguna vuelve, está en la historia de git: las borra el commit a0f8d.',
    archivos: [
      'apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts:10-13',
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:25-27',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:204',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'rubros-a-alquileres-y-gimnasio', tipo: 'decisión', quien: 'Mateo',
    titulo: 'Canchas pasan a Alquileres y las clases con cupo a Gimnasio',
    foco: 'Turnos queda con la agenda por profesional y por sala; las canchas son de Alquileres (modo cancha) y las clases con cupo, de Gimnasio.',
    que: `Turnos tenía cuatro modos de agenda: por profesional, por recurso (sala o cabina), cancha (por hora) y cupo (clase con cupo). Los dos últimos se fueron a sus propios módulos, armados sobre \`lib/reservas\`: canchas es el modo cancha de Alquileres y los ocho rubros de clases con cupo son Gimnasio.`,
    decision: 'Turnos agenda por profesional o por sala. Canchas pasa a Alquileres (modo cancha). Gimnasio, crossfit, funcional, yoga y pilates, danza, artes marciales, natación y talleres pasan a Gimnasio.',
    porque: 'Es la decisión 3 del pedido de Ale. Una cancha se alquila por hora (franjas con distinto precio, turnos seguidos, extras como la luz) y una clase con cupo vende lugares en una grilla semanal (planes, socios, lista de espera): reglas que un turno con una persona no usa. Separados, cada módulo tiene solo lo suyo y Turnos deja de cargar dos modos que no le sirven a una barbería ni a un consultorio.',
    archivos: [
      'apps/web/src/modules/turnos/datos/index.ts:32-34',
      'apps/web/src/modules/alquileres/datos/index.ts:11-15',
      'apps/web/src/modules/gimnasio/datos/index.ts:12-14',
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:28',
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:33',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F, slug: 'qa-responsive-turnos', tipo: 'tarea', quien: 'Mateo',
    titulo: 'QA responsive de Turnos en 390, 768 y 1280',
    foco: 'Recorrida en el navegador de todas las pantallas de Turnos en cuatro anchos, con flujos a 1280 y a 390 con toque: arreglos de layout, números de verdad en vez de fijos y accesibilidad.',
    que: `Se recorrieron en el navegador todas las pantallas de Turnos a 1280, 768, 390 y 390 en oscuro, el panel entero (24 pantallas) y los flujos de reserva, Mis turnos, página simple y panel a 1280 y a 390 con toque. Lo que se arregló (commit 251ec):
- **Ganancias a 1280:** dentro de Configuración se rompía (regresión de a0f8d, al pasar Ganancias adentro de Configuración). Ahora los indicadores y la tabla se acomodan al ancho que les toca, con container queries.
- **Números de verdad:** las variaciones y la tendencia del Resumen salen de la agenda (el mismo día de la semana pasada y los últimos 7 días; sin datos no se muestran) en vez de "+12,5 %" y "+8,2 %" fijos, y un total en cero dice $0 y no "Incluido".
- **Huecos para ofrecer:** son botones de 44 px y solo aparecen donde entra el servicio más corto.
- **Celular:** el cajón del menú retiene el foco y deja inerte lo de atrás; la Agenda con turnos de 44 px y la vista Semana legible.
- **Mis turnos:** reprogramar solo ofrece días en que esa persona atiende y el aviso ya no tapa la hoja de cancelar; "Elegí con quién" muestra los horarios libres reales.
- **Calendario:** el .ics del turno lo arma \`lib/reservas/ics\`, con la hora en UTC, y se descarga sin cortes en Safari.
- Los degradados y brillos que quedaban (ver "Turnos minimalista"), "Agregar" y los canales de Mensajes de 44 px, y "Avanzado" en el menú vuelve al inicio de Avanzado.

En la consola solo queda el 401 de \`POST /api/auth/refresh\`, que es del entorno local sin sesión y aparece igual en el resto del sitio.

${comoQuedo('turnos', ['Agenda · 390', 'panel-agenda-despues-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/turnos/admin/Ganancias.tsx:27',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:94',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:109-113',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:15-18',
      'apps/web/src/modules/turnos/storefront/MisTurnos.tsx:411',
      'apps/web/src/modules/turnos/storefront/reserva/acciones.ts:11-24',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:218-222',
    ],
  }),

  // ─── Alquileres · Alan ──────────────────────────────────────────────────────
  entrada({
    modulo: 'alquileres', fecha: F, slug: 'alta-de-alquileres', tipo: 'tarea', quien: 'Alan',
    titulo: 'Alta de Alquileres: qué alquilás define el modo',
    foco: 'El primer paso propio de Alquileres en el alta única pregunta qué se alquila (por hora, un salón o un alojamiento) y eso define el modo; el siguiente pide lo mínimo de ese modo.',
    que: `Quien elige Alquileres en el alta única pasa por dos pasos propios antes de los comunes:
1. **¿Qué alquilás?** Canchas o espacios por hora, salón para eventos, o casa, depto o cabaña. Eso define el modo (cancha, bloque o estadía) y cómo se nombra lo que sigue: la estación del arco pasa a decir "Tus canchas", "Tu salón" o "Tu propiedad". Las tres tarjetas son radios nativos: una parada de Tab y flechas para elegir (pulido final, commit 6c542).
2. **Lo que alquilás:** las canchas con su precio por hora; o el salón con capacidad, duración del bloque, limpieza, depósito y paquetes; o la primera propiedad con huéspedes, ambientes, precio por noche, mínimo de noches y limpieza.

El resto (tu negocio, ubicación, tu página, cuenta y pago) es el del alta de todos los módulos. En la demo (\`/alquileres-demo/onboarding\`), al terminar se guarda el negocio en la demo de Alquileres y se abre su panel en ese modo. En el alta real (\`/onboarding/rubro\`) Alquileres sale como "Próximamente" y su código no se descarga.

${comoQuedo('alquileres', ['¿Qué alquilás? · 1280', 'alta-tipo-1280.webp'], ['¿Qué alquilás? · 390', 'alta-tipo-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/onboarding/pasos.tsx:1-5',
      'apps/web/src/modules/alquileres/onboarding/pasos.tsx:70',
      'apps/web/src/modules/alquileres/onboarding/pasos.tsx:111',
      'apps/web/src/modules/alquileres/onboarding/pasos.tsx:54',
      'apps/web/src/modules/alquileres/datos/index.ts:49',
      'apps/web/src/modules/onboarding/alta/textos.ts:110-114',
      'apps/web/src/pages/alquileres-demo/onboarding.tsx:1-4',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'modo-cancha', tipo: 'tarea', quien: 'Alan',
    titulo: 'Modo cancha: reservas por hora',
    foco: 'Canchas, salas o boxes que se reservan por hora: precio por cancha, franjas con descuento o recargo, turnos seguidos, seña y extras, con la disponibilidad y el precio de lib/reservas.',
    que: `Para canchas, salas de ensayo o boxes. El negocio de ejemplo, Complejo La Cancha, tiene cuatro (Cancha 1 y Cancha 2 de fútbol 5, Pádel 1 y Tenis), cada una con su precio por hora, y define:
- cuánto dura un turno, cada cuánto arranca uno y cuántos seguidos se pueden tomar (hasta 3 en el ejemplo);
- franjas con descuento o recargo (−15 % de lunes a viernes de 9 a 16; +15 % todos los días de 19 a 22);
- seña (50 %), cancelación sin cargo (hasta 24 h antes) y extras (iluminación, pelotas, pecheras).

El sitio muestra las canchas y los próximos horarios libres. La reserva va cancha → día y horario → extras → tus datos → seña, sin registrarse, y queda en Mis reservas y en el panel. Los horarios libres salen de \`franjasDelDia\` y \`consecutivasDesde\` (nunca ofrece un turno que pise otro) y el precio de \`precioTurnosSeguidos\`: cada hora con el ajuste de su franja, con una línea por tramo en el resumen.

**Diferencias con el plan:** la tarea del 3/11 pide canchas "con duración y precio distintos": el precio es de cada cancha, pero la duración del turno es una sola para el negocio (el pedido hablaba de "duración mínima" y "saltos de horario" del negocio).

${comoQuedo('alquileres', ['Sitio · 1280', 'sitio-cancha-1280.webp'], ['Reserva · 390', 'reserva-cancha-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/datos/index.ts:326-347',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:1-4',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:93-97',
      'apps/web/src/modules/alquileres/storefront/Home.tsx:1-4',
      'apps/web/src/lib/reservas/disponibilidad.ts:30',
      'apps/web/src/lib/reservas/disponibilidad.ts:55',
      'apps/web/src/lib/reservas/precio.ts:61',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'modo-bloque', tipo: 'tarea', quien: 'Alan',
    titulo: 'Modo bloque: salón para eventos',
    foco: 'Salones de cumpleaños, quinchos o salas de reunión que se reservan por bloque fijo, con paquetes por cantidad de invitados, extras, limpieza entre bloques, seña, saldo y depósito.',
    que: `Una reserva ocupa un bloque fijo del día. Los bloques salen del horario del salón, de lo que dura cada uno (4 h en el ejemplo) y de la limpieza entre uno y otro (90 min), que no se puede reservar: Salón Burbujas abre de miércoles a domingo y tiene "Tarde" de 14:00 a 18:00 y "Noche" de 19:30 a 23:30.
- **Paquetes por invitados:** hasta 30, 60 y 100, cada uno con lo que incluye (mesas, sillas y vajilla, pelotero, personal de salón, mesa dulce). El salón tiene cupo máximo (100) y no deja pasarse del paquete elegido.
- **Extras que suman al total:** DJ, inflables, animador, mozo extra, torta y decoración temática.
- **Plata:** seña del 30 % y el saldo en el lugar; depósito de garantía de $50.000 que solo se registra (no se cobra desde Órbita).
- **Política:** la cancelación sin cargo (hasta 72 h antes en el ejemplo) se muestra en el paso de la seña, antes de confirmar.

La reserva va día y bloque → paquete e invitados → extras → datos del evento (quién cumple, edad, notas) → seña. En el panel, Calendario muestra el mes con los días que tienen evento, y **Eventos** reemplaza a Clientes: cada evento tiene su ficha (cumpleañero o cumpleañera, edad, invitados, paquete, extras, saldo y notas), porque lo que el dueño busca es el evento y no la persona que reservó.

**Diferencias con el plan:** la tarea del 9/11 habla de bloques "cada uno con su precio": el precio es por paquete de invitados, como pedía la Fase 2. La del 12/11 pide además un mail de confirmación en modo STUB: no hay mail porque el módulo no tiene backend.

${comoQuedo('alquileres', ['Sitio · 1280', 'sitio-salon-1280.webp'], ['Reserva · 390', 'reserva-salon-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/datos/index.ts:103-113',
      'apps/web/src/modules/alquileres/datos/index.ts:364-386',
      'apps/web/src/modules/alquileres/datos/index.ts:467-468',
      'apps/web/src/lib/reservas/disponibilidad.ts:84',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:432-436',
      'apps/web/src/modules/alquileres/admin/Eventos.tsx:1-4',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:324-325',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'modo-estadia', tipo: 'tarea', quien: 'Alan',
    titulo: 'Modo estadía: casa, depto o cabaña',
    foco: 'Alojamiento por noches: rango de entrada y salida con dos toques, mínimo de noches, temporadas, fin de semana, limpieza, seña y varias propiedades, sin choques con reservas ni bloqueos.',
    que: `Reserva por rango de fechas: se toca el día de entrada y después el de salida. La salida no se duerme: del 14 al 16 son dos noches y otra reserva puede entrar el 16.
- **Cada propiedad:** máximo de huéspedes, mínimo de noches, precio por noche con temporadas (en Cabaña Arrayán: alta, baja y Carnaval, que cae adentro de la alta; si dos se pisan, manda la más corta), recargo de fin de semana (+15 % las noches de viernes y sábado), limpieza fija, seña (30 %) y horas de entrada y salida (15:00 y 10:00).
- **Sin choques:** un rango que pisa una reserva o un bloqueo del dueño no se puede elegir, y la pantalla dice por qué; tampoco uno más corto que el mínimo de noches.
- **Varias propiedades por cuenta:** Cabañas del Bosque tiene dos cabañas y un depto, cada uno con fotos, ambientes, camas, baños, comodidades, ubicación en el mapa y su calendario.
- **Precio claro:** una línea por precio (temporada o fin de semana) más la limpieza, así el total se entiende.

En el panel, Calendario es la ocupación del mes de cada propiedad, con llegadas, salidas y el porcentaje ocupado, y **Huéspedes** reemplaza a Clientes. En Mis reservas la estadía muestra su rango y se cancela sin cargo hasta 7 días antes (la política del ejemplo).

**Diferencias con el plan:** la tarea del 23/11 dice "con dos calendarios": el selector muestra un mes por vez, que es el estándar en celular, y el rango igual se elige con dos toques.

${comoQuedo('alquileres', ['Sitio · 1280', 'sitio-estadia-1280.webp'], ['Reserva · 390', 'reserva-estadia-390.webp'])}`,
    archivos: [
      'apps/web/src/lib/reservas/estadia.ts:1-4',
      'apps/web/src/lib/reservas/estadia.ts:119',
      'apps/web/src/lib/reservas/estadia.ts:145',
      'apps/web/src/design-system/reservas/Calendario.tsx:146',
      'apps/web/src/modules/alquileres/datos/index.ts:115-133',
      'apps/web/src/modules/alquileres/datos/index.ts:400-433',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:314-316',
      'apps/web/src/modules/alquileres/storefront/MisReservas.tsx:47-54',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'panel-alquileres', tipo: 'tarea', quien: 'Alan',
    titulo: 'Panel de Alquileres por modo',
    foco: 'El panel muestra solo lo que aplica al modo: la agenda (Reservas o Calendario), Clientes, Eventos o Huéspedes, Ingresos y Configuración, con la seña, el saldo y el depósito registrados a mano.',
    que: `Cuatro secciones, las que el modo necesita:
- **Agenda:** Reservas en canchas (el día, cancha por cancha y hora por hora; en celular, una lista por cancha); Calendario en el salón (el mes con los días con evento y los eventos del día elegido) y en la estadía (la ocupación del mes por propiedad, con llegadas y salidas). Desde cualquiera se abre el detalle de una reserva (registrar seña, saldo o depósito, cancelar, marcarla realizada) y se agenda a mano.
- **La gente:** Clientes en canchas, Eventos en el salón y Huéspedes en la estadía, con cuántas veces reservaron, cuánto gastaron y su historial. Sale de las reservas: no hay una lista aparte que mantener.
- **Ingresos:** cuánto entró, cuántas reservas, qué seña falta cobrar y la ocupación del período, con una serie por semana y otra por unidad, en el acento del sistema.
- **Configuración:** pestañas con borrador y botón Guardar: datos, horarios, reglas de reserva, lo propio del modo (canchas y precios por franja; salón, paquetes y extras; propiedades con temporadas, fotos y mapa) y calendarios (.ics).

Todo vive en el almacén de la demo, en el navegador: una reserva hecha en el sitio aparece en el panel, y lo que se confirma en el panel se ve en Mis reservas.

${comoQuedo('alquileres', ['Reservas de canchas · 1280', 'panel-cancha-1280.webp'], ['Calendario de la estadía · 390', 'panel-estadia-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/Panel.tsx:1-9',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:102',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:1-7',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:432-436',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:1-4',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:91',
      'apps/web/src/modules/alquileres/datos/negocio.ts:1-5',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'calendarios-ics', tipo: 'tarea', quien: 'Alan',
    titulo: 'Calendarios .ics de Alquileres: exportar de verdad, importar simulado',
    foco: 'Cada cancha, salón o propiedad descarga su calendario .ics generado en el navegador; importar la URL .ics de Airbnb, Booking o Google es simulado y la pantalla lo dice.',
    que: `En Configuración → Calendarios (.ics):
- **Exportar (real):** cada cancha, salón o propiedad tiene "Descargar calendario (.ics)". El archivo se arma en el navegador con sus reservas: las estadías como días enteros y las canchas y los bloques con hora en UTC. Los bloqueos del dueño salen como "No disponible", así el otro sistema tampoco vende esas fechas; lo que vino de un calendario externo no se vuelve a exportar.
- **Importar (simulado):** se elige para qué unidad, se le pone un nombre y se pega la URL .ics que dan Airbnb, Google o Booking (la de Booking termina en \`ical.html\` y también vale). No se descarga nada: se cargan dos bloqueos de ejemplo, y la pantalla lo avisa con el rótulo "Demo: sincronización simulada" y con "En la demo no se descarga nada". Lo importado bloquea de verdad en los tres modos y, al quitar el calendario, se van sus bloqueos.

Generar y leer el .ics es de \`lib/reservas/ics\`, con tests. Falta probar el archivo descargado en Google Calendar y en el calendario del iPhone: lo piden las tareas del 25/11 y del 4/12 del plan, que por eso no se vincularon.

${comoQuedo('alquileres', ['Exportar · 1280', 'configuracion-calendarios-1280.webp'], ['Importar · 390', 'configuracion-calendarios-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx:1-3',
      'apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx:39',
      'apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx:49',
      'apps/web/src/lib/reservas/ics.ts:1-7',
      'apps/web/src/lib/reservas/ics.ts:70',
      'apps/web/src/lib/reservas/ics.ts:125',
      'apps/web/src/design-system/reservas/piezas.tsx:288',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'calendarios-solo-ical', tipo: 'decisión', quien: 'Alan',
    titulo: 'Calendarios externos solo por iCal (.ics)',
    foco: 'Sin sincronización con Airbnb, Booking ni Google: Alquileres (y Gimnasio) exportan su .ics y lo de afuera entra por la URL .ics del calendario externo.',
    que: `Los calendarios externos se resuelven con iCal (.ics), el formato que Airbnb, Booking y Google ya usan para exportar e importar disponibilidad: Alquileres exporta el calendario de cada unidad y lee la URL .ics de uno externo (simulado en la demo). Gimnasio usa el mismo esquema para su grilla de clases.`,
    decision: 'Calendarios externos solo por iCal (.ics): exportar real e importar por URL. Sin APIs de Airbnb, Booking ni Google.',
    porque: 'Es la decisión 7 del pedido de Ale. Sincronizar con Airbnb, Booking o Google necesita las APIs de partner de cada uno y un servidor que consulte y guarde, y estos módulos no tienen backend; el .ics lo aceptan los tres sin acuerdos. La consecuencia es que no hay un link de suscripción que se actualice solo (lo pide la tarea del 3/12 del plan, que por eso no se vinculó): servir un .ics vivo necesita un servidor.',
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx:1-3',
      'apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx:74',
      'apps/web/src/modules/gimnasio/admin/configuracion/Calendarios.tsx:21',
      'apps/web/src/lib/reservas/ics.ts:1-7',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'cobros-a-mano', tipo: 'decisión', quien: 'Alan',
    titulo: 'Seña, saldo y depósito se registran a mano',
    foco: 'En Alquileres (y en Gimnasio) Órbita no cobra nada nuevo: el pago de la seña es simulado y el dueño registra a mano la seña, el saldo y el depósito.',
    que: `En el sitio, el pago de la seña es simulado. En el panel, el detalle de cada reserva tiene "Registrar seña", "Registrar saldo" y "Registrar depósito": el dueño marca lo que cobró por su cuenta. El depósito de garantía del salón nunca se cobra desde Órbita, solo queda registrado. En Gimnasio, los planes y las clases sueltas también se registran a mano (lo dice Ingresos).`,
    decision: 'Seña, saldo y depósito se registran a mano desde el panel. No se integran cobros nuevos.',
    porque: 'Es la decisión 6 del pedido de Ale. Los módulos son demos sin backend, y cobrar de verdad (con Mercado Pago u otro medio) necesita uno: la cuenta de cobro del negocio, los avisos de pago y las devoluciones. Registrar a mano alcanza para mostrar el circuito completo (seña, saldo, depósito) sin prometer un cobro que no existe.',
    archivos: [
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:432-436',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:450-452',
      'apps/web/src/modules/alquileres/datos/index.ts:110-111',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:8-9',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:148',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'bloquear-dia-canchas-y-salon', tipo: 'decisión', quien: 'Alan',
    titulo: 'Bloquear un día también en canchas y en el salón',
    foco: 'La QA de Alquileres sumó "Bloquear un día" en canchas y en el salón, que el pedido no exigía: queda como decisión a confirmar por Alan.',
    que: `En la agenda de canchas y del salón hay un botón "Bloquear un día": se elige el día, el motivo y, en canchas, una cancha o todas. Desde ahí ese día no se puede reservar. Lo que ya estaba reservado sigue en pie: la pantalla avisa cuántas reservas hay, y se cancelan desde la agenda si no se van a poder usar. Usa el mismo bloqueo que "Bloquear fechas" de la estadía y que lo importado por .ics.`,
    decision: 'Canchas y salón también tienen "Bloquear un día" (feriado, torneo, mantenimiento o un evento propio), además del "Bloquear fechas" de la estadía.',
    porque: 'La agregó la QA de Alquileres (commit ce12d) sin que el pedido lo exigiera: el pedido solo hablaba de bloqueos del dueño en la estadía, pero una cancha en mantenimiento o un salón cerrado por feriado tienen el mismo problema, y en esos dos modos no había cómo cerrar un día puntual desde el panel. Queda a confirmar por Alan: si no va, se saca el botón de la agenda de canchas y del salón (BloquearDia en Reservas.tsx).',
    archivos: [
      'apps/web/src/modules/alquileres/admin/Bloquear.tsx:1-5',
      'apps/web/src/modules/alquileres/admin/Bloquear.tsx:18',
      'apps/web/src/modules/alquileres/datos/index.ts:135-146',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'qa-responsive-alquileres', tipo: 'tarea', quien: 'Alan',
    titulo: 'QA responsive de Alquileres en 390, 768 y 1280',
    foco: 'Recorrida en el navegador de los tres modos en cuatro anchos, con ocho suites de flujos: dos cuentas de plata corregidas en lib/reservas, la recarga del panel y una veintena de arreglos de diseño.',
    que: `Se recorrieron en el navegador los tres modos: 36 pantallas a 1280, 768, 390 y 390 en oscuro, y ocho suites de flujos con Playwright (a 1280 y a 390 con toque), sin fallas en la última pasada. Lo que se arregló (commit ce12d):

**Cuentas** (\`lib/reservas\` pasó de 36 a 40 tests):
- Turnos seguidos: cada hora se cobra con su franja. Antes el ajuste de la primera hora se aplicaba a todas (de 15 a 17 un día de semana cobraba las dos con el −15 %).
- Redondeo: 45.000 × 1,15 daba $51.700 por la coma flotante; ahora $51.800.
- Un rango de un solo día dice "20 de noviembre" y no "20 al 20 de noviembre".

**Panel:**
- Al recargar en Configuración se veía el negocio de ejemplo y guardar pisaba lo del dueño: el almacén avisa cuándo ya leyó lo guardado (\`useHidratado\`) y las secciones se vuelven a montar con eso.
- "Última" en Clientes y Huéspedes mostraba una reserva futura; los días de "Precios por horario" se desarmaban al tocar uno; sin desborde a 390 en Propiedades y Calendarios; acepta la URL iCal de Booking; "Bloquear un día" en canchas y en el salón (decisión aparte); días completos del salón sin tachar; plurales ("1 noche", "1 huésped").

**Sitio y reserva:**
- La reserva arranca en "Cuándo" si se viene de un horario o de una propiedad; la seña figura desde el principio; la barra fija dice qué falta; desglose por noche y franjas incluidas marcadas.
- Pie con márgenes, marca de 44 px, galería sin huecos con 1 a 4 fotos, precios de temporada sin cortes y el mapa fuera del orden del Tab.
- Mis reservas: dos próximas y cuatro anteriores, y un aviso de que la demo tiene la fecha fija.`,
    archivos: [
      'apps/web/src/lib/reservas/precio.ts:42-47',
      'apps/web/src/lib/reservas/precio.ts:53-61',
      'apps/web/src/lib/reservas/fechas.ts:119',
      'apps/web/src/modules/alquileres/datos/negocio.ts:87',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:67-71',
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:43',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:112',
      'apps/web/src/modules/alquileres/storefront/Sitio.tsx:269',
      'apps/web/src/modules/alquileres/storefront/MisReservas.tsx:42-43',
    ],
  }),

  // ─── Gimnasio · Ale ─────────────────────────────────────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'grilla-y-reserva', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: grilla semanal, reserva de lugar y lista de espera',
    foco: 'Clases con cupo, profe y sala en una grilla que se repite cada semana; se reserva el lugar sin registrarse y, si la clase está llena, la lista de espera avanza sola.',
    que: `Cada negocio tiene una grilla semanal de clases (actividad, día, hora, profe, sala y cupo) que se repite todas las semanas y se edita desde el panel (Clases → Grilla semanal).
- **En el sitio:** hoy arriba (lo que queda del día) y la semana completa, cada clase con los lugares libres o "Completa · lista de espera".
- **Reserva:** clase → cómo se paga (plan, pack, suelta o prueba) → datos → listo, sin registrarse: con nombre y celular alcanza, y quien ya tiene plan entra con su celular. Se reserva con anticipación limitada (hasta 14 días en el ejemplo de crossfit) y se cancela sin perder la clase hasta un plazo (2 h antes en ese ejemplo).
- **Lista de espera que avanza sola:** si la clase está llena, la persona queda en espera; cuando alguien cancela, el primero que esperaba pasa a reservado, y si el dueño le sube el cupo a la clase, pasan los que entren. Con un lugar libre, desde el panel también se le puede "dar el lugar" a mano.

La reserva aparece en Mis clases y en el panel: el cupo y las reglas son las mismas desde los dos lados porque viven en el almacén de la demo.

${comoQuedo('gimnasio', ['Sitio · 1280', 'sitio-1280.webp'], ['Reserva · 390', 'reserva-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/datos/index.ts:113-114',
      'apps/web/src/modules/gimnasio/datos/index.ts:567',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:6-12',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:177-179',
      'apps/web/src/modules/gimnasio/storefront/Home.tsx:1-3',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:1-4',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:1-4',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'planes', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: planes de prueba, clase suelta, pack y membresía',
    foco: 'Cuatro tipos de plan para todos los rubros: prueba gratis una vez por persona, clase suelta, pack que se descuenta al reservar y membresía con tope semanal o pase libre.',
    que: `Todos los rubros usan los mismos cuatro tipos de plan, cada uno con precio, vigencia en días y si se ofrece en el sitio:
- **Clase de prueba:** gratis, una vez por persona. Se reconoce por el celular (los últimos 8 dígitos) o el email, aunque reserve como alguien nuevo.
- **Clase suelta:** se paga esa clase.
- **Pack de N clases:** se descuenta una al reservar; si se cancela a tiempo, vuelve. Quien pasa de la lista de espera a reservado también la descuenta. Con el pack agotado, la reserva ofrece elegir otro plan.
- **Membresía mensual:** con tope de clases por semana (2 o 3 en el ejemplo) o pase libre. La clase de más de esa semana no entra con la membresía y se puede pagar aparte como suelta.

Las reglas valen igual desde el sitio y desde el panel y tienen 14 tests (\`datos/__tests__/reglas.test.ts\`). En Mis clases cada socio ve su plan, cuándo vence y cuántas clases usó esa semana.

${comoQuedo('gimnasio', ['Mis clases · 390', 'mis-clases-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/datos/index.ts:65-72',
      'apps/web/src/modules/gimnasio/datos/index.ts:116-130',
      'apps/web/src/modules/gimnasio/datos/index.ts:599',
      'apps/web/src/modules/gimnasio/datos/index.ts:606-623',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:6-10',
      'apps/web/src/modules/gimnasio/datos/__tests__/reglas.test.ts:1-5',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'socios-vencimientos', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: socios con plan, vencimiento y aviso a 7 días',
    foco: 'Cada socio con su plan, vencimiento, clases que le quedan y asistencia; los que vencen en los próximos 7 días van primero, con un aviso arriba y la renovación desde la ficha.',
    que: `Socios (Atletas en crossfit; Alumnos o Participantes en otros rubros) muestra a cada persona con su plan, cuándo vence, cuántas clases le quedan (pack o tope semanal) y su asistencia de los últimos 30 días.
- Los que vencen en los próximos 7 días van primero, con un aviso arriba ("2 planes vencen en los próximos 7 días: …").
- Indicadores y filtros: Al día, Vencen en 7 días, Vencidos (plan vencido o pack agotado) y Sin plan, más un buscador por nombre o teléfono. En celular la tabla pasa a tarjetas y los filtros van detrás de un botón.
- Desde la ficha se asigna un plan o se renueva el que tiene, y se ve el historial.

**Diferencias con el plan:** la tarea del 12/11 pedía además el aviso por mail, en modo STUB. No hay mail porque el módulo no tiene backend: el aviso es el del panel.

${comoQuedo('gimnasio', ['Socios · 1280', 'panel-socios-1280.webp'], ['Socios · 390', 'panel-socios-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:1-4',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:98-99',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:181-197',
      'apps/web/src/modules/gimnasio/datos/index.ts:576',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'check-in-y-pagina-publica', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: check-in y página pública',
    foco: 'Check-in desde la lista de asistencia de cada clase en el panel y desde Mis clases; página pública con hoy, la semana, los planes, cómo llegar y Mis clases.',
    que: `**Check-in**, en los dos lados:
- En el panel, cada clase abre su lista: check-in por persona, "Faltó" en las clases que ya pasaron y la lista de espera con "Darle el lugar".
- En Mis clases, el socio hace su check-in desde la reserva.
- Se abre el día de la clase, unos minutos antes (configurable); en las clases pasadas sirve para corregir la asistencia.

**Página pública:** hoy (lo que queda del día), la semana completa con los lugares libres, los planes con precio (la clase de prueba aparte, arriba), dónde queda con el mapa, y "Mis clases": plan, vencimiento, clases que quedan, próximas clases con check-in y cancelación, lista de espera e historial de asistencia. En celular, el botón de reservar queda fijo al pie sin tapar el contenido.

**Diferencias con el plan:** las tareas del 16/11 y del 17/11 piden buscar al socio por nombre, guardar la hora del ingreso y avisar en el check-in si el plan está vencido. El check-in quedó por clase (la lista de asistencia, como pedía la Fase 3): no guarda la hora ni avisa del plan vencido. La del 16/11 se vinculó a esta entrada; la del 17/11 no.

${comoQuedo('gimnasio', ['Clases del día · 1280', 'panel-clases-1280.webp'], ['Mis clases · 390', 'mis-clases-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:220-221',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:255',
      'apps/web/src/modules/gimnasio/storefront/MisClases.tsx:1-5',
      'apps/web/src/modules/gimnasio/storefront/MisClases.tsx:48',
      'apps/web/src/modules/gimnasio/storefront/Sitio.tsx:1-4',
      'apps/web/src/modules/gimnasio/storefront/Home.tsx:147',
      'apps/web/src/modules/gimnasio/storefront/Sitio.tsx:153',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'panel-e-ingresos', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: panel con clases, socios, ingresos y configuración',
    foco: 'El panel del gimnasio tiene cuatro secciones: Clases (el día y la grilla), Socios, Ingresos por período y por plan, y Configuración con horarios, actividades, profes, planes y calendarios.',
    que: `Cuatro secciones:
- **Clases:** el día, con la ocupación de cada clase (barra de cupo, "N de M vinieron" en las pasadas, quiénes esperan), y la grilla semanal para editar.
- **Socios:** ver "Socios con plan, vencimiento y aviso a 7 días".
- **Ingresos:** lo que entró por planes y clases sueltas, socios al día, vencen en 7 días y ocupación, para Este mes, Mes pasado o Últimos 3 meses, con una serie por semana y "Por plan" en filas de mayor a menor. Las ventas se cuentan por la fecha en que arrancó el plan y, para atrás, una renovación por vigencia desde que la persona es socia.
- **Configuración:** datos del negocio, horarios, actividades, salas y profes, planes y precios, reglas de reserva, días sin clases y calendarios .ics (el esquema de Alquileres: la grilla de las próximas cuatro semanas se exporta de verdad y la importación es simulada).

**Diferencias con el plan:** la tarea del 1/12 pide comparar el mes contra el anterior; Ingresos no los muestra lado a lado (se ve cambiando el período), y por eso no se vinculó.

${comoQuedo('gimnasio', ['Ingresos · 1280', 'panel-ingresos-1280.webp'], ['Ingresos · 390', 'panel-ingresos-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:1-7',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:1-4',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:1-5',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:20',
      'apps/web/src/modules/gimnasio/admin/configuracion/Negocio.tsx:6',
      'apps/web/src/modules/gimnasio/admin/configuracion/Actividades.tsx:25',
      'apps/web/src/modules/gimnasio/admin/configuracion/Calendarios.tsx:21',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'un-motor-para-clases-con-cupo', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: un solo motor para todos los rubros con cupo',
    foco: 'Gimnasio, crossfit, funcional, yoga y pilates, danza, artes marciales, natación y talleres comparten un solo motor; lo que cambia por rubro son los datos y los nombres.',
    que: `Los ocho rubros usan la misma grilla semanal con cupo, profe y sala; los mismos cuatro tipos de plan; los mismos socios, check-in y lista de espera; y las mismas pantallas. Lo que cambia por rubro está en los datos: actividades, salas, profes, planes y precios por defecto, fotos y cómo se llama cada cosa (Coach y Atletas en crossfit, Sensei en artes marciales, Tallerista y Participantes en talleres). Desde el pulido final (commit 6c542) cada rubro tiene su foto de portada; natación, danza y artes marciales usan la más neutra que hay porque faltan fotos propias (pileta, salón de baile, dojo).`,
    decision: 'Un solo motor de clases con cupo para los ocho rubros de Gimnasio, con datos y nombres por rubro.',
    porque: 'Lo pide la Fase 3 del pedido de Ale ("Todos son clases con cupo y comparten el mismo motor"). Un motor por rubro serían ocho copias de las mismas reglas (cupo, lista de espera, tope semanal, pack, prueba una vez por persona) que se desalinean con el primer arreglo; con uno solo, los 14 tests de reglas valen para los ocho.',
    archivos: [
      'apps/web/src/modules/gimnasio/datos/index.ts:12-14',
      'apps/web/src/modules/gimnasio/datos/index.ts:29',
      'apps/web/src/modules/gimnasio/datos/index.ts:74-102',
      'apps/web/src/modules/gimnasio/datos/__tests__/reglas.test.ts:1-5',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'qa-responsive-gimnasio', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: QA responsive en 390, 768 y 1280',
    foco: 'Recorrida en el navegador de cinco rubros en cuatro anchos y 294 verificaciones de flujos: arreglos de recarga, datos de ejemplo coherentes, check-in y contraste.',
    que: `Se recorrieron en el navegador cinco rubros a 1280, 768, 390 y 390 en oscuro, con 294 verificaciones de flujos en Playwright a 1280 y a 390 con toque. Lo que se arregló (commit b1b1c):
- **Recarga:** al recargar el panel en Configuración se veía el negocio de ejemplo y guardar pisaba lo del dueño. El almacén avisa cuándo ya leyó lo guardado (\`useHidratado\`) y el panel espera; la reserva se vuelve a montar con lo guardado.
- **Datos de ejemplo coherentes:** el plantel se calcula según el cupo de la grilla, cada socio viene en sus días fijos y respeta su plan, y las renovaciones cuentan en Ingresos (antes había 16 socios para 25 clases y gente sin plan con 53 clases en un mes). Socios muestra de a 25.
- **Check-in** solo desde la ventana del día o en clases pasadas; una clase en curso ya no se puede reservar por link.
- **Contraste y textos:** barra de cupo y "Vence" con contraste AA, "Completa" legible, "1 lugar" en singular.
- **Sitio:** planes con la prueba aparte, pie alineado, marca de 44 px. **Reserva:** el botón fijo dice "Pagar $X". **Mis clases:** la asistencia en su fila.
- **Configuración:** la pestaña activa visible en la tira; los bloqueos de un día bien escritos. **Ingresos:** "Últimos 3 meses" son tres, sin semanas futuras en cero, y "Por plan" en filas ordenadas.`,
    archivos: [
      'apps/web/src/modules/gimnasio/datos/negocio.ts:228',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:146-150',
      'apps/web/src/modules/gimnasio/datos/index.ts:362-369',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:220-221',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:169',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:165',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:98',
    ],
  }),

  // ─── Transversal (en Gimnasio, el módulo de Ale) ────────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'lib-reservas', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: lib/reservas, la lógica compartida de reservas',
    foco: 'Reglas puras de calendario y de plata para Alquileres, Gimnasio, el alta y Turnos: fechas, solapamiento, disponibilidad, precio, estadía e iCal, con 40 tests.',
    que: `\`apps/web/src/lib/reservas/\` es una librería de funciones puras: sin React, sin estado, sin leer el navegador ni la hora actual (el "hoy" entra como parámetro). Cada archivo con sus tests de vitest, 40 en total:
- \`fechas.ts\`: fechas \`AAAA-MM-DD\` y horas en minutos, sin zona horaria, y los textos de fecha.
- \`solapamiento.ts\`: si dos tramos \`[desde, hasta)\` se pisan; 10:00 a 10:30 y 10:30 a 11:00 no chocan.
- \`disponibilidad.ts\`: franjas libres de un día, turnos seguidos con saltos de horario, bloques fijos con limpieza en el medio y ocupación.
- \`precio.ts\`: franjas con descuento o recargo, extras, seña, saldo y redondeo a cien; los turnos seguidos, cada uno con su franja.
- \`estadia.ts\`: noches, temporadas (si se pisan, manda la más corta), fin de semana, mínimo de noches, rangos ocupados y salida máxima.
- \`ics.ts\`: generar el .ics (estadías como días enteros, el resto con hora en UTC, líneas plegadas por bytes UTF-8), leer uno externo y descargarlo.

La usan Alquileres, Gimnasio, el kit de reservas, los pasos de reservas del alta y Turnos (las fechas y el .ics). La QA de Alquileres (ce12d) corrigió ahí dos cuentas, que quedaron bien en todos lados a la vez: los turnos seguidos cobraban todas las horas con el ajuste de la primera, y 45.000 × 1,15 daba $51.700 por la coma flotante (ahora $51.800). El porqué de compartirla y qué puede ir ahí está en \`lib/reservas/README.md\` (decisión "Módulos independientes").

**Diferencias con el plan:** la tarea del 27/10 habla de "cupos": el cupo de las clases es una regla de Gimnasio y está en sus propios tests (\`gimnasio/datos/__tests__/reglas.test.ts\`), no en la librería.`,
    archivos: [
      'apps/web/src/lib/reservas/README.md:12-24',
      'apps/web/src/lib/reservas/fechas.ts:1-8',
      'apps/web/src/lib/reservas/solapamiento.ts:1-4',
      'apps/web/src/lib/reservas/disponibilidad.ts:1-5',
      'apps/web/src/lib/reservas/precio.ts:1-3',
      'apps/web/src/lib/reservas/precio.ts:53-61',
      'apps/web/src/lib/reservas/estadia.ts:1-4',
      'apps/web/src/lib/reservas/ics.ts:1-7',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'kit-reservas', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: kit design-system/reservas',
    foco: 'La UI compartida de Alquileres, Gimnasio y los pasos de reservas del alta (prefijo rv-): calendario de día y de rango, campos, modales que en celular son hoja inferior, indicadores, barras y el panel con cajón.',
    que: `\`apps/web/src/design-system/reservas/\` es el kit visual de reservas, con las mismas reglas que \`lib/reservas\`: no sabe de ningún módulo.
- **estilo.tsx:** una hoja \`rv-\` para el panel, el alta y el sitio: un acento, la tipografía del cuerpo, bordes finos, sin degradados ni brillos, con los tokens \`--color-*\` (el claro y el oscuro salen solos; el sitio redefine los tokens con el tema del negocio). Inputs de 16 px, toques de 44 px en celular, foco visible y movimiento que se apaga con \`prefers-reduced-motion\`.
- **Calendario.tsx:** un mes por vez y celdas de 44 px, para elegir un día o un rango con dos toques (entrada y salida), también con teclado (flechas, Inicio y Fin, RePág y AvPág).
- **piezas.tsx:** encabezado, campos, selectores, segmentados, interruptores, modal (hoja inferior en celular, con el foco retenido), aviso, indicadores, barras, filtros plegables y la etiqueta "Demo: sincronización simulada".
- **LayoutPanel.tsx:** barra lateral de 240 px en escritorio y cajón por debajo de 768 px (el foco entra al ítem activo, lo de atrás queda inerte y Escape lo cierra).

La QA (commit 8ebb7) lo ajustó en celular: el cajón llega hasta abajo, el modal y el cajón frenan el scroll de la página, el aviso sale arriba si hay una hoja abierta, los errores y ayudas de los campos ya no salen como un segundo rótulo en negrita, la salida de un rango en un día ocupado ya no sale tachada, las fechas se leen en oscuro (solo en el panel), los íconos van en el renglón del texto y las barras muestran su monto al tocarlas o enfocarlas. En el pulido final (commit 6c542), Campo, Area y Selector dejan la ayuda y el error fuera del \`<label>\`, enlazados con \`aria-describedby\` (y \`aria-invalid\` con error), así el lector no los lee dos veces, y las tarjetas que se eligen como radio (\`.rv-card--radio\`) se recorren con flechas.`,
    archivos: [
      'apps/web/src/design-system/reservas/estilo.tsx:1-12',
      'apps/web/src/design-system/reservas/Calendario.tsx:1-12',
      'apps/web/src/design-system/reservas/Calendario.tsx:146',
      'apps/web/src/design-system/reservas/piezas.tsx:1-3',
      'apps/web/src/design-system/reservas/piezas.tsx:144',
      'apps/web/src/design-system/reservas/piezas.tsx:163',
      'apps/web/src/design-system/reservas/piezas.tsx:174',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:1-10',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'modulos-independientes', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: módulos independientes, lo compartido solo en lib/reservas y el kit',
    foco: 'Turnos, Alquileres y Gimnasio no se importan entre sí; lo que comparten vive en lib/reservas y design-system/reservas, que no conocen a ningún módulo, y eslint lo hace cumplir.',
    que: `Turnos, Alquileres y Gimnasio no se importan entre sí ni importan el alta. Lo que comparten vive en dos lugares que no conocen a ningún módulo: \`lib/reservas\` (reglas de calendario y de plata) y \`design-system/reservas\` (el kit \`rv-\`). El único que conoce a los cuatro módulos es el alta, en un solo sentido. El porqué está escrito en \`lib/reservas/README.md\`, y eslint lo hace cumplir con \`no-restricted-imports\`: un import de un módulo a otro, o de lo compartido a un módulo, es error. Alquileres y Gimnasio tampoco dependen de Tienda ni de la landing.`,
    decision: 'Cada módulo es independiente. Lo compartido vive solo en lib/reservas y design-system/reservas, y eslint marca como error cualquier import entre módulos.',
    porque: 'Ale lo pidió explícito: "cada módulo es independiente", para poder cambiar, borrar o pasarle un módulo a otra persona sin tocar los demás. Se comparte solo lo que son las mismas cuentas, porque una cuenta escrita tres veces termina dando tres resultados: el redondeo de 45.000 × 1,15 se arregló una vez en precio.ts y quedó bien en todos lados, y el .ics de Turnos pasó de hora local a UTC al usar ics.ts. Queda una excepción: Turnos usa piezas de Tienda y de la landing desde antes de esta regla, y cortarlo toca Tienda en producción (decisión abierta "Turnos todavía usa piezas de Tienda y de la landing", en Turnos).',
    archivos: [
      'apps/web/src/lib/reservas/README.md:3-10',
      'apps/web/src/lib/reservas/README.md:47-58',
      'apps/web/eslint.config.mjs:5-27',
      'apps/web/eslint.config.mjs:32-46',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'plan-por-modulo', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el plan de cada módulo es una lista de tareas, no una por semana',
    foco: 'Cada módulo guarda todas sus tareas en una sola lista, con la semana de cada una en los dos horizontes, para poder cambiar de horizonte sin perder lo hecho.',
    que: `El plan de cada módulo con plan (Turnos, Alquileres y Gimnasio) es una sola lista de tareas en \`modules/superadmin/modulos/plan.ts\`. Cada tarea tiene día, quién, criterio de listo y su semana en los dos horizontes: \`semana\` en el de 2 meses y \`semana1m\` en el de 1 mes (o \`null\` si queda afuera, como la estadía). El estado de cada semana se calcula a partir de sus tareas, y los títulos de las semanas de cada horizonte van en el plan.`,
    decision: 'Una lista de tareas por módulo, con la semana de cada tarea en los dos horizontes. El pedido original decía un ítem por semana (modulo.<slug>.semana-N).',
    porque: 'Al pasar al horizonte de 1 mes, las tareas de las semanas 5 a 8 se comprimen en la 3 y la 4, y la estadía queda afuera: guardadas por semana, una tarea quedaría en una semana distinta de la que se muestra, y lo ya tildado se perdería al cambiar de horizonte. Con una lista por módulo, cambiar de horizonte es solo otra forma de agrupar las mismas tareas, y lo tildado se guarda por tarea. La idea nació cuando el plan vivía en el tablero de auditoría (un ítem por módulo en vez de uno por semana); sigue igual ahora que Módulos es solo visual.',
    archivos: [
      'apps/web/src/modules/superadmin/modulos/plan.ts:14',
      'apps/web/src/modules/superadmin/modulos/plan.ts:50',
      'apps/web/src/modules/superadmin/modulos/plan.ts:98',
      'apps/web/src/modules/superadmin/Modulos.tsx:176',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'modulos-solo-visual', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: Módulos es solo visual, sin backend',
    foco: 'La sección Módulos no usa la API ni la base: el plan, las entradas y las decisiones viven en la web, y lo que se marca queda en el navegador de quien lo marca.',
    que: `La primera versión de Módulos (commit 82f05) guardaba el plan y las entradas en el tablero de auditoría de la API: un ítem por plan y uno por entrada, sembrados al listar el tablero y con reglas en el servicio. El 26/10 pasó todo a la web:
- \`modules/superadmin/modulos/plan.ts\`: el ciclo y las tareas de los tres planes.
- \`entradas.ts\` y \`decisiones.ts\`: las entradas de auditoría y las decisiones abiertas, con su informe en Markdown.
- \`estado.ts\`: lo que cada uno tilda, confirma o carga, y el horizonte elegido, en el navegador (localStorage); la pantalla avisa "Se guarda en este navegador".

En el cliente de la API (\`lib/platform/api.ts\`) se sacaron los campos que se habían sumado para Módulos, y la Auditoría general ya no filtra nada: no hay ítems de Módulos en el tablero. La API queda como estaba antes de esta sesión.`,
    decision: 'Módulos es solo visual: el plan, las entradas y las decisiones viven en la web y lo que se marca queda en el navegador de quien lo marca. Para que algo quede para todos, se pasa al código: una entrada nueva a entradas.ts y una confirmación con `confirmada` en su entrada.',
    porque: 'Lo pidió Ale el 26/10/2026: "solo visual, nada de backend quiero". Sin backend no hay migraciones ni deploy de la API para Módulos, y los ítems de los módulos no se mezclan con el inventario de la Auditoría general. El costo es que lo que se tilda en un navegador no lo ven los demás: lo que tiene que ser de todos va al código.',
    archivos: [
      'apps/web/src/modules/superadmin/modulos/estado.ts:1',
      'apps/web/src/modules/superadmin/modulos/plan.ts:3',
      'apps/web/src/modules/superadmin/modulos/entradas.ts:9',
      'apps/web/src/modules/superadmin/Modulos.tsx:18',
      'apps/web/src/lib/platform/api.ts:645',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'qa-superadmin', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: QA de la sección Módulos y del superadmin en 390, 768 y 1280',
    foco: 'Recorrida en el navegador de la sección Módulos (119 verificaciones de flujos) y arreglos en la barra del superadmin, la Auditoría general y el Documento: 44 px, contraste AA y foco.',
    que: `Se recorrió en el navegador la sección Módulos a 1280, 768 y 390, en claro y en oscuro, con 119 verificaciones de flujos (en ese momento con la API simulada a partir de los datos reales). Lo que se arregló (commit 0c9df):
- **Módulos:** el ciclo de 1 mes tiene sus propios títulos de semana (\`semanas1m\`); el foco vuelve a la tarjeta del módulo al volver; tarjetas sin cortes a 1280; el progreso dice "N de M tareas"; una entrada confirmada ya no dice "pendiente"; casillas y fechas legibles en oscuro; campos de 44 px en celular.
- **Informes (MarkdownInforme):** las listas vuelven a tener viñetas (el preflight de Tailwind las sacaba en todos los informes) y las rutas de archivo cortan después de cada barra.
- **Superadmin:** espera a que el router esté listo antes de elegir la sección, así un link directo no monta el Resumen ni dispara sus pedidos; la barra superior medía 168 px a 768 o menos; la hamburguesa y los ítems del cajón pasan a 44 px; la página tiene \`<title>\`.
- **Auditoría general y Documento:** 44 px en celular y contraste AA (chips, filtros, rutas, rótulos, el estado Pendiente y el aviso gris del Documento); el aviso de un guardado que falla ya no se borra con la recarga que le sigue.

Queda sin arreglar el azul primario con texto blanco (3,68:1, no llega a AA): es de todo el panel y lo decide Ale (decisión abierta "Azul primario"). Las capturas son de esa QA, antes de que Módulos pasara a ser solo visual.

${comoQuedo('gimnasio', ['Resumen de un módulo · 1280', 'superadmin-modulos-resumen-1280.webp'], ['Resumen de un módulo · 390', 'superadmin-modulos-resumen-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/superadmin/modulos/plan.ts:63',
      'apps/web/src/modules/superadmin/Modulos.tsx:379',
      'apps/web/src/modules/superadmin/Modulos.tsx:112',
      'apps/web/src/modules/superadmin/Modulos.tsx:504',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:170-173',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:264-267',
      'apps/web/src/modules/superadmin/SuperAdminDashboard.tsx:79',
      'apps/web/src/modules/superadmin/Shell.tsx:83-84',
      'apps/web/src/pages/superadmin/index.tsx:11',
      'apps/web/src/modules/superadmin/Auditoria.tsx:60',
      'apps/web/src/modules/superadmin/Auditoria.tsx:205-207',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'sitios-siempre-claros', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: los sitios públicos de Alquileres y Gimnasio son siempre claros',
    foco: 'El sitio público de cada negocio usa siempre el tema del negocio y no cambia a modo oscuro; el oscuro queda para el panel y el alta.',
    que: `Los sitios públicos de Alquileres y Gimnasio redefinen los tokens \`--color-*\` con el tema del negocio (verde para canchas, rosa para salones, terracota para alojamientos y verde azulado en Gimnasio) y no siguen el modo oscuro del teléfono. El panel sí tiene modo oscuro, y el alta es oscura siempre; el kit de reservas aplica el oscuro solo en el panel (por ejemplo, las fechas de los campos con \`color-scheme: dark\`).`,
    decision: 'Los sitios públicos de Alquileres y Gimnasio no tienen modo oscuro: siempre muestran el tema del negocio, en claro.',
    porque: 'Es el sitio de un negocio, no una app: lo que ve el cliente es la marca de ese negocio y no debería cambiar según el teléfono de quien entra. Lo definió la sesión al armar los módulos y la QA lo tomó como regla ("los sitios públicos usan el tema del negocio y son siempre claros"). Choca con la tarea del 19/11 del plan de Gimnasio ("página pública responsive y en oscuro"), que por eso no se vinculó: si Ale quiere oscuro en los sitios, es trabajo del kit y de los cuatro temas.',
    archivos: [
      'apps/web/src/modules/alquileres/storefront/Sitio.tsx:1-6',
      'apps/web/src/modules/gimnasio/storefront/Sitio.tsx:1-4',
      'apps/web/src/design-system/reservas/estilo.tsx:126',
    ],
  }),

  // ─── Transversal · el alta única ────────────────────────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alta-unica', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: alta única con los cuatro módulos',
    foco: 'Un solo alta para Tienda, Turnos, Alquileres y Gimnasio: arranca eligiendo el módulo y cada uno sigue su recorrido; en el alta real, Tienda sigue igual y los otros tres salen como "Próximamente".',
    que: `El alta se mudó de \`modules/turnos/onboarding\` a \`modules/onboarding/alta\`: ya no es de Turnos, es de los cuatro módulos. Arranca con el paso Módulo (cuatro tarjetas, ver el diseño "Paso Módulo con cuatro tarjetas") y el arco de arriba suma las estaciones del módulo elegido:
- **Tienda:** módulo · qué vendés · tu negocio · ubicación · tu cuenta · pago.
- **Turnos:** módulo · rubro · servicios · tu negocio · ubicación · tu página · tu cuenta · pago.
- **Alquileres:** módulo · qué alquilás · lo que alquilás (tus canchas, tu salón o tu propiedad) · tu negocio · ubicación · tu página · tu cuenta · pago.
- **Gimnasio:** módulo · rubro · actividades · precios · tu negocio · ubicación · tu página · tu cuenta · pago.

Los pasos comunes cambian sus textos según el módulo (\`textos.ts\`, un mapa por módulo en vez de preguntar "¿es Tienda?" en cada pantalla), y lo propio de Alquileres y de Gimnasio son los pasos de cada módulo (su \`onboarding/pasos.tsx\`). Lo cargado vive en la pestaña (memoria y sessionStorage) y se sigue desde el mismo paso al volver.
- **En las demos** (\`/turnos-demo/onboarding\`, \`/alquileres-demo/onboarding\`, \`/gimnasio-demo/onboarding\`, solo en localhost) se eligen los cuatro y cualquiera acepta \`?modulo=\`. Al terminar, Turnos muestra el "¡Listo!" con su sitio y su panel, y Alquileres y Gimnasio guardan el negocio en su demo y abren su panel.
- **En el alta real** (\`/onboarding/rubro\`) Turnos, Alquileres y Gimnasio salen como "Próximamente" y no se pueden elegir; Tienda sigue igual. No se tocaron la landing ni los precios.

**QA (commit 88a99):** 64 pantallas a 1280, 768, 390 y 390 en oscuro, los recorridos completos de los cuatro módulos en las demos y el alta real hasta "Tu cuenta" con la API simulada (sin crear nada). Se arreglaron el contraste (texto oscuro sobre el azul claro en días elegidos, ícono del rubro, estaciones hechas y la cámara del logo; "Para:" de las tarjetas en Próximamente a 4,5:1), los avisos de los pasos sin campo (al lado de la grilla, con role=alert y a la vista) y toques de 44 px (casilla de términos, el link "Órbita" de la cabecera e "Iniciá sesión"). Esos arreglos tocan también el alta real de Tienda. Queda abierto si se aplanan los estados elegidos de los pasos (decisión abierta "Alta real: ¿se aplanan los estados elegidos?").

**Pulido final (commit 6c542):** las tarjetas de "¿Qué alquilás?" y del rubro de Gimnasio son radios nativos como las del paso Módulo (una parada de Tab y flechas para moverse y elegir), los rubros de Gimnasio van en dos columnas compactas a 390, y la tira de las demos no muestra el selector de tipo o de rubro durante el alta.

**Diferencias con el plan:** la tarea del 25/11 pide que un alta de prueba por módulo cree el negocio: en las demos lo guarda en la demo de su módulo; en el alta real solo Tienda crea la cuenta (los otros tres están en Próximamente). La del 26/11 pide el alta "en oscuro": el alta es oscura siempre (se monta sobre el cielo, con los tokens del espacio).`,
    archivos: [
      'apps/web/src/modules/onboarding/alta/Alta.tsx:1-12',
      'apps/web/src/modules/onboarding/alta/Alta.tsx:19-25',
      'apps/web/src/modules/onboarding/alta/modelo.ts:67-68',
      'apps/web/src/modules/onboarding/alta/textos.ts:1-5',
      'apps/web/src/modules/onboarding/alta/estadoAlta.ts:1-7',
      'apps/web/src/pages/onboarding/rubro.tsx:1-4',
      'apps/web/src/pages/alquileres-demo/onboarding.tsx:1-4',
      'apps/web/src/pages/gimnasio-demo/onboarding.tsx:1-4',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alta-vive-en-onboarding', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el alta vive en modules/onboarding/alta y es lo único que importa de los módulos',
    foco: 'El alta única dejó de vivir en Turnos: está en modules/onboarding/alta y es el único lugar que conoce los cuatro módulos, en un solo sentido.',
    que: `El alta se mudó de \`modules/turnos/onboarding\` a \`modules/onboarding/alta\`. Importa de los módulos lo que necesita (los pasos de Alquileres y de Gimnasio, la demo de cada uno para guardar lo cargado) y ningún módulo importa del alta: la regla de eslint lo marca como error desde Turnos, Alquileres y Gimnasio. De Alquileres y Gimnasio el alta importa de forma fija solo tipos; lo demás se baja al elegir uno de esos módulos (ver "El alta real no baja el código de Alquileres ni de Gimnasio").`,
    decision: 'El alta única vive en modules/onboarding/alta, no en un módulo. Es el único lugar que conoce los cuatro módulos, en un solo sentido: el alta importa de los módulos y ningún módulo importa del alta.',
    porque: 'El alta ya no es de Turnos: es de Tienda, Turnos, Alquileres y Gimnasio. Si viviera adentro de un módulo, ese módulo dependería de los otros tres y dejaría de ser independiente. Afuera y en un solo sentido, cada módulo se puede cambiar o borrar sin tocar a los demás, y sumar un módulo es sumar su entrada en textos.ts y sus pasos.',
    archivos: [
      'apps/web/src/modules/onboarding/alta/Alta.tsx:1-12',
      'apps/web/src/modules/onboarding/alta/PasosReservas.tsx:1-8',
      'apps/web/src/lib/reservas/README.md:47-58',
      'apps/web/eslint.config.mjs:5-27',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alta-real-sin-codigo-de-reservas', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el alta real no baja el código de Alquileres ni de Gimnasio',
    foco: 'En /onboarding/rubro, /onboarding/plan y /onboarding/pago-retorno no se descarga nada de Alquileres, Gimnasio, el kit ni lib/reservas: se carga recién al elegir uno de esos módulos.',
    que: `En el alta real Alquileres y Gimnasio están en "Próximamente", así que su código no tiene por qué llegar al navegador. Antes, las páginas reales del alta arrastraban 13 archivos de \`modules/alquileres\`, \`modules/gimnasio\`, \`design-system/reservas\` y \`lib/reservas\`. Ahora:
- Los pasos de esos módulos, su "Tu página" y el cierre llegan con \`next/dynamic\` (\`PasosReservas\`, \`PasoPaginaReservas\` y \`CierreReservas\`), y el cierre con un \`import()\` al terminar el pago simulado.
- Lo que el alta calcula con sus datos (reglas de los pasos, resúmenes de la botonera y del pago, la vista previa) está en \`reservas.ts\` y se baja con \`cargaReservas.ts\` al elegir el módulo.
- El estado del alta guarda solo lo que se tocó de esos pasos, y los valores de fábrica salen de cada módulo.

La QA del alta (88a99) lo revisó chunk por chunk: el alta real sigue sin bajar ese código.`,
    archivos: [
      'apps/web/src/modules/onboarding/alta/Alta.tsx:39-43',
      'apps/web/src/modules/onboarding/alta/Alta.tsx:126-128',
      'apps/web/src/modules/onboarding/alta/Alta.tsx:333',
      'apps/web/src/modules/onboarding/alta/cargaReservas.ts:1-6',
      'apps/web/src/modules/onboarding/alta/reservas.ts:6-9',
      'apps/web/src/modules/onboarding/alta/CierreReservas.tsx:1-6',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alta-paso-modulo', tipo: 'diseño', quien: 'Ale', transversal: true,
    titulo: 'Transversal: paso Módulo del alta con cuatro tarjetas',
    foco: 'El primer paso del alta pasó de dos tarjetas (Tienda y "Turnos y reservas") a cuatro (Tienda, Turnos, Alquileres y Gimnasio), en una columna en celular y dos desde tablet.',
    que: `Antes el paso Módulo ofrecía dos opciones: Tienda online y "Turnos y reservas" en Próximamente, que prometía "agenda por profesional, sala, cancha o clase con cupo". Ahora son cuatro tarjetas, una por módulo, cada una con qué trae y para quién es:
- **Tienda online** (catálogo, cobro y pedidos), **Turnos** (agenda por profesional o por sala y cabina), **Alquileres** (por hora, por evento o por noches) y **Gimnasio** (clases con cupo, planes y socios).
- Son radios de verdad: se recorren con las flechas y se elige tocando en cualquier lado de la tarjeta. La elegida lleva borde y velo del acento, sin degradado ni brillo, y el botón Continuar es plano.
- Una columna en celular y dos desde tablet. Con \`?modulo=\` llega elegida.
- En el alta real, los módulos que todavía no se pueden elegir muestran el chip "Próximamente" y borde punteado.

En las capturas, el paso en la demo de Turnos: antes con dos tarjetas y después con las cuatro (Turnos elegida; Alquileres y Gimnasio abajo).`,
    antes: { 1280: 'alta-antes-1280.webp', 390: 'alta-antes-390.webp' },
    despues: { 1280: 'alta-despues-1280.webp', 390: 'alta-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:1-7',
      'apps/web/src/modules/onboarding/alta/PasoModulo.tsx:16-35',
      'apps/web/src/modules/onboarding/alta/estilo.ts:84',
      'apps/web/src/modules/onboarding/alta/estilo.ts:89',
      'apps/web/src/modules/onboarding/alta/estilo.ts:560',
      'apps/web/src/modules/onboarding/alta/modelo.ts:67-68',
    ],
  }),

  // ═══ Rediseño de los paneles al estándar de Órbita (26 y 27/10/2026) ═══════
  // Ale lo pidió textual el 26/10: "hacer el estándar de Órbita, o sea todo
  // porque no me gusta", "todo en el sidebar", "minimalista pero el estándar
  // visual de Órbita". Alquileres (Alan) y Gimnasio (Ale) el 26/10, con sus
  // decisiones tomadas sin preguntar; el kit tomó los pedidos de los módulos el
  // 27/10 (transversal, en Gimnasio). Turnos (Mateo) se carga cuando termine.

  // ─── Alquileres · Alan · rediseño ───────────────────────────────────────────
  entrada({
    modulo: 'alquileres', fecha: F, slug: 'todo-en-el-sidebar', tipo: 'diseño', quien: 'Alan',
    titulo: 'Alquileres al estándar de Órbita: todas las secciones en el sidebar',
    foco: 'El panel pasó de cuatro ítems y una columna de pestañas en Configuración a la barra lateral del panel de Tienda: 13 o 14 secciones por modo, en grupos (Hoy, Canchas/Salón/Propiedades, Reservas) y Configuración con sub-secciones; la URL es el único estado.',
    que: `Ale pidió el 26/10 que los tres paneles fueran "el estándar de Órbita, o sea todo", "todo en el sidebar" y "minimalista pero el estándar visual de Órbita". El panel de Alquileres tenía cuatro ítems (Reservas, Clientes, Ingresos y Configuración) y, adentro de Configuración, una columna propia de seis pestañas. Ahora usa el armazón \`LayoutPanel\` v2 del kit (el de Tienda: ver la entrada transversal "LayoutPanel v2") y cada modo tiene su barra lateral completa:
- **Canchas:** Hoy (Reservas, con un badge con las señas pendientes; Clientes; Ingresos), Canchas (Canchas, Extras, Precios por horario), Reservas (Reglas de reserva, Días bloqueados, Recordatorios y mensajes, Pagos y señas), Calendarios (.ics) y Configuración › Datos del negocio, Horarios y Equipo.
- **Salón:** Hoy (Calendario, Eventos, Ingresos), Salón (Salón, Paquetes, Extras), las mismas Reservas, Calendarios y Configuración.
- **Estadía:** Hoy (Calendario, Huéspedes, Ingresos), Propiedades (Propiedades, Temporadas y precios, Bloqueos), Reservas sin Días bloqueados, Calendarios y Configuración sin Horarios (se entra y se sale a la hora de cada propiedad).

La navegación salió a un módulo puro, \`admin/navegacion.ts\`: \`seccionesDe(tipo)\` arma las secciones de cada modo con su grupo y sus sub-secciones, y \`resolverRuta\` lee \`?tipo=&vista=&tab=\`. Antes \`Panel.tsx\` armaba los cuatro ítems a mano y \`Configuracion.tsx\` tenía su propia columna de pestañas; ahora la URL es el único estado y \`Panel.tsx\` solo pone los íconos. Los links viejos siguen andando: \`?vista=configuracion&tab=reglas\` (o \`unidades\`, \`precios\`, \`salon\`, \`propiedades\`, \`calendarios\`) abre la sección nueva y la URL se reescribe; \`tab=negocio\` y \`tab=horarios\` siguen adentro de Configuración, y una sección de otro modo o inventada cae en la agenda. Son nueve casos probados en \`navegacion.test.ts\`.

En las capturas, Configuración a 1280 antes (cuatro ítems y la columna de pestañas) y después (la barra completa, con Datos del negocio como sub-sección). A 390 el después es el cajón del menú abierto, que es donde se ve la barra en celular.`,
    antes: { 1280: 'panel-sidebar-antes-1280.webp', 390: 'panel-sidebar-antes-390.webp' },
    despues: { 1280: 'panel-sidebar-despues-1280.webp', 390: 'panel-sidebar-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/alquileres/admin/navegacion.ts:1-14',
      'apps/web/src/modules/alquileres/admin/navegacion.ts:26',
      'apps/web/src/modules/alquileres/admin/navegacion.ts:72',
      'apps/web/src/modules/alquileres/admin/navegacion.test.ts:29',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:71-72',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:159-160',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:1-13',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'header-del-panel', tipo: 'tarea', quien: 'Alan',
    titulo: 'Alquileres: header del estándar con buscador, avisos y cuenta',
    foco: 'El header de Tienda en el panel: miga, fecha de la demo, buscador (Ctrl K) que encuentra secciones, clientes, reservas y unidades, campanita con avisos y la cuenta del dueño; lo que se abre en un modal viaja en la URL.',
    que: `Con \`LayoutPanel\` v2 el panel tiene el header completo de Tienda (\`Panel.tsx\`): \`producto="Alquileres"\`, la miga (Alquileres › sección › sub-sección), la fecha de la demo ("Sáb 14 nov · 10:40", el \`HOY\` de los datos de ejemplo), el tema claro u oscuro, y:
- **Buscador** (\`busqueda\`): sin escribir ofrece "Ir a" cada sección y sub-sección; escribiendo encuentra clientes o huéspedes con reserva (por nombre o teléfono), lo de hoy (reservas de hoy en canchas, "en casa hoy" en la estadía, próximos eventos en el salón) y las canchas, el salón o las propiedades.
- **Campanita** (\`avisos\`): las reservas hechas en la demo (desde el sitio o a mano) entran sin leer, porque son la única novedad de verdad; después las señas pendientes, lo que queda de hoy, las llegadas y salidas de la estadía y los calendarios externos sincronizados. Cada aviso abre lo suyo.
- **Cuenta** (\`usuario\`): el dueño o la dueña de \`negocio.equipo\`, con su rol.

Los modales viajan en la URL: \`?reserva=\` abre el detalle de una reserva en Reservas o Eventos y \`?cliente=\` la ficha en Clientes o Huéspedes, así la campanita, el buscador e Ingresos los abren desde cualquier parte y un link se puede compartir. El badge de Reservas cuenta solo las señas pendientes futuras.

${comoQuedo('alquileres', ['Campanita · 1280', 'header-avisos-1280.webp'], ['Ficha de un cliente abierta por la URL · 390', 'header-cliente-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/Panel.tsx:4-6',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:52',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:74-75',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:106-108',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:132',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:150',
      'apps/web/src/modules/alquileres/admin/Eventos.tsx:8',
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:4',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:27-36',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'configuracion-en-paginas', tipo: 'tarea', quien: 'Alan',
    titulo: 'Alquileres: Configuración partida en páginas',
    foco: 'Configuracion.tsx (499 líneas, con su propia columna de pestañas) se borró; cada sección es una página de admin/configuracion/, de 37 a 155 líneas, con borrador y Guardar; los modales de bloqueo salieron de la agenda a Bloquear.tsx.',
    que: `\`admin/Configuracion.tsx\` (499 líneas) tenía adentro seis pestañas y su propia columna para elegirlas. Se borró (\`git rm\`) y cada sección quedó como una página en \`admin/configuracion/\`: Negocio, Horarios, Reglas, Canchas, Extras, Precios, Salon, Paquetes, Propiedades, Temporadas, Calendarios, Bloqueos, Mensajes, Pagos y Equipo, de 37 a 155 líneas cada una. Lo común está en \`comun.tsx\`: \`PaginaForm\` (el encabezado y el ancho de formulario), \`CSS_CONFIG\`, \`num\`, \`idNuevo\`, \`HORAS\`, \`igual\` y el tipo \`Form\`.
- Todas conservan el borrador y el botón Guardar (\`Guardar\` en \`admin/piezas.tsx\`, ahora con Descartar) y la \`key\` del panel que las vuelve a montar cuando el almacén ya leyó lo guardado (\`useHidratado\`), para que el primer render no pise lo del dueño.
- Los modales "Bloquear un día" y "Bloquear fechas" salieron de \`Reservas.tsx\` a \`admin/Bloquear.tsx\`: los usan la agenda y las páginas Días bloqueados y Bloqueos.

Lo que se hizo en cada página nueva está en "Secciones nuevas con contenido real"; dónde quedó cada dato, en la decisión "Dónde vive cada dato de la configuración".`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:18',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:31',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:91',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:107',
      'apps/web/src/modules/alquileres/admin/Bloquear.tsx:1-5',
      'apps/web/src/modules/alquileres/admin/Bloquear.tsx:18',
      'apps/web/src/modules/alquileres/admin/Bloquear.tsx:56',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:166-167',
      'apps/web/src/modules/alquileres/datos/negocio.ts:87',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'secciones-nuevas', tipo: 'tarea', quien: 'Alan',
    titulo: 'Alquileres: secciones nuevas con contenido real',
    foco: 'Extras, Días bloqueados, Recordatorios y mensajes (plantillas de WhatsApp con llaves y vista previa), Pagos y señas (seña, formas de pago, depósito, reembolsos), Equipo con roles, y Temporadas y precios con el calendario de qué temporada rige cada día.',
    que: `Con todo en el sidebar aparecieron secciones que antes no existían o vivían escondidas en una pestaña. Todas con datos de ejemplo en \`datos/index.ts\`:
- **Extras:** alta, baja y edición con precio, separado de Canchas (en el salón edita \`salon.extras\`). Cada extra dice cuántas veces lo pidieron y cuánto sumó, y una nota cuenta lo que sumaron los extras en el mes.
- **Días bloqueados / Bloqueos:** próximos y pasados, agrupados (el torneo que cierra las cuatro canchas es una sola fila, "Todas las canchas"), con motivo, quitar los propios y el chip "Calendario externo" en los que vinieron por .ics (esos se quitan desconectando el calendario). Agrega con los mismos modales de la agenda. Datos nuevos: bloqueos de ejemplo en canchas (cambio del césped, torneo interno, uno pasado) y en el salón (feriado del 20/11, pintura del 25 al 27/11); las reservas de ejemplo saltean los días bloqueados.
- **Recordatorios y mensajes:** cuatro plantillas de WhatsApp por momento (confirmación, recordatorio 24 h, seña pendiente, agradecimiento), llave para prender cada una, texto editable con llaves (nombre, negocio, unidad, fecha, hora, total, seña, saldo y link, que se insertan donde está el cursor), vista previa con la próxima reserva confirmada de la agenda y "Mandar una prueba" simulado ("Demo: no se mandó ningún WhatsApp"). Textos de fábrica por modo (\`mensajesDeFabrica\`).
- **Pagos y señas:** la seña (porcentaje y sobre qué se calcula: el total con extras o solo la cancha, el paquete o las noches, \`senaSobre\`) con un ejemplo hecho con los precios del negocio; formas de pago (efectivo, transferencia con alias y titular, Mercado Pago con "Conectar" simulado que avisa "Demo: no se conectó ninguna cuenta real"); el depósito de garantía del salón y la política de reembolso (a tiempo y tarde) con la frase que lee el cliente.
- **Equipo:** personas con rol (dueño, encargado o recepción, con rótulo femenino cuando corresponde), alta en un modal, baja (no del dueño), qué puede cada rol y "Demo: no se mandó ninguna invitación". Tres equipos de ejemplo.
- **Temporadas y precios:** por propiedad, el precio base, el recargo de fin de semana, la limpieza y las temporadas, y un calendario de qué temporada rige cada día con el precio de esa noche debajo, en una escala de un solo tono (más fuerte cuanto más cara que la base; gris si es más barata) y su leyenda.
- **Salón, Paquetes y Extras** como páginas separadas (Paquetes dice cuántos eventos eligió cada uno).

\`senaSobre\` es real: cambia la seña en el sitio público, en Nueva reserva y en las reservas de ejemplo (\`senaPara\`).

${comoQuedo('alquileres', ['Recordatorios y mensajes · 1280', 'secciones-mensajes-1280.webp'], ['Temporadas y precios · 1280', 'secciones-temporadas-1280.webp'], ['Pagos y señas · 390', 'secciones-pagos-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Extras.tsx:14',
      'apps/web/src/modules/alquileres/admin/configuracion/Bloqueos.tsx:39',
      'apps/web/src/modules/alquileres/admin/configuracion/Mensajes.tsx:31',
      'apps/web/src/modules/alquileres/admin/configuracion/Pagos.tsx:20',
      'apps/web/src/modules/alquileres/admin/configuracion/Equipo.tsx:17',
      'apps/web/src/modules/alquileres/admin/configuracion/Temporadas.tsx:30',
      'apps/web/src/modules/alquileres/admin/configuracion/Temporadas.tsx:79',
      'apps/web/src/modules/alquileres/admin/configuracion/Paquetes.tsx:11',
      'apps/web/src/modules/alquileres/datos/index.ts:160',
      'apps/web/src/modules/alquileres/datos/index.ts:179-181',
      'apps/web/src/modules/alquileres/datos/index.ts:196',
      'apps/web/src/modules/alquileres/datos/index.ts:312',
      'apps/web/src/modules/alquileres/datos/index.ts:339-342',
      'apps/web/src/modules/alquileres/datos/index.ts:590',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'ingresos-tablero', tipo: 'diseño', quien: 'Alan',
    titulo: 'Alquileres: Ingresos como tablero del estándar',
    foco: 'Cuatro indicadores con ícono y variación contra el período anterior del mismo largo, las series por semana y por unidad en un solo acento, una tercera según el modo y la lista "Por cobrar" que abre cada reserva para registrar el pago.',
    que: `Ingresos tenía cuatro números sueltos (facturado, ocupación, seña pendiente, saldo por cobrar) y dos gráficos. Ahora es el tablero del panel de Tienda:
- **Indicadores** con ícono en un chip y la variación contra el período anterior del mismo largo (\`periodoAnterior\`): Facturado, Reservas o Eventos, Ocupación (en puntos) y Por cobrar. Sin datos previos no se inventa un porcentaje: el chip no aparece.
- **Series** en un solo acento: por semana y por cancha, bloque o propiedad; y una tercera por modo: horas reservadas por franja de tres horas en canchas (sirve para afinar Precios por horario), eventos por paquete en el salón, llegadas y salidas de la semana en la estadía.
- **Por cobrar:** las señas que no entraron y los saldos de reservas ya realizadas; cada fila abre la reserva (por \`?reserva=\`) para registrar el pago.

Reglas de la skill \`dataviz\` aplicadas: una serie es un color, columnas finas de 24 px con el extremo redondeado, el valor solo en la columna más alta y al foco o al pasar, un eje, sin dos ejes ni leyenda para una sola serie. El \`Kpi\` con ícono y variación es una pieza local del módulo (\`admin/piezas.tsx\`), igual que en Gimnasio: el del kit no la tiene (decisión abierta "Pedidos del kit que quedaron sin tomar").`,
    antes: { 1280: 'ingresos-antes-1280.webp', 390: 'ingresos-antes-390.webp' },
    despues: { 1280: 'ingresos-despues-1280.webp', 390: 'ingresos-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:1-5',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:34',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:41',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:49',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:63',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:78-79',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:104-107',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:124',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:72',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'clientes-con-indicadores', tipo: 'diseño', quien: 'Alan',
    titulo: 'Alquileres: Clientes y Huéspedes con indicadores',
    foco: 'Arriba de la tabla, tres indicadores con la misma pieza Kpi (total, nuevos este mes, con reserva próxima); la ficha se abre por ?cliente=; la tabla rv-tabla sigue pasando a tarjetas en celular.',
    que: `Clientes (Huéspedes en la estadía) tenía solo la tabla. Ahora arranca con tres indicadores con la misma pieza \`Kpi\` de Ingresos: cuántos clientes con al menos una reserva, cuántos hicieron su primera reserva este mes y cuántos ya tienen fecha. La ficha de cada persona (reservas, gasto, historial) se abre por \`?cliente=\`, así el buscador del header la abre desde cualquier parte. La tabla \`rv-tabla\` del kit sigue como estaba: en celular pasa a tarjetas. En el salón esta sección es Eventos (cada evento con su ficha), como desde el 26/10.`,
    antes: { 1280: 'clientes-antes-1280.webp', 390: 'clientes-antes-390.webp' },
    despues: { 1280: 'clientes-despues-1280.webp', 390: 'clientes-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:4',
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:37',
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:60-62',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:53',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'agenda-tintada-y-piezas', tipo: 'diseño', quien: 'Alan',
    titulo: 'Alquileres: la agenda con el día tintado y las piezas locales del panel',
    foco: 'En la tira de días de Reservas el día elegido va tintado (fondo claro del acento, borde y tinta oscura) y no lleno: el blanco sobre el acento a 11 y 16 px daba 3,68:1. Lo que el kit no tiene (Kpi con variación, Guardar) quedó como piezas locales en admin/piezas.tsx.',
    que: `- **El día elegido va tintado, no lleno.** En la tira de días de la agenda, "HOY" a 11 px y el número a 16 px en blanco sobre el acento daban 3,68:1 (la norma pide 4,5:1). Ahora el elegido lleva el fondo claro del acento, el borde en el acento y la tinta oscura (\`--color-primary-bg\`, \`--color-primary\` y \`--chip-primary-fg\`). Gimnasio hizo lo mismo en su tira de Clases. En el calendario del salón, un día completo se abre igual (para ver sus eventos): va tintado, no tachado ni apagado; tachado queda solo lo cerrado.
- **Piezas locales:** lo que el kit no tiene quedó en \`admin/piezas.tsx\`, sin romper el estándar: \`Kpi\` con ícono en chip y chip de variación (▲/▼, en porcentaje o en unidades con sufijo, y "sin datos previos" cuando no hay período anterior), \`Guardar\` (el estado "Tenés cambios sin guardar" / "Todo guardado", Descartar y Guardar cambios) y \`CSS_PANEL\` con \`.ala-kpis\`, \`.ala-guardar\`, \`.ala-cab-lista\` y \`.ala-pie-nota\`. Lo que le faltaba al kit se pidió en \`pedidos-kit-alquileres.md\`, y el 27/10 el kit tomó los contrastes del armazón, la Sigla, el chip apretado, el segmentado, el botón de peligro, \`Switch\`, \`Nota\` y \`Area\` (entrada transversal "El kit toma lo que pidieron los módulos"); el pisado local de \`.rv-btn--peligro\` que había en este archivo se borró ese día. Kpi y Guardar siguen locales (decisión abierta "Pedidos del kit que quedaron sin tomar").

En las capturas, Reservas de canchas antes y después: la tira con el día lleno y con el día tintado, y el header nuevo.`,
    antes: { 1280: 'agenda-antes-1280.webp', 390: 'agenda-antes-390.webp' },
    despues: { 1280: 'agenda-despues-1280.webp', 390: 'agenda-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:46-48',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:85-87',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:132',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:11',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:72',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:107',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'donde-vive-cada-dato', tipo: 'decisión', quien: 'Alan',
    titulo: 'Alquileres: dónde vive cada dato de la configuración',
    foco: 'La seña (porcentaje y sobre qué se calcula) vive en Pagos y señas y no en Reglas; el depósito de garantía se edita solo en Pagos; el precio por noche, el fin de semana, la limpieza y las temporadas salieron de Propiedades a Temporadas y precios. Lo decidió Alan sin preguntar, al partir Configuración.',
    que: `Al partir Configuración en páginas hubo que decidir en cuál queda cada dato, y el pedido nombraba algunos en dos lugares. Quedó así:
1. La **seña** (porcentaje y sobre qué se calcula) vive en Pagos y señas. Reglas de reserva conserva la cancelación, el turno (en canchas: duración, cada cuánto arranca uno y cuántos seguidos) y, en la estadía, las noches mínimas y las horas de entrada y salida por propiedad, que salieron de Propiedades.
2. El **depósito de garantía** del salón se edita solo en Pagos y señas; Salón lo muestra con un botón que lleva ahí.
3. El **precio por noche, el fin de semana, la limpieza y las temporadas** salieron de Propiedades a Temporadas y precios; Propiedades queda con datos, comodidades, fotos y ubicación, y enlaza.
4. \`senaSobre\` (la seña sobre el total con extras o solo sobre la base) es **real**: cambia la seña en el sitio público, en Nueva reserva y en las reservas de ejemplo (las canchas y la estadía de ejemplo la calculan sobre la base; el salón, sobre el total).`,
    decision: 'Cada dato de la configuración vive en una sola página: la seña y el depósito en Pagos y señas, las reglas del turno y la cancelación en Reglas de reserva, los precios de la estadía en Temporadas y precios; las otras páginas enlazan en vez de repetirlo. Y la base de la seña es un dato real que usan el sitio y el panel.',
    porque: 'Un mismo dato en dos pantallas termina con dos valores: el pedido nombraba el depósito en Salón y en Pagos, y la seña en Reglas y en Pagos. Con una sola fuente y un link desde la otra pantalla no hay forma de que se desalineen. La seña es plata y la cancelación es una regla: separarlas sigue el criterio de Tienda (lo que se cobra va en Pagos). Y si `senaSobre` fuera solo un texto de la pantalla, el ejemplo de Pagos y señas mostraría un número que la reserva no cobra. Queda a confirmar por Alan: si Ale prefiere la seña en Reglas, es mover un bloque de Pagos.tsx a Reglas.tsx.',
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Pagos.tsx:20',
      'apps/web/src/modules/alquileres/admin/configuracion/Reglas.tsx:20',
      'apps/web/src/modules/alquileres/admin/configuracion/Salon.tsx:17',
      'apps/web/src/modules/alquileres/admin/configuracion/Temporadas.tsx:30',
      'apps/web/src/modules/alquileres/admin/configuracion/Propiedades.tsx:17',
      'apps/web/src/modules/alquileres/datos/index.ts:179-181',
      'apps/web/src/modules/alquileres/datos/index.ts:590',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:109',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:538',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'vista-previa-chat-neutro', tipo: 'decisión', quien: 'Alan',
    titulo: 'Alquileres: la vista previa de los mensajes es un chat neutro, no WhatsApp',
    foco: 'La vista previa de Recordatorios y mensajes es una pantalla de chat con los colores del panel (un solo acento), no el verde de WhatsApp que usa Gimnasio. Alan lo decidió sin preguntar; unificar o no es una decisión abierta de Ale.',
    que: `En Recordatorios y mensajes, cada plantilla se ve en una pantalla de chat (\`.alc-chat\` en \`comun.tsx\`, \`Vista\` en \`Mensajes.tsx\`): la cabecera con el negocio, la burbuja con el texto y las llaves rellenas en negrita, y la hora con las tildes. Los colores son los del panel: la burbuja sobre \`--color-primary-bg\`, la tinta en \`--color-text\`, sin el verde de WhatsApp. Gimnasio eligió lo contrario (una pantalla de WhatsApp, verde, en claro y en oscuro); Turnos tenía el verde y el 27/10 pasó al mismo chat neutro que Alquileres (commit 6d526).`,
    decision: 'La vista previa del mensaje en Alquileres es un chat neutro con los colores del panel y un solo acento.',
    porque: 'El pedido de Ale para el rediseño fue un acento y sin adornos: un verde ajeno al sistema en medio de un panel que no usa ese color rompe la regla, y la vista previa muestra el texto, no la aplicación. Gimnasio prefirió parecerse a lo que llega al teléfono. Las dos son defendibles y hoy conviven: si se unifican, Alan propone que sea la neutra, y lo decide Ale (decisión abierta "Pedidos del kit que quedaron sin tomar").',
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:58-65',
      'apps/web/src/modules/alquileres/admin/configuracion/Mensajes.tsx:134',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:37',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'acciones-al-instante-y-campanita', tipo: 'decisión', quien: 'Alan',
    titulo: 'Alquileres: qué se guarda al instante, qué cuenta la campanita y qué busca el buscador',
    foco: 'Equipo y Conectar/Desconectar Mercado Pago se guardan al instante (son acciones, no un borrador); los bloqueos de un calendario externo solo se quitan desconectándolo; el badge de Reservas cuenta solo señas pendientes futuras; las reservas hechas en la demo entran sin leer; en el salón el buscador busca eventos.',
    que: `Decisiones chicas del comportamiento del panel, tomadas al armarlo:
1. **Equipo** y **Conectar / Desconectar Mercado Pago** se guardan al instante: son acciones, no un borrador. El resto de Pagos y señas sigue con borrador + Guardar.
2. Los **bloqueos de un calendario externo** no se quitan desde Días bloqueados o Bloqueos: se desconecta el calendario en Calendarios (.ics), como ya era, y se van con él.
3. El **badge de Reservas** cuenta solo las señas pendientes futuras (antes contaba también las pasadas).
4. Las **reservas hechas en la demo** (desde el sitio o a mano) entran en la campanita sin leer: son la única novedad de verdad; el resto de los avisos nace leído.
5. En el salón el **buscador** no busca clientes (esa sección es Eventos) sino los próximos eventos, con el cliente en el detalle.`,
    decision: 'Las acciones (sumar o sacar a alguien del equipo, conectar o desconectar Mercado Pago) se guardan al toque; lo que se configura, con borrador y Guardar. La campanita y el badge cuentan solo lo que todavía se puede atender, y el buscador encuentra lo que cada modo llama "la gente" (clientes, huéspedes o eventos).',
    porque: 'Un "Conectado" que todavía no se guardó confunde (y lo mismo una persona que figura en el equipo y desaparece al descartar): una acción se cumple o no, no queda en borrador. Un badge que cuenta señas de reservas que ya pasaron no se puede bajar nunca. Y los bloqueos importados tienen un dueño, el calendario externo: si se pudieran borrar sueltos, la próxima sincronización los traería de vuelta.',
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Pagos.tsx:28-29',
      'apps/web/src/modules/alquileres/admin/configuracion/Equipo.tsx:2-3',
      'apps/web/src/modules/alquileres/admin/configuracion/Bloqueos.tsx:39',
      'apps/web/src/modules/alquileres/datos/index.ts:144',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:101-102',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:106-108',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:140-144',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'textos-y-links-viejos', tipo: 'decisión', quien: 'Alan',
    titulo: 'Alquileres: precios abreviados en el calendario, rótulos femeninos y links viejos que siguen andando',
    foco: 'En el calendario de temporadas el precio va abreviado ("98k") con el precio entero en el aria-label; los roles del equipo tienen rótulo femenino opcional (Dueña, Encargada); los links viejos a Configuración se traducen a la sección nueva y una sección de otro modo cae en la agenda.',
    que: `1. En el calendario de Temporadas y precios el precio de cada noche va **abreviado** ("98k"): "$98.000" no entra en una celda de 46 px. El precio entero queda en el \`aria-label\` de cada día, con la temporada y si es fin de semana.
2. Los **roles** tienen rótulo femenino opcional (\`Persona.genero\`): Lucía Benítez es "Dueña" y Paula Giménez "Encargada"; "Recepción" es neutro.
3. Nada de \`?vista=\` nuevo rompe lo viejo: \`resolverRuta\` traduce \`?vista=configuracion&tab=…\` a la sección nueva y reescribe la URL, y una sección de otro modo o inventada cae en la agenda.`,
    decision: 'Precio abreviado en la celda y entero para el lector de pantalla; rótulos de rol con género cuando la persona lo tiene; y los links viejos del panel siguen abriendo lo que abrían.',
    porque: 'Una celda de 46 px no puede mostrar "$98.000" sin romper la grilla ni achicar la letra por debajo de lo legible; el `aria-label` guarda el dato completo. "Dueño" para Lucía es un error que cualquier dueña nota al abrir su panel. Y la demo de Alquileres tiene links guardados desde el 26/10 (en la tira de la demo, en el índice y en las entradas de auditoría): romperlos era regalar 404.',
    archivos: [
      'apps/web/src/modules/alquileres/admin/configuracion/Temporadas.tsx:27',
      'apps/web/src/modules/alquileres/admin/configuracion/Temporadas.tsx:86',
      'apps/web/src/modules/alquileres/datos/index.ts:194',
      'apps/web/src/modules/alquileres/datos/index.ts:201',
      'apps/web/src/modules/alquileres/admin/navegacion.ts:11-14',
      'apps/web/src/modules/alquileres/admin/navegacion.test.ts:34',
      'apps/web/src/modules/alquileres/admin/navegacion.test.ts:54',
    ],
  }),

  entrada({
    modulo: 'alquileres', fecha: F, slug: 'qa-rediseno', tipo: 'tarea', quien: 'Alan',
    titulo: 'Alquileres: QA del rediseño en 1280, 768, 390 y 390 oscuro',
    foco: 'Recorrida con Playwright de los tres modos (51 pantallas por ancho, 204 en total): sin desborde, sin errores de consola, sin imágenes rotas, el link viejo redirige; lo que quedó en rojo son contrastes del kit (tomados el 27/10), los botones primarios (decisión abierta) y tres toques chicos.',
    que: `Con el rediseño terminado se recorrieron en el navegador los tres modos (canchas, salón y estadía) a 1280, 768, 390 y 390 en oscuro: 51 pantallas por ancho (cada ítem y sub-sección del sidebar en los tres modos, el detalle de una reserva, nueva reserva y nuevo evento, bloquear, la campanita, el buscador, la ficha de un cliente, sumar al equipo y el link viejo), con un contexto de Playwright por tamaño y un log por ancho (\`qa-1280.log\`, \`qa-768.log\`, \`qa-390.log\` y \`qa-oscuro.log\`, en el scratchpad de la sesión). Antes, \`tsc\` 0 errores en \`modules/alquileres\`, eslint 0 errores (solo avisos de \`no-img-element\`, aceptados) y vitest 9/9 en \`navegacion.test.ts\`.

**Lo que dio bien:** sin scroll horizontal en ninguna pantalla, sin errores de consola, sin imágenes rotas, inputs de 16 px, y el link viejo (\`?vista=configuracion&tab=reglas\`) redirige a la sección nueva.

**Lo que quedó en rojo** (el medidor marcó las 51 pantallas de cada ancho, siempre por lo mismo):
- **Contrastes del kit** (\`pedidos-kit-alquileres.md\`, punto 3): la sigla del negocio, el ítem y la sub-sección activos, el badge y el contador de la campanita, "Marcar leídas" y la fecha de cada aviso en el armazón (3,38 a 3,76:1, y 2,45:1 la fecha); la \`Sigla\` de personas con tonos 600 (3,19 a 3,88:1); los chips apretados de días, comodidades y filtros y el segmentado (3,68 y 4,34:1). El kit los tomó el 27/10 (commit f1623, entrada transversal "El kit toma lo que pidieron los módulos"); las capturas del después de Alquileres son de antes de eso.
- **Botones primarios** de 14 y 16 px en blanco sobre el azul (3,68:1): "Nueva reserva", "Agendar", "Importar", "Sumar a alguien". Es la decisión abierta "Azul primario".
- **Toques chicos a 390:** las llaves \`rv-switch\` (42×24; el kit ya tiene el área de 54×44 con un \`::before\`, el medidor no la cuenta), las flechas de semana de la tira de días (32 px de ancho) y los horarios de Nueva reserva (42 px de alto). Las dos últimas no se arreglaron.
- En oscuro, el valor sobre la columna más alta de los gráficos (2,17:1) es una falsa alarma: el medidor tomaba la barra como fondo del texto, que está arriba de ella (Gimnasio lo corrigió en su medidor el 27/10).

Las capturas del después (207 archivos en cuatro anchos, en el scratchpad de la sesión) son las que usan las entradas de diseño de Alquileres.

**Diferencias con el plan:** las tareas del 7, 8 y 9/12 piden "lista de fallas registrada en Auditoría" por ancho: está acá, en una sola entrada. La del 10/12 (correcciones) no se vinculó: quedan dos toques chicos sin arreglar. La del 11/12 pide una captura por pantalla en los tres anchos enlazadas en la entrada: están en el scratchpad, no en la web (no se vinculó).`,
    archivos: [
      'apps/web/src/modules/alquileres/admin/navegacion.test.ts:5',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:144',
      'apps/web/src/design-system/reservas/estilo.tsx:136',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:59-61',
    ],
  }),

  // ─── Gimnasio · Ale · rediseño ──────────────────────────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'todo-en-el-sidebar', tipo: 'diseño', quien: 'Ale',
    titulo: 'Gimnasio al estándar de Órbita: todas las secciones en el sidebar',
    foco: 'Un solo panel para los ocho rubros con la barra lateral de Tienda: Hoy (Clases, Alumnos, Ingresos), Negocio (Equipo, Actividades y salas, Planes y precios), Reservas (Reglas, Días sin clases, Mensajes, Pagos), Calendarios y Configuración con Datos del negocio y Horarios; antes eran cuatro ítems y una columna de pestañas.',
    que: `Mismo pedido de Ale que en los otros módulos ("todo en el sidebar", "minimalista pero el estándar visual de Órbita"). El panel de Gimnasio tenía Clases, Atletas, Ingresos y Configuración, y adentro de Configuración una columna de siete pestañas. Ahora usa \`LayoutPanel\` v2 (el armazón de Tienda, entrada transversal "LayoutPanel v2") y la barra lateral completa, la misma para los ocho rubros (\`RUBROS_GYM\`: cambia el rótulo de la gente, Alumnos, Socios o Participantes, y el del profe, Coach, Instructora, Sensei…, no las secciones):
- **Hoy:** Clases (badge con las personas en lista de espera hoy; \`?ver=grilla\` abre la grilla semanal, \`?dia=\` otro día y \`?clase=\` el detalle), Alumnos (antes "Atletas"; badge con los planes que vencen en 7 días; \`?socio=\` abre la ficha) e Ingresos.
- **Negocio:** Equipo, Actividades y salas, Planes y precios.
- **Reservas:** Reglas de reserva, Días sin clases, Recordatorios y mensajes, Pagos.
- Sin grupo: Calendarios (.ics) y Configuración › Datos del negocio y Horarios.

Los links viejos siguen andando: \`?vista=configuracion&tab=actividades\` (o \`planes\`, \`reglas\`, \`bloqueos\`, \`calendarios\`) abre la sección nueva y un efecto corrige la barra de direcciones (\`PESTANA_VIEJA\`); \`tab=negocio\` y \`tab=horarios\` siguen adentro de Configuración, y una \`vista\` desconocida cae en Clases. El panel espera a \`useHidratado\` antes de montar los formularios: en una carga completa el primer render traía el negocio de ejemplo y, al guardar, pisaba lo del dueño.

En las capturas, Configuración a 1280 antes (cuatro ítems y la columna de pestañas, con "Atletas") y después (la barra completa con Datos del negocio como sub-sección). A 390 el después es el cajón abierto con Configuración desplegada.`,
    antes: { 1280: 'panel-sidebar-antes-1280.webp', 390: 'panel-sidebar-antes-390.webp' },
    despues: { 1280: 'panel-sidebar-despues-1280.webp', 390: 'panel-sidebar-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:7',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:40-42',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:62-63',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:86-88',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:147-152',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:163',
      'apps/web/src/modules/gimnasio/datos/index.ts:74-75',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:228',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'header-del-panel', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: header del estándar con buscador, avisos y cuenta',
    foco: 'Miga, fecha de la demo, buscador que encuentra secciones, clases de hoy, el equipo y los alumnos, campanita con lo que necesita atención (lista de espera, planes por vencer, clases completas o sin profe) y la cuenta del dueño del rubro.',
    que: `Con \`LayoutPanel\` v2, el panel de Gimnasio tiene el header completo de Tienda (\`Panel.tsx\`): \`producto="Gimnasio"\`, el rubro, la fecha de la demo ("Sáb 14 nov · 10:40", \`FECHA_DEMO\`), el link al sitio ("Lo que ven tus alumnos para reservar") y:
- **Campanita** (\`avisos\`): las clases de hoy con gente esperando lugar (sin leer), los planes que vencen en 7 días (sin leer si vencen en 3), las clases de hoy completas y, si las hay, las clases de la grilla que quedaron sin profe (en rojo, abre la grilla). Cada aviso lleva a la ficha o a la clase por la URL.
- **Buscador** (\`busqueda\`): "Ir a" cada sección (con las sub-secciones de Configuración), las clases de hoy (con profe, sala y cupo), el equipo y los alumnos (teléfono, estado del plan y plan).
- **Cuenta** (\`usuario\`): el dueño o la dueña del rubro (\`RUBROS_GYM[].dueno\`; por ejemplo Martín Acuña, Dueño, en crossfit).

Los badges del menú: Clases cuenta personas esperando lugar hoy; Alumnos, planes que vencen en 7 días.

${comoQuedo('gimnasio', ['Campanita · 1280', 'header-avisos-1280.webp'], ['Cajón del menú · 390', 'header-cajon-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:45',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:58',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:90',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:117',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:142-143',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:160',
      'apps/web/src/modules/gimnasio/datos/index.ts:192',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:27-36',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'configuracion-en-secciones', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: Configuración partida en secciones del sidebar y piezas comunes del panel',
    foco: 'Configuracion.tsx (con su columna de pestañas) se borró; cada sección es una página de admin/configuracion/ (39 a 186 líneas) más admin/Equipo.tsx; lo común (useBorrador, BarraGuardar con motivo, Swatches como radios, KpiGym) vive en admin/piezas.tsx.',
    que: `\`admin/Configuracion.tsx\` tenía adentro las pestañas y su propia columna para elegirlas. Se borró (\`git rm\`) y cada sección es una página en \`admin/configuracion/\`: Negocio (39 líneas), Horarios (41), Reglas (56), Planes (57), Actividades (81), Bloqueos (79), Calendarios (76), Mensajes (186) y Pagos (93), más \`admin/Equipo.tsx\` (143). Todas usan \`rv-pagina rv-pagina--form\` (880 px) salvo Equipo, que es un listado.

Las piezas comunes están en \`admin/piezas.tsx\`:
- \`useBorrador\`: el borrador que se compara con lo guardado y sabe si cambió.
- \`BarraGuardar\`: fija abajo, con Descartar y Guardar, y un \`motivo\` cuando todavía no se puede guardar ("Marcá al menos un día", "El CBU tiene que tener 22 números").
- \`Swatches\`: los colores del equipo como radios de verdad (Tab entra una vez, las flechas eligen).
- \`Punto\`, \`num\` y \`KpiGym\` (el indicador con ícono y variación, ver Ingresos).

Lo que se hizo en cada sección nueva está en "Secciones nuevas con contenido real"; dónde quedó cada dato, en la decisión "Dónde vive cada cosa y qué se guarda al instante".`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:113',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:128',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:142',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:160',
      'apps/web/src/modules/gimnasio/admin/configuracion/Negocio.tsx:6',
      'apps/web/src/modules/gimnasio/admin/configuracion/Horarios.tsx:11',
      'apps/web/src/modules/gimnasio/admin/configuracion/Pagos.tsx:90',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:193-194',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'secciones-nuevas', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: secciones nuevas con contenido real',
    foco: 'Equipo (profes con color, actividades e invitación; dar de baja deja sus clases sin profe), Actividades y salas, Planes y precios, Reglas de reserva, Días sin clases, Recordatorios y mensajes (WhatsApp con variables y vista previa), Pagos (Mercado Pago, mostrador, renovaciones) y Calendarios (.ics).',
    que: `Con todo en el sidebar aparecieron secciones nuevas, todas con datos de ejemplo en \`datos/index.ts\`:
- **Equipo:** una tarjeta por profe con su sigla en su color, las actividades que da, cuántas clases por semana y qué días, Editar y Dar de baja. Sumar pide nombre, email opcional (invitación simulada: "Demo: no se mandó ninguna invitación"), actividades (casillas de 44 px) y color (\`Swatches\`, el primero que nadie usa). Dar de baja deja sus clases **sin profe** (\`profeId: ''\`) y avisa cuántas; la grilla, el día, el sitio ("Profe a confirmar") y la campanita (\`clasesSinProfe\`) lo muestran. Datos: \`Profe\` con \`color\`, \`actividades\` y \`email\`; \`COLORES_EQUIPO\` en tonos 700; \`colorDe\` (un color fijo por nombre para las siglas de alumnos); un equipo guardado antes de tener color se completa al leer.
- **Actividades y salas:** nombre, duración, cupo por defecto y color de borde en la grilla por actividad (\`COLORES_ACTIVIDAD\`), cuántas clases por semana tiene cada una; las salas aparte (dos clases no se pisan en la misma sala). Al guardar, las clases de una sala quitada pasan a la primera y las de una actividad quitada salen de la grilla (se avisa cuántas); los profes dejan de dar la actividad quitada. Una tarjeta "Los profes están en Equipo" con el salto.
- **Planes y precios:** prueba (gratis, una vez por persona), clase suelta, packs y membresías, con precio, clases o "por semana", vigencia y la llave "Se ofrece en el sitio"; cada tarjeta dice cuántos alumnos lo tienen hoy (apagar o quitar no les saca nada hasta que venza).
- **Reglas de reserva:** se reserva hasta N días adelante, cancelación sin cargo hasta N horas antes, check-in desde N minutos antes; debajo, "Lo que pasa solo" (\`SOLAS\`): la lista de espera avanza sola, el pack se descuenta al reservar, la prueba vale una vez por persona, la membresía respeta su tope semanal (reglas del sistema, con tests).
- **Días sin clases:** lista con fecha ("20 de noviembre" o "24 al 26 de noviembre", \`rangoTxt\`), motivo, origen (lo cargaste vos o calendario externo), cuántas clases de la grilla caen ahí, "ya pasó" y Quitar (solo los propios). Agregar pide desde, hasta incluido y motivo, y dice cuántas clases no se dan. Dato de ejemplo: el feriado del Día de la Soberanía.
- **Recordatorios y mensajes:** el número de WhatsApp del negocio ("Verificado"), la firma y cuatro mensajes automáticos (\`MOMENTOS\`: reserva confirmada, recordatorio de clase, se liberó un lugar, plan por vencer), cada uno en una tarjeta plegable con llave, texto editable con variables (\`VARIABLES_MENSAJE\`, se insertan donde está el cursor), vista previa como pantalla de WhatsApp con un alumno y una clase reales del negocio (\`ejemploDe\`; una variable inexistente queda marcada), "Enviarme una prueba" (simulado) y "Volver al texto sugerido". Textos de fábrica en \`mensajesDe\`.
- **Pagos:** Mercado Pago con Conectar / Desconectar simulados ("Demo: no se conectó ninguna cuenta real") y la llave de cobro online al reservar; en el mostrador, efectivo y transferencia (alias, titular, CBU de 22 números validado); membresías y vencimientos: quién registra la renovación (automática solo con Mercado Pago), días de gracia y qué pasa con las reservas de quien venció; una nota con cuántos planes vencen esta semana y el salto a Mensajes. Datos: \`PagosGym\` y \`pagosDe\`.
- **Calendarios (.ics):** exportar la grilla de las próximas cuatro semanas (real) e importar la URL de un calendario externo (simulado: dos días de ejemplo que quedan como días sin clases); la lista de calendarios conectados con sus días y la última sincronización.
- **Datos del negocio** y **Horarios** adentro de Configuración: días que abre y horario; si el horario nuevo deja clases afuera se avisa antes de guardar y la grilla las marca.

${comoQuedo('gimnasio', ['Equipo · 1280', 'secciones-equipo-1280.webp'], ['Recordatorios y mensajes · 1280', 'secciones-mensajes-1280.webp'], ['Pagos · 390', 'secciones-pagos-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:34',
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:48',
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:110',
      'apps/web/src/modules/gimnasio/admin/configuracion/Actividades.tsx:25',
      'apps/web/src/modules/gimnasio/admin/configuracion/Planes.tsx:11',
      'apps/web/src/modules/gimnasio/admin/configuracion/Reglas.tsx:20',
      'apps/web/src/modules/gimnasio/admin/configuracion/Bloqueos.tsx:24',
      'apps/web/src/modules/gimnasio/admin/configuracion/Bloqueos.tsx:59',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:59',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:74',
      'apps/web/src/modules/gimnasio/admin/configuracion/Pagos.tsx:21',
      'apps/web/src/modules/gimnasio/admin/configuracion/Calendarios.tsx:21',
      'apps/web/src/modules/gimnasio/admin/configuracion/Calendarios.tsx:25',
      'apps/web/src/modules/gimnasio/admin/configuracion/Calendarios.tsx:37',
      'apps/web/src/modules/gimnasio/datos/index.ts:112',
      'apps/web/src/modules/gimnasio/datos/index.ts:186-192',
      'apps/web/src/modules/gimnasio/datos/index.ts:214-217',
      'apps/web/src/modules/gimnasio/datos/index.ts:233',
      'apps/web/src/modules/gimnasio/datos/index.ts:301',
      'apps/web/src/modules/gimnasio/datos/index.ts:345',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:62-64',
      'apps/web/src/modules/gimnasio/storefront/Home.tsx:76',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'clases-como-listado', tipo: 'diseño', quien: 'Ale',
    titulo: 'Gimnasio: Clases, el día y la grilla como un listado de Tienda',
    foco: 'Segmentado Día / Grilla semanal y "Nueva clase" en el encabezado; el día con la tira de siete días, una fila por clase (hora en mono, actividad, profe con su punto de color, barra de cupo y chips) y el detalle en un modal; la grilla con una columna por día y un chip por clase con el borde del color de la actividad.',
    que: `Clases era una lista de tarjetas con el día y, aparte, la grilla. Ahora es un listado del estándar de Tienda (\`Clases.tsx\`):
- **Encabezado:** el segmentado Día / Grilla semanal (\`?ver=grilla\`) y "Nueva clase".
- **El día** (\`Dia\`): la tira de siete días con "Hoy" y un punto en los días con lista de espera, flechas de semana, y una tarjeta con una fila por clase: la hora en mono, la actividad, el profe con su punto de color (o "Sin profe"), la barra de cupo y los chips "En curso", "N en espera" y "N de M vinieron". El día elegido va tintado, no lleno (como en Alquileres: el blanco sobre el primario a 11 px no llega a AA).
- **El detalle** (\`DetalleClase\`), en un modal que en celular es hoja: la asistencia con check-in (se abre \`checkInMin\` antes de la clase), Faltó, sacar, la lista de espera con "Darle el lugar", y anotar a alguien a mano con aviso si ya gastó su tope semanal o el pack.
- **La grilla** (\`Grilla\`): una columna por día que abre, cada clase un chip con el borde del color de la actividad, el profe, el cupo y "% lleno" (promedio de cuatro semanas); en celular, un día por vez con una tira de chips. Editar / Nueva clase (\`EditarClase\`): actividad, día, hora de 15 en 15 dentro del horario, profe (incluye "Sin profe por ahora"), sala y cupo; no deja pisar dos clases en la misma sala ni salir del horario.

El 27/10 la QA ajustó la tira en celular: el día elegido queda entero a la vista (un efecto centra el chip apretado solo si quedó cortado, como la tira de Reservar del sitio) y las flechas no se achican (\`flex-shrink: 0\`: medían 27 px a 390).`,
    antes: { 1280: 'clases-antes-1280.webp', 390: 'clases-antes-390.webp' },
    despues: { 1280: 'clases-despues-1280.webp', 390: 'clases-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:6',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:30',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:37',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:101',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:146',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:154-159',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:213',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:303',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:351',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:368',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alumnos', tipo: 'diseño', quien: 'Ale',
    titulo: 'Gimnasio: Alumnos (antes Atletas) con indicadores, filtros en tira y paginado',
    foco: 'La sección pasó a llamarse Alumnos (Socios en el gimnasio tradicional, Participantes en talleres); arriba, el aviso de quiénes vencen en 7 días y cuatro indicadores; filtros con cuenta por estado en una tira, buscador sin tildes, tabla con sigla en color fijo y "Mostrar 25 más".',
    que: `"Atletas" pasó a **Alumnos** (es el rótulo de crossfit, funcional, yoga, danza, artes marciales y natación; el gimnasio tradicional dice Socios y los talleres, Participantes). La pantalla (\`Socios.tsx\`):
- Arriba, el aviso con quiénes vencen en 7 días y cuatro \`KpiGym\`: al día, vencen en 7 días, vencidos y sin plan.
- La tira de filtros con la cuenta por estado (\`.gso-tira\`; píldoras de 44 px en celular) y el buscador por nombre o teléfono sin tildes (\`plano\`).
- La tabla \`rv-tabla\` (tarjetas en celular) con la sigla en un color fijo por nombre, el estado del plan, "vence en N d", cuántas clases le quedan y la asistencia de 30 días; los que vencen pronto van primero; "Mostrar 25 más" (\`PAGINA\`: hay 104 alumnos de ejemplo).
- La ficha por \`?socio=\` (\`Ficha\`): plan, vence, renovar o cambiar (asigna desde hoy; el cobro se registra a mano), "Avisar que vence" (simulado, dice si el automático está apagado), vino / faltó / asistencia 30 días y las últimas diez clases. Sumar alumno (\`NuevoSocio\`).

El texto "Un cupo por atleta" del sitio pasó a "Un cupo por alumno".`,
    antes: { 1280: 'alumnos-antes-1280.webp', 390: 'alumnos-antes-390.webp' },
    despues: { 1280: 'alumnos-despues-1280.webp', 390: 'alumnos-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:25',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:36-38',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:51',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:59',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:61',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:99-100',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:120-123',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:173',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:229',
      'apps/web/src/modules/gimnasio/datos/index.ts:80',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:316',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F27, slug: 'ingresos-comparaciones-honestas', tipo: 'diseño', quien: 'Ale',
    titulo: 'Gimnasio: Ingresos como tablero del estándar, con comparaciones honestas',
    foco: 'Cuatro indicadores con ícono y variación, "Por semana" con Barras del kit y tres listas con barra fina (por plan, ocupación por actividad, asistencia por día); el período en curso se compara con el mismo tramo del anterior y sin historial no se inventa un delta.',
    que: `Ingresos (\`Ingresos.tsx\`) es el tablero del panel de Tienda: el segmentado Este mes / Mes pasado / Últimos 3 meses, cuatro \`KpiGym\` con ícono y variación (Ingresos, Alumnos al día, Vencen en 7 días, Ocupación), "Por semana" con \`Barras\` del kit (una serie, un acento, el valor solo en la columna más alta y al foco) y tres listas con barra fina (\`.gii-filas\`): por plan, ocupación por actividad y asistencia por día de la semana. Las ventas se cuentan por la fecha en que arrancó el plan (y una renovación por vigencia desde el alta), más las clases sueltas (\`ventasEntre\`).

**Lo que se veía mal el 26/10 y se arregló el 27/10:** "▼ 40,1 %" comparaba medio noviembre contra octubre entero, y la ocupación "▲ 35 puntos" contra días anteriores al historial de la demo. Ahora:
- el período que todavía corre se compara con el mismo tramo del anterior (lo que va de noviembre contra el 1 al 14 de octubre) y la nota lo dice ("vs. 1 al 14 de octubre", \`comparado\`);
- la ocupación solo cuenta días con historial (\`primerDia\`, \`ocupacionEntre\`) y, sin período anterior con datos, no inventa un delta ("sin historial antes del jue 15 oct");
- sin ventas previas tampoco hay variación (\`variacion\` solo con \`antes > 0\`).

Con los datos de ejemplo da "▲ 11,3 % · 57 ventas · vs. 1 al 14 de octubre" (se ve en la captura del después). El valor sobre la columna del gráfico en oscuro ("$2.106.000", 2,17:1 según la QA del 26/10) no era una falla real: el rótulo está arriba de la barra, sobre la tarjeta; el medidor tomaba el fondo de la barra como fondo del texto, y se corrigió el medidor.

**Diferencias con el plan:** la tarea del 1/12 pide la comparación "contra el mes anterior": es contra el mismo tramo del período anterior, que es lo honesto a mitad de mes; por eso ahora sí se vinculó.`,
    antes: { 1280: 'ingresos-antes-1280.webp', 390: 'ingresos-antes-390.webp' },
    despues: { 1280: 'ingresos-despues-1280.webp', 390: 'ingresos-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:3',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:28',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:42',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:68',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:84',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:86',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:89-92',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:104',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:115',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:151-156',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:81',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F27, slug: 'qa-rediseno', tipo: 'tarea', quien: 'Ale',
    titulo: 'Gimnasio: QA del rediseño en 1280, 768, 390 y 390 oscuro, y los arreglos del 27/10',
    foco: '459 verificaciones con Playwright y 0 fallas en cuatro anchos; las 13 fallas del 26/10 eran tres cosas (flechas de 27 px, llaves que el medidor no contaba y un contraste medido contra el fondo equivocado); se borraron los parches locales que el kit tomó.',
    que: `Antes: \`tsc\` 0 errores en \`modules/gimnasio\` y \`pages/gimnasio-demo\`, eslint 0 errores (solo \`no-img-element\`, aceptados), vitest 14/14 (\`datos/__tests__/reglas.test.ts\`).

**La recorrida** (\`pw/rediseno/gimnasio.cjs\` en el scratchpad de la sesión, un contexto por vista; log en \`gimnasio.log\`): a 1280, 768, 390 y 390 en oscuro, las 14 secciones y sub-secciones del sidebar, el detalle de una clase, nueva clase, la ficha de un alumno, sumar alumno, sumar coach, agregar días sin clases, la campanita, el buscador (1280), el cajón y Configuración desplegada (390), el link viejo, la baja de un profe (1280), la tira de días de Clases a 390 (hoy entero a la vista al entrar, con "Semana siguiente" y al tocar un día; flechas de 44), la llave \`rv-switch\` a 390 (un toque 8 px arriba y abajo o 4 px a los costados cae en la llave y la cambia) y la tira de Reservar con el teclado. En cada pantalla: sin scroll horizontal, sin imágenes rotas, inputs de 16 px, toques de 44 px (contando el \`::before\` de la llave), contraste AA contra el fondo real y sin errores de consola. Resultado: **459 OK · 0 fallas** (1280: 114 · 768: 109 · 390: 119 · 390 oscuro: 117), 94 capturas.

**Las 13 fallas del 26/10 eran tres cosas:**
- las flechas de semana de la tira de Clases medían 27 px a 390: \`flex-shrink: 0\`;
- doce llaves de 42×24: el kit ya tenía el área de toque de 54×44 con un \`::before\`, el medidor no la contaba (ahora sí);
- el valor sobre la barra del gráfico en oscuro (2,17:1): el medidor tomaba la barra como fondo; corregido en \`medir.fondo\` (solo cuentan los ancestros que están debajo del texto, y un ancestro que scrollea cuenta aunque el texto haya quedado fuera de su caja: eso sacó también una falsa alarma en la ficha del alumno a 1280). El mismo arreglo le sirve al medidor común de \`pw/superadmin/visual.cjs\`.

**Parches locales borrados** porque el kit los tomó el 27/10: \`.rvp .rv-seg\`, \`.rvp .rv-chip--gris\`, \`.rvp .rv-btn--peligro\` y \`.rvp .rv-chip[aria-pressed]\` de \`CSS_PANEL\`, y el efecto \`scrollTo\` de \`Panel.tsx\` (lo hace \`LayoutPanel\`). Mensajes usa el \`Switch\` exportado del kit en vez de un botón crudo, y \`diasTxt\` de Bloqueos se fue: \`rangoTxt\` ya cubre un solo día. También el día elegido de la tira de Clases queda entero a la vista en celular.

Lo que queda fuera del módulo: nada en rojo. Los botones primarios (blanco 14 px 600 sobre #3B82F6, 3,7:1) el medidor los excluye a propósito: es la decisión abierta "Azul primario".

**Diferencias con el plan:** las tareas del 7, 8 y 9/12 piden "lista de fallas registrada en Auditoría" por ancho: está acá, en una sola entrada; la del 11/12 (correcciones) se cumple con las tres de arriba.

${comoQuedo('gimnasio', ['Tira de Clases con "Semana siguiente" · 390', 'qa-clases-tira-390.webp'], ['Ingresos en oscuro · 390', 'qa-ingresos-oscuro-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:30',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:154-159',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:136',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:18',
      'apps/web/src/design-system/reservas/estilo.tsx:136',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:355',
      'apps/web/src/modules/gimnasio/datos/__tests__/reglas.test.ts:1-5',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'alumnos-y-equipo', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: Atletas pasa a Alumnos y los profes van a Equipo',
    foco: '"Atletas" pasó a Alumnos solo en crossfit, funcional, yoga, danza, artes marciales y natación (el gimnasio tradicional sigue con Socios y los talleres con Participantes); los profes salieron de Actividades y salas a una sección Equipo, y dar de baja no borra sus clases: quedan sin profe.',
    que: `1. **Alumnos:** \`socio: 'Alumno/a'\` y \`socios: 'Alumnos'\` en seis rubros (\`RUBROS_GYM\`); el gimnasio tradicional sigue con **Socios** y los talleres con **Participantes**. El texto "Un cupo por atleta" del sitio pasó a "Un cupo por alumno".
2. **Equipo:** los profes salieron de Actividades y salas a una sección propia, con color, email e invitación. Dar de baja no borra sus clases: quedan "sin profe" (\`profeId: ''\`), se avisa cuántas, y la grilla, el día, el sitio ("Profe a confirmar") y la campanita lo muestran hasta que se asigne a otra persona.`,
    decision: 'La gente se llama Alumnos (o Socios, o Participantes) según el rubro, nunca Atletas. Los profes son una sección, Equipo, y una baja deja las clases sin profe en vez de borrarlas.',
    porque: 'Ale pidió "Atletas → Alumnos" el 26/10. "Atletas" era un rótulo de crossfit que colgaba de los otros rubros; "Alumnos" sirve para seis, y al gimnasio tradicional y a los talleres se les dejó el que ya usaban, porque "alumno" en un gimnasio de musculación suena a escuela. Equipo como sección es lo que hace Tienda (y Turnos): los profes son personas con acceso al panel, no un atributo de una actividad. Y borrar las clases de un profe que se fue borraría reservas de alumnos: la clase sigue, se le pone otro profe.',
    archivos: [
      'apps/web/src/modules/gimnasio/datos/index.ts:75',
      'apps/web/src/modules/gimnasio/datos/index.ts:80',
      'apps/web/src/modules/gimnasio/datos/index.ts:99',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:316',
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:3-4',
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:48',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:386-387',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'donde-vive-cada-cosa', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: dónde vive cada cosa y qué se guarda al instante',
    foco: 'Reglas de reserva tiene solo lo configurable (lo que el sistema hace solo se explica, no se configura); la seña, el cobro online y las renovaciones viven en Pagos y el aviso de vencimiento en Mensajes; Mercado Pago y el equipo se guardan al instante; los bloqueos de un calendario externo se quitan desconectándolo.',
    que: `1. **Reglas de reserva** tiene solo lo configurable: reservar hasta N días adelante, cancelar hasta N horas antes, check-in desde N minutos antes. Lo que el sistema hace solo (la lista de espera avanza, el pack se descuenta, la prueba vale una vez, la membresía respeta su tope) se explica ahí, en "Lo que pasa solo", pero no se configura.
2. La **seña / cobro online** y las **renovaciones** (quién la registra, días de gracia, qué pasa con las reservas de quien venció) viven en Pagos; el aviso de vencimiento, en Recordatorios y mensajes (Pagos solo enlaza).
3. **Conectar / Desconectar Mercado Pago** y el **equipo** se guardan al instante: son acciones, no un borrador. El resto, borrador + Guardar.
4. Los **bloqueos de un calendario externo** no se quitan desde Días sin clases: se desconecta el calendario.`,
    decision: 'Lo que es regla del sistema se explica y no se configura; lo que es plata vive en Pagos y lo que es un mensaje, en Mensajes; las acciones se guardan al toque y lo importado por .ics se saca desconectando el calendario.',
    porque: 'Una llave para "que la lista de espera avance sola" es una promesa de algo que, apagado, rompería la reserva: las reglas probadas en `reglas.test.ts` no son opciones. Pagos y Mensajes siguen el criterio de Tienda y el mismo que Alquileres tomó el mismo día, así los dos paneles se parecen. Un "Conectado" sin guardar confundía en la QA. Y un bloqueo importado tiene dueño: si se borra suelto, la próxima sincronización lo trae de vuelta.',
    archivos: [
      'apps/web/src/modules/gimnasio/admin/configuracion/Reglas.tsx:20',
      'apps/web/src/modules/gimnasio/admin/configuracion/Reglas.tsx:27',
      'apps/web/src/modules/gimnasio/admin/configuracion/Pagos.tsx:4',
      'apps/web/src/modules/gimnasio/admin/configuracion/Pagos.tsx:26',
      'apps/web/src/modules/gimnasio/admin/Equipo.tsx:43',
      'apps/web/src/modules/gimnasio/admin/configuracion/Bloqueos.tsx:47',
      'apps/web/src/modules/gimnasio/datos/__tests__/reglas.test.ts:1-5',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'vista-previa-whatsapp', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: la vista previa de los mensajes es una pantalla de WhatsApp',
    foco: 'La vista previa de Recordatorios y mensajes usa los colores de WhatsApp (verde, en claro y en oscuro) porque tiene que parecerse a lo que llega al teléfono; el resto del panel no usa ese verde. Alquileres y Turnos eligieron un chat neutro: unificar o no queda abierto.',
    que: `En Recordatorios y mensajes, cada plantilla se ve en una pantalla de WhatsApp (\`VistaWhatsApp\`, \`.gms-wa\`): la cabecera gris con la sigla del negocio, el fondo beige, la burbuja verde con el texto y las variables rellenas con un alumno y una clase reales (\`ejemploDe\`), y la firma. Tiene su versión en oscuro. Ese verde no aparece en ningún otro lugar del panel.`,
    decision: 'La vista previa del mensaje en Gimnasio se ve como WhatsApp, con sus colores, aunque el panel use un solo acento.',
    porque: 'La vista previa existe para que el dueño sepa cómo le va a llegar el mensaje al alumno, y lo que le llega es un WhatsApp: con los colores del panel se vería como un aviso más del sistema. Es una diferencia consciente con Alquileres y Turnos (chat neutro) y la unificación la decide Ale (decisión abierta "Pedidos del kit que quedaron sin tomar").',
    archivos: [
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:37-45',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:59',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:163',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:58',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F27, slug: 'ingresos-compara-periodos-iguales', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: Ingresos compara períodos del mismo largo y no inventa un delta sin historial',
    foco: 'El período en curso se compara con el mismo tramo del anterior (lo que va de noviembre contra el 1 al 14 de octubre), la ocupación solo cuenta días con historial y, sin datos previos, no hay chip de variación.',
    que: `El 26/10 Ingresos comparaba "este mes" (medio noviembre) contra octubre entero y daba "▼ 40,1 %", y la ocupación contra días anteriores al historial de la demo daba "▲ 35 puntos". Desde el 27/10 el período que corre se compara con el mismo tramo del anterior, la ocupación arranca en \`primerDia\` (el primer día con historial) y, sin período anterior con datos, el indicador sale sin chip y la nota lo dice.`,
    decision: 'Las variaciones de Ingresos comparan tramos del mismo largo y solo aparecen cuando hay con qué comparar.',
    porque: 'A mitad de mes, "este mes contra el mes pasado entero" daba una caída del 40 % que no existía, y la ocupación contra días sin historial un salto de 35 puntos: un tablero que miente en la demo va a mentir con datos reales. Mejor un indicador sin chip que uno con un número inventado. Alquileres hace lo mismo (`periodoAnterior`, del mismo largo).',
    archivos: [
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:89-92',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:62-66',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:84',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:151',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:154-156',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:34',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'colores-badges-y-dia-tintado', tipo: 'decisión', quien: 'Ale',
    titulo: 'Gimnasio: colores de borde, siglas en tonos 700, qué cuentan los badges y el día tintado',
    foco: 'Los colores de actividad van de borde en la grilla, nunca debajo de un texto; los del equipo son tonos 700 que llegan a AA con la sigla blanca; el badge de Clases cuenta personas esperando lugar hoy y el de Alumnos, planes que vencen en 7 días; el día elegido de la tira va tintado, no lleno.',
    que: `1. Los **colores de actividad** (\`COLORES_ACTIVIDAD\`) van de borde en los chips de la grilla, nunca debajo de un texto.
2. Los **colores del equipo** (\`COLORES_EQUIPO\`) son tonos 700: con la sigla blanca encima dan 4,5:1 o más (el kit adoptó la misma paleta para \`Sigla\` el 27/10).
3. El **badge de Clases** cuenta personas esperando lugar hoy; el de **Alumnos**, planes que vencen en 7 días.
4. El **día elegido** de la tira de Clases va tintado (fondo claro del acento, borde y tinta oscura), no lleno: el blanco sobre el primario a 11 px no llega a AA. Igual que en Alquileres.`,
    decision: 'El color nunca va debajo de un texto chico salvo en tonos que llegan a AA; los badges cuentan lo que hay que atender hoy; el día elegido se marca con tinte, borde y tinta oscura.',
    porque: 'Son las tres formas de no romper AA con color: un borde no tiene texto encima; un tono 700 con la sigla blanca da 4,5:1 o más (los 600 daban 3,0 a 3,9:1); y el blanco sobre el primario a 11 px da 3,68:1. Un badge que cuenta todo (todas las clases, todos los alumnos) no dice nada: cuenta lo que se puede atender ahora.',
    archivos: [
      'apps/web/src/modules/gimnasio/datos/index.ts:186',
      'apps/web/src/modules/gimnasio/datos/index.ts:300-301',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:58',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:62-63',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:37',
      'apps/web/src/design-system/reservas/piezas.tsx:124',
    ],
  }),

  // ─── Transversal · el kit y el armazón (en Gimnasio, el módulo de Ale) ─────
  entrada({
    modulo: 'gimnasio', fecha: F, slug: 'layoutpanel-v2', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: LayoutPanel v2, el armazón del panel de Tienda para los módulos',
    foco: 'El armazón del kit pasó de una barra con ítems sueltos y un header mínimo al estándar de Tienda: grupos rotulados, sub-secciones plegables, header de 64 px con miga, buscador (Ctrl K), fecha, tema, campanita y cuenta, el contenido scrolleando adentro de main y el cajón en celular.',
    que: `Para que los tres paneles fueran "el estándar de Órbita" sin importar nada de Tienda (regla "Módulos independientes"), el armazón \`LayoutPanel\` del kit \`design-system/reservas\` se reescribió con las medidas y el lenguaje de \`layouts/AdminLayout\`, \`Sidebar\` y \`Header\` de Tienda, sin su sesión ni su API:
- **Barra lateral de 240 px** con el logo arriba (64 px), la tarjeta del negocio con su sigla, los grupos rotulados (\`grupo\` en cada \`ItemNav\`) y, en los ítems que las tienen, las sub-secciones plegables (\`subs\`, viajan en \`?tab=\`) unidas por la línea que se enciende hasta la activa, como Configuración en Tienda. Badges por ítem y por sub-sección.
- **Header de 64 px** con la miga (producto › sección › sub-sección), el buscador (\`busqueda\`, con Ctrl K: los del grupo "Ir a" se ofrecen sin escribir), la fecha, el tema claro u oscuro, la campanita (\`avisos\`, con el contador de los no leídos y "Marcar leídas") y la cuenta (\`usuario\`; con \`cuentas\` se puede mirar el panel como alguien del equipo).
- El contenido scrollea adentro de \`<main>\` (\`.admin-main\`, el fondo del panel), no la ventana, y vuelve arriba al cambiar de sección.
- En celular (hasta 768 px) la barra es un cajón: el foco entra, no se escapa (lo de atrás queda inert), Escape, el velo, la X o elegir una sección lo cierran y el foco vuelve al botón de menú. Los paneles flotantes (buscador, avisos, cuenta) se cierran al tocar afuera o con Escape. Nada de hover por JS: \`ds-hover\` y \`ds-field\`.

Antes el armazón era una barra con ítems sueltos y un header con el nombre del negocio y el link al sitio, "sin buscador ni campanita: el panel es corto y se recorre de un vistazo". Con todo en el sidebar dejó de ser corto. Lo usan Alquileres y Gimnasio (las entradas "al estándar de Órbita" de cada uno, con sus capturas) y Turnos en su rediseño. Quedó en el commit f1623 del 27/10, junto con los contrastes.`,
    archivos: [
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:1-18',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:27-36',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:217',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:266',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:285-286',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:322',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:355',
      'apps/web/src/modules/alquileres/admin/Panel.tsx:159-160',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:163',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F27, slug: 'kit-toma-los-pedidos', tipo: 'diseño', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el kit toma lo que pidieron los módulos',
    foco: 'Contrastes AA del armazón LayoutPanel (ítem y sub-sección activos, badge, sigla, contador y links en tinta del acento sobre su fondo claro), Sigla con paleta 700, chip apretado tintado, segmentado y chip gris en color-body, botón de peligro con el rojo de los chips, scroll arriba al cambiar de sección, Switch suelto, Nota que envuelve, Area con ref, Campo disabled.',
    que: `Alquileres y Gimnasio anotaron lo que necesitaron del kit \`design-system/reservas\` y lo resolvieron mientras tanto con parches locales (\`pedidos-kit-alquileres.md\` y \`pedidos-kit-gimnasio.md\`, en el scratchpad de la sesión). El 27/10 el kit tomó lo que era suyo (commit f1623) y los módulos borraron sus parches:
- **Contrastes AA del armazón** (\`LayoutPanel\`): el ítem y la sub-sección activos (3,38:1), el badge del ítem activo y la sigla del negocio (3,68:1), el contador de la campanita (3,76:1), "Marcar leídas" (3,52:1) y la fecha de cada aviso (2,45:1) van ahora en tinta oscura del acento sobre su fondo claro (\`--chip-primary-fg\` sobre \`--color-primary-bg\`) o en \`--color-muted\`: el blanco sobre el primario a 10–14 px daba 3,4–3,7:1.
- **\`Sigla\` con paleta 700** por defecto: todas dan 4,5:1 o más con la sigla blanca (las 600 daban 3,0–3,9:1).
- **Chip apretado tintado** (\`button.rv-chip[aria-pressed='true']\`: fondo claro del acento, tinta oscura y borde), el **segmentado** apagado y el **chip gris** en \`--color-body\` (eran \`--color-muted\`, 4,34:1 a 13 px), y el **botón de peligro** con el rojo de los chips (\`--chip-error-fg\`; \`--color-error\` sobre blanco daba 3,76:1).
- **Vuelve arriba** solo al cambiar de sección o de sub-sección (\`activo\` o \`tab\`): antes cada módulo tenía su \`scrollTo\`.
- **\`Switch\` suelto** exportado (Gimnasio y Alquileres tenían un \`<button role="switch">\` crudo en Mensajes), **\`Nota\` envuelve su texto** (era flex con gap: un \`<b>\` adentro partía la fila en ítems), **\`Area\` acepta \`ref\` y \`disabled\`** (para insertar una llave donde está el cursor) y **\`Campo\` acepta \`disabled\` y \`readOnly\`**.

- **Y lo que pidió Turnos** (\`pedidos-kit-turnos.md\`, commit da07e de la madrugada): el avatar del menú de cuentas lleva el color de la persona como tinte y anillo con las iniciales en tinta de texto (blancas daban 2,2–4,2:1), los rótulos de grupo de los paneles flotantes van en \`--color-muted\` a 11 px, el botón de cerrar notificaciones mide 44 px en celular, hay una clase \`.rv-link\` para texto suelto en el acento (\`--chip-primary-fg\`, 44 px en celular) y en \`estilo.tsx\` queda escrito qué tokens sirven para texto y cuáles no.

Lo que no se tomó (el \`Kpi\` con ícono y variación, la barra de guardar, el toque de 44 de la llave en el medidor, la tira de chips de 38 px, la vista previa de mensajes, la cabecera del \`Modal\` que estira su primer \`div\`, el gris sobre \`--color-primary-bg\` y el celular de vista previa) está en la decisión abierta "Pedidos del kit que quedaron sin tomar".

En las capturas, el armazón de Alquileres: el antes es la captura del 26/10 (antes del commit del kit), con la sigla y el badge en blanco sobre el azul; el después, el mismo panel el 27/10. A 390, el cajón del menú.`,
    antes: { 1280: 'kit-armazon-antes-1280.webp', 390: 'kit-armazon-antes-390.webp' },
    despues: { 1280: 'kit-armazon-despues-1280.webp', 390: 'kit-armazon-despues-390.webp' },
    archivos: [
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:59-61',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:69',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:73-74',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:85',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:117',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:144',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:151',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:355',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:123',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:139',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:175',
      'apps/web/src/design-system/reservas/estilo.tsx:115',
      'apps/web/src/design-system/reservas/estilo.tsx:79',
      'apps/web/src/design-system/reservas/estilo.tsx:91',
      'apps/web/src/design-system/reservas/estilo.tsx:96',
      'apps/web/src/design-system/reservas/estilo.tsx:106',
      'apps/web/src/design-system/reservas/estilo.tsx:128',
      'apps/web/src/design-system/reservas/estilo.tsx:279',
      'apps/web/src/design-system/reservas/piezas.tsx:55-57',
      'apps/web/src/design-system/reservas/piezas.tsx:72',
      'apps/web/src/design-system/reservas/piezas.tsx:105',
      'apps/web/src/design-system/reservas/piezas.tsx:122-124',
      'apps/web/src/design-system/reservas/piezas.tsx:266',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:136',
    ],
  }),

  // ─── Turnos · Mateo · rediseño ──────────────────────────────────────────────
  entrada({
    modulo: 'turnos', fecha: F, slug: 'todo-en-el-sidebar', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Turnos al estándar de Órbita: todas las secciones en el sidebar',
    foco: 'El panel usa LayoutPanel v2 con Hoy (Resumen, Agenda), Negocio (Clientes, Servicios, Equipo, Espacios, Ganancias), Reservas (Reglas, Recordatorios y mensajes, Pagos) y Configuración con Datos, Horarios, Apariencia, Dominio y Suscripción; el armazón propio, la columna de pestañas y las piezas tuo- del panel se borraron.',
    que: `Turnos ya tenía un armazón propio (\`layout/LayoutTurnos.tsx\`) con buscador y campanita, pero Servicios, Equipo, Espacios, Ganancias, Reglas, Mensajes y Pagos vivían adentro de Configuración, con su propia columna de pestañas ("Navegación del panel de Turnos: Hoy y Negocio", del 26/10). Ale pidió explícito Reglas de reserva, Recordatorios y mensajes, Ganancias y Pagos en el sidebar. Ahora el panel usa \`LayoutPanel\` v2 del kit (entrada transversal "LayoutPanel v2") y la barra completa (\`items\` con \`grupo\` y \`subs\` en \`PanelTurnos.tsx\`):
- **Hoy:** Resumen y Agenda (badge con los turnos de hoy sin confirmar; "Mi agenda" para un rol que ve solo la suya).
- **Negocio** (rotulado "El negocio" o "Lo tuyo" según el rol): Clientes o Pacientes, Servicios, Equipo, Cabinas / Consultorios / Equipos EMS (solo en los rubros por espacio) y Ganancias ("Mis ganancias" para quien ve solo lo suyo).
- **Reservas** (solo quien puede configurar): Reglas de reserva, Recordatorios y mensajes y Pagos (badge con las señas por cobrar).
- Sin grupo: Configuración › Datos del negocio, Horarios, Apariencia, Dominio y Suscripción (con separador); y Avanzado (\`&funcion=\` abre cada función).

Cada sección es una página con su \`rv-pagina\` y su \`Encabezado\`, no un envoltorio de la pestaña vieja. Se borraron (\`git rm\`) \`layout/LayoutTurnos.tsx\`, \`admin/configuracion/ConfiguracionTurnos.tsx\` (la columna de pestañas) y \`_shared/orbita/piezas.tsx\`; sus piezas viven en \`admin/piezasPanel.tsx\`, y \`_shared/orbita/estilo.tsx\` (\`tuo-\`) queda solo para el índice de la demo, la landing y el paso de la reserva pública: ninguna pantalla del panel lo monta. La URL es el único estado (\`navegar\` / \`ir\`); los links viejos \`?vista=configuracion&tab=servicios|equipo|espacios|ganancias|reservas|mensajes|pagos\` abren la sección nueva y la URL se reescribe (\`TABS_VIEJAS\`), probado en los cuatro anchos. El header: \`producto="Turnos"\`, fecha de la demo, buscador (Ctrl K: secciones, turnos de hoy, clientes, servicios, equipo), campanita (sin confirmar, nuevos, ausentes, cancelados) y la cuenta con "Ver el panel como" (\`cuentas\`, \`viendoComo\`, \`onCuenta\`) y su franja \`tu-como\`. Servicios suma pausar y reanudar.

La primera sesión del rediseño (26/10, cortada por el límite de uso) puso el armazón y las pantallas principales; la segunda (27/10) terminó Avanzado, arregló Apariencia y sumó sustancia a Pagos, Recordatorios y la ficha de cliente (sus entradas). Todo en el commit 6d526.

En las capturas, Configuración a 1280 antes (la columna de pestañas Tu sitio / Tu negocio / Equipo / Cuenta, con Apariencia como pestaña de entrada) y después (Datos del negocio como sub-sección). A 390 el después es el cajón del menú.`,
    antes: { 1280: 'panel-sidebar-antes-1280.webp', 390: 'panel-sidebar-antes-390.webp' },
    despues: { 1280: 'panel-sidebar-despues-1280.webp', 390: 'panel-sidebar-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:191-202',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:212',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:221-226',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:437-442',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:456-457',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:470-471',
      'apps/web/src/modules/turnos/admin/configuracion/datos.ts:20',
      'apps/web/src/modules/turnos/admin/configuracion/datos.ts:29',
      'apps/web/src/modules/turnos/admin/configuracion/Reservas.tsx:63',
      'apps/web/src/modules/turnos/admin/Ganancias.tsx:97',
      'apps/web/src/modules/turnos/admin/Servicios.tsx:6',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:20',
      'apps/web/src/modules/turnos/_shared/orbita/estilo.tsx:1-8',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'avanzado-al-estandar', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Turnos: Avanzado al estándar, el hub y las tres funciones con el kit',
    foco: 'El hub dejó de ser una vidriera oscura con degradado y anillo: página plana con encabezado, "N de 3 activas", buscador y segmentado, un bloque por objetivo y tarjetas del kit; cada función con Volver, interruptor maestro plano, indicadores y la vista previa en un celular plano con el tema del sitio.',
    que: `Antes el hub de Avanzado era una "vidriera" oscura con degradado y un anillo (\`tuo-espacio\`), tarjetas con un tono por grupo y animaciones al pasar (escala y giro), un celular 3D inclinado con sombras y una órbita que giraba, un interruptor maestro con degradado, inputs con una clase que ya no existía (\`tuc-field\`: se veían sin borde) e imports de \`modules/ventas\` (\`Volver\`, \`cargarFuentes\`), que la regla de módulos independientes prohíbe.
- **El hub** (\`AvanzadoTurnos.tsx\`): \`rv-pagina\` con \`Encabezado\` y el chip "N de 3 activas", \`Buscador\` y \`Segmentado\` en una tira, un bloque por objetivo (Llenar la agenda, Cobrar mejor) con \`rv-h2\`, y tarjetas \`rv-card rv-card--accion\`. Los grupos ya no tienen tono (\`datosAvanzado.ts\`): un solo acento.
- **El armazón de cada función** (\`ShellFuncion\` en \`avanzado/ui.tsx\`): \`Volver\` propio, \`Encabezado\`, el interruptor maestro en una tarjeta plana, los indicadores en \`rv-kpis\`, dos columnas con la vista previa pegajosa y un Guardar que avisa con el toast del panel (\`avisar\`, que \`PanelTurnos.tsx\` le pasa).
- **La vista previa** (\`VistaCliente\`): un celular plano (tarjeta con borde y radio 30, sin inclinación ni sombras) con una pantalla pintada con las variables del tema del sitio, que es lo que ve el cliente.
- **Las tres funciones** (Paquetes y bonos, Membresías y abonos, Precios por horario) reescritas con los controles de Configuración (\`SecCard\`, \`FilaSwitch\`, \`Segmentado\`) y del kit (\`rv-input\`, \`rv-select\`, \`rv-chip\`, \`Barra\`). El mapa de ocupación de Precios por horario (\`tua-mapa\`) usa una escala de un solo tono que no pasa del 55 % del acento y texto siempre en tinta de texto.

Qué funciones quedan sigue siendo la decisión del 26/10 ("Avanzado se queda con Membresías, Paquetes y Precios por horario"); esto es cómo se ven.`,
    antes: { 1280: 'avanzado-antes-1280.webp', 390: 'avanzado-antes-390.webp' },
    despues: { 1280: 'avanzado-despues-1280.webp', 390: 'avanzado-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:31',
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:73',
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:84',
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:89',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:26',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:68-73',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:80-81',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:165',
      'apps/web/src/modules/turnos/admin/avanzado/Paquetes.tsx:14',
      'apps/web/src/modules/turnos/admin/avanzado/Paquetes.tsx:139',
      'apps/web/src/modules/turnos/admin/avanzado/Membresias.tsx:10',
      'apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts:20',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:525',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'apariencia-con-su-hoja', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Turnos: Apariencia volvía a verse rota y pasó al lenguaje del kit',
    foco: 'Su CSS se montaba en el ConfiguracionTurnos borrado en la sesión 1 y la pantalla salía sin estilos; ahora lo monta sola, usa rv-pagina con el ancho de editor (1760 px), las clases rv- en vez de tuo-/tuc-, y tarjetas de plantilla, vista previa, paletas y fotos planas, sin sombra ni zoom.',
    que: `Al borrar \`ConfiguracionTurnos.tsx\` en la sesión 1 se fue con él el \`<style>\` que montaba \`CSS_APARIENCIA\`, \`CSS_MINI\`, \`CSS_PLANTILLA\` y \`CSS_VISTA_PREVIA\`: Apariencia salía sin estilos (el iframe de la vista previa aparecía sobre el header, las tarjetas-radio sin forma, el riel sin riel). Ahora la pantalla monta su hoja sola.
- \`panel-page panel-page--editor\` (clase de Tienda) pasó a \`rv-pagina tuc-pagina--editor\`: 1760 px, como el editor de Tienda, la única pantalla ancha de Configuración (editor y vista previa lado a lado; el resto queda en 880).
- \`tuo-h2\`, \`tuo-btn\`, \`tuo-rotulo\`, \`tuo-num\`, \`tuc-pastilla\` y \`tuc-sr\` pasaron a \`rv-h2\`, \`rv-btn\`, \`rv-rotulo\`, \`rv-num\`, \`rv-chip rv-chip--borde\` y \`rv-sr\`; sin el punto que latía.
- Tarjetas de plantilla planas (\`MiniSitio.tsx\`): radio 12, borde fino, la elegida con un anillo de 1 px del acento, "En uso" en tinta del acento sobre fondo; sin sombra, sin elevarse ni escalar la miniatura al pasar. La vista previa sin sombras (\`VistaPrevia.tsx\`); paletas, fotos y tildes sin sombra ni zoom.

En las capturas, el antes es la Configuración vieja, que abría en Apariencia (con el \`tuo-\` del panel de antes); el después, Apariencia con el kit.`,
    antes: { 1280: 'panel-sidebar-antes-1280.webp', 390: 'panel-sidebar-antes-390.webp' },
    despues: { 1280: 'apariencia-despues-1280.webp', 390: 'apariencia-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:76',
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:188-191',
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:578-579',
      'apps/web/src/modules/turnos/admin/configuracion/MiniSitio.tsx:171',
      'apps/web/src/modules/turnos/admin/configuracion/MiniSitio.tsx:180',
      'apps/web/src/modules/turnos/admin/configuracion/MiniSitio.tsx:196',
      'apps/web/src/modules/turnos/admin/configuracion/VistaPrevia.tsx:190-192',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'pagos-senas-por-cobrar', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Turnos: Pagos lista las señas por cobrar desde la agenda',
    foco: 'Arriba de la configuración de Pagos, "Señas por cobrar": los turnos de las próximas dos semanas que no pagaron la seña, con el total en el badge del menú; cada fila abre el turno y "Registrar" la cobra con el mismo registrarSena del detalle; si el negocio no pide seña, lo dice y lleva a Reglas.',
    que: `Es sustancia para el "hay que mejorar 1000 veces más" de Ale: Pagos era solo configuración. Ahora arranca con **Señas por cobrar** (\`configuracion/Pagos.tsx\`): los turnos de las próximas dos semanas que todavía no pagaron la seña, que salen de la agenda (\`senasPendientes\` en \`PanelTurnos.tsx\`), con el total en el chip y en el badge del ítem Pagos del menú. Cada fila abre el turno (la fecha es un \`tuc-link\`) y "Registrar" cobra la seña con el mismo \`registrarSena\` del detalle del turno. Es una tabla \`rv-tabla\`, que en celular pasa a tarjetas, con la celda "Cuándo" a la izquierda. Si el negocio no pide seña, la tarjeta lo dice y lleva a Reglas de reserva.

${comoQuedo('turnos', ['Pagos con seña del 20 %, peluquería · 1280', 'pagos-senas-1280.webp'], ['Pagos · 390', 'pagos-senas-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/Pagos.tsx:38',
      'apps/web/src/modules/turnos/admin/configuracion/Pagos.tsx:49',
      'apps/web/src/modules/turnos/admin/configuracion/Pagos.tsx:56',
      'apps/web/src/modules/turnos/admin/configuracion/Pagos.tsx:61',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:179',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:202',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:519',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'recordatorios-hoy-y-ficha-con-historial', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Turnos: Recordatorios muestra la confirmación de hoy y la ficha del cliente tiene historial real',
    foco: 'La tarjeta "Hoy" de Recordatorios dice cuántos turnos del día confirmaron y cuántos faltan, con el primero sin confirmar y "Ver el turno"; la ficha del cliente lista los turnos atendidos o ausentes de los últimos dos meses, sacados de la agenda, en vez de una lista fija igual para todos.',
    que: `- **Recordatorios y mensajes** (\`configuracion/Mensajes.tsx\`): una tarjeta "Hoy" con los turnos del día, cuántos confirmaron y cuántos faltan, el primero sin confirmar con nombre y hora, y "Ver el turno", que lo abre (desde ahí se le manda el recordatorio: el bloque no manda nada por su cuenta). El chip dice si el recordatorio automático está prendido. Props nuevas \`turnosHoy\`, \`nombreDe\` y \`onAbrir\`, que \`PanelTurnos.tsx\` le pasa.
- **La ficha del cliente** (\`admin/Clientes.tsx\`): antes mostraba una lista fija (\`HISTORIAL\`, las mismas cuatro fechas para todos). Ahora \`historialDe\` (\`PanelTurnos.tsx\`) saca de la agenda los turnos atendidos o ausentes de esa persona en los últimos dos meses; la ficha los lista con fecha, servicio, hora, precio (si el rol ve números) y estado, cada uno abre su turno, y "Ver los N turnos" despliega el resto. Las ausencias del indicador salen de ahí. \`Clientes\` ya no recibe \`servicios\` (solo servía para inventar nombres).
- **Un error de React Compiler** en la redirección de los links viejos: \`useEffect\` → \`ir()\` → \`setClienteSel(null)\` era un \`setState\` sincrónico dentro de un efecto (el único error de eslint del módulo). Ahora \`navegar\` solo toca la URL, \`ir\` (lo que usa el menú) cierra la ficha y navega, y la redirección usa \`navegar\`.

**Diferencias con el plan:** la tarea del 1/12 ("clientes y horarios de trabajo") pide editar el horario semanal y los feriados sin salir del panel: Horarios ya era una sección de Configuración; lo nuevo es la ficha con historial.

${comoQuedo('turnos', ['Recordatorios con la tarjeta Hoy · 1280', 'mensajes-hoy-1280.webp'], ['Ficha de un cliente · 390', 'cliente-ficha-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:74',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:105-106',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:116',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:127',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:308',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:518',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:221-230',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:5',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:86-87',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:212-213',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:264',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'contraste-aa-y-chat-neutro', tipo: 'diseño', quien: 'Mateo',
    titulo: 'Turnos: contraste AA en lo que es del módulo y la vista previa del chat con los colores del panel',
    foco: 'Texto en el acento con --chip-primary-fg (links, "Ver agenda", la columna de hoy y la etiqueta de "ahora" de la agenda), --color-subtle fuera del texto, --color-body sobre primary-bg, hoy tintado con anillo, estados Atendido y Cancelado legibles, el mapa de ocupación sin blanco sobre celdas claras; y la burbuja del chat sin los verdes de WhatsApp.',
    que: `Lo que el medidor de la QA marcaba por debajo de 4,5:1 y era del módulo (lo del kit se pidió aparte: "El kit toma lo que pidieron los módulos"):
- **Texto en el acento → \`--chip-primary-fg\`:** \`.tuc-link\`, \`.tua-funcion-ir\`, "En curso" y "Ver agenda" del Resumen, "Ver los N turnos" en Clientes y Ganancias, el plan elegido en Cuenta, la opción elegida en Apariencia, y en la agenda la columna de hoy, "+N más" y la etiqueta de "ahora" (tinta del acento sobre fondo con borde: el blanco sobre el acento daba 3,68:1).
- **\`--color-subtle\` dejó de usarse para texto** (2,56:1): escalas de horas, contadores de caracteres, días apagados y rótulos de la agenda pasaron a \`--color-muted\`.
- **Sobre \`--color-primary-bg\`** el gris \`--color-muted\` queda en 4,37:1: pasa a \`--color-body\` en la opción elegida de una tarjeta-radio, el ítem elegido de Avanzado, la opción marcada del buscador de Nuevo turno y la burbuja del chat.
- **Hoy en el mes** va tintado con anillo, no lleno; los estados Atendido y Cancelado del chip usan \`--color-body\` (4,3:1 con muted). El mapa de ocupación de Precios por horario no pone texto blanco sobre celdas claras.
- **La vista previa del chat** (\`BurbujaWA\` en Mensajes y \`MensajeWhatsApp\` en \`piezasPanel.tsx\`): la forma de un chat (burbuja, hora, tildes) pero con \`--color-surface\`, \`--color-primary-bg\` y \`--chip-primary-fg\`; antes llevaba los verdes de WhatsApp en claro y en oscuro. Misma decisión que Alquileres.
- **Dos arreglos en modales:** el \`Avatar\` del design system es un \`div\` y la cabecera del modal del kit estira su primer \`div\`, así que en la ficha de cliente salía una elipse (el ícono va envuelto en \`piezasPanel.tsx\`); y \`.tu-cli-prox-ico\` se estiraba por una regla \`> span { flex: 1 }\`.

En las capturas, la Agenda antes y después: la columna de hoy, los chips de estado y la tira de agendas tintada. Después de esto, nada del módulo queda debajo de AA en claro ni en oscuro.

**Diferencias con el plan:** la tarea del 13/11 pide la pasada de oscuro del panel y del storefront; el storefront la tuvo en la QA del 26/10 ("QA responsive de Turnos"). La del 30/11 pide además que los vacíos expliquen qué hacer: los de Avanzado lo hacen ("Todavía no prendiste ninguna función"); el resto no se revisó a propósito.

${comoQuedo('turnos', ['Vista previa del chat, neutra · 1280', 'chat-neutro-1280.webp'])}`,
    antes: { 1280: 'agenda-antes-1280.webp', 390: 'agenda-antes-390.webp' },
    despues: { 1280: 'agenda-despues-1280.webp', 390: 'agenda-despues-390.webp' },
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:63',
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:33',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:39',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:56-57',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:165',
      'apps/web/src/modules/turnos/admin/Ganancias.tsx:384',
      'apps/web/src/modules/turnos/admin/configuracion/Cuenta.tsx:168',
      'apps/web/src/modules/turnos/admin/Agenda.tsx:46-47',
      'apps/web/src/modules/turnos/admin/Agenda.tsx:52-55',
      'apps/web/src/modules/turnos/admin/Agenda.tsx:95',
      'apps/web/src/modules/turnos/admin/configuracion/Horarios.tsx:54',
      'apps/web/src/modules/turnos/admin/Espacios.tsx:31',
      'apps/web/src/modules/turnos/admin/NuevoTurno.tsx:46-47',
      'apps/web/src/modules/turnos/datos/index.ts:263-266',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:53',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:244',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:197',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:501',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:51-52',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'qa-rediseno', tipo: 'tarea', quien: 'Mateo',
    titulo: 'Turnos: QA del rediseño en 1280, 768, 390 y 390 oscuro',
    foco: '38 pantallas por corrida con Playwright: ninguna desborda, sin imágenes rotas, inputs de 16 px, sin errores de consola, el link viejo redirige y "ver el panel como" aparece; lo que quedó en falla es del kit o del armazón (anotado en pedidos-kit-turnos.md, parte tomada el 27/10) o la decisión abierta de los botones primarios.',
    que: `Antes: \`tsc --noEmit\` 0 errores en \`modules/turnos\` (quedan los 2 preexistentes de \`modules/orbi/piezas/Mensaje.tsx\`, de mayúsculas en Windows); eslint 0 errores en \`modules/turnos\` y \`pages/turnos-demo\` (14 avisos \`no-img-element\`, aceptados); el módulo no tiene tests.

**La recorrida** (\`pw/rediseno/turnos.cjs\` en el scratchpad de la sesión, un contexto por corrida): 38 pantallas en cada ancho: cada ítem y sub-sección del sidebar, la Agenda en día, semana y mes, Cabinas (rubro estética), Pagos con seña (peluquería), las tres funciones de Avanzado, los modales (ficha y alta de cliente, nuevo servicio, invitar, editar persona, liquidación, nuevo turno, detalle de turno, WhatsApp), la campanita, el buscador (solo 1280), el menú de cuentas, "ver el panel como", el link viejo y el cajón (solo 390).

**Resultado:** en los cuatro anchos ninguna pantalla desborda (ni la ventana ni \`main\`), no hay imágenes rotas, ningún input baja de 16 px, no hay errores de consola, el link viejo redirige y la franja de "ver el panel como" aparece. Los contadores (\`qa-1280.log\` 232 OK · 29 fallas, \`qa-768.log\` 226 · 28, \`qa-390.log\` 217 · 44, \`qa-oscuro.log\` 239 · 22) incluyen solo fallas del kit o del armazón, anotadas en \`pedidos-kit-turnos.md\` y no parchadas en el módulo:
- contraste: \`rv-btn--primario\` a 14 px (3,68:1, la decisión abierta "Azul primario"), la \`Sigla\` con las iniciales blancas sobre el color de cada persona (2,15–4,23:1) y, en el menú de cuentas, \`.rvp-avatar\` y \`.rvp-flota-grupo\`;
- toques a 390: las llaves \`rv-switch\` de 42×24 (el kit les suma 54×44 de área con un \`::before\` que el medidor no ve), "Cerrar notificaciones" (32 px) y la X del \`Toast\` del design system (24 px) que monta \`useAviso\`.

El kit tomó el avatar y los rótulos del menú de cuentas y el cierre de notificaciones de 44 px el mismo 27/10 (commit da07e; ver "El kit toma lo que pidieron los módulos"). Lo que se arregló en el módulo a partir de la medida: la tira de agendas de 44 px con la activa tintada, los siete días de Horarios a 390 (\`.tu-dias\`), el "Volver" de 44 px (\`.tu-volver\`), las opciones cortas del segmentado con 44 px de ancho y el botón "Conectar" a la altura del campo, y el link "Sugerido" de Paquetes. Los últimos arreglos de Agenda y de Pagos están en las corridas filtradas \`qa-{390,768,oscuro}-agenda.log\` y \`qa-390-pagos.log\`, con sus capturas regrabadas.

**Diferencias con el plan:** las tareas del 7, 8 y 9/12 piden "lista de fallas registrada en Auditoría" por ancho: está acá, en una sola entrada. La del 10/12 (correcciones) se cumple: lo que queda es del kit (tomado en parte) o una decisión abierta. La del 11/12 (una captura por pantalla en los tres anchos, enlazadas) no se vinculó: las 155 capturas están en el scratchpad, no en la web.

${comoQuedo('turnos', ['Horarios con los siete días · 390', 'qa-horarios-390.webp'], ['Agenda, vista semana · 390', 'qa-agenda-semana-390.webp'])}`,
    archivos: [
      'apps/web/src/modules/turnos/admin/Agenda.tsx:37',
      'apps/web/src/modules/turnos/admin/Agenda.tsx:260',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:36',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:79-80',
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:50',
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:90-93',
      'apps/web/src/modules/turnos/admin/avanzado/Paquetes.tsx:91',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:123',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:175',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'avanzado-un-acento-y-celular-plano', tipo: 'decisión', quien: 'Mateo',
    titulo: 'Turnos: Avanzado sin tonos por grupo, celular plano, Guardar con el toast y la escala del mapa al 55 %',
    foco: '"Llenar la agenda" y "Cobrar mejor" se distinguen por el bloque y su título, no por un color propio; el celular de la vista previa es una tarjeta plana con el tema del sitio adentro; "Guardar cambios" avisa con el toast del panel; la escala del mapa de ocupación se corta en el 55 % del acento. Lo decidió Mateo sin preguntar.',
    que: `1. **Avanzado sin tonos por grupo:** "Llenar la agenda" y "Cobrar mejor" se distinguen por el bloque y su título, no por un color (verde) propio.
2. **El celular de la vista previa es plano:** tarjeta con borde y radio, sin inclinación 3D, sin sombras ni órbita; adentro sigue el tema del sitio (es lo que ve el cliente).
3. **"Guardar cambios" en Avanzado** avisa con el toast del panel ("Es una demo: quedan solo en esta pantalla") en vez de un estado "Guardado" propio.
4. **La escala del mapa de ocupación** de Precios por horario se corta en el 55 % del acento.`,
    decision: 'Avanzado usa un solo acento (sin tono por grupo), el celular de la vista previa es plano, se guarda con el toast de todo el panel y el mapa de ocupación nunca pasa del 55 % del acento.',
    porque: 'El brief del rediseño pide un acento y nada decorativo: el verde de un grupo, el celular 3D con órbita y el "Guardado" propio eran tres formas de salirse del sistema. Una sola forma de confirmar en todo el panel es lo que hace Tienda. Y con la escala cortada en el 55 % el número de la celda más llena sigue en tinta de texto y legible; al 100 % del acento había que pasarlo a blanco y no llegaba a AA.',
    archivos: [
      'apps/web/src/modules/turnos/admin/avanzado/datosAvanzado.ts:20',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:68-73',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:80-81',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:165',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:525',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'pagos-recordatorios-e-historial', tipo: 'decisión', quien: 'Mateo',
    titulo: 'Turnos: Pagos arranca por las señas por cobrar, Recordatorios no manda nada y el historial es el de la agenda',
    foco: 'Pagos abre con lo operativo (señas por cobrar, dos semanas) y después la configuración, y su badge cuenta señas; el bloque "Hoy" de Recordatorios lleva al turno en vez de mandar mensajes; el historial de la ficha sale de la agenda (dos meses) y no de una lista inventada.',
    que: `1. **Pagos arranca por lo operativo** (las señas por cobrar) y después la configuración; el badge del menú cuenta señas, no pagos.
2. **Señas por cobrar mira dos semanas:** lo que vence antes es lo que importa cobrar; el detalle del turno sigue mostrando la seña de cualquier fecha.
3. **El bloque "Hoy" de Recordatorios no manda nada:** lleva al turno, donde ya está "Mandar recordatorio".
4. **El historial de la ficha es el de la agenda** (dos meses): no hay más lista inventada; en un negocio recién creado la ficha dice que el historial arranca con el primer turno.`,
    decision: 'En Pagos primero lo que hay que cobrar y después cómo se cobra; el badge cuenta señas pendientes de dos semanas; una sola forma de escribirle a alguien (desde el turno); y la ficha muestra turnos reales de la agenda.',
    porque: 'Ale pidió "mejorar 1000 veces más": una pantalla de Pagos que solo configura no le sirve al dueño a las 10 de la mañana; lo que le sirve es saber a quién cobrarle hoy. Dos semanas es el horizonte en el que una seña todavía se puede reclamar antes del turno. Dos botones para mandar el mismo mensaje son dos lugares donde se desalinean. Y una lista fija de cuatro fechas iguales para todos los clientes era un dato falso en la demo: con la agenda real, la ficha dice la verdad aunque sea "todavía no vino".',
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/Pagos.tsx:61',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:179',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:202',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:116',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:127',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:308',
      'apps/web/src/modules/turnos/admin/Clientes.tsx:86-87',
    ],
  }),

  entrada({
    modulo: 'turnos', fecha: F27, slug: 'chat-neutro-tinta-del-acento-y-editor-ancho', tipo: 'decisión', quien: 'Mateo',
    titulo: 'Turnos: chat neutro como Alquileres, texto en el acento con chip-primary-fg y Apariencia con ancho de editor',
    foco: 'La vista previa del chat usa los colores del panel y no los de WhatsApp (misma decisión que Alquileres); todo texto en el acento va en --chip-primary-fg y el acento puro queda para fondos, bordes y botones primarios; Apariencia conserva los 1760 px del editor de Tienda y el resto de Configuración queda en 880.',
    que: `1. **La vista previa del chat es neutra:** la forma de un WhatsApp (burbuja, hora, tildes) con \`--color-surface\`, \`--color-primary-bg\` y \`--chip-primary-fg\`; los verdes se fueron. Igual que Alquileres; Gimnasio eligió el verde (decisión abierta "Pedidos del kit que quedaron sin tomar").
2. **Texto en el acento = \`--chip-primary-fg\`** en todo el módulo (links, "Configurar", chips de estado de la agenda): el acento puro (\`--color-primary\`, 3,68:1 sobre blanco) queda para fondos, bordes y botones primarios.
3. **Apariencia conserva el ancho de editor (1760 px):** es la única pantalla de Configuración con editor y vista previa lado a lado; el resto queda en 880.`,
    decision: 'Chat neutro con un solo acento, tinta oscura del acento para todo texto chico en el acento, y el ancho de editor solo donde hay editor.',
    porque: 'El brief pide un acento y sin adornos: el verde de WhatsApp en medio del panel era un segundo acento, y ya lo había resuelto así Alquileres. El acento puro no llega a AA como texto a 13 o 14 px (3,68:1) y `--chip-primary-fg` sí (es el mismo criterio que el kit adoptó para el armazón el 27/10). Y 1760 px en una pantalla de solo formulario deja líneas de 150 caracteres: el ancho de editor se justifica solo con la vista previa al lado, como en Tienda.',
    archivos: [
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:53',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:501',
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:63',
      'apps/web/src/modules/turnos/admin/Agenda.tsx:46-47',
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:188-189',
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:579',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:58',
    ],
  }),

  // ─── 03/11/2026 · el backend compartido de reservas ─────────────────────────
  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'un-motor-para-los-tres', tipo: 'decisión', quien: 'Ale', transversal: true,
    titulo: 'Transversal: un solo backend de reservas para Turnos, Alquileres y Gimnasio',
    foco: 'Se deja de pensar un backend por módulo (el de Turnos, appointments, se había borrado el 26/10): los tres comparten un motor de reservas en apps/api/src/reservas, y cada módulo sigue siendo dueño de su panel y su sitio.',
    que: `Hasta el 26/10 la idea era que cada módulo tuviera su backend cuando lo necesitara, y Turnos había tenido uno propio (\`appointments\`, cinco ramas que se borraron sin llegar a \`main\`). El 03/11 Ale pidió otra cosa: *"eliminar lo del backend de turnos, dejar uno profesional de lo que es los 3 y que compartan, cubriendo toda la integridad de turnos: si dos tocan el botón al mismo tiempo, si se cancela, si no completa"*.

Lo que cambia:
- **Un módulo de la API, \`reservas\`,** con un modelo único: qué se reserva (un recurso con cupo), cuándo (un rango), en qué estado está y las reglas del negocio. Turnos reserva profesionales y cabinas con servicios; Alquileres canchas, salones y alojamientos; Gimnasio clases con cupo. El tipo del recurso dice de qué módulo es.
- **Cada módulo sigue siendo independiente en la web:** ningún módulo importa de otro; los tres usan el mismo cliente tipado (\`apps/web/src/lib/reservasApi\`) con su \`modulo\`. El sitio y el panel de cada uno los sigue haciendo su responsable.
- **Lo que no se comparte** sigue en cada módulo: planes, pases y socios de Gimnasio, paquetes y temporadas de Alquileres, membresías y fidelidad de Turnos.

Lo que no cambia: la sección Módulos del superadmin sigue siendo solo visual, y los módulos siguen siendo demos hasta que cada uno se conecte (tareas nuevas en el plan de cada módulo).`,
    decision: 'Un solo backend de reservas para los tres módulos, en apps/api/src/reservas, con un contrato escrito (su README) y un cliente tipado en la web. Ningún módulo tiene backend propio.',
    porque: 'Las cuentas que no pueden dar tres resultados distintos (si dos personas toman el mismo lugar, qué pasa al cancelar, cuánto dura un lugar retenido) tienen que vivir en un solo lugar y probarse una sola vez contra Postgres. Con tres backends cada módulo iba a resolver la concurrencia a su manera y el primero en fallar iba a ser el que menos tests tuviera. Y el equipo es de tres personas: un motor compartido es lo único que se puede mantener.',
    archivos: [
      'apps/api/src/reservas/README.md:1',
      'apps/api/prisma/schema.prisma:3770',
      'apps/web/src/lib/reservasApi/cliente.ts:69',
      'apps/web/src/lib/reservas/README.md:53',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'backend-compartido-de-reservas', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el backend compartido de reservas, con su integridad probada contra Postgres',
    foco: 'Módulo apps/api/src/reservas: modelo, migración, motor con candado por recurso, retenciones que vencen solas, cancelación con lista de espera, reprogramación, rutas del panel y del sitio, cliente tipado en la web y tests (26 de dominio, 25 unitarios, 15 e2e).',
    que: `## El modelo

Siete tablas \`reservas_*\` (bloque "Reservas" de \`schema.prisma\`, migración \`20261103120000_reservas\`):
- \`reservas_config\`: las reglas de un negocio para un módulo (existe = usa ese módulo): confirmación automática o manual, minutos de retención, anticipación mínima y máxima, hasta cuántas horas antes se cancela o reprograma, seña, tope de reservas activas por persona, lista de espera, margen y el horario semanal por defecto.
- \`reservas_recursos\`: lo que se reserva, con \`tipo\` (PROFESIONAL y ESPACIO de Turnos; CANCHA, SALON y ALOJAMIENTO de Alquileres; CLASE de Gimnasio), \`cupo\` (1 = exclusivo), duración y paso de la franja, franjas seguidas, precio, horario propio y \`datos\` por módulo (check-in/check-out, extras, profesor…).
- \`reservas_servicios\`: lo que se elige antes en Turnos, con duración y precio.
- \`reservas\`: un recurso, un rango \`[inicio, fin)\`, lugares, estado, la foto del cliente y del servicio, precio, seña, pagado, el código visible, el token del enlace personal, la clave de idempotencia y la \`version\`.
- \`reservas_historial\` (cada cambio de estado, solo se agrega), \`reservas_espera\` (lista de espera por sesión) y \`reservas_bloqueos\` (feriados, mantenimiento).

Estados: RETENIDA → CONFIRMADA (o PENDIENTE si el negocio confirma a mano) → COMPLETADA o AUSENTE; cualquiera de los que ocupan lugar → CANCELADA; una retenida que nadie confirma → VENCIDA. La tabla de transiciones vive en \`dominio/estados.ts\`.

## La integridad, caso por caso

| Si… | Lo cubre |
|---|---|
| Dos tocan el botón a la vez | Crear y reprogramar toman primero el candado de la fila del recurso (\`SELECT … FOR UPDATE\`) y cuentan adentro de la transacción: el segundo recibe 409 "Ese horario se acaba de ocupar". Debajo, la base tiene la restricción de exclusión \`reservas_sin_solapamiento\` (btree_gist sobre \`recurso_id\` y \`[inicio, fin)\`) para los recursos exclusivos: aunque algún camino se saltee el service, el INSERT falla. |
| Doble clic o reintento | La clave de idempotencia (un uuid por intento): repetir devuelve la misma reserva. |
| No completa | Nace RETENIDA con \`retenidaHasta\`; vencida, deja de ocupar lugar en el acto (la disponibilidad la filtra y el motor la vence por recurso antes de contar). El cron de cada 5 minutos la marca VENCIDA. |
| Se cancela | Compare-and-set sobre el estado y la \`version\`: la segunda de dos acciones simultáneas recibe 409 con el estado real. Desde el sitio vale la política; el negocio cancela siempre. La seña queda DEVUELTA, PERDIDA o SIN_SENA. Con lista de espera, el primero toma el lugar en la misma transacción. |
| Fuera de horario, en un bloqueo, demasiado pronto o lejos, sesión inexistente | 400 con el motivo en castellano. |
| Precio y seña | Siempre en el servidor; lo que mande el cliente se ignora. |
| Otro negocio | Todo filtra por el \`businessId\` del token (lo vigila \`aislamiento-consultas.unit-spec.ts\`); el sitio solo encuentra una reserva por el token de su enlace. |

## Rutas

Sitio (\`/api/v1/storefront/:slug/reservas\`, sin login): \`config\`, \`recursos\`, \`servicios\`, \`disponibilidad\` (día, rango y noches), \`retener\` → \`mi/:token/confirmar\` (o \`reservar\` en un paso), \`mi/:token\` con su política, \`cancelar\`, \`reprogramar\`, y la lista de espera (\`espera\`). Panel (\`/api/v1/reservas\`): config, recursos, servicios, bloqueos, disponibilidad, agenda, detalle con historial, resumen, crear, confirmar, completar, ausente, cancelar, reprogramar, pago, nota, lista de espera. Tres permisos nuevos: \`reservas.view\`, \`reservas.manage\` (owner, admin y empleado) y \`reservas.config\` (owner y admin), repartidos a los negocios existentes por la migración.

## Tests

- \`src/reservas/dominio/*.spec.ts\` (26): tiempo de Argentina, horario semanal, máquina de estados, precio y franjas.
- \`test/unit/reservas.service.unit-spec.ts\` (25): lo que el motor decide antes del candado y cómo reacciona cuando el compare-and-set no encuentra la fila.
- \`test/reservas.e2e-spec.ts\` (15, contra la base de dev): seis pedidos simultáneos entran uno; una clase de cupo 3 con ocho personas a la vez entra tres; la retenida vencida libera; al cancelar el primero de la lista de espera toma el lugar; la restricción de la base rechaza dos reservas pisadas aunque se saltee el service; política de cancelación; permisos del empleado.

## Lo que queda

El cobro online de la seña (Mercado Pago), la devolución automática, WhatsApp, los recordatorios del día anterior y la campanita del panel no están: solo email. Y conectar cada módulo es tarea de su responsable (ver el plan): hoy los tres siguen siendo demos con datos en el navegador. El cliente tipado para hacerlo está en \`apps/web/src/lib/reservasApi\` (\`panel\` y \`sitio(slug)\`).`,
    archivos: [
      'apps/api/src/reservas/README.md:62',
      'apps/api/prisma/schema.prisma:3852',
      'apps/api/prisma/schema.prisma:3963',
      'apps/api/prisma/migrations/20261103120000_reservas/migration.sql:286-302',
      'apps/api/prisma/migrations/20261103120000_reservas/migration.sql:320',
      'apps/api/src/reservas/reservas.service.ts:178',
      'apps/api/src/reservas/reservas.service.ts:258',
      'apps/api/src/reservas/reservas.service.ts:298',
      'apps/api/src/reservas/reservas.service.ts:352',
      'apps/api/src/reservas/reservas.service.ts:437',
      'apps/api/src/reservas/reservas.service.ts:631-650',
      'apps/api/src/reservas/reservas.service.ts:671',
      'apps/api/src/reservas/disponibilidad.service.ts:99',
      'apps/api/src/reservas/disponibilidad.service.ts:122',
      'apps/api/src/reservas/reservas-catalogo.service.ts:67',
      'apps/api/src/reservas/reservas-catalogo.service.ts:259',
      'apps/api/src/reservas/reservas-panel.controller.ts:22',
      'apps/api/src/reservas/reservas-publico.controller.ts:29',
      'apps/api/src/reservas/reservas-avisos.service.ts:18',
      'apps/api/src/reservas/reservas-mantenimiento.service.ts:20',
      'apps/api/src/internal-cron/internal-cron.controller.ts:219',
      'apps/api/src/reservas/dominio/estados.ts:13',
      'apps/api/src/reservas/dominio/disponibilidad.ts:41',
      'apps/api/src/common/permisos/catalogo.ts:44',
      'apps/api/src/onboarding/onboarding.service.ts:135',
      'apps/api/test/reservas.e2e-spec.ts:109',
      'apps/api/test/reservas.e2e-spec.ts:232',
      'apps/api/test/unit/reservas.service.unit-spec.ts:193',
      'apps/web/src/lib/reservasApi/cliente.ts:69',
      'apps/web/src/lib/reservasApi/cliente.ts:112',
      'apps/web/src/lib/reservasApi/tipos.ts:94',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'merge-con-main', tipo: 'tarea', quien: 'Ale', transversal: true,
    titulo: 'Transversal: la rama de los módulos al día con main (139 commits) y el typecheck de la web en Windows',
    foco: 'feat/turnos-visual estaba 139 commits atrás de origin/main (staging, Marketing, WhatsApp con Orbi, Difusión); se mergeó con dos conflictos en el superadmin y se arregló un nombre de archivo que rompía el typecheck en Windows y macOS.',
    que: `- **Merge de \`origin/main\`** (commit 56c40): solo dos archivos en conflicto, los dos del superadmin, porque \`main\` sumó Marketing e Instagram al menú y la rama había sumado Módulos: quedaron las tres secciones. \`pages/superadmin/index.tsx\` conserva el título de la pestaña de la rama y el retorno a "Conectar Claude" de \`main\`.
- **\`pnpm typecheck\` de la web fallaba en Windows** (y falla en macOS): \`modules/orbi/markdown/\` tenía \`Markdown.tsx\` y \`markdown.ts\`, que solo difieren en mayúsculas; en un disco que no distingue mayúsculas TypeScript resolvía uno por el otro. El parser pasó a llamarse \`parser.ts\` (commit 4877d). CI corre en Linux y nunca lo vio.
- **Tests unitarios de la API en esta máquina:** siete suites de WhatsApp, Instagram y el adaptador de Workers AI fallan con \`jest.spyOn(global, 'fetch')\` en Node 26 ("Property fetch does not exist"); pasan en CI (Node 22). No se tocaron: son de \`main\`, no de la rama.
- Las dependencias se reinstalaron en \`apps/api\` y \`apps/web\` (los lockfiles cambiaron con \`main\`).`,
    archivos: [
      'apps/web/src/pages/superadmin/index.tsx:15',
      'apps/web/src/modules/superadmin/SuperAdminDashboard.tsx:138',
      'apps/web/src/modules/orbi/markdown/parser.ts:62',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'kit-kpi-guardar-modal', tipo: 'diseño', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el kit toma el Kpi con variación, la barra de guardar con borrador y la cabecera del Modal; toques de 44 px en Alquileres',
    foco: 'Puntos 1, 2 y 6 de "pedidos del kit sin tomar": un solo Kpi (con ícono, tono y variación), un solo useBorrador + BarraGuardar y un solo Modal para los tres módulos; se borraron las copias de Alquileres, Gimnasio y Turnos (48 archivos, −581 líneas). Las flechas de la semana y los horarios de Nueva reserva de Alquileres miden 44 px a 390.',
    que: `Lo que los tres módulos tenían repetido pasó al kit (\`design-system/reservas/piezas.tsx\` y \`estilo.tsx\`) y las copias se borraron:

1. **\`Kpi\`** con la anatomía de la KpiCard de Tienda: rótulo en mayúsculas, ícono en un chip con \`tono\`, valor en mono y al pie la variación (\`delta: { valor, unidades?, sufijo?, invertir?, vs? }\`). \`valor: null\` dice "sin datos previos" en vez de inventar un número; más de 999 % se escribe ">999%"; el chip neutro va en tinta de cuerpo (AA sobre surface-alt) y la flecha es \`aria-hidden\` con su texto para lectores. Reemplaza a \`Kpi\` de Alquileres, \`KpiGym\` de Gimnasio e \`Indicador\` de Turnos (en Turnos, nueve indicadores de Ganancias y los del Resumen).
2. **\`useBorrador\` + \`BarraGuardar\`** (la versión de Gimnasio): el borrador sigue lo que llega del negocio, o queda en memoria si la pantalla no persiste nada; la barra aparece solo con cambios, pegada abajo, y con \`motivo\` ("Marcá al menos un día.") apaga Guardar y explica por qué. Alquileres (12 pantallas de Configuración) y Turnos (7) migraron; Turnos dejó su barra compacta propia.
3. **La cabecera del \`Modal\`** ya no estira el primer hijo: estira solo \`.rv-modal-cab-txt\`, así un ícono o un avatar delante del título queda redondo. Turnos borró su Modal propio (con el \`span\` envoltorio que esquivaba el problema) y sus diez pantallas usan el del kit, que sumó \`onEnviar\` (Enter envía), \`encima\` (un modal sobre otro), \`foco\` y el cierre con mousedown en el velo; Escape y Tab los atiende solo el modal de más arriba.
4. **Alquileres a 390 px:** las flechas de la semana en Reservas pasan de 32 a 44 px (\`.alg-tira > .rv-btn { flex-shrink: 0 }\`) y el radio de cada horario de Nueva reserva cubre los 44 px de la franja (\`.rv-card--radio\` con \`inset: -1px\`; vale también para el sitio).

Cómo quedó, además de las capturas de abajo: la cabecera del Modal con el avatar del cliente en Turnos y las flechas de Alquileres a 390.

![Modal con avatar · 1280](/auditoria/modulos/gimnasio/kit-modal-despues-1280.webp)
![Flechas de la semana · 390](/auditoria/modulos/gimnasio/kit-flechas-despues-390.webp)

Verificado con capturas antes/después de 16 pantallas a 1280 y 390 (y el oscuro de los chips) y un recorrido por teclado: dos modales apilados se cierran de a uno con Escape, Tab queda adentro, el foco vuelve a la fila, Enter envía, Horarios de Alquileres sin días deja Guardar apagado. Sin imports entre módulos (eslint), typecheck y vitest en verde. Lo que cambia a la vista: Alquileres ya no dice "Todo guardado." sin cambios y su variación se escribe "62,1%" (es-AR), como los otros dos; los KPIs de Turnos entran con la animación del kit; los tres números de la ficha del alumno de Gimnasio son Kpi del kit.

Quedan abiertos del mismo pedido los puntos 3, 4, 5, 7 y 8 (globals.css de Tienda, la vista previa del chat y el celular de vista previa): siguen en la decisión.`,
    antes: { 1280: 'kit-ingresos-antes-1280.webp', 390: 'kit-ingresos-antes-390.webp' },
    despues: { 1280: 'kit-ingresos-despues-1280.webp', 390: 'kit-ingresos-despues-390.webp' },
    archivos: [
      'apps/web/src/design-system/reservas/piezas.tsx:185',
      'apps/web/src/design-system/reservas/piezas.tsx:264',
      'apps/web/src/design-system/reservas/piezas.tsx:283',
      'apps/web/src/design-system/reservas/piezas.tsx:313',
      'apps/web/src/design-system/reservas/estilo.tsx:68',
      'apps/web/src/design-system/reservas/estilo.tsx:193',
      'apps/web/src/design-system/reservas/estilo.tsx:278',
      'apps/web/src/design-system/reservas/estilo.tsx:316',
      'apps/web/src/modules/alquileres/admin/piezas.tsx:1',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:42',
      'apps/web/src/modules/gimnasio/admin/piezas.tsx:1',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:1',
      'apps/web/src/modules/turnos/admin/piezasPanel.tsx:1',
      'apps/web/src/modules/turnos/admin/configuracion/ui.tsx:1',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:1',
      'apps/web/src/modules/turnos/admin/Ganancias.tsx:1',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'fondo-claro-planeta', tipo: 'diseño', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el fondo claro de los paneles es el planeta de la landing, fijo abajo, con cielo claro y meteoritos',
    foco: 'La opción que eligió Ale el 27/10 ("Planeta como la landing"): en claro, el planeta de orbita.site en versión clara queda fijo abajo de la pantalla con su línea de luz, los anillos y el satélite del logo; arriba un cielo celeste muy suave con estrellas blancas y cometas azules; el contenido pasa por encima. Sin la banda debajo del encabezado. Oscuro, igual que antes.',
    que: `Lo que Ale eligió entre las opciones del 27/10 (la banda del horizonte "me gusta, pero la idea es que no quede blanco lo demás"), hecho con la misma escena de la landing (\`design-system/EscenaEspacial\`):

1. **La escena en una capa del panel.** \`EscenaEspacial\` suma tres props que la landing, el alta y el login no usan (sus defaults reproducen exactamente lo de antes): \`paleta\` (una paleta nueva \`panelClaro\`: solo azules de marca, estrellas blancas, el planeta del color de la superficie, línea y anillos más tenues), \`contenedor\` (la escena mide su propio contenedor con un ResizeObserver en vez de la ventana, porque en los paneles scrollea \`<main>\`) y \`satelite\` (una capa SVG propia donde el satélite del logo recorre el anillo interior con \`animateMotion\` y se funde en las puntas; con \`prefers-reduced-motion\` no se dibuja). Los cometas pasan a "marcados": cola con brillo ancho más una línea fina, cabeza con halo.
2. **El armazón.** \`LayoutPanel\` deja de usar \`HorizonteOrbita\` y toda la medición del encabezado (\`.rvp-con-banda\`, tope/evitar/piso, los observers). El cielo vive en una zona nueva (\`.rvp-zona\`, la caja de \`<main>\`, debajo del header) con la escena en los dos temas: oscuro como estaba (estrellas y cometas de Tienda); claro con el planeta sobre un gradiente celeste que termina en la superficie. El planeta queda quieto porque la ventana no scrollea: el ápice del horizonte va al 72 % de la caja (86 % en celular), como en la landing.
3. **Tintas sobre el fondo.** En claro, adentro de \`.rvp-main\`: \`--color-muted\` a #5B6B80, \`--rv-tinta-fondo\` igual al texto y un token nuevo \`--rv-tinta-link\` para links y botones fantasma sueltos. Cinco textos sueltos de los módulos que no llegaban a AA sobre la línea del horizonte pasaron a esas tintas (Espacios, Apariencia y el "Ver agenda" del Resumen de Turnos; "Ves N de M" de Alumnos de Gimnasio).
4. **Lo que se verificó.** Capturas de los tres paneles a 1280 y 390, claro y oscuro, con y sin scroll; un script de contraste píxel a píxel (modo claro, tres posiciones de scroll, más el peor caso teórico contra el píxel más oscuro del cielo) sobre 60 pantallas × 2 anchos: 0 textos por debajo de AA; el peor par es el gris del cuerpo sobre la línea del horizonte, 5,0:1. Con \`prefers-reduced-motion\`: sin cometas ni satélite. Consola sin errores. \`HorizonteOrbita.tsx\` sigue en el repo para el comparador \`/fondos-demo\`.

Cómo quedó al scrollear y en Gimnasio a 390:

![Con scroll · 1280](/auditoria/modulos/gimnasio/fondo-scroll-despues-1280.webp)
![Gimnasio · 390](/auditoria/modulos/gimnasio/fondo-gimnasio-despues-390.webp)

Lo que queda para que decida Ale está en la decisión "Fondo claro: ajustes": cometas que cruzan detrás del texto, la altura del horizonte, qué tan presentes van las estrellas, las bandas del resplandor y la franja de 40 px de la demo de Turnos.`,
    antes: { 1280: 'fondo-antes-1280.webp', 390: 'fondo-antes-390.webp' },
    despues: { 1280: 'fondo-despues-1280.webp', 390: 'fondo-despues-390.webp' },
    archivos: [
      'apps/web/src/design-system/EscenaEspacial.tsx:84',
      'apps/web/src/design-system/EscenaEspacial.tsx:234',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:63',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:72-75',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:529',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:189',
      'apps/web/src/modules/turnos/admin/Espacios.tsx:37',
      'apps/web/src/modules/turnos/admin/configuracion/Apariencia.tsx:532',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:49',
      'apps/web/src/pages/fondos-demo.tsx:15',
    ],
  }),

  entrada({
    modulo: 'gimnasio', fecha: F3, slug: 'fundido-de-tema', tipo: 'diseño', quien: 'Ale', transversal: true,
    titulo: 'Transversal: el cambio de tema se funde en vez de cortar: la noche baja desde arriba y el día sube desde el horizonte',
    foco: 'Pedido de Ale del 03/11 ("sumaría una transición de lo que es modo claro a oscuro para hacerlo más limpio y bonito"). Al tocar la luna o el sol, el navegador fotografía la pantalla y la nueva se revela encima con una máscara degradada tan alta como la pantalla: cuando anochece, la noche baja desde el encabezado; cuando amanece, la luz sube desde el horizonte, donde está el planeta. 640 ms, sin borde visible; el botón responde en el acto.',
    que: `Antes, al tocar la luna el cuadro siguiente ya era el oscuro: un corte. Ahora es un fundido con dirección. Las capturas de "después" son el mismo instante, 320 ms después del toque, con la noche a mitad de camino.

1. **Cómo se hace.** \`conFundidoDeTema\` (\`hooks/useDarkMode\`) envuelve el cambio en una View Transition: el navegador fotografía la pantalla como está, React aplica el tema nuevo adentro de \`flushSync\` y la foto vieja queda quieta abajo mientras la pantalla nueva se revela encima. Mientras dura, \`<html>\` lleva \`data-tema-fundido="anochece"\` o \`"amanece"\` y las reglas viven en \`globals.css\` ("Cambio de tema con fundido"). Donde no existe la API (Safari anterior al 18, Firefox anterior al 144) el cambio es instantáneo, como antes. El armazón de los tres paneles la usa desde el botón del tema; el panel de Tienda sigue con el corte (es una decisión, ver abajo).
2. **La máscara.** Un degradado de tres pantallas de alto (un tercio opaco, uno degradado, uno transparente) que se desplaza con \`mask-position\`: nunca hay un borde, se ve como una penumbra que baja o una claridad que sube. 640 ms con la curva estándar del panel (cubic-bezier 0.4, 0, 0.2, 1), arrancando y terminando suave. Con \`prefers-reduced-motion\`, un fundido parejo de 220 ms sin dirección.
3. **El botón.** Va en su propia capa de la transición (\`view-transition-name: rvp-tema\`): el sol y la luna se cruzan ahí mismo en 250 ms y el ícono nuevo entra girando, así el toque responde en el acto aunque el resto tarde más.
4. **Lo que se verificó.** Cuadros congelados de la transición a 0, 160, 320, 480 y 640 ms (pausando las animaciones de los pseudo-elementos \`::view-transition\` y fijando su tiempo) a 1280 y 390, en los dos sentidos; el atributo se limpia al terminar; consola sin errores nuevos (el 401 de la demo ya estaba). Cinco tests del helper: sin API cambia al instante; con API marca la dirección, cambia adentro y limpia; dos toques seguidos no se pisan; una transición salteada también limpia. Gotcha: el compilador de CSS colapsa un \`animation\` sin nombre a \`animation: none\` y pierde la duración, por eso van los longhands.

Cuatro tiempos del anochecer, el amanecer a la mitad y el celular:

![Anochece · cuatro tiempos · 1280](/auditoria/modulos/gimnasio/tema-cuadros-despues-1280.webp)
![Amanece a los 320 ms · 1280](/auditoria/modulos/gimnasio/tema-amanece-despues-1280.webp)
![Anochece · cuatro tiempos · 390](/auditoria/modulos/gimnasio/tema-cuadros-despues-390.webp)

Lo que queda a gusto de Ale (punto 6 de la decisión "Fondo claro: ajustes"): la dirección y la duración, y si el panel de Tienda también lo toma.`,
    antes: { 1280: 'tema-antes-1280.webp', 390: 'tema-antes-390.webp' },
    despues: { 1280: 'tema-despues-1280.webp', 390: 'tema-despues-390.webp' },
    archivos: [
      'apps/web/src/hooks/useDarkMode.ts:71',
      'apps/web/src/styles/globals.css:287',
      'apps/web/src/styles/globals.css:320',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:146',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:510',
      'apps/web/src/hooks/__tests__/useDarkMode.test.ts:1',
    ],
  }),
]

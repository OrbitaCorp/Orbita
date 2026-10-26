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
// Todas del 26/10/2026, la sesión que armó los módulos nuevos. La primera es
// la de la sección Módulos (los tests del front la usan de ejemplo).

const F = '2026-10-26'

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
      'apps/web/src/modules/superadmin/Modulos.tsx:357',
      'apps/web/src/modules/superadmin/Modulos.tsx:199',
      'apps/web/src/modules/superadmin/Modulos.tsx:1098',
      'apps/web/src/modules/superadmin/Modulos.tsx:438',
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
      'apps/web/src/modules/turnos/datos/negocio.ts:165',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:9-12',
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
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:27-29',
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
      'apps/web/src/modules/turnos/_shared/orbita/estilo.tsx:24-26',
      'apps/web/src/modules/turnos/_shared/orbita/piezas.tsx:27-29',
      'apps/web/src/modules/turnos/_shared/orbita/piezas.tsx:51',
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
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:4-7',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:183-192',
      'apps/web/src/modules/turnos/admin/configuracion/datos.ts:28-49',
      'apps/web/src/modules/turnos/admin/configuracion/ConfiguracionTurnos.tsx:7-9',
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
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:199-201',
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
      'apps/web/src/modules/turnos/admin/avanzado/AvanzadoTurnos.tsx:27-29',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:190',
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
      'apps/web/src/modules/gimnasio/datos/index.ts:11-13',
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
      'apps/web/src/modules/turnos/admin/Ganancias.tsx:26-30',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:63-79',
      'apps/web/src/modules/turnos/admin/KPIs.tsx:84-88',
      'apps/web/src/modules/turnos/layout/LayoutTurnos.tsx:77-81',
      'apps/web/src/modules/turnos/storefront/MisTurnos.tsx:411',
      'apps/web/src/modules/turnos/storefront/reserva/acciones.ts:11-24',
      'apps/web/src/modules/turnos/admin/PanelTurnos.tsx:199-201',
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
      'apps/web/src/modules/alquileres/datos/index.ts:257-278',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:1-4',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:92-96',
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
      'apps/web/src/modules/alquileres/datos/index.ts:282-304',
      'apps/web/src/modules/alquileres/datos/index.ts:368-369',
      'apps/web/src/lib/reservas/disponibilidad.ts:84',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:424-428',
      'apps/web/src/modules/alquileres/admin/Eventos.tsx:1-4',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:323-324',
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
      'apps/web/src/modules/alquileres/datos/index.ts:308-341',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:306-308',
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
      'apps/web/src/modules/alquileres/admin/Panel.tsx:35-42',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:1-7',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:424-428',
      'apps/web/src/modules/alquileres/admin/Ingresos.tsx:1-4',
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:1-5',
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
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:431-436',
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:454-462',
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:464-472',
      'apps/web/src/lib/reservas/ics.ts:1-7',
      'apps/web/src/lib/reservas/ics.ts:70',
      'apps/web/src/lib/reservas/ics.ts:125',
      'apps/web/src/design-system/reservas/piezas.tsx:279',
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
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:431-436',
      'apps/web/src/modules/alquileres/admin/Configuracion.tsx:477',
      'apps/web/src/modules/gimnasio/admin/Configuracion.tsx:235-239',
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
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:424-428',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:442-444',
      'apps/web/src/modules/alquileres/datos/index.ts:110-111',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:8-9',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:91',
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
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:639-644',
      'apps/web/src/modules/alquileres/admin/Reservas.tsx:683',
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
      'apps/web/src/modules/alquileres/admin/Panel.tsx:28-32',
      'apps/web/src/modules/alquileres/admin/Clientes.tsx:34',
      'apps/web/src/modules/alquileres/storefront/Reserva.tsx:111',
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
      'apps/web/src/modules/gimnasio/datos/index.ts:108-109',
      'apps/web/src/modules/gimnasio/datos/index.ts:472',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:6-12',
      'apps/web/src/modules/gimnasio/datos/negocio.ts:172-174',
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
      'apps/web/src/modules/gimnasio/datos/index.ts:62-69',
      'apps/web/src/modules/gimnasio/datos/index.ts:111-125',
      'apps/web/src/modules/gimnasio/datos/index.ts:504',
      'apps/web/src/modules/gimnasio/datos/index.ts:511-528',
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
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:63-64',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:143-159',
      'apps/web/src/modules/gimnasio/datos/index.ts:481',
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
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:145-146',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:180',
      'apps/web/src/modules/gimnasio/storefront/MisClases.tsx:1-5',
      'apps/web/src/modules/gimnasio/storefront/MisClases.tsx:48',
      'apps/web/src/modules/gimnasio/storefront/Sitio.tsx:1-4',
      'apps/web/src/modules/gimnasio/storefront/Home.tsx:146',
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
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:13',
      'apps/web/src/modules/gimnasio/admin/Configuracion.tsx:1-3',
      'apps/web/src/modules/gimnasio/admin/Configuracion.tsx:153',
      'apps/web/src/modules/gimnasio/admin/Configuracion.tsx:235-239',
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
      'apps/web/src/modules/gimnasio/datos/index.ts:11-13',
      'apps/web/src/modules/gimnasio/datos/index.ts:28',
      'apps/web/src/modules/gimnasio/datos/index.ts:71-99',
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
      'apps/web/src/modules/gimnasio/datos/negocio.ts:223',
      'apps/web/src/modules/gimnasio/admin/Panel.tsx:45-49',
      'apps/web/src/modules/gimnasio/datos/index.ts:267-274',
      'apps/web/src/modules/gimnasio/admin/Clases.tsx:145-146',
      'apps/web/src/modules/gimnasio/storefront/Reserva.tsx:152',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:18',
      'apps/web/src/modules/gimnasio/admin/Ingresos.tsx:36',
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
      'apps/web/src/design-system/reservas/piezas.tsx:137',
      'apps/web/src/design-system/reservas/piezas.tsx:156',
      'apps/web/src/design-system/reservas/piezas.tsx:167',
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
      'apps/web/src/modules/superadmin/Modulos.tsx:376',
      'apps/web/src/modules/superadmin/Modulos.tsx:112',
      'apps/web/src/modules/superadmin/Modulos.tsx:501',
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
      'apps/web/src/design-system/reservas/estilo.tsx:112',
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
]

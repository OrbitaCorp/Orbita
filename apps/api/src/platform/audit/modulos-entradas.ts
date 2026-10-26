// Entradas de auditoría de los módulos nuevos que se generaron en sesión
// (super admin → Módulos → pestaña Auditoría de cada módulo).
//
// Cada entrada documenta algo que YA se hizo: una tarea del plan, un cambio de
// diseño (con capturas antes y después) o una decisión de producto (con la
// opción elegida y el porqué). Van en el seed y no en un script para que
// lleguen solas a producción con el deploy de la API, sin que nadie corra nada
// contra la base: asegurarSeed las crea por key, una sola vez, y nunca las pisa.
//
// Formato (lo arma `entrada()`, no se escribe a mano):
// - key `auditoria.<modulo>.<AAAA-MM-DD>-<slug>`, con modulo turnos, alquileres
//   o gimnasio. Lo transversal (lib de reservas, sección Módulos, alta única)
//   va en gimnasio, el módulo de Ale, con area TRANSVERSAL y el título con el
//   prefijo "Transversal: ", igual que sus tareas del plan.
// - grupo `Módulo · <Nombre> · tarea|diseño|decisión`: de ahí saca el front el
//   tipo para los filtros.
// - informe en Markdown que arranca avisando que lo generó una sesión y sigue
//   con Qué se hizo, Quién, Cuándo, Archivos (`ruta:línea` desde la raíz del
//   repo), Antes / Después (solo diseño) y Decisión y porqué (solo decisión).
// - estado PENDIENTE y dos checks sin tildar (CHECKS_ENTRADA). El botón
//   Confirmar de Módulos la pasa a HECHO y tilda el primero; el segundo lo
//   tilda Ale cuando la revisa.
// - notas JSON {"quien","tipo","sesion"} y `responsable` por nombre de pila,
//   que se resuelve igual que el del plan (elegirResponsable).
//
// Capturas (solo diseño): los archivos van en
// apps/web/public/auditoria/modulos/<modulo>/ y se pasan por nombre, uno por
// ancho (`antes: { 1280: 'agenda-antes-1280.jpg', 390: 'agenda-antes-390.jpg' }`).
// Se sirven desde la web pública: nada con datos reales de clientes.
//
// Para que una tarea del plan apunte a su entrada, en modulos-seed.ts se
// envuelve la tarea con documentada(t(...), '<key de la entrada>'). Si el plan
// ya existía en esa base, asegurarSeed completa el link la próxima vez que
// crea algo del seed (completarLinksDePlanes), sin tocar lo tildado.

import type { SeedArea, SeedItem, SeedQuien } from './audit-seed';

export type ModuloConPlan = 'turnos' | 'alquileres' | 'gimnasio';
export type TipoEntrada = 'tarea' | 'diseño' | 'decisión';

const NOMBRE: Record<ModuloConPlan, string> = { turnos: 'Turnos', alquileres: 'Alquileres', gimnasio: 'Gimnasio' };

// Los mismos dos checks en toda entrada, también en las que se cargan desde
// el modal de Módulos.
export const CHECKS_ENTRADA = ['Confirmada por el responsable', 'Revisada por Ale'];

export const AVISO_SESION = '> **Generada en sesión, pendiente de confirmación del responsable.**';

// Una captura por ancho: nombre del archivo dentro de la carpeta del módulo.
export interface Capturas {
  1280: string;
  390: string;
}

interface Base {
  modulo: ModuloConPlan;
  // Día en que se hizo (AAAA-MM-DD). Va en la key.
  fecha: string;
  // Slug de la tarea: minúsculas, números y guiones.
  slug: string;
  quien: SeedQuien;
  titulo: string;
  // Una línea: es lo que se ve en la lista sin abrir la entrada.
  foco: string;
  // Markdown: qué se hizo.
  que: string;
  // `ruta:línea` desde la raíz del repo, uno por archivo creado o tocado.
  archivos: string[];
  // FRONTEND salvo que cruce módulos.
  area?: Extract<SeedArea, 'FRONTEND' | 'TRANSVERSAL'>;
  // Día de la sesión que la generó; por defecto, la fecha.
  sesion?: string;
}

// Cada tipo exige lo suyo: un diseño sin capturas o una decisión sin porqué
// no compilan.
export type DatosEntrada = Base & (
  | { tipo: 'tarea' }
  | { tipo: 'diseño'; antes: Capturas; despues: Capturas }
  | { tipo: 'decisión'; decision: string; porque: string }
);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

// Un párrafo por ancho: el front muestra cada par antes/después lado a lado
// desde 768 px y apilado abajo de eso (MarkdownInforme).
function capturas(modulo: ModuloConPlan, antes: Capturas, despues: Capturas): string {
  const url = (archivo: string) => `/auditoria/modulos/${modulo}/${archivo}`;
  return ([1280, 390] as const)
    .map((ancho) => `![Antes · ${ancho}](${url(antes[ancho])})\n![Después · ${ancho}](${url(despues[ancho])})`)
    .join('\n\n');
}

export function entrada(d: DatosEntrada): SeedItem {
  const secciones = [
    AVISO_SESION,
    '## Qué se hizo', d.que.trim(),
    '## Quién', d.quien,
    '## Cuándo', fechaLarga(d.fecha),
    '## Archivos', d.archivos.map((a) => `- \`${a}\``).join('\n'),
  ];
  if (d.tipo === 'diseño') secciones.push('## Antes / Después', capturas(d.modulo, d.antes, d.despues));
  if (d.tipo === 'decisión') secciones.push('## Decisión y porqué', `**Decisión:** ${d.decision.trim()}\n\n**Porqué:** ${d.porque.trim()}`);
  return {
    key: `auditoria.${d.modulo}.${d.fecha}-${d.slug}`,
    area: d.area ?? 'FRONTEND',
    grupo: `Módulo · ${NOMBRE[d.modulo]} · ${d.tipo}`,
    titulo: d.titulo,
    foco: d.foco,
    estado: 'PENDIENTE',
    checks: [...CHECKS_ENTRADA],
    informe: secciones.join('\n\n'),
    notas: JSON.stringify({ quien: d.quien, tipo: d.tipo, sesion: d.sesion ?? d.fecha }),
    responsable: d.quien,
  };
}

// ─── Entradas ─────────────────────────────────────────────────────────────────

export const ENTRADAS_MODULOS: SeedItem[] = [
  entrada({
    modulo: 'gimnasio',
    fecha: '2026-10-26',
    slug: 'seccion-modulos',
    tipo: 'tarea',
    quien: 'Ale',
    area: 'TRANSVERSAL',
    titulo: 'Transversal: sección Módulos del superadmin',
    foco: 'Pestaña Módulos del superadmin con el plan diario de Turnos, Alquileres y Gimnasio y sus entradas de auditoría, guardados en el tablero de auditoría sin migración.',
    que: `Se creó la sección Módulos del superadmin (Interno → Módulos, \`/superadmin?seccion=modulos\`): cuatro tarjetas (Tienda, Turnos, Gimnasio y Alquileres) con responsable, fin estimado, progreso y semáforo, y la vista de cada módulo con las pestañas Plan, Auditoría y Resumen.

- **Sin migración:** el tablero de auditoría es el almacén. Un ítem \`modulo.<slug>.plan\` por módulo, con una tarea diaria por check (día, quién, criterio de listo y semana en los horizontes de 2 meses y 1 mes), y una entrada \`auditoria.<slug>.<fecha>-<slug>\` por cada cosa hecha.
- **Reglas en la API:** una tarea solo se tilda con una entrada que exista. Las entradas generadas en sesión van en el seed y llegan solas con el deploy. El responsable se resuelve por nombre de pila (una palabra del nombre que empiece así) o por la cuenta de su cargo (CPO, CEO, CTO).
- **Confirmación:** una entrada de sesión queda pendiente hasta que su responsable la confirma; confirmarla tilda también la tarea del plan que documenta.
- **Auditoría general intacta:** los planes y las entradas no cuentan en el resumen, la lista ni el documento de la pestaña Auditoría.
- **Capturas:** los informes muestran imágenes \`https://\` o de \`/auditoria/…\` con proporción fija, y el antes y el después lado a lado desde 768 px.
- **Verificación:** typecheck, eslint y tests unitarios en verde. Falta recorrerla en el navegador a 390, 768 y 1280, en claro y en oscuro.`,
    archivos: [
      'apps/api/src/platform/audit/modulos-seed.ts:10',
      'apps/api/src/platform/audit/modulos-seed.ts:67',
      'apps/api/src/platform/audit/modulos-entradas.ts:100',
      'apps/api/src/platform/audit/modulos-entradas.ts:126',
      'apps/api/src/platform/audit/platform-audit.service.ts:61',
      'apps/api/src/platform/audit/platform-audit.service.ts:127',
      'apps/api/src/platform/audit/platform-audit.service.ts:240',
      'apps/api/src/platform/audit/platform-audit.service.ts:341',
      'apps/api/src/platform/audit/dto/audit-item.dto.ts:38',
      'apps/api/src/platform/audit/dto/audit-item.dto.ts:134',
      'apps/api/src/platform/audit/audit-seed.ts:30',
      'apps/api/src/platform/audit/audit-seed.ts:946',
      'apps/api/test/unit/modulos-plan.unit-spec.ts:145',
      'apps/api/test/unit/modulos-plan.unit-spec.ts:330',
      'apps/api/test/unit/platform-audit.unit-spec.ts:16',
      'apps/web/src/modules/superadmin/Modulos.tsx:241',
      'apps/web/src/modules/superadmin/Modulos.tsx:387',
      'apps/web/src/modules/superadmin/Modulos.tsx:1189',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:35',
      'apps/web/src/modules/superadmin/MarkdownInforme.tsx:214',
      'apps/web/src/modules/superadmin/Auditoria.tsx:130',
      'apps/web/src/modules/superadmin/DocumentoAuditoria.tsx:44',
      'apps/web/src/modules/superadmin/SuperAdminDashboard.tsx:136',
      'apps/web/src/lib/platform/api.ts:645',
      'apps/web/src/lib/platform/api.ts:727',
    ],
  }),
];

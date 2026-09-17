// Cierra en el tablero lo que se hizo la noche del 16/09, ya desplegado
// (main 97eed, Cloud Run orbita-api-00112-nm4, 93/93 migraciones).
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-16-09-noche.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-16-09-noche.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const REV = 'orbita-api-00112-nm4';
const SHA = '97eed';

const CAMBIOS = [
  {
    key: 'hallazgo.alta-sin-verificar-email',
    estado: 'HECHO',
    checks: [true, true, true],
    nota:
      `[16/09 noche] CERRADO y desplegado (main ${SHA}, Cloud Run ${REV}, migración 20260916230000 aplicada). ` +
      'Se hizo con el criterio de Mateo, que NO es el que proponía el hallazgo: la verificación no va en el ' +
      'wizard, porque pedir un código en el medio del alta le suma fricción justo antes de cobrar. En vez de ' +
      'eso el member dueño NACE sin verificar (onboarding.service.ts ya no lo crea con emailVerified: true) ' +
      'con 7 días de plazo en el campo nuevo emailVerifyDueAt, y lo resuelve desde "Mi perfil" del panel con ' +
      'un código de 6 dígitos. c1: el código se manda por mail y vive 30 minutos (más que los 15 del reset ' +
      'de contraseña: acá no hay una sesión esperando del otro lado). c2: emailVerified pasa a true recién ' +
      'cuando el código se confirma. c3: verificacion-email-member.auditoria.unit-spec.ts, 14 casos. ' +
      'Defensas: se guarda solo el SHA-256 del código, pedir otro quema los anteriores, 5 intentos por ' +
      'código, y un minuto de espera entre envíos POR MEMBER — el throttle del controller es por IP y no ' +
      'alcanza para evitar que alguien use el endpoint para bombardear una casilla ajena. El código se busca ' +
      'contra el email ACTUAL, así que si lo cambia mientras hay uno dando vueltas el viejo muere solo, y ' +
      'cambiar el email reinicia el plazo. DECISIÓN DE DISEÑO que conviene tener a mano: vencido el plazo NO ' +
      'pasa nada automático — el aviso del panel se pone rojo y listo. Bloquear el panel de un negocio que ya ' +
      'paga por un email sin confirmar hace más daño del que evita; la fecha queda guardada por si algún día ' +
      'se decide apretar. Los members que ya existían quedan con emailVerifyDueAt NULL: no se le puso plazo ' +
      'retroactivo a nadie que ya está operando. En el tutorial quedó como primera tarea de la checklist (es ' +
      'la única con reloj) y mencionado en la ayuda del menú del avatar, como pidió Mateo.',
  },
  {
    key: 'hallazgo.member-email-sin-confirmacion',
    estado: 'HECHO',
    checks: [true, true],
    nota:
      `[16/09 noche] CERRADO junto con alta-sin-verificar-email, que era el plan desde el 15/09 (un solo ` +
      `flujo para los dos casos). Desplegado en main ${SHA} / ${REV}. Cambiar el email de un member desde ` +
      '"Mi perfil" ahora deja emailVerified en false Y arranca de nuevo el plazo de 7 días (emailVerifyDueAt), ' +
      'porque el email nuevo tampoco está probado. El aviso del panel aparece solo y el member confirma con ' +
      'un código de 6 dígitos. Los códigos que hubiera pendientes para el email anterior quedan muertos sin ' +
      'tener que salir a borrarlos: EmailVerificationService los busca por el email ACTUAL del member. ' +
      'Cubierto en member-profile.auditoria.unit-spec.ts (el test del cambio de email ahora verifica también ' +
      'que el plazo se reinicia a 7 días) y en verificacion-email-member.auditoria.unit-spec.ts.',
  },
  {
    key: 'hallazgo.resenas-sin-moderacion-panel',
    estado: 'HECHO',
    checks: [true, true, true],
    nota:
      `[16/09 noche] CERRADO y desplegado (main ${SHA}, Cloud Run ${REV}). Sin migración: el modelo Review ya ` +
      'tenía status HIDDEN y hiddenReason. Criterio de Mateo: se entra por el PRODUCTO, con un ícono en su ' +
      'fila, no por una bandeja general — una reseña se entiende leyendo el producto al que le pegan, y una ' +
      'lista suelta de "todas las reseñas del negocio" obliga a saltar de una a otra para saber de qué ' +
      'hablan. c1: GET /reviews/producto/:productId (owner/admin) trae TODAS, también las ocultas con su ' +
      'motivo, más el resumen de cuántas hay y cuántas están ocultas. No reusa el mapper público a propósito: ' +
      'acá va el nombre completo y el email, porque el dueño necesita poder contestarle, mientras que en el ' +
      'storefront va "María G.". c2: PATCH /reviews/:id/show devuelve una reseña a VISIBLE y limpia el ' +
      'motivo, que era el de ESA vez. Antes moderar era de una sola vía: una reseña ocultada por error no ' +
      'volvía nunca. c3: la pantalla es un modal que se abre desde el ícono de reseñas, en la vista de grilla ' +
      'y en la de tabla. Ocultar pide motivo siempre. Aparte: ocultar y mostrar ahora quedan en el registro ' +
      'de actividad con quién y por qué — moderar es tocar lo que ve un cliente sobre su propia compra, y sin ' +
      'la traza tres meses después nadie sabe por qué esa reseña no está. Tests: ' +
      'moderacion-resenas.auditoria.unit-spec.ts, 11 casos, incluidos los de aislamiento (un producto o una ' +
      'reseña de otro negocio dan 404 antes de tocar nada).',
  },
  {
    key: 'hallazgo.inventario-mock-sin-montar',
    estado: 'HECHO',
    checks: [true, true, true],
    nota:
      '[16/09 noche] CERRADO. Se borraron apps/web/src/modules/ventas/panel/inventario (9 archivos) y ' +
      'reportes/mock/reportes.mock.ts. Lo corrió Ale porque el clasificador de permisos me niega el borrado ' +
      'de archivos, incluso con git rm, que es reversible. Verificado antes de borrar que no lo importaba ' +
      'nadie (grep sobre apps/web/src) y después con typecheck limpio. Queda en la historia de git si alguna ' +
      'vez se quiere retomar como base.',
  },
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  for (const c of CAMBIOS) {
    const f = await p.platformAuditItem.findUnique({
      where: { key: c.key },
      select: { id: true, estado: true, notas: true, checks: true },
    });
    if (!f) { console.log(`- ${c.key}: NO EXISTE en el tablero`); continue; }
    if (f.checks.length !== c.checks.length) {
      console.log(`- ${c.key}: tiene ${f.checks.length} checks y el script trae ${c.checks.length} — NO SE TOCA`);
      continue;
    }
    console.log(`${aplicar ? '✔' : '·'} ${c.key}: ${f.estado} → ${c.estado} (${c.checks.filter(Boolean).length}/${c.checks.length})`);
    if (!aplicar) continue;
    await p.platformAuditItem.update({
      where: { id: f.id },
      data: {
        estado: c.estado,
        checks: f.checks.map((ch, i) => ({ ...ch, hecho: c.checks[i] })),
        notas: `${f.notas ?? ''}\n\n${c.nota}`.trim(),
        actualizadoPorId: CPO,
        ...(c.estado === 'HECHO' ? { hechoPorId: CPO, hechoAt: new Date() } : {}),
      },
    });
  }
  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

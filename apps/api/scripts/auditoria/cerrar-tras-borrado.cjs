// Cierra los hallazgos que quedan resueltos por el borrado de los 199
// negocios de prueba (scripts/auditoria/borrar-negocios-de-prueba.cjs).
//
// NO cierra a ciegas: antes de tocar el tablero VERIFICA contra la base que el
// borrado haya pasado de verdad. Si no pasó, no hace nada y lo dice. Un
// hallazgo cerrado sobre un trabajo que en realidad no se hizo es peor que el
// hallazgo abierto.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-tras-borrado.cjs        → verifica y muestra
//   node --env-file=.env scripts/auditoria/cerrar-tras-borrado.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const HOY = new Date().toISOString().slice(0, 10);

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  // ── Verificación ────────────────────────────────────────────────────────
  const total = await p.business.count();
  const quedan = await p.business.findMany({ select: { subdomain: true }, orderBy: { subdomain: 'asc' } });
  const demo = await p.member.count({ where: { email: { contains: 'demo-tutorial' } } });
  const rolDemo = await p.role.count({ where: { name: 'Demo Tutorial' } });
  const e2e = await p.business.count({ where: { subdomain: { contains: 'e2e' } } });
  const tefaltacalle = quedan.some((b) => b.subdomain === 'tefaltacalle');
  const negocio = quedan.some((b) => b.subdomain === 'negocio');

  console.log(`Negocios en la base: ${total} → ${quedan.map((b) => b.subdomain).join(', ')}`);
  console.log(`Cuentas demo-tutorial: ${demo} | rol "Demo Tutorial": ${rolDemo} | subdominios con "e2e": ${e2e}`);

  // tefaltacalle es de una clienta real: si no está, algo salió muy mal y no
  // se cierra nada hasta entender qué pasó.
  if (!tefaltacalle) {
    console.error('\nABORTA: no está tefaltacalle en la base. Es una clienta real — revisá qué pasó ANTES de seguir.');
    await p.$disconnect();
    process.exit(1);
  }
  if (!negocio) {
    console.error('\nABORTA: no está el negocio de desarrollo `negocio`. Revisá qué pasó antes de seguir.');
    await p.$disconnect();
    process.exit(1);
  }
  if (total > 5) {
    console.log(`\nTodavía no: quedan ${total} negocios. El borrado no terminó (o no se corrió). No se toca el tablero.`);
    await p.$disconnect();
    return;
  }

  const CAMBIOS = [
    {
      key: 'hallazgo.tiendas-prueba-publicadas',
      checks: [true, true, true],
      nota:
        `[${HOY}] CERRADO. Se resolvió de una forma más fuerte que la que proponía el hallazgo: en vez de ` +
        'despublicar las tiendas de e2e (isActive: false), Ale decidió borrar de la base los 199 negocios de ' +
        `prueba. Quedan solo los ${total} que se conservan a propósito: ${quedan.map((b) => b.subdomain).join(' y ')}. ` +
        'tefaltacalle es una clienta real y el script la protege explícitamente, igual que a cualquier negocio ' +
        'con un dominio propio verificado. Con eso quedan cubiertos los tres checks: no hay tiendas de e2e ' +
        'publicadas (no hay tiendas de e2e), se decidió qué pasa con las del equipo (se borran menos una), y ' +
        'los e2e ya limpian lo que crean desde el commit 0f651 (test/helpers/limpiar-negocio.ts). El script ' +
        'usado es scripts/auditoria/borrar-negocios-de-prueba.cjs, con tres candados y prueba en seco. Los ' +
        'archivos de Supabase Storage de esos negocios NO se borraron: quedan huérfanos en el bucket y hay ' +
        'que limpiarlos aparte desde el panel de Supabase.',
    },
    {
      key: 'hallazgo.cuentas-demo-produccion',
      checks: [true, true],
      nota:
        `[${HOY}] CERRADO, y no hizo falta correr borrar-cuentas-demo.cjs: las 5 cuentas ` +
        'demo-tutorial-*@orbita.test y el rol "Demo Tutorial" vivían todos dentro de zapatoslorena, que se ' +
        'fue en el borrado de los 199 negocios de prueba. Verificado contra la base después del borrado: ' +
        `quedan ${demo} cuentas demo-tutorial y ${rolDemo} roles "Demo Tutorial". El script sigue en el repo ` +
        'por si alguna vez se vuelven a crear cuentas de demo sin borrar el negocio entero.',
    },
  ];

  for (const c of CAMBIOS) {
    const f = await p.platformAuditItem.findUnique({ where: { key: c.key }, select: { id: true, estado: true, notas: true, checks: true } });
    if (!f) { console.log(`- ${c.key}: no existe`); continue; }
    if (f.checks.length !== c.checks.length) { console.log(`- ${c.key}: tiene ${f.checks.length} checks y el script trae ${c.checks.length} — NO SE TOCA`); continue; }
    console.log(`${aplicar ? '✔' : '·'} ${c.key}: ${f.estado} → HECHO`);
    if (!aplicar) continue;
    await p.platformAuditItem.update({
      where: { id: f.id },
      data: { estado: 'HECHO', checks: f.checks.map((ch, i) => ({ ...ch, hecho: c.checks[i] })), notas: `${f.notas ?? ''}\n\n${c.nota}`.trim(), hechoPorId: CPO, hechoAt: new Date(), actualizadoPorId: CPO },
    });
  }

  // Y las decisiones que quedan cumplidas con el mismo borrado.
  for (const key of ['decision.tiendas-del-equipo', 'decision.despublicar-tiendas-e2e', 'decision.borrar-cuentas-demo']) {
    const f = await p.platformAuditItem.findUnique({ where: { key }, select: { id: true, estado: true, checks: true, notas: true } });
    if (!f) continue;
    console.log(`${aplicar ? '✔' : '·'} ${key}: ${f.estado} → HECHO`);
    if (!aplicar) continue;
    await p.platformAuditItem.update({
      where: { id: f.id },
      data: { estado: 'HECHO', checks: f.checks.map((c) => ({ ...c, hecho: true })), notas: `${f.notas ?? ''}\n\n[${HOY}] Aplicado: se borraron los 199 negocios de prueba.`.trim(), hechoPorId: CPO, hechoAt: new Date(), actualizadoPorId: CPO },
    });
  }

  if (!aplicar) console.log('\n(verificación ok: correr con --si para cerrar el tablero)');
  await p.$disconnect();
})();

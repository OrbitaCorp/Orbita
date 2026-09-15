// Cierra el hallazgo BAJO `cuentas-demo-produccion` (auditoría interna 09/09):
// las 5 cuentas demo-tutorial-*@orbita.test de Zapatos Lorena, con contraseña
// compartida, siguen en producción desde la demo de tutoriales de onboarding
// (ver docs/demo-tutoriales-onboarding.md § Reversión completa). Este script
// hace esa reversión de una: borra los members, sus refresh tokens, los
// email_logs SIMULATED que apuntan a esas casillas y el rol "Demo Tutorial"
// si quedó sin miembros.
//
// La base del .env es PRODUCCIÓN. Por eso:
//   node --env-file=.env scripts/auditoria/borrar-cuentas-demo.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/borrar-cuentas-demo.cjs --si   → lo aplica
//
// Solo toca lo que matchea EXACTAMENTE el patrón del email y el id del rol
// documentado; cualquier otra cosa queda como está.
const { PrismaClient } = require('@prisma/client');

const PATRON_EMAIL = /^demo-tutorial-[a-z]+@orbita\.test$/;
const ROL_DEMO_ID = '509104ee-5e8c-4862-8850-39daba146364';

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  const candidatos = await p.member.findMany({
    where: { email: { startsWith: 'demo-tutorial-', endsWith: '@orbita.test' } },
    select: { id: true, email: true, businessId: true, roleId: true, business: { select: { name: true } } },
  });
  const cuentas = candidatos.filter((m) => PATRON_EMAIL.test(m.email));
  if (!cuentas.length) {
    console.log('No hay cuentas demo-tutorial-*@orbita.test: nada que hacer.');
    await p.$disconnect();
    return;
  }
  for (const m of cuentas) console.log(`${aplicar ? '✔' : '·'} member ${m.email} (${m.business.name}) → borrar`);

  const ids = cuentas.map((m) => m.id);
  const tokens = await p.refreshToken.count({ where: { userId: { in: ids }, userType: 'MEMBER' } });
  const mails = await p.emailLog.count({ where: { to: { in: cuentas.map((m) => m.email) }, status: 'SIMULATED' } });
  console.log(`${aplicar ? '✔' : '·'} refresh_tokens de esas cuentas: ${tokens} → borrar`);
  console.log(`${aplicar ? '✔' : '·'} email_logs SIMULATED a esas casillas: ${mails} → borrar`);

  const rol = await p.role.findUnique({
    where: { id: ROL_DEMO_ID },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  const rolQuedaVacio = rol && rol._count.members === cuentas.filter((m) => m.roleId === rol.id).length;
  if (rol) console.log(`${aplicar && rolQuedaVacio ? '✔' : '·'} rol "${rol.name}" (${rol._count.members} miembros) → ${rolQuedaVacio ? 'borrar' : 'NO se borra: tiene otros miembros'}`);
  else console.log('· rol "Demo Tutorial": ya no existe');

  if (!aplicar) {
    console.log('\n(prueba en seco: correr con --si para aplicarlo)');
    await p.$disconnect();
    return;
  }

  await p.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: { in: ids }, userType: 'MEMBER' } });
    await tx.emailLog.deleteMany({ where: { to: { in: cuentas.map((m) => m.email) }, status: 'SIMULATED' } });
    await tx.member.deleteMany({ where: { id: { in: ids } } });
    if (rol && rolQuedaVacio) await tx.role.delete({ where: { id: rol.id } });
  });
  console.log(`\nListo: ${cuentas.length} cuentas borradas${rol && rolQuedaVacio ? ' y el rol "Demo Tutorial" también' : ''}.`);
  await p.$disconnect();
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});

// Pasa a HECHO los ítems de la auditoría interna que quedaron EN_CURSO
// "arreglados en la rama, falta deploy". Correr SOLO después de:
//   1. cd apps/api && pnpm exec prisma migrate deploy   (migración RLS del 10/09)
//   2. cd apps/api && ./deploy/deploy.sh                (API en Cloud Run)
//   3. main por fast-forward + git push origin main     (panel y tienda)
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-items-desplegados.cjs          → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-items-desplegados.cjs --si     → lo aplica
//
// Solo toca ítems que estén EN_CURSO (si alguien ya lo cerró o lo reabrió a
// mano, no lo pisa), deja las verificaciones tildadas, reemplaza en las notas
// el "FALTA DEPLOY" por la fecha de deploy y firma como el CPO.
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';

// Auditados la noche del 10/09/2026 (ver commits "auditoría `api.*`" de esa noche).
const ITEMS = [
  'api.businesses', 'api.branches', 'api.domains', 'api.members', 'api.member-profile',
  'api.roles', 'api.customers', 'api.me', 'api.supabase', 'api.audit',
  'api.products', 'api.categories', 'api.tags', 'api.inventory',
  'api.search', 'api.orders', 'api.cancellations', 'api.returns', 'api.return-requests',
  'api.payments', 'api.mercadopago', 'api.subscriptions', 'api.discounts',
  'api.coupons', 'api.two-for-one', 'api.reviews',
  // Se van sumando los que se auditen después en la misma tanda:
  ...(process.env.ITEMS_EXTRA ? process.env.ITEMS_EXTRA.split(',') : []),
];

// Hallazgos viejos que quedan completos con este deploy.
const HALLAZGOS = ['hallazgo.subidas-sin-limite'];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  const hoy = new Date().toISOString().slice(0, 10);
  const filas = await p.platformAuditItem.findMany({
    where: { key: { in: [...ITEMS, ...HALLAZGOS] } },
    select: { id: true, key: true, estado: true, notas: true, checks: true },
  });
  for (const f of filas) {
    if (f.estado !== 'EN_CURSO' && !HALLAZGOS.includes(f.key)) {
      console.log(`- ${f.key}: ${f.estado}, no se toca`);
      continue;
    }
    if (f.estado === 'HECHO') { console.log(`- ${f.key}: ya HECHO`); continue; }
    const notas = (f.notas ?? '')
      .replace(/FALTA DEPLOY[^.]*\.?/g, `Desplegado el ${hoy}.`)
      .replace(/hasta entonces sigue EN_CURSO\.?/g, '')
      .trim();
    console.log(`${aplicar ? '✔' : '·'} ${f.key}: ${f.estado} → HECHO`);
    if (aplicar) {
      await p.platformAuditItem.update({
        where: { id: f.id },
        data: {
          estado: 'HECHO',
          checks: f.checks.map((c) => ({ ...c, hecho: true })),
          notas: notas || `Desplegado el ${hoy}.`,
          hechoPorId: CPO,
          hechoAt: new Date(),
          actualizadoPorId: CPO,
        },
      });
    }
  }
  const faltan = [...ITEMS, ...HALLAZGOS].filter((k) => !filas.some((f) => f.key === k));
  if (faltan.length) console.log('No existen en el tablero:', faltan.join(', '));
  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

// Deja constancia del deploy en los ítems de la auditoría interna de la
// noche del 10/09. Correr SOLO después de:
//   1. cd apps/api && pnpm exec prisma migrate deploy   (migración RLS del 10/09)
//   2. cd apps/api && ./deploy/deploy.sh                (API en Cloud Run)
//   3. main por fast-forward + git push origin main     (panel y tienda)
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-items-desplegados.cjs          → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-items-desplegados.cjs --si     → lo aplica
//
// Dos casos, los dos firmados como el CPO:
//   - Ítem EN_CURSO con "FALTA DEPLOY" en las notas → pasa a HECHO, con las
//     verificaciones tildadas y la fecha de deploy en las notas.
//   - Ítem ya HECHO con "Pendiente de deploy" en las notas (los que se
//     finalizaron el 10/09 a la mañana, a pedido de Ale, antes del deploy) →
//     queda HECHO y la nota pasa a decir la fecha de deploy.
// Cualquier otro estado (alguien lo reabrió o lo tocó a mano) no se pisa.
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
  'api.reports', 'api.wizard-analytics', 'api.storefront',
  'api.promo-modal', 'api.countdown', 'api.social-proof', 'api.games',
  'api.background-removal', 'api.orbi', 'api.conversations', 'api.mail',
  'api.notifications', 'api.message-templates', 'api.support', 'api.onboarding',
  'web.panel.pedidos', 'web.panel.clientes', 'web.panel.descuentos', 'web.panel.reportes', 'web.panel.perfil', 'web.panel.shared',
  'web.cliente.checkout', 'web.cliente.juegos', 'web.cliente.perfil', 'web.cliente.auth',
  'web.propuestas', 'web.landing', 'web.middleware', 'web.design-system',
  'web.components-orbi', 'web.components-storefront',
  // Transversales: solo los que quedan completos con migrate deploy + deploy.
  'trans.rls-supabase',
  // Se van sumando los que se auditen después en la misma tanda:
  ...(process.env.ITEMS_EXTRA ? process.env.ITEMS_EXTRA.split(',') : []),
];

// Hallazgos viejos que quedan completos con este deploy. health-guard no está:
// además del deploy le falta el uptime check, que es de Ale.
const HALLAZGOS = [
  'hallazgo.subidas-sin-limite', 'hallazgo.comprobante-fijo', 'hallazgo.email-en-url',
  'hallazgo.cron-timing', 'hallazgo.ctalink-externo', 'hallazgo.webhooks-sin-firma',
  'hallazgo.auth-refresh-reuso', 'hallazgo.common-enumeracion-alta', 'hallazgo.common-query-sin-dto',
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  const hoy = new Date().toISOString().slice(0, 10);
  const filas = await p.platformAuditItem.findMany({
    where: { key: { in: [...ITEMS, ...HALLAZGOS] } },
    select: { id: true, key: true, estado: true, notas: true, checks: true },
  });
  for (const f of filas) {
    const notasActuales = f.notas ?? '';
    const finalizadoSinDeploy = f.estado === 'HECHO' && /Pendiente de deploy/.test(notasActuales);
    const enCursoSinDeploy = f.estado === 'EN_CURSO' && (/FALTA DEPLOY/.test(notasActuales) || HALLAZGOS.includes(f.key));
    if (!finalizadoSinDeploy && !enCursoSinDeploy) {
      console.log(`- ${f.key}: ${f.estado}, no se toca`);
      continue;
    }
    const notas = notasActuales
      .replace(/FALTA DEPLOY[^.]*\.?/g, `Desplegado el ${hoy}.`)
      .replace(/hasta entonces sigue EN_CURSO\.?/g, '')
      .replace(/Pendiente de deploy de la API y push de main\.?/g, `Desplegado el ${hoy}.`)
      .trim();
    console.log(`${aplicar ? '✔' : '·'} ${f.key}: ${f.estado} → HECHO (desplegado el ${hoy})`);
    if (aplicar) {
      await p.platformAuditItem.update({
        where: { id: f.id },
        data: {
          estado: 'HECHO',
          checks: f.checks.map((c) => ({ ...c, hecho: true })),
          notas: notas || `Desplegado el ${hoy}.`,
          ...(enCursoSinDeploy ? { hechoPorId: CPO, hechoAt: new Date() } : {}),
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

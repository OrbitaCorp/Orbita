// Hallazgo `mp-plan-override-prod`, check c3: "Revisadas las altas que se
// cobraron con el monto de prueba".
//
// MP_PLAN_OVERRIDE hacía que el beneficio de bienvenida cobrara un monto de
// prueba (unos $15, cada 3 días) en altas REALES de producción. Este script
// SOLO LEE: lista los cobros de suscripción por debajo de un piso razonable
// para un plan de verdad, con el negocio y el estado de cada uno, para poder
// decidir a quién hay que devolverle o reacomodarle el cobro.
//
//   cd apps/api && node --env-file=.env scripts/auditoria/altas-monto-prueba.cjs
//   ... --piso 1000    (cambia el piso; por defecto $1000)

const { PrismaClient } = require('@prisma/client');

const arg = (nombre, porDefecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : porDefecto;
};

(async () => {
  const PISO = arg('piso', 1000);
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

  const cobros = await prisma.subscriptionPayment.findMany({
    where: { amount: { lt: PISO } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, amount: true, status: true, paidAt: true, createdAt: true,
      periodStart: true, periodEnd: true, mpPaymentId: true,
      subscription: {
        select: {
          id: true, status: true, plan: true,
          business: { select: { id: true, name: true, subdomain: true, isActive: true } },
        },
      },
    },
  });

  console.log(`Cobros de suscripción por debajo de $${PISO}: ${cobros.length}\n`);
  if (!cobros.length) {
    console.log('No hay ninguno: nadie quedó cobrado con el monto de prueba.');
  }

  const porNegocio = new Map();
  for (const c of cobros) {
    const b = c.subscription?.business;
    const clave = b ? `${b.subdomain} (${b.name})` : 'sin negocio';
    if (!porNegocio.has(clave)) porNegocio.set(clave, []);
    porNegocio.get(clave).push(c);
    console.log(
      [
        c.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        `$${String(c.amount).padStart(8)}`,
        c.status.padEnd(9),
        (c.subscription?.plan ?? '-').padEnd(10),
        (c.subscription?.status ?? '-').padEnd(10),
        clave,
        c.mpPaymentId ? `mp:${c.mpPaymentId}` : 'sin mp_payment_id',
      ].join('  '),
    );
  }

  if (porNegocio.size) {
    console.log(`\nResumen: ${porNegocio.size} negocio(s) afectado(s).`);
    for (const [clave, lista] of porNegocio) {
      const total = lista.reduce((a, c) => a + Number(c.amount), 0);
      const pagados = lista.filter((c) => c.status === 'PAID' || c.paidAt).length;
      console.log(`  · ${clave}: ${lista.length} cobro(s), ${pagados} efectivamente pagado(s), total $${total.toFixed(2)}`);
    }
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

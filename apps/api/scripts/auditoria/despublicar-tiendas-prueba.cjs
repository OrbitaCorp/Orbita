// Cierra el primer check del hallazgo BAJO `tiendas-prueba-publicadas`
// (auditoría interna 09/09): 24 tiendas que crearon los e2e entre el 10 y el
// 19/08 quedaron publicadas (isActive: true) en *.orbita.site, con productos y
// pedidos de prueba a la vista. Ninguna es de un cliente ni del equipo: el
// subdominio lleva el prefijo del test y un timestamp.
//
// Las despublica (isActive: false, lo mismo que hace PUT /onboarding/business
// al "pausar" la tienda): no borra nada, así que si hiciera falta se
// revierten a mano. Las tiendas del equipo (negocio, zapatoslorena, alex,
// tefaltacalle, asd…) NO se tocan: eso es una decisión aparte de Ale.
//
// La base del .env es PRODUCCIÓN. Por eso:
//   node --env-file=.env scripts/auditoria/despublicar-tiendas-prueba.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/despublicar-tiendas-prueba.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

// Prefijo del e2e + timestamp de 10 dígitos: así se generan en test/*.e2e-spec.ts.
const PATRON_E2E =
  /^(f3-test|f4-test|pausa-test|fav-test|reviews-test|deals-test|deals2|deals3|msg-test|mp-order-test|verif-cart|guest-checkout|descuentos-demo|disc-e2e|co-val|tienda-cupon-test|tienda-imagen-test|tienda-origin-test|tienda-logo-test|verify-envio|verify-envio2|verify-tracking)-\d{10}$/;

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  const activas = await p.business.findMany({
    where: { isActive: true },
    select: { id: true, subdomain: true, name: true, createdAt: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const prueba = activas.filter((b) => PATRON_E2E.test(b.subdomain));
  const resto = activas.length - prueba.length;

  for (const b of prueba) {
    console.log(`${aplicar ? '✔' : '·'} ${b.subdomain} (${b.name}, ${b.createdAt.toISOString().slice(0, 10)}, ${b._count.orders} pedidos) → isActive: false`);
  }
  console.log(`\n${prueba.length} tiendas de e2e publicadas; ${resto} tiendas activas que NO se tocan.`);

  if (!aplicar) {
    console.log('(prueba en seco: correr con --si para aplicarlo)');
    await p.$disconnect();
    return;
  }
  const r = await p.business.updateMany({ where: { id: { in: prueba.map((b) => b.id) } }, data: { isActive: false } });
  console.log(`Listo: ${r.count} tiendas despublicadas.`);
  await p.$disconnect();
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});

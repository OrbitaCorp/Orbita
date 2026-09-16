// BORRA DE VERDAD, Y NO SE PUEDE DESHACER.
//
// Decisión de Ale del 2026-09-16 (ítem `decision.tiendas-del-equipo`): de los
// ~201 negocios de producción, casi todos son pruebas de e2e, del wizard y del
// equipo. Se borran físicamente todos menos los que estén en CONSERVAR.
//
// No es un `business.delete()`: `businesses` tiene 36 relaciones y solo una
// borra en cascada, así que se borra por pasadas sobre las tablas con
// `business_id` — las que fallan por una FK quedan para la pasada siguiente,
// cuando sus hijas ya no están. Es la misma lógica de
// `test/helpers/limpiar-negocio.ts`, que ya se usa en los e2e.
//
// LO QUE ESTE SCRIPT **NO** BORRA: los archivos de Supabase Storage (logos,
// fotos de productos, comprobantes). Quedan huérfanos en el bucket y hay que
// limpiarlos aparte. Se avisa al final con el conteo.
//
// ── Candados (todos tienen que pasar, si no aborta sin tocar nada) ──────────
//   1. Los negocios de CONSERVAR tienen que existir TODOS. Si uno está mal
//      escrito, abortamos: un typo ahí significa borrar la tienda que se
//      quería salvar.
//   2. Nunca se toca un negocio con un dominio propio ACTIVE + dnsVerified,
//      aunque no esté en CONSERVAR.
//   3. Para aplicar hay que pasar `--cuantos=N` con el número exacto que
//      imprimió la prueba en seco. Si entre una cosa y la otra se creó o borró
//      un negocio, el número no coincide y aborta.
//
// ── Uso (desde apps/api) ───────────────────────────────────────────────────
//   node --env-file=.env scripts/auditoria/borrar-negocios-de-prueba.cjs
//   node --env-file=.env scripts/auditoria/borrar-negocios-de-prueba.cjs --si --cuantos=199
//
//   CONSERVAR_EXTRA="mateo,otro" node --env-file=.env ...   ← salvar más
const { PrismaClient } = require('@prisma/client');

const CONSERVAR = [
  'tefaltacalle', // clienta real (Milagros). NUNCA se toca.
  'negocio',      // la tienda de desarrollo del equipo.
  ...(process.env.CONSERVAR_EXTRA ? process.env.CONSERVAR_EXTRA.split(',').map((s) => s.trim()).filter(Boolean) : []),
];

const num = (s) => new Intl.NumberFormat('es-AR').format(s);

async function tablasConBusinessId(prisma) {
  const filas = await prisma.$queryRawUnsafe(
    `SELECT c.table_name FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'business_id' AND t.table_type = 'BASE TABLE'`,
  );
  return filas.map((f) => f.table_name);
}

// Borra un negocio con todo lo que le cuelga. Devuelve las tablas que no se
// pudieron vaciar (si queda alguna, el negocio NO se borra).
async function borrarNegocio(prisma, id, tablas) {
  let pendientes = tablas;
  for (let pasada = 0; pasada < 8 && pendientes.length > 0; pasada++) {
    const fallaron = [];
    for (const tabla of pendientes) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM public."${tabla}" WHERE business_id = $1`, id);
      } catch {
        fallaron.push(tabla); // referencia una hija que todavía no se borró
      }
    }
    if (fallaron.length === pendientes.length) break; // no avanzó: no insistir
    pendientes = fallaron;
  }
  if (pendientes.length > 0) return pendientes;
  await prisma.$executeRawUnsafe(`DELETE FROM public."businesses" WHERE id = $1`, id);
  return [];
}

(async () => {
  const prisma = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  const esperados = Number((process.argv.find((a) => a.startsWith('--cuantos=')) ?? '').split('=')[1]);

  const todos = await prisma.business.findMany({
    select: {
      id: true, subdomain: true, name: true, isActive: true, createdAt: true,
      customDomains: { select: { domain: true, status: true, dnsVerified: true } },
      subscription: { select: { status: true, origin: true, mpPreapprovalId: true } },
      _count: { select: { orders: true, customers: true, products: true, members: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Candado 1: los que se quieren salvar tienen que existir.
  const faltan = CONSERVAR.filter((s) => !todos.some((b) => b.subdomain === s));
  if (faltan.length > 0) {
    console.error(`ABORTA: estos subdominios de CONSERVAR no existen en la base: ${faltan.join(', ')}`);
    console.error('Un typo acá significa borrar justo la tienda que se quería salvar. Corregilo y volvé a correr.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Candado 2: un dominio propio verificado salva al negocio aunque no esté en CONSERVAR.
  const protegidos = [];
  const aBorrar = [];
  for (const b of todos) {
    if (CONSERVAR.includes(b.subdomain)) { protegidos.push([b, 'está en CONSERVAR']); continue; }
    const dom = b.customDomains.find((d) => d.status === 'ACTIVE' && d.dnsVerified);
    if (dom) { protegidos.push([b, `tiene el dominio propio verificado ${dom.domain}`]); continue; }
    aBorrar.push(b);
  }

  console.log('SE CONSERVAN:');
  for (const [b, motivo] of protegidos) console.log(`  ✓ ${b.subdomain} (${b.name}) — ${motivo}`);

  const tot = aBorrar.reduce((a, b) => ({
    orders: a.orders + b._count.orders,
    customers: a.customers + b._count.customers,
    products: a.products + b._count.products,
    members: a.members + b._count.members,
  }), { orders: 0, customers: 0, products: 0, members: 0 });

  console.log(`\nSE BORRAN ${aBorrar.length} negocios. Con ellos se van, PARA SIEMPRE:`);
  console.log(`  ${num(tot.orders)} pedidos · ${num(tot.customers)} clientes · ${num(tot.products)} productos · ${num(tot.members)} usuarios del panel`);

  const gordos = aBorrar.filter((b) => b._count.orders + b._count.customers + b._count.products > 0);
  if (gordos.length > 0) {
    console.log(`\n  Los ${gordos.length} que NO están vacíos (mirá esta lista antes de aplicar):`);
    for (const b of gordos) {
      const sub = b.subscription ? ` [susc ${b.subscription.status}/${b.subscription.origin}${b.subscription.mpPreapprovalId ? ' CON PREAPPROVAL' : ''}]` : '';
      console.log(`    - ${b.subdomain} (${b.name}) ${b.createdAt.toISOString().slice(0, 10)} — ${b._count.orders} pedidos, ${b._count.customers} clientes, ${b._count.products} productos${sub}`);
    }
  }

  if (!aplicar) {
    console.log(`\n(prueba en seco, no se borró nada)`);
    console.log(`Para aplicarlo:  node --env-file=.env scripts/auditoria/borrar-negocios-de-prueba.cjs --si --cuantos=${aBorrar.length}`);
    await prisma.$disconnect();
    return;
  }

  // Candado 3: el número tiene que coincidir con el de la prueba en seco.
  if (esperados !== aBorrar.length) {
    console.error(`\nABORTA: se pasó --cuantos=${esperados || '(nada)'} pero hay ${aBorrar.length} para borrar.`);
    console.error('Si el número cambió es porque se creó o se borró un negocio desde la prueba en seco.');
    console.error('Volvé a correr sin --si, mirá la lista de nuevo y usá el número que imprima.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const tablas = await tablasConBusinessId(prisma);
  console.log(`\nBorrando (${tablas.length} tablas con business_id)…`);
  let ok = 0;
  const fallados = [];
  for (const b of aBorrar) {
    const pendientes = await borrarNegocio(prisma, b.id, tablas);
    if (pendientes.length > 0) {
      fallados.push([b.subdomain, pendientes]);
      console.log(`  ✗ ${b.subdomain}: no se pudo vaciar ${pendientes.join(', ')} — el negocio NO se borró`);
    } else {
      ok += 1;
      if (ok % 25 === 0) console.log(`  … ${ok}/${aBorrar.length}`);
    }
  }

  const quedan = await prisma.business.count();
  console.log(`\nBorrados ${ok} de ${aBorrar.length}. Quedan ${quedan} negocios en la base.`);
  if (fallados.length > 0) {
    console.log(`\n${fallados.length} no se pudieron borrar del todo. Son tablas con una FK que el borrado por pasadas no resolvió:`);
    for (const [sd, t] of fallados) console.log(`  - ${sd}: ${t.join(', ')}`);
  }
  console.log('\nOJO: los archivos de Supabase Storage (logos, fotos de productos, comprobantes) NO se borran acá.');
  console.log('Quedan huérfanos en el bucket y hay que limpiarlos por separado desde el panel de Supabase.');

  await prisma.$disconnect();
})();

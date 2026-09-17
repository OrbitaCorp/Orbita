// Cierra `decision.webhook-cobros-vacio` con lo que se encontró y se arregló.
//
// El ítem quedó EN_CURSO el 16/09 con "se investiga": subscription_payments
// estaba vacía en producción. La investigación terminó el 17/09 y el arreglo
// está desplegado, así que el tercer check ("Aplicado, o asentado como
// decisión en el ítem relacionado") se cumple y el ítem pasa a HECHO.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-webhook-cobros.cjs              → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-webhook-cobros.cjs --si <rev>   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const KEY = 'decision.webhook-cobros-vacio';

const nota = (rev) => `[17/09] Investigado y arreglado. Eran dos agujeros en el webhook, no uno:
1) \`subscription_authorized_payment\` — el aviso de cada cobro recurrente — manda en data.id el id del authorized payment, no el del pago. Se lo pedíamos a /v1/payments, MP contestaba 404 y el cobro se perdía en el catch general. Ahora se resuelve por /authorized_payments/{id}, que trae adentro el id del pago real.
2) recordPayment descartaba el cobro entero si el plan de la suscripción no era una PlanKey ('standard' del @default del schema o el 'starter' del alta vieja: 5 de las 8 suscripciones de producción, incluida la única con preapproval). Ahora el cobro se registra igual y lo único que no se hace sin plan conocido es renovar el período, con un error en el log.
Además: los caminos que devuelven recorded:false dicen por qué, y el descarte por firma inválida loguea tipo, id y request-id.
Desplegado en Cloud Run (revisión ${rev}), main 1c9be, con tests unitarios (test/unit/webhook-cobros.auditoria.unit-spec.ts).
PENDIENTE aparte: los 16 cobros reales del negocio \`jaja\` (31/07–18/08) siguen sin estar en la tabla — el arreglo es de acá en adelante. Backfill a decidir.`;

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  const rev = process.argv.find((a) => a.startsWith('orbita-api-')) ?? 'sin revisión';
  const it = await p.platformAuditItem.findFirst({ where: { key: KEY }, select: { id: true, estado: true, checks: true, notas: true } });
  if (!it) { console.log(`no existe el ítem ${KEY}`); await p.$disconnect(); return; }

  const checks = it.checks.map((c) => ({ ...c, hecho: true }));
  console.log(`${aplicar ? '✔' : '·'} ${KEY}: ${it.estado} → HECHO (revisión ${rev})`);
  if (!aplicar) { console.log('\n(prueba en seco: correr con --si <revisión> para aplicarlo)'); await p.$disconnect(); return; }

  await p.platformAuditItem.update({
    where: { id: it.id },
    data: {
      estado: 'HECHO',
      checks,
      notas: `${it.notas ? `${it.notas}\n\n` : ''}${nota(rev)}`,
      actualizadoPorId: CPO,
      hechoPorId: CPO,
      hechoAt: new Date(),
    },
  });
  await p.$disconnect();
})();

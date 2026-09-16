// Deja el tablero al día con el deploy de la tarde del 16/09 (main e56a7,
// Cloud Run orbita-api-00105-htc). Sin flags muestra qué haría; --si lo aplica.
//   node --env-file=.env scripts/auditoria/cerrar-16-09-tarde.cjs [--si]
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const HOY = '16/09';
const REV = 'orbita-api-00105-htc';

const CAMBIOS = [
  {
    key: 'hallazgo.cambio-plan-activo-no-se-aplica',
    estado: 'HECHO',
    checks: [true, true, true],
    nota:
      `[${HOY} tarde] CERRADO. Lo arregló Mateo y se verificó leyendo el código, no la nota vieja. ` +
      'c1: el mecanismo elegido es "se aplica en la próxima renovación" — changePlan guarda el plan nuevo en ' +
      'Subscription.nextPlan (subscriptions.service.ts:1028) en vez de intentar cambiar la preapproval ya ' +
      'autorizada, que es justo lo que MP no permite. c2: activatePlan lo toma con `sub.nextPlan ?? sub.plan` ' +
      'y confirmPlanActivation lo aplica y limpia nextPlan; cubierto por subscriptions.auditoria.unit-spec.ts. ' +
      'c3: el panel lo dice, "Elegí tu próximo plan (rige desde la próxima renovación)" ' +
      '(Suscripcion.tsx:295) y "Podés cambiar de plan para la próxima renovación" (:285).',
  },
  {
    key: 'hallazgo.businesses-sin-baja',
    estado: 'EN_CURSO',
    checks: [false, true, false],
    nota:
      `[${HOY} tarde] c2 CERRADO y desplegado (main e56a7, Cloud Run ${REV}). La baja ahora cancela la ` +
      'preapproval en Mercado Pago antes de tocar la base, así que deja de debitarle al que se fue. El ' +
      'mpPreapprovalId se borra SOLO si MP confirmó la baja; si falló se conserva (es lo único con lo que se ' +
      'puede reintentar) y queda un logger.error pidiendo cancelarla a mano en el panel de MP. Además ' +
      'recordPayment ya no resucita una suscripción CANCELLED: registra el cobro para que quede el rastro de ' +
      'la plata, reintenta cancelar la preapproval y NO renueva el período, no extiende el addon, no despausa ' +
      'la tienda ni manda el mail de reactivación. planActive no se toca a propósito (si reactiva dentro de ' +
      'los 60 días, ponerlo en false le dispararía el aviso de "tu período de bienvenida está por vencer"). ' +
      'Verificado que cancelBusiness es el ÚNICO lugar que pone una suscripción en CANCELLED, así que la ' +
      'guarda no puede pisar un flujo legítimo. Tests: baja-negocio.auditoria.unit-spec.ts (8 casos). ' +
      'SIGUEN ABIERTOS c1 y c3, los dos de Ale: c1 es definir qué se borra, qué se anonimiza y qué se ' +
      'conserva por obligación fiscal (sin eso la supresión de datos a pedido no se puede implementar sin ' +
      'adivinar), y c3 es contar en los términos y en la privacidad la ventana de 60 días y qué se borra.',
  },
  {
    key: 'hallazgo.mp-plan-override-prod',
    estado: 'PENDIENTE',
    checks: [true, true, false],
    nota:
      `[${HOY} tarde] CORRECCIÓN: la nota anterior de hoy decía "MP_PLAN_OVERRIDE queda en true por decisión ` +
      'de Ale" y era falsa — quedó pisando a la nota correcta de la madrugada. Verificado contra producción: ' +
      `la revisión en vivo (${REV}) NO tiene MP_PLAN_OVERRIDE ni MP_SUBSCRIPTION_AMOUNT entre sus env vars, y ` +
      'deploy/env-vars.yaml las tiene comentadas con la explicación de por qué. c2 CERRADO: apagado primero ' +
      'en el servicio en vivo y ahora también en el yaml, desplegado con e56a7. Ningún alta real cobra $15. ' +
      'c3 sigue abierto por una sola cosa: hay UNA preapproval con id en la base y no se puede saber desde ' +
      'acá a qué monto quedó — hay que mirarla en el panel de Mercado Pago. Lo demás ya se revisó con ' +
      'scripts/auditoria/altas-monto-prueba.cjs. APARTE, y más raro que este hallazgo: subscription_payments ' +
      'está VACÍA (0 filas) con 7 suscripciones, 3 de ellas ACTIVE. El webhook que graba los cobros no ' +
      'escribió nunca nada. No es parte de este ítem pero merece uno propio.',
  },
  {
    key: 'hallazgo.rate-limit-ip-proxy',
    estado: 'EN_CURSO',
    checks: [true, true, true, false],
    nota:
      `[${HOY} tarde] Sin avance en c4, y no por falta de código. Se intentó crear el secret: ` +
      '`gcloud secrets create BFF_IP_SECRET` lo bloquea el clasificador de permisos (Secret-Store Writes), y ' +
      'la env var de Vercel tampoco se puede cargar desde acá (el CLI de esta máquina está en una cuenta ' +
      'personal que no ve el proyecto). gcloud SÍ está logueado como contacto@orbita-corp.com y se confirmó ' +
      'que el secret todavía no existe. Lo corre Ale con el paso a paso de DEPLOYMENT.md § BFF_IP_SECRET. ' +
      `El deploy de hoy (${REV}) salió sin el secret: sigue sin regresión, pero el límite por IP detrás del ` +
      'BFF sigue compartiendo un solo balde. También se evaluó sumar BFF_IP_SECRET a SECRETS= en deploy.sh ' +
      'por adelantado y se descartó: referenciar un secret que no existe rompe TODOS los deploys.',
  },
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');
  for (const c of CAMBIOS) {
    const f = await p.platformAuditItem.findUnique({ where: { key: c.key }, select: { id: true, estado: true, notas: true, checks: true } });
    if (!f) { console.log(`- ${c.key}: NO EXISTE en el tablero`); continue; }
    if (f.checks.length !== c.checks.length) {
      console.log(`- ${c.key}: el ítem tiene ${f.checks.length} checks y el script trae ${c.checks.length} — NO SE TOCA`);
      continue;
    }
    const tildados = c.checks.filter(Boolean).length;
    console.log(`${aplicar ? '✔' : '·'} ${c.key}: ${f.estado} → ${c.estado}, checks ${tildados}/${c.checks.length}`);
    if (!aplicar) continue;
    await p.platformAuditItem.update({
      where: { id: f.id },
      data: {
        estado: c.estado,
        checks: f.checks.map((ch, i) => ({ ...ch, hecho: c.checks[i] })),
        notas: `${f.notas ?? ''}\n\n${c.nota}`.trim(),
        ...(c.estado === 'HECHO' ? { hechoPorId: CPO, hechoAt: new Date() } : {}),
        actualizadoPorId: CPO,
      },
    });
  }
  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

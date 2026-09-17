// Cierra el uptime check: `hallazgo.health-guard` y `decision.uptime-check`.
//
// El 17/09 se creó por CLI (gcloud monitoring / API de Monitoring) lo que hasta
// ahora figuraba como "lo hace Ale desde la consola de GCP":
//   - uptime check `orbita-api health` contra https://api.orbita.site/api/v1/health,
//     cada 5 min, timeout 10 s, exigiendo `"status":"ok"` en el cuerpo;
//   - canal de notificación por mail a contacto@orbita-corp.com;
//   - política de alerta "API caida - uptime check api.orbita.site", que avisa
//     cuando el check falla en más de una región, con auto-cierre a los 30 min.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-uptime-check.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-uptime-check.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';

const CHECK_ID = 'orbita-api-health-JxHidDp2xKw';
const POLITICA = 'projects/orbita-api-corp/alertPolicies/6792302556596087889';
const CANAL = 'projects/orbita-api-corp/notificationChannels/3583552617709246352';

const NOTA = `[17/09] Hecho por CLI, sin pasar por la consola. Quedó configurado en el proyecto orbita-api-corp:
- Uptime check \`orbita-api health\` (projects/orbita-api-corp/uptimeCheckConfigs/${CHECK_ID}): GET https://api.orbita.site/api/v1/health cada 300 s, timeout 10 s, SSL, y un content matcher que exige \`"status":"ok"\` en el cuerpo — o sea que no alcanza con un 200 vacío de un balanceador.
- Canal de notificación por mail a contacto@orbita-corp.com (${CANAL}). OJO: creado por API, así que GCP manda un mail de verificación a esa casilla; hasta que alguien lo confirme el canal figura sin verificar y puede no entregar.
- Política de alerta "API caida - uptime check api.orbita.site" (${POLITICA}): salta cuando el check falla en más de una región durante 60 s, con auto-cierre a los 30 min y un texto que apunta al rollback de DEPLOYMENT.md.
Antes de esto el proyecto no tenía NI un uptime check NI canales NI políticas de alerta: una caída de la API no le avisaba a nadie.`;

const ITEMS = [
  { key: 'hallazgo.health-guard', check: /uptime check/i },
  { key: 'decision.uptime-check', check: null },
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  for (const { key } of ITEMS) {
    const it = await p.platformAuditItem.findFirst({
      where: { key },
      select: { id: true, estado: true, checks: true, notas: true },
    });
    if (!it) {
      console.log(`no existe el ítem ${key}`);
      continue;
    }

    const checks = (it.checks ?? []).map((c) => ({ ...c, hecho: true }));
    const faltaban = (it.checks ?? []).filter((c) => !c.hecho).map((c) => c.texto);
    console.log(`${aplicar ? '✔' : '·'} ${key}: ${it.estado} → HECHO`);
    for (const t of faltaban) console.log(`    marca: ${t}`);

    if (!aplicar) continue;

    await p.platformAuditItem.update({
      where: { id: it.id },
      data: {
        estado: 'HECHO',
        checks,
        notas: `${it.notas ? `${it.notas}\n\n` : ''}${NOTA}`,
        actualizadoPorId: CPO,
        hechoPorId: CPO,
        hechoAt: new Date(),
      },
    });
  }

  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

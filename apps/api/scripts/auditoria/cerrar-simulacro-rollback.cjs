// Cierra el simulacro de rollback: `hallazgo.rollback-sin-simulacro`,
// `decision.simulacro-rollback` y el último check de `trans.deploy-manual`.
//
// El 17/09 se corrió el simulacro contra producción con impacto mínimo: en vez
// de mover el 100% del tráfico como dice el runbook, se mandó el 1% a la
// revisión anterior, se verificó, y se devolvió el 100% a la actual.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-simulacro-rollback.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-simulacro-rollback.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';

const NOTA = `[17/09] Simulacro de rollback CORRIDO contra producción, con impacto mínimo.
Se usó la variante 1 de DEPLOYMENT.md (mover el tráfico sin redesplegar), pero con 1% en vez del 100%: la idea era probar el mecanismo, no que la API vieja atendiera a los clientes.
- 15:47 — \`gcloud run services update-traffic orbita-api --to-revisions=orbita-api-00117-ndg=1,orbita-api-00118-7lv=99\`. Cloud Run tardó ~40 s en reenrutar.
- Verificación con el reparto ya aplicado (1% / 99%): 20 requests a https://api.orbita.site/api/v1/health por el dominio real → 20/20 en 200 con \`{"status":"ok"}\`, latencia media 304 ms, máxima 540 ms. Ni un error durante el reparto.
- 15:52 — vuelta con \`--to-revisions=orbita-api-00118-7lv=100\` (~20 s). Reparto final: 100% en orbita-api-00118-7lv, que es la revisión con el fix de cobros (imagen taggeada e5801). 15 requests más al health: 15/15 OK.
Conclusión: el rollback por tráfico funciona y se aplica en menos de un minuto, sin redeploy ni build. Lo corrió Ale (los dos update-traffic) con verificación en el medio.
Lo que este simulacro NO prueba: la variante 2 (redesplegar una imagen anterior por tag) y el caso peliagudo de una migración destructiva, que un rollback de código no revierte (ver DEPLOYMENT.md § Migraciones).`;

const ITEMS = [
  { key: 'hallazgo.rollback-sin-simulacro', estado: 'HECHO', todos: true },
  { key: 'decision.simulacro-rollback', estado: 'HECHO', todos: true },
  // trans.deploy-manual tenía abierto solo el check del rollback probado.
  { key: 'trans.deploy-manual', estado: 'HECHO', todos: true },
];

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  for (const { key, estado } of ITEMS) {
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
    console.log(`${aplicar ? '✔' : '·'} ${key}: ${it.estado} → ${estado}`);
    for (const t of faltaban) console.log(`    marca: ${t}`);

    if (!aplicar) continue;

    await p.platformAuditItem.update({
      where: { id: it.id },
      data: {
        estado,
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

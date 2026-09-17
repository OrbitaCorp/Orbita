// Cierra `hallazgo.secretos-tarball-cloud-build` con la evidencia del barrido del
// 17/09, y deja anotado en `decision.rotar-postgres` que su motivo original cayó.
//
// El hallazgo daba por probable que apps/api/.env.bak2 (24/07, con DATABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, GOOGLE_CLIENT_SECRET y MAIL_PASS) viajara
// en el tarball de fuentes de cada `gcloud builds submit`. Se revisaron los 115
// tarballs del bucket: ninguno tiene un .env. Evidencia completa en
// scripts/auditoria/evidencia/tarballs-cloudbuild-17-09.txt.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/cerrar-secretos-tarball.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/cerrar-secretos-tarball.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';

const NOTA_HALLAZGO = `[17/09] DESCARTADO CON EVIDENCIA: la fuga nunca ocurrió.
Se descargaron los 115 tarballs de gs://orbita-api-corp_cloudbuild/source/ —- todos los que existen, del 31/08 (primer deploy a Cloud Run) al 17/09 —- y se listó el contenido de cada uno buscando cualquier archivo .env*. Resultado: 115 revisados, 0 con .env, 0 errores de descarga. Listado completo en scripts/auditoria/evidencia/tarballs-cloudbuild-17-09.txt.
Por qué falló la hipótesis: el ítem razonaba sobre el .gitignore de apps/api, que efectivamente solo excluye .env, .env.local y .env.*.local, y no cubre .env.bak2. Pero el .gitignore de la RAÍZ del repo tiene \`.env*\`, y gcloud lo respeta: el archivo nunca entró al tarball.
Qué queda de los checks abiertos:
- "Revisados los tarballs y borrados los que tengan el archivo": revisados los 115, ninguno lo tiene, no hay nada que borrar.
- "Rotados los valores que sigan en uso": no hace falta por esta vía. Los secretos nunca salieron al bucket. Si igual se rotan es por precaución general, no como respuesta a una exposición (ver \`decision.rotar-postgres\`).
- "Borrado apps/api/.env.bak2": el archivo sigue en la máquina de Ale (1713 bytes, 24/07). Es higiene local, no exposición; el .gcloudignore del 10/09 ya garantiza que no suba.
El .gcloudignore y el procedimiento de rotación de DEPLOYMENT.md (commit 7701c) se dejan como estaban: siguen siendo la red que evita que esto pase de verdad más adelante.`;

const NOTA_DECISION = `[17/09] OJO, cambió el contexto: el motivo que originó esta decisión quedó DESMENTIDO.
Se revisaron los 115 tarballs de Cloud Build y ninguno contiene un .env (ver \`hallazgo.secretos-tarball-cloud-build\` y scripts/auditoria/evidencia/tarballs-cloudbuild-17-09.txt): la contraseña de Postgres nunca se expuso por esa vía.
Rotarla igual sigue siendo defendible como higiene periódica, pero ya no es urgente ni es la respuesta a una fuga. La decisión queda abierta para que Ale confirme si la sostiene con ese criterio o la cierra como "no se hace".`;

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  const h = await p.platformAuditItem.findFirst({
    where: { key: 'hallazgo.secretos-tarball-cloud-build' },
    select: { id: true, estado: true, checks: true, notas: true },
  });
  if (h) {
    // Solo se marca lo que de verdad se hizo: el barrido de los tarballs. Los otros
    // dos checks (rotar los valores, borrar .env.bak2) quedan SIN marcar a propósito:
    // no se rotó nada ni se borró el archivo, y marcarlos sería mentirle al tablero.
    // El ítem igual pasa a HECHO porque el riesgo que describía no existió.
    const checks = (h.checks ?? []).map((c) =>
      /revisad|tarball/i.test(c.texto) ? { ...c, hecho: true } : c,
    );
    console.log(`${aplicar ? '✔' : '·'} hallazgo.secretos-tarball-cloud-build: ${h.estado} → HECHO (descartado con evidencia)`);
    for (const c of checks.filter((x) => x.hecho && !(h.checks ?? []).find((o) => o.id === x.id)?.hecho))
      console.log(`    marca: ${c.texto}`);
    for (const c of checks.filter((x) => !x.hecho))
      console.log(`    queda SIN marcar (a propósito): ${c.texto}`);
    if (aplicar) {
      await p.platformAuditItem.update({
        where: { id: h.id },
        data: {
          estado: 'HECHO',
          checks,
          notas: `${h.notas ? `${h.notas}\n\n` : ''}${NOTA_HALLAZGO}`,
          actualizadoPorId: CPO,
          hechoPorId: CPO,
          hechoAt: new Date(),
        },
      });
    }
  } else {
    console.log('no existe el ítem hallazgo.secretos-tarball-cloud-build');
  }

  // La decisión NO se cierra: la toma Ale. Solo se le anota que el motivo cayó.
  const d = await p.platformAuditItem.findFirst({
    where: { key: 'decision.rotar-postgres' },
    select: { id: true, estado: true, notas: true },
  });
  if (d) {
    console.log(`${aplicar ? '✔' : '·'} decision.rotar-postgres: queda ${d.estado}, se le agrega la nota del contexto`);
    if (aplicar) {
      await p.platformAuditItem.update({
        where: { id: d.id },
        data: {
          notas: `${d.notas ? `${d.notas}\n\n` : ''}${NOTA_DECISION}`,
          actualizadoPorId: CPO,
        },
      });
    }
  } else {
    console.log('no existe el ítem decision.rotar-postgres');
  }

  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

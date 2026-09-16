// Baja las decisiones que se tomaron en la pantalla "Decisiones" al hallazgo
// del que sale cada una, para que el tablero no tenga la decisión en un lado y
// el pendiente en otro. Dos efectos:
//
//   - NO_HACER  → el hallazgo queda HECHO con los checks tildados y una nota
//     que dice que se cerró POR DECISIÓN, no porque se haya hecho el trabajo.
//     Es la diferencia entre "riesgo aceptado" y "pendiente que nadie mira".
//   - HACER     → el hallazgo NO se toca. Solo se le agrega la nota con la
//     decisión y lo que haya escrito quien decidió, para que el que lo agarre
//     sepa con qué criterio trabajar.
//
// Uso (desde apps/api):
//   node --env-file=.env scripts/auditoria/aplicar-decisiones.cjs        → muestra qué haría
//   node --env-file=.env scripts/auditoria/aplicar-decisiones.cjs --si   → lo aplica
const { PrismaClient } = require('@prisma/client');

const CPO = '7af5fdc3-a10f-435d-8d4f-d8c4d0592f23';
const HOY = new Date().toISOString().slice(0, 10);

const LABEL = { HACER: 'SE HACE', NO_HACER: 'NO SE HACE', HABLAR: 'A HABLAR' };

(async () => {
  const p = new PrismaClient();
  const aplicar = process.argv.includes('--si');

  const decisiones = await p.platformAuditItem.findMany({
    where: { key: { startsWith: 'decision.' }, decision: { not: null } },
    orderBy: { orden: 'asc' },
    select: { key: true, titulo: true, informe: true, decision: true, decisionNota: true, decisionPor: { select: { name: true } } },
  });

  for (const d of decisiones) {
    // El hallazgo relacionado está escrito en el informe del ítem de decisión.
    const m = /\*\*Ítem relacionado:\*\* `([^`]+)`/.exec(d.informe ?? '');
    if (!m) {
      console.log(`- ${d.key}: sin ítem relacionado (${LABEL[d.decision]}), no hay dónde bajarlo`);
      continue;
    }
    const rel = await p.platformAuditItem.findUnique({ where: { key: m[1] }, select: { id: true, key: true, estado: true, notas: true, checks: true } });
    if (!rel) {
      console.log(`- ${d.key}: el relacionado ${m[1]} no existe`);
      continue;
    }

    const quien = d.decisionPor?.name ?? 'el equipo';
    const nota = [
      `[${HOY}] DECISIÓN — ${LABEL[d.decision]} (la tomó ${quien} en la pantalla Decisiones, ítem \`${d.key}\`).`,
      d.decisionNota ? `Con esta indicación: "${d.decisionNota.trim()}"` : null,
      d.decision === 'NO_HACER'
        ? 'El ítem se cierra POR DECISIÓN, no porque se haya hecho el trabajo: es un riesgo aceptado a conciencia, no un pendiente que nadie mira. Si el criterio cambia, se reabre.'
        : 'El hallazgo sigue abierto: la decisión es hacerlo, el trabajo todavía no está.',
    ].filter(Boolean).join('\n');

    const cerrar = d.decision === 'NO_HACER' && rel.estado !== 'HECHO';
    console.log(`${aplicar ? '✔' : '·'} ${rel.key}: ${LABEL[d.decision]}${cerrar ? ` — ${rel.estado} → HECHO (cerrado por decisión)` : ' — solo se anota'}`);

    if (!aplicar) continue;
    await p.platformAuditItem.update({
      where: { id: rel.id },
      data: {
        notas: `${rel.notas ?? ''}\n\n${nota}`.trim(),
        actualizadoPorId: CPO,
        ...(cerrar
          ? { estado: 'HECHO', checks: rel.checks.map((c) => ({ ...c, hecho: true })), hechoPorId: CPO, hechoAt: new Date() }
          : {}),
      },
    });
  }

  if (!aplicar) console.log('\n(prueba en seco: correr con --si para aplicarlo)');
  await p.$disconnect();
})();

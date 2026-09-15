// Registra la renovación manual de un dominio comprado desde el panel (hallazgo
// `dominios-comprados-sin-renovacion`, decidido el 15/09). Soporte renueva el
// dominio en la cuenta de Vercel de OrbitaCorp y después corre esto para correr
// custom_domains.expires_at. Sin este paso, el aviso nocturno
// (src/domains/domain-expiry.service.ts) seguiría avisando con la fecha vieja.
//
// La base del .env es PRODUCCIÓN. Por eso, desde apps/api:
//   node --env-file=.env scripts/dominios/registrar-renovacion.cjs --dominio mitienda.com --hasta 2027-10-15        → muestra qué haría
//   node --env-file=.env scripts/dominios/registrar-renovacion.cjs --dominio mitienda.com --hasta 2027-10-15 --si   → lo aplica
//
// --hasta AAAA-MM-DD es la forma preferida: la fecha de vencimiento que muestra
// Vercel después de renovar. --anios N (1 a 10) suma años calendario a la fecha
// que figura hoy (no a la de hoy: una renovación anticipada no pierde los días
// que quedaban) y sirve si no se tiene la fecha a mano.
//
// Solo toca expires_at de ESE dominio, y solo si es comprado (PURCHASED): el
// vencimiento de un dominio propio vinculado lo maneja su dueño.
const { PrismaClient } = require('@prisma/client');

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const fmt = (d) => (d ? d.toISOString().slice(0, 10) : 'sin fecha');

function fallar(mensaje) {
  console.error(mensaje);
  process.exitCode = 1;
}

(async () => {
  const dominio = (arg('dominio') || '').trim().toLowerCase();
  const hasta = arg('hasta');
  const anios = arg('anios');
  const aplicar = process.argv.includes('--si');
  if (!dominio || (!hasta && !anios)) {
    return fallar('Uso: --dominio <dominio> (--hasta AAAA-MM-DD | --anios <1-10>) [--si]');
  }

  const p = new PrismaClient();
  try {
    const d = await p.customDomain.findUnique({
      where: { domain: dominio },
      select: { id: true, domain: true, source: true, status: true, expiresAt: true, business: { select: { name: true, subdomain: true } } },
    });
    if (!d) return fallar(`No existe el dominio ${dominio} en custom_domains.`);
    if (d.source !== 'PURCHASED') return fallar(`${dominio} no es un dominio comprado por Órbita (${d.source}): su vencimiento lo maneja el dueño.`);

    let nueva;
    if (hasta) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return fallar('--hasta tiene que ser AAAA-MM-DD.');
      // Mediodía UTC: cae el mismo día calendario en Argentina.
      nueva = new Date(`${hasta}T12:00:00Z`);
      if (Number.isNaN(nueva.getTime()) || fmt(nueva) !== hasta) return fallar(`--hasta ${hasta} no es una fecha válida.`);
    } else {
      const n = Number(anios);
      if (!Number.isInteger(n) || n < 1 || n > 10) return fallar('--anios tiene que ser un entero entre 1 y 10.');
      if (!d.expiresAt) return fallar(`${dominio} no tiene fecha de vencimiento cargada: usá --hasta con la fecha de Vercel.`);
      nueva = new Date(d.expiresAt);
      nueva.setUTCFullYear(nueva.getUTCFullYear() + n);
    }

    if (d.expiresAt && nueva.getTime() <= d.expiresAt.getTime()) {
      return fallar(`La fecha nueva (${fmt(nueva)}) no es posterior a la que figura (${fmt(d.expiresAt)}).`);
    }
    if (d.expiresAt && d.expiresAt.getTime() < Date.now() && !hasta) {
      console.log('Ojo: figuraba vencido. Confirmá en Vercel la fecha real y preferí --hasta.');
    }

    console.log(`${aplicar ? '✔' : '·'} ${d.domain} (${d.business.name}, ${d.status}): vence ${fmt(d.expiresAt)} → ${fmt(nueva)}`);
    if (!aplicar) {
      console.log('\n(prueba en seco: correr con --si para aplicarlo)');
      return;
    }
    await p.customDomain.update({ where: { id: d.id }, data: { expiresAt: nueva } });
    console.log('Listo: el aviso nocturno ya toma la fecha nueva.');
  } finally {
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

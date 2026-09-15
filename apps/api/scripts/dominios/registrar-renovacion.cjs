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
// Se usa UNA de las dos opciones:
//   --hasta AAAA-MM-DD  la fecha de vencimiento que muestra Vercel después de
//                       renovar (la forma preferida). Tiene que ser futura,
//                       posterior a la que figura y a menos de 10 años.
//   --anios N           (1 a 10) suma años calendario a la fecha que figura hoy,
//                       no a la de hoy: una renovación anticipada no pierde los
//                       días que quedaban. Un 29/02 hacia un año no bisiesto
//                       queda en 28/02, como en el registrador.
//
// Solo toca expires_at de ESE dominio, y solo si es comprado (PURCHASED): el
// vencimiento de un dominio propio vinculado lo maneja su dueño.
const { PrismaClient } = require('@prisma/client');

const MAX_ANIOS = 10;

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const fmt = (d) => (d ? d.toISOString().slice(0, 10) : 'sin fecha');

// Misma regla que src/common/utils/fechas.ts#sumarAniosCalendario (este script
// es CommonJS y no puede importar el TypeScript de src).
function sumarAniosCalendario(fecha, anios) {
  const resultado = new Date(fecha.getTime());
  const mes = resultado.getUTCMonth();
  resultado.setUTCFullYear(resultado.getUTCFullYear() + anios);
  if (resultado.getUTCMonth() !== mes) resultado.setUTCDate(0);
  return resultado;
}

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
  if (hasta && anios) {
    return fallar('Usá --hasta o --anios, no los dos a la vez.');
  }

  const p = new PrismaClient();
  try {
    const d = await p.customDomain.findUnique({
      where: { domain: dominio },
      select: { id: true, domain: true, source: true, status: true, expiresAt: true, business: { select: { name: true, subdomain: true } } },
    });
    if (!d) return fallar(`No existe el dominio ${dominio} en custom_domains.`);
    if (d.source !== 'PURCHASED') return fallar(`${dominio} no es un dominio comprado por Órbita (${d.source}): su vencimiento lo maneja el dueño.`);

    const ahora = new Date();
    let nueva;
    if (hasta) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return fallar('--hasta tiene que ser AAAA-MM-DD.');
      // Mediodía UTC: cae el mismo día calendario en Argentina.
      nueva = new Date(`${hasta}T12:00:00Z`);
      if (Number.isNaN(nueva.getTime()) || fmt(nueva) !== hasta) return fallar(`--hasta ${hasta} no es una fecha válida.`);
      if (nueva.getTime() <= ahora.getTime()) return fallar(`--hasta ${hasta} no es una fecha futura.`);
      const tope = sumarAniosCalendario(d.expiresAt && d.expiresAt > ahora ? d.expiresAt : ahora, MAX_ANIOS);
      if (nueva.getTime() > tope.getTime()) {
        return fallar(`--hasta ${hasta} queda a más de ${MAX_ANIOS} años (tope ${fmt(tope)}): revisá el año.`);
      }
    } else {
      const n = Number(anios);
      if (!Number.isInteger(n) || n < 1 || n > MAX_ANIOS) return fallar(`--anios tiene que ser un entero entre 1 y ${MAX_ANIOS}.`);
      if (!d.expiresAt) return fallar(`${dominio} no tiene fecha de vencimiento cargada: usá --hasta con la fecha de Vercel.`);
      nueva = sumarAniosCalendario(d.expiresAt, n);
      if (nueva.getTime() <= ahora.getTime()) {
        return fallar(`Sumando ${n} año(s) a ${fmt(d.expiresAt)} queda ${fmt(nueva)}, que ya pasó: usá --hasta con la fecha de Vercel.`);
      }
    }

    if (d.expiresAt && nueva.getTime() <= d.expiresAt.getTime()) {
      return fallar(`La fecha nueva (${fmt(nueva)}) no es posterior a la que figura (${fmt(d.expiresAt)}).`);
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

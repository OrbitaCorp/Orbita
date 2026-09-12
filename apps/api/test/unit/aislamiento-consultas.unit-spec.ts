import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';

// Red de seguridad del aislamiento entre negocios (auditoría interna
// 2026-09-09, ítem `api.prisma`).
//
// 40 de los 66 modelos llevan `businessId`, y que los datos de un negocio no
// se mezclen con los de otro no lo garantiza ninguna capa: lo garantiza cada
// consulta, una por una, ~440 veces. Alcanza con que UNA salga sin el filtro
// para abrir un agujero — que es exactamente lo que pasó dos veces en la
// misma semana con Orbi (el contexto del prompt y la conversación del panel).
//
// Este test recorre las consultas a Prisma de `src/` y falla cuando aparece
// una nueva sin filtro de negocio en un lugar que no está justificado acá
// abajo. NO dice que el código sea correcto: dice "esto es nuevo, miralo".
//
// Cómo se arregla cuando falla:
//   1. Si la consulta debería filtrar por negocio → agregale `businessId` al
//      where. Es el caso normal y es el motivo por el que existe el test.
//   2. Si de verdad no corresponde (un token que se busca por su hash, el
//      perfil propio con el id del token, algo cross-tenant del super admin),
//      sumá el archivo a EXCEPCIONES con el motivo, o subile el número.

const RAIZ = join(__dirname, '..', '..');
const SRC = join(RAIZ, 'src');

// Archivos donde hay consultas sin filtro de negocio POR UN MOTIVO, con
// cuántas hay hoy. El número es un techo: si sube, el test falla y hay que
// mirar la que se agregó.
const EXCEPCIONES: Record<string, { max: number; motivo: string }> = {
  'src/auth/auth.service.ts': { max: 18, motivo: 'Tokens buscados por su hash (único global), sesiones por userId+tipo, y el perfil propio con el id del token' },
  'src/me/me.service.ts': { max: 5, motivo: 'Perfil del cliente: el id sale del token, no de la URL; al cambiar la contraseña se revocan sus sesiones por userId+tipo (como auth.service)' },
  'src/member-profile/member-profile.service.ts': { max: 5, motivo: 'Perfil del miembro: el id sale del token; al cambiar la contraseña se revocan sus sesiones por userId+tipo (como auth.service), sin filtrar por businessId porque refresh_tokens.business_id puede venir null' },
  'src/platform/platform.service.ts': { max: 6, motivo: 'Super admin: es cross-tenant por diseño, detrás de PlatformAdminGuard' },
  'src/subscriptions/subscriptions.service.ts': { max: 4, motivo: 'Crons de reconciliación y de avisos del ciclo de vida: recorren las suscripciones de todos los negocios' },
  'src/onboarding/onboarding.service.ts': { max: 2, motivo: 'Alta: todavía no hay negocio, y el email de dueño es único en toda la plataforma' },
  'src/domains/domain-purchase.service.ts': { max: 3, motivo: 'Webhook de pago: la orden se identifica por el id que mandó Mercado Pago; y el checkout mira si el dominio ya está vinculado en CUALQUIER negocio (custom_domains.domain es único global)' },
  'src/reviews/reviews.service.ts': { max: 2, motivo: 'Reseñas públicas de un producto: el producto es la unidad, no el negocio' },
  'src/games/games-play.service.ts': { max: 1, motivo: 'El juego se resuelve desde una sesión que el caller ya verificó' },
  'src/mercadopago/mercadopago.service.ts': { max: 1, motivo: 'Webhook de OAuth: la credencial se identifica por el usuario de Mercado Pago' },
  'src/storefront/storefront.service.ts': { max: 1, motivo: 'Helper que recibe el where ya armado por quien lo llama' },
};

const OPS = ['findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany', 'update', 'delete'];

function modelosConNegocio(): Set<string> {
  const schema = readFileSync(join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const conNegocio = new Set<string>();
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    if (/^\s*businessId\s/m.test(m[2])) {
      conNegocio.add(m[1].charAt(0).toLowerCase() + m[1].slice(1)); // como se accede desde el cliente
    }
  }
  return conNegocio;
}

function archivosTs(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) salida.push(...archivosTs(p));
    else if (p.endsWith('.ts') && !p.includes('.spec.')) salida.push(p);
  }
  return salida;
}

interface Consulta { file: string; linea: number; modelo: string; op: string }

// Firma de método a nivel clase (dos espacios de indentación).
const FIRMA = /^ {2}(?:(?:private|public|protected|static|async|\*)\s+)*[A-Za-z_$][\w$]*\s*[(<]/;

function consultasSinFiltro(): Consulta[] {
  const conNegocio = modelosConNegocio();
  const re = new RegExp('(?:prisma|tx)[.](\\w+)[.](' + OPS.join('|') + ')[(]', 'g');
  const salida: Consulta[] = [];

  for (const abs of archivosTs(SRC)) {
    const src = readFileSync(abs, 'utf8');
    const lineas = src.split('\n');
    const file = abs.slice(RAIZ.length + 1).split(sep).join('/');

    for (const m of src.matchAll(re)) {
      const [, acceso, op] = m;
      if (!conNegocio.has(acceso)) continue;

      // Argumento balanceado de la llamada.
      let i = (m.index ?? 0) + m[0].length;
      let prof = 1;
      let arg = '';
      while (i < src.length && prof > 0) {
        const c = src[i];
        if (c === '(') prof++;
        else if (c === ')') prof--;
        if (prof > 0) arg += c;
        i++;
      }
      if (/businessId|business_id|business:\s*\{/.test(arg)) continue;

      // Segunda oportunidad: si el método que la contiene ya usó businessId
      // antes (el patrón updateMany({id, businessId}) + findUnique({id})),
      // la llamada por id es segura.
      const linea = src.slice(0, m.index).split('\n').length;
      let ini = 0;
      for (let j = linea - 1; j >= 0; j--) {
        if (FIRMA.test(lineas[j])) { ini = j; break; }
      }
      if (/businessId/.test(lineas.slice(ini, linea).join('\n'))) continue;

      salida.push({ file, linea, modelo: acceso, op });
    }
  }
  return salida;
}

describe('Aislamiento entre negocios — consultas a Prisma', () => {
  const sinFiltro = consultasSinFiltro();

  it('no hay consultas sin filtro de negocio en archivos no justificados', () => {
    const nuevas = sinFiltro.filter((c) => !EXCEPCIONES[c.file]);
    const detalle = nuevas.map((c) => `${c.file}:${c.linea} ${c.modelo}.${c.op}`).join('\n');
    expect(detalle).toBe('');
  });

  it('ningún archivo justificado sumó consultas nuevas sin filtro', () => {
    const cuenta: Record<string, number> = {};
    for (const c of sinFiltro) cuenta[c.file] = (cuenta[c.file] ?? 0) + 1;

    const excedidos = Object.entries(EXCEPCIONES)
      .filter(([file, { max }]) => (cuenta[file] ?? 0) > max)
      .map(([file, { max }]) => `${file}: ${cuenta[file]} > ${max} permitidas`);
    expect(excedidos).toEqual([]);
  });

  it('la lista de excepciones no tiene entradas de más', () => {
    const cuenta: Record<string, number> = {};
    for (const c of sinFiltro) cuenta[c.file] = (cuenta[c.file] ?? 0) + 1;

    // Si un archivo bajó su número o dejó de tener consultas sin filtro, se
    // ajusta acá: la lista tiene que reflejar la realidad, no un histórico.
    const sobrantes = Object.keys(EXCEPCIONES).filter((f) => (cuenta[f] ?? 0) === 0);
    expect(sobrantes).toEqual([]);
  });

  it('el barrido encuentra consultas (si no, el test no está mirando nada)', () => {
    expect(sinFiltro.length).toBeGreaterThan(20);
  });
});

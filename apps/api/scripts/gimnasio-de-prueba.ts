// El negocio de prueba de Gimnasio en la base de DEV (tarea del 06/11 del plan
// de Gimnasio, super admin → Módulos): un negocio con su dueño, la config de
// reservas de GIMNASIO y dos clases como recursos CLASE con cupo, para probar
// el panel de Gimnasio contra la API (/gimnasio-demo/panel?origen=api).
//
// Nunca toca producción: antes de conectar verifica que DATABASE_URL sea la
// base de dev y no la de producción, sin imprimir la URL. Se puede correr las
// veces que haga falta: no duplica nada.
//
// Dos partes:
//   1. El negocio y su dueño, con Prisma y igual que el alta (sucursal, roles
//      de fábrica con sus permisos, config del negocio y de la tienda): el alta
//      real todavía muestra Gimnasio como "Próximamente". El rubro va como en
//      Tienda: industry "gimnasio" y el subrubro en subrubros.
//   2. La config de reservas y las clases, por la API local (PUT
//      /reservas/config y POST /reservas/recursos) con la sesión del dueño: así
//      pasan por las mismas validaciones que el panel. Hace falta la API
//      corriendo contra la misma base.
//
// Desde apps/api, con la API levantada en localhost:3000:
//   GIMNASIO_PRUEBA_CLAVE=<8 caracteres o más> pnpm exec ts-node scripts/gimnasio-de-prueba.ts
// La clave del dueño de prueba no está en el repo: es la que se pasa ahí (y la
// que se usa para entrar al panel). Lee el .env de apps/api (o ENV_FILE).
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/common/permisos/catalogo';

dotenv.config({ path: process.env.ENV_FILE ?? '.env', quiet: true } as dotenv.DotenvConfigOptions);

const REF_DEV = 'hhaqlzrcskmwnvhgydon';
const REF_PRODUCCION = 'dgergykdihtvsglfumsb';
const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';

const NEGOCIO = { nombre: 'Gimnasio de prueba', subdominio: 'gimnasio-prueba', rubro: 'gimnasio', subrubro: 'crossfit' };
const DUENO = { nombre: 'Dueño de prueba', email: 'dueno@gimnasio-prueba.orbita.test' };

// Los roles de fábrica, como los crea el alta (onboarding.service.ts): Propietario con todo y Empleado sin configurar.
const ROLES: { name: string; color: string; permisos: string[] }[] = [
  { name: 'owner', color: '#3B82F6', permisos: PERMISSIONS.map((p) => p.code) },
  {
    name: 'empleado', color: '#10B981',
    permisos: ['orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view', 'messages.view', 'messages.manage', 'reservas.view', 'reservas.manage'],
  },
];

// Lunes a sábado de 07:00 a 22:00 (minutos de Argentina; en la API el 0 es el domingo), como el negocio de ejemplo de la demo.
const HORARIO = Object.fromEntries(['1', '2', '3', '4', '5', '6'].map((d) => [d, [[7 * 60, 22 * 60]]]));
const CONFIG = {
  modulo: 'GIMNASIO', horario: HORARIO, confirmacion: 'AUTOMATICA', listaDeEspera: true, retencionMinutos: 10,
  anticipacionMinimaMinutos: 30, anticipacionMaximaDias: 14, cancelacionHastaHoras: 2, reprogramacionHastaHoras: 2,
  maximoActivasPorCliente: 0, senaPorcentaje: 0,
};

// Dos clases, cada una un recurso CLASE con una sesión semanal y lo de Gimnasio en datos.gimnasio
// (ver apps/web/src/modules/gimnasio/datos/origen/mapear.ts). La de Halterofilia tiene cupo 3: se llena rápido y deja probar la espera.
const CLASES = [
  { nombre: 'WOD', duracionMinutos: 60, cupo: 12, horario: { '1': [[19 * 60, 20 * 60]] }, gimnasio: { actividadId: 'a1', color: '#2563EB', profeId: 'p1', profe: 'Nico', sala: 'Box' } },
  { nombre: 'Halterofilia', duracionMinutos: 60, cupo: 3, horario: { '3': [[18 * 60, 19 * 60]] }, gimnasio: { actividadId: 'a3', color: '#059669', profeId: 'p2', profe: 'Seba', sala: 'Box' } },
];

function fallar(motivo: string): never {
  console.error(`✗ ${motivo}`);
  process.exit(1);
}

/** Solo la base de dev: se mira el ref del proyecto en las dos URLs, sin imprimirlas. */
function verificarBase() {
  const urls = [process.env.DATABASE_URL ?? '', process.env.DIRECT_URL ?? ''];
  if (urls.some((u) => u.includes(REF_PRODUCCION))) fallar('Esta base es la de PRODUCCIÓN. El negocio de prueba va solo en dev.');
  if (!urls[0].includes(REF_DEV)) fallar('DATABASE_URL no es la base de dev: no se toca nada.');
  console.log('✓ Base de dev');
}

async function negocioYDueno(prisma: PrismaClient, clave: string) {
  for (const p of PERMISSIONS) await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  const negocio = await prisma.business.upsert({
    where: { subdomain: NEGOCIO.subdominio },
    update: {},
    create: { name: NEGOCIO.nombre, industry: NEGOCIO.rubro, subrubros: [NEGOCIO.subrubro], subdomain: NEGOCIO.subdominio, mode: 'FULL', isActive: true },
  });
  if (!(await prisma.branch.findFirst({ where: { businessId: negocio.id, isDefault: true } }))) {
    await prisma.branch.create({ data: { businessId: negocio.id, name: 'Principal', isDefault: true } });
  }
  const roles: Record<string, string> = {};
  for (const def of ROLES) {
    const rol = (await prisma.role.findFirst({ where: { businessId: negocio.id, name: def.name } }))
      ?? (await prisma.role.create({ data: { businessId: negocio.id, name: def.name, color: def.color, isDefault: true } }));
    roles[def.name] = rol.id;
    const permisos = await prisma.permission.findMany({ where: { code: { in: def.permisos } } });
    for (const p of permisos) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: rol.id, permissionId: p.id } }, update: {}, create: { roleId: rol.id, permissionId: p.id } });
    }
  }
  const passwordHash = await argon2.hash(clave, { type: argon2.argon2id });
  await prisma.member.upsert({
    where: { businessId_email: { businessId: negocio.id, email: DUENO.email } },
    update: { passwordHash, status: 'ACTIVE', hasTempPassword: false, emailVerified: true },
    create: { businessId: negocio.id, name: DUENO.nombre, email: DUENO.email, roleId: roles.owner, status: 'ACTIVE', hasTempPassword: false, passwordHash, emailVerified: true },
  });
  await prisma.businessConfig.upsert({ where: { businessId: negocio.id }, update: {}, create: { businessId: negocio.id, acceptsMercadopago: false, acceptsCash: true, acceptsTransfer: true, acceptsPickup: false } });
  await prisma.storefrontConfig.upsert({ where: { businessId: negocio.id }, update: {}, create: { businessId: negocio.id, storeName: NEGOCIO.nombre, colorMode: 'light' } });
  await prisma.notificationConfig.upsert({ where: { businessId: negocio.id }, update: {}, create: { businessId: negocio.id, matrix: {} } });
  console.log(`✓ Negocio ${NEGOCIO.subdominio} y su dueño ${DUENO.email}`);
}

async function llamar<T>(ruta: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
  });
  const cuerpo = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (!res.ok) fallar(`${init.method ?? 'GET'} ${ruta} → ${res.status}: ${JSON.stringify(cuerpo?.message ?? cuerpo)}`);
  return cuerpo as T;
}

type Recurso = { id: string; nombre: string; cupo: number; duracionMinutos: number; horario: Record<string, number[][]> | null; datos: unknown };

async function configYClases(clave: string) {
  const { token } = await llamar<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: DUENO.email, password: clave }) });
  await llamar('/reservas/config', { method: 'PUT', token, body: JSON.stringify(CONFIG) });
  console.log('✓ Config de reservas de GIMNASIO (lunes a sábado de 7 a 22, con lista de espera)');
  const hay = await llamar<Recurso[]>('/reservas/recursos?modulo=GIMNASIO', { token });
  for (const c of CLASES) {
    if (hay.some((r) => r.nombre === c.nombre)) continue;
    const { gimnasio, ...resto } = c;
    await llamar('/reservas/recursos', { method: 'POST', token, body: JSON.stringify({ modulo: 'GIMNASIO', tipo: 'CLASE', ...resto, datos: { gimnasio } }) });
  }
  const recursos = await llamar<Recurso[]>('/reservas/recursos?modulo=GIMNASIO', { token });
  console.log('✓ GET /reservas/recursos?modulo=GIMNASIO:');
  for (const r of recursos) console.log(`  - ${r.nombre}: cupo ${r.cupo}, ${r.duracionMinutos} min, sesiones ${JSON.stringify(r.horario)}, datos ${JSON.stringify(r.datos)}`);
}

async function main() {
  const clave = process.env.GIMNASIO_PRUEBA_CLAVE ?? '';
  if (clave.length < 8) fallar('Falta GIMNASIO_PRUEBA_CLAVE (8 caracteres o más): es la clave del dueño de prueba.');
  verificarBase();
  const prisma = new PrismaClient();
  try {
    await negocioYDueno(prisma, clave);
  } finally {
    await prisma.$disconnect();
  }
  await configYClases(clave);
  console.log(`Listo. Panel: entrá en http://localhost:3001/login con ${DUENO.email} y abrí /gimnasio-demo/panel?origen=api`);
}

void main();

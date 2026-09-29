// ─── Seed de la demo pública de Órbita (demo.orbita.site) ───────────────────
//
// Crea (o actualiza) el negocio demo: una tienda real con Business.isDemo que
// cualquiera recorre sin cuenta. Ver apps/web/src/lib/demo/modo.ts para el
// recorrido y apps/api/src/common/guards/demo.guard.ts para la garantía de
// que ningún visitante escribe sobre estos datos.
//
// Idempotente: correrlo de nuevo no duplica nada. "demo" es un subdominio
// reservado (common/utils/subdominio.ts), así que ningún negocio real puede
// tomarlo: el alta se hace acá, replicando lo que arma
// OnboardingService.registerBusiness.
//
// Uso (desde apps/api):
//   DEMO_OWNER_PASSWORD='...' pnpm seed:demo            (negocio + contenido)
//   pnpm seed:demo -- --solo-base                       (solo el negocio)
//
// DEMO_OWNER_PASSWORD es la contraseña del dueño de la demo: la cuenta con la
// que se cura la tienda desde el panel real (login con EMAIL_DUENO). Hace
// falta la primera vez; después, pasarla de nuevo la cambia — es la forma de
// "recuperarla", porque el email del dueño no es una casilla real. Nunca se
// imprime ni se guarda en el repo.

process.loadEnvFile?.();

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { sembrarContenido } from './demo/sembrar';
import { sembrarApariencia } from './demo/apariencia';

const prisma = new PrismaClient();

const SLUG = 'demo';
const NOMBRE = 'Nébula Tech';
// Solo sirve para loguearse: no es una casilla real (dominio .invalid, RFC
// 2606 — ningún mail sale). Tiene que ser propio de la demo porque el email
// de un member es único en TODA la plataforma (ver registerBusiness).
const EMAIL_DUENO = 'dueno@demo.invalid';
// El visitante no tiene contraseña: nunca loguea, solo recibe tokens de
// AuthService.demoSession. Dominio .invalid (RFC 2606): ningún mail sale.
const EMAIL_VISITANTE = 'visitante@demo.invalid';

// Mismo catálogo que onboarding.service.ts (ver el comentario de duplicado
// deliberado en prisma/seed.ts). El dueño y el visitante tienen TODOS los
// permisos: el visitante tiene que poder abrir cada pantalla del panel.
const PERMISOS: Array<{ group: string; code: string; label: string }> = [
  { group: 'Pedidos', code: 'orders.view', label: 'Ver pedidos' },
  { group: 'Pedidos', code: 'orders.manage', label: 'Gestionar pedidos' },
  { group: 'Pedidos', code: 'orders.export', label: 'Exportar pedidos' },
  { group: 'Clientes', code: 'customers.view', label: 'Ver clientes' },
  { group: 'Clientes', code: 'customers.manage', label: 'Gestionar clientes' },
  { group: 'Reportes', code: 'reports.view', label: 'Ver reportes' },
  { group: 'Reportes', code: 'reports.export', label: 'Exportar reportes' },
  { group: 'Reportes', code: 'reports.dashboard', label: 'Ver dashboard' },
  { group: 'Inventario', code: 'inventory.view', label: 'Ver inventario' },
  { group: 'Inventario', code: 'inventory.manage', label: 'Gestionar inventario' },
  { group: 'Descuentos', code: 'discounts.view', label: 'Ver descuentos' },
  { group: 'Descuentos', code: 'discounts.manage', label: 'Gestionar descuentos' },
  { group: 'Configuración', code: 'config.edit', label: 'Editar configuración' },
  { group: 'Configuración', code: 'config.team.view', label: 'Ver equipo' },
  { group: 'Configuración', code: 'config.team.manage', label: 'Gestionar equipo' },
  { group: 'Configuración', code: 'config.audit.view', label: 'Ver auditoría' },
  { group: 'Configuración', code: 'config.domains.manage', label: 'Gestionar dominios' },
  { group: 'Catálogo', code: 'catalog.view', label: 'Ver catálogo' },
  { group: 'Catálogo', code: 'catalog.manage', label: 'Gestionar catálogo' },
  { group: 'Mensajes', code: 'messages.view', label: 'Ver mensajes' },
  { group: 'Mensajes', code: 'messages.manage', label: 'Responder mensajes' },
  { group: 'Avanzado', code: 'advanced.manage', label: 'Gestionar Avanzado' },
];
const PERMISOS_EMPLEADO = [
  'orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view',
  'messages.view', 'messages.manage',
];

async function negocioBase() {
  for (const p of PERMISOS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  const permisos = new Map((await prisma.permission.findMany()).map((p) => [p.code, p.id]));

  let negocio = await prisma.business.findUnique({ where: { subdomain: SLUG } });
  const creadoAhora = !negocio;
  if (!negocio) {
    const password = process.env.DEMO_OWNER_PASSWORD;
    if (!password || password.length < 10) {
      throw new Error('Primera vez: definí DEMO_OWNER_PASSWORD (10+ caracteres) para el dueño de la demo.');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    negocio = await prisma.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: { name: NOMBRE, industry: 'Tecnología', subdomain: SLUG, mode: 'FULL', isActive: true, isDemo: true, subrubros: ['electronica', 'informatica', 'celulares'], operatesOnline: true },
      });
      await tx.branch.create({ data: { businessId: b.id, name: 'Principal', isDefault: true } });
      const roles: Record<string, string> = {};
      for (const [name, color, codes] of [
        ['owner', '#3B82F6', PERMISOS.map((p) => p.code)],
        ['empleado', '#10B981', PERMISOS_EMPLEADO],
      ] as const) {
        const role = await tx.role.create({ data: { businessId: b.id, name, color, isDefault: true } });
        roles[name] = role.id;
        await tx.rolePermission.createMany({
          data: codes.map((c) => permisos.get(c)).filter((id): id is string => !!id).map((permissionId) => ({ roleId: role.id, permissionId })),
        });
      }
      await tx.member.create({
        data: { businessId: b.id, name: 'Equipo Nébula', email: EMAIL_DUENO, roleId: roles.owner, status: 'ACTIVE', passwordHash, emailVerified: true },
      });
      await tx.businessConfig.create({
        data: { businessId: b.id, acceptsMercadopago: true, acceptsCash: true, acceptsTransfer: true, acceptsPickup: true },
      });
      await tx.storefrontConfig.create({
        data: { businessId: b.id, storeName: NOMBRE, colorMode: 'light', showRating: true, showNewBadge: true, showWhatsapp: true, showLowStock: false },
      });
      await tx.notificationConfig.create({
        data: { businessId: b.id, matrix: { nuevo_pedido: { panel: true, email: false }, pago_confirmado: { panel: true, email: false } } },
      });
      return b;
    }, { timeout: 30000 });
    console.log(`Negocio demo creado: ${negocio.id}`);
  } else if (!negocio.isDemo) {
    negocio = await prisma.business.update({ where: { id: negocio.id }, data: { isDemo: true } });
  }
  if (process.env.DEMO_OWNER_PASSWORD && !creadoAhora) {
    const passwordHash = await argon2.hash(process.env.DEMO_OWNER_PASSWORD, { type: argon2.argon2id });
    const { count } = await prisma.member.updateMany({
      where: { businessId: negocio.id, email: EMAIL_DUENO },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    if (count) console.log('Contraseña del dueño de la demo actualizada.');
  }

  // Visitante anónimo: dueño en permisos (ve todo), readOnly (DemoGuard le
  // corta toda escritura). Sin contraseña.
  const owner = await prisma.role.findFirstOrThrow({ where: { businessId: negocio.id, name: 'owner' } });
  await prisma.member.upsert({
    where: { businessId_email: { businessId: negocio.id, email: EMAIL_VISITANTE } },
    update: { readOnly: true, roleId: owner.id, status: 'ACTIVE' },
    create: { businessId: negocio.id, name: 'Visitante de la demo', email: EMAIL_VISITANTE, roleId: owner.id, status: 'ACTIVE', readOnly: true, emailVerified: true },
  });

  // Cortesía sin vencimiento práctico + paquete Avanzado: la demo muestra
  // todo lo que Órbita tiene, sin pantallas de "tu plan venció".
  const ahora = new Date();
  const lejos = new Date(ahora.getFullYear() + 20, 0, 1);
  await prisma.subscription.upsert({
    where: { businessId: negocio.id },
    update: { status: 'ACTIVE', planActive: true, currentPeriodEnd: lejos },
    create: { businessId: negocio.id, origin: 'COMP', status: 'ACTIVE', amount: 0, currentPeriodStart: ahora, currentPeriodEnd: lejos, grantReason: 'Demo pública de Órbita' },
  });
  await prisma.businessAddon.upsert({
    where: { businessId_type: { businessId: negocio.id, type: 'ADVANCED' } },
    update: { isActive: true, expiresAt: null },
    create: { businessId: negocio.id, type: 'ADVANCED', isActive: true },
  });

  // Sin tutorial de primeros pasos: la demo ya está armada. Fase 'terminado'
  // en la etapa 2 = no se muestra nunca (ver tutoriales/estado.ts en apps/web).
  await prisma.business.update({
    where: { id: negocio.id },
    data: { tutorial: { variante: 'checklist', fase: 'terminado', etapa: 2, paso: 0, hechas: [], minimizado: false } },
  });

  // Pagos y envíos: que el checkout muestre lo que Órbita permite (descuento
  // por transferencia y por efectivo, costos por transportista, envío gratis
  // desde un monto). Se pisa en cada corrida, así un cambio acá se aplica
  // re-sembrando. Sin WhatsApp ni redes: un número o usuario inventado podría
  // ser de alguien real.
  await prisma.businessConfig.update({
    where: { businessId: negocio.id },
    data: {
      acceptsMercadopago: true, acceptsCash: true, acceptsTransfer: true, acceptsPickup: true,
      transferDiscountPercent: 10,
      cashDiscountPercent: 5,
      pickupPaymentMethods: ['CASH', 'DEBIT', 'CREDIT', 'MERCADOPAGO'],
      freeShippingFrom: 250000,
      enabledCarriers: ['CORREO_ARGENTINO', 'ANDREANI', 'OCA', 'DELIVERY_APP'],
      carrierShippingCosts: { CORREO_ARGENTINO: 8900, ANDREANI: 11500, OCA: 9800, DELIVERY_APP: 4500 },
      shippingEstimateText: 'Llega en 24 a 72 h',
      scheduleText: 'Lunes a viernes de 9 a 18 h',
    },
  });

  return negocio;
}

async function main() {
  const negocio = await negocioBase();
  // --solo-base: arma el negocio (dueño, visitante, suscripción) sin tocar
  // el contenido. --solo-apariencia: además, logo y diseño del home (rápido,
  // para iterar el diseño). Sin banderas, borra y vuelve a sembrar catálogo,
  // ventas y todo el panel (ver prisma/demo/sembrar.ts) y la apariencia.
  const soloApariencia = process.argv.includes('--solo-apariencia');
  if (!process.argv.includes('--solo-base') && !soloApariencia) await sembrarContenido(prisma, negocio.id);
  if (!process.argv.includes('--solo-base')) await sembrarApariencia(prisma, negocio.id);
  console.log(`Demo lista: ${negocio.subdomain} (${negocio.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

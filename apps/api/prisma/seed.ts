// Seed de datos de prueba para el flujo de Auth.
// Idempotente: correrlo varias veces no duplica ni rompe nada.
//
// Uso: pnpm seed  (o: npx prisma db seed)

process.loadEnvFile?.();

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const TEST_PASSWORD = 'Test1234!';

// ── Catálogo global de permisos (7 grupos, ~19 permisos — ver CONTRATO_API.md §1) ──

const PERMISSIONS: Array<{ group: string; code: string; label: string }> = [
  { group: 'Pedidos', code: 'orders.view', label: 'Ver pedidos' },
  { group: 'Pedidos', code: 'orders.manage', label: 'Gestionar pedidos' },
  { group: 'Pedidos', code: 'orders.export', label: 'Exportar pedidos' },
  { group: 'Clientes', code: 'customers.view', label: 'Ver clientes' },
  { group: 'Clientes', code: 'customers.manage', label: 'Gestionar clientes' },
  { group: 'Reportes', code: 'reports.view', label: 'Ver reportes' },
  { group: 'Reportes', code: 'reports.export', label: 'Exportar reportes' },
  { group: 'Inventario', code: 'inventory.view', label: 'Ver inventario' },
  { group: 'Inventario', code: 'inventory.manage', label: 'Gestionar inventario' },
  { group: 'Catálogo', code: 'catalog.view', label: 'Ver catálogo' },
  { group: 'Catálogo', code: 'catalog.manage', label: 'Gestionar catálogo' },
  { group: 'Descuentos', code: 'discounts.view', label: 'Ver descuentos' },
  { group: 'Descuentos', code: 'discounts.manage', label: 'Gestionar descuentos' },
  { group: 'Configuración', code: 'config.edit', label: 'Editar configuración' },
  { group: 'Configuración', code: 'config.team.view', label: 'Ver equipo' },
  { group: 'Configuración', code: 'config.team.manage', label: 'Gestionar equipo' },
  { group: 'Configuración', code: 'config.audit.view', label: 'Ver auditoría' },
  { group: 'Configuración', code: 'config.domains.manage', label: 'Gestionar dominios' },
];

// Permisos por rol default. empleado suma *.view de catálogo/equipo para no
// perder acceso de lectura que ya tenía cuando los GET solo chequeaban membership
// (ver PermissionsGuard) — los *.manage siguen exclusivos de owner/admin.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: PERMISSIONS.map((p) => p.code), // todo
  admin: PERMISSIONS.map((p) => p.code), // todo (los casos owner-only usan @Roles('owner') directo)
  empleado: ['orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view'],
};

async function main() {
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  // ── 1. Negocio ─────────────────────────────────────────────────────────────

  const business = await prisma.business.upsert({
    where: { subdomain: 'zapatoslorena' },
    update: {},
    create: {
      name: 'Zapatos Lorena',
      industry: 'Indumentaria',
      description: 'Zapatería de barrio con venta online y en local.',
      subdomain: 'zapatoslorena',
      mode: 'FULL',
    },
  });

  const existingBranch = await prisma.branch.findFirst({
    where: { businessId: business.id, isDefault: true },
  });
  if (!existingBranch) {
    await prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'Principal',
        address: 'Av. Siempre Viva 742',
        isDefault: true,
      },
    });
  }

  await prisma.businessConfig.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      whatsapp: '+5493751123456',
      email: 'contacto@zapatoslorena.test',
      scheduleText: 'Lun a Vie 9 a 18hs',
      acceptsMercadopago: true,
      acceptsCash: true,
      acceptsTransfer: true,
      acceptsPickup: true,
      transferAlias: 'zapatoslorena.mp',
      shippingBase: 1500,
      freeShippingFrom: 20000,
      deliveryZones: ['Posadas', 'Garupá'],
    },
  });

  await prisma.storefrontConfig.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      storeName: 'Zapatos Lorena',
      tagline: 'Calzado para toda la familia',
      colorPrimary: '#8B4513',
      colorSecondary: '#D2B48C',
      colorMode: 'light',
      headerLayout: 'centered',
      gridLayout: 'grid-3',
      showRating: true,
      showNewBadge: true,
      showWhatsapp: true,
    },
  });

  await prisma.notificationConfig.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      matrix: {
        nuevo_pedido: { panel: true, email: true, whatsapp: false },
        pago_confirmado: { panel: true, email: true, whatsapp: false },
      },
    },
  });

  // ── 2. Permisos (catálogo global) + roles ───────────────────────────────────

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  const roleDefs = [
    { name: 'owner', color: '#000000' },
    { name: 'admin', color: '#4A5568' },
    { name: 'empleado', color: '#718096' },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const def of roleDefs) {
    let role = await prisma.role.findFirst({
      where: { businessId: business.id, name: def.name },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          businessId: business.id,
          name: def.name,
          color: def.color,
          isDefault: true,
        },
      });
    }
    roles[def.name] = role;

    const permissionCodes = ROLE_PERMISSIONS[def.name] ?? [];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // ── 3. Member owner ──────────────────────────────────────────────────────────

  const ownerEmail = 'dueno@zapatoslorena.test';
  await prisma.member.upsert({
    where: { businessId_email: { businessId: business.id, email: ownerEmail } },
    update: { passwordHash: passwordHash, status: 'ACTIVE', hasTempPassword: false, emailVerified: true, googleId: null },
    create: {
      businessId: business.id,
      name: 'Lorena Dueña',
      email: ownerEmail,
      roleId: roles.owner.id,
      status: 'ACTIVE',
      hasTempPassword: false,
      passwordHash: passwordHash,
      emailVerified: true,
    },
  });

  // ── 4. Member empleado ────────────────────────────────────────────────────────

  const empleadoEmail = 'empleado@zapatoslorena.test';
  await prisma.member.upsert({
    where: { businessId_email: { businessId: business.id, email: empleadoEmail } },
    update: { passwordHash: passwordHash, status: 'ACTIVE', hasTempPassword: false, emailVerified: true, googleId: null },
    create: {
      businessId: business.id,
      name: 'Carlos Empleado',
      email: empleadoEmail,
      roleId: roles.empleado.id,
      status: 'ACTIVE',
      hasTempPassword: false,
      passwordHash: passwordHash,
      emailVerified: true,
    },
  });

  // ── 5. Customer con cuenta ───────────────────────────────────────────────────

  const clienteEmail = 'cliente@zapatoslorena.test';
  await prisma.customer.upsert({
    where: { businessId_email: { businessId: business.id, email: clienteEmail } },
    update: { passwordHash: passwordHash, emailVerified: true, googleId: null },
    create: {
      businessId: business.id,
      firstName: 'Ana',
      lastName: 'García',
      email: clienteEmail,
      passwordHash: passwordHash,
      emailVerified: true,
    },
  });

  // ── 6. Customer sin cuenta (cargado a mano por el negocio) ──────────────────

  const sinCuentaEmail = 'sinregistrar@zapatoslorena.test';
  await prisma.customer.upsert({
    where: { businessId_email: { businessId: business.id, email: sinCuentaEmail } },
    update: { passwordHash: null, emailVerified: false, failedLoginAttempts: 0, lockedUntil: null, googleId: null },
    create: {
      businessId: business.id,
      firstName: 'Pedro',
      lastName: 'Martínez',
      email: sinCuentaEmail,
      phone: '+5493751123456',
    },
  });

  // ── 6b. Customer sin cuenta #2 (fixture reutilizable para pruebas manuales) ─

  const sinCuentaEmail2 = 'sinregistrar2@zapatoslorena.test';
  await prisma.customer.upsert({
    where: { businessId_email: { businessId: business.id, email: sinCuentaEmail2 } },
    update: { passwordHash: null, emailVerified: false, failedLoginAttempts: 0, lockedUntil: null, googleId: null },
    create: {
      businessId: business.id,
      firstName: 'Laura',
      lastName: 'Fernández',
      email: sinCuentaEmail2,
      phone: '+5493751987654',
    },
  });

  // ── 7. Super admin de plataforma (fundador) ─────────────────────────────────
  // Identidad cross-tenant, fuera del multi-tenant: email único global, sin
  // negocio. Se siembra con password temporal para poder entrar desde el día uno;
  // el googleId se vincula solo en el primer login con Google (ver auth.service).

  const superAdminEmail = 'vegaalanadrian@gmail.com';
  await prisma.platformAdmin.upsert({
    where: { email: superAdminEmail },
    update: { passwordHash, role: 'SUPERADMIN', isActive: true, emailVerified: true, googleId: null },
    create: {
      name: 'Alan Vega',
      email: superAdminEmail,
      role: 'SUPERADMIN',
      isActive: true,
      passwordHash,
      emailVerified: true,
    },
  });

  // ── Resumen ──────────────────────────────────────────────────────────────────

  console.log('');
  console.log('✅ Seed completado');
  console.log('');
  console.log(`Negocio: Zapatos Lorena (subdomain: zapatoslorena)`);
  console.log('');
  console.log('Credenciales de prueba:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ Owner (panel, sin header)                                │');
  console.log(`│   email: ${ownerEmail}`);
  console.log(`│   password: ${TEST_PASSWORD}`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Empleado (panel, sin header, para probar RolesGuard)     │');
  console.log(`│   email: ${empleadoEmail}`);
  console.log(`│   password: ${TEST_PASSWORD}`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Cliente CON cuenta (storefront, header                   │');
  console.log('│ X-Business-Slug: zapatoslorena)                          │');
  console.log(`│   email: ${clienteEmail}`);
  console.log(`│   password: ${TEST_PASSWORD}`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Cliente SIN cuenta (cargado a mano, sin passwordHash)    │');
  console.log(`│   email: ${sinCuentaEmail}`);
  console.log('│   (no tiene password — usar /auth/register para darle   │');
  console.log('│   una cuenta)                                            │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ Cliente SIN cuenta #2 (fixture reutilizable)             │');
  console.log(`│   email: ${sinCuentaEmail2}`);
  console.log('│   (mismo caso que arriba — para pruebas repetidas de    │');
  console.log('│   vinculación de compras sin cuenta)                     │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ SUPER ADMIN (apex orbita.site/login → /superadmin)       │');
  console.log(`│   email: ${superAdminEmail}`);
  console.log(`│   password: ${TEST_PASSWORD}`);
  console.log('│   (o entrar con Google — vincula solo en el 1er login)   │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
}

main()
  .catch((err) => {
    console.error('❌ Seed falló:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

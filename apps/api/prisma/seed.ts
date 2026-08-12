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

  // ── 6c. Catálogo: categorías en árbol + productos ───────────────────────────
  // Reemplaza los mocks que tenía el panel (catalogo.mock.ts). Cubre a propósito
  // los casos de borde que la UI tiene que saber mostrar: producto sin variantes,
  // con una sola opción, con dos (Talle × Color), sin stock, borrador, y con y
  // sin costo cargado (para que la métrica de valor de inventario tenga ambos).

  const branch = await prisma.branch.findFirstOrThrow({
    where: { businessId: business.id, isDefault: true },
  });

  const categoriasSeed: { slug: string; name: string; icon: string; color: string; hijas?: string[] }[] = [
    { slug: 'indumentaria', name: 'Indumentaria', icon: '👕', color: '#3B82F6', hijas: ['Remeras', 'Pantalones', 'Buzos'] },
    { slug: 'accesorios', name: 'Accesorios', icon: '🧢', color: '#F59E0B' },
    { slug: 'calzado', name: 'Calzado', icon: '👟', color: '#10B981' },
  ];

  const catIdPorNombre = new Map<string, string>();
  for (const [i, cat] of categoriasSeed.entries()) {
    const padre = await prisma.category.upsert({
      where: { businessId_slug: { businessId: business.id, slug: cat.slug } },
      update: {},
      create: {
        businessId: business.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        color: cat.color,
        position: i,
      },
    });
    catIdPorNombre.set(cat.name, padre.id);

    for (const [j, hija] of (cat.hijas ?? []).entries()) {
      const slugHija = hija.toLowerCase();
      const sub = await prisma.category.upsert({
        where: { businessId_slug: { businessId: business.id, slug: slugHija } },
        update: {},
        create: {
          businessId: business.id,
          name: hija,
          slug: slugHija,
          icon: cat.icon,
          color: cat.color,
          parentId: padre.id,
          position: j,
        },
      });
      catIdPorNombre.set(hija, sub.id);
    }
  }

  // `opciones` vacío ⇒ producto sin variantes: se le crea una única variante
  // default, igual que hace ProductsService.create().
  type ProductoSeed = {
    name: string;
    categoria: string;
    description: string;
    basePrice: number;
    comparePrice?: number;
    cost?: number;
    status: 'PUBLISHED' | 'DRAFT';
    sku: string;
    stockPorVariante: number;
    stockMin: number;
    opciones?: { name: string; values: string[] }[];
    imagen?: string;
  };

  const productosSeed: ProductoSeed[] = [
    {
      name: 'Remera oversize negra',
      categoria: 'Remeras',
      description: 'Remera de corte oversize en algodón premium 180g.',
      basePrice: 24900,
      cost: 11000,
      status: 'PUBLISHED',
      sku: 'RM-OVR-NG',
      stockPorVariante: 6,
      stockMin: 3,
      opciones: [
        { name: 'Talle', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Negro', 'Blanco'] },
      ],
      imagen: 'https://picsum.photos/seed/remera-oversize/800/800',
    },
    {
      name: 'Pantalón cargo verde oliva',
      categoria: 'Pantalones',
      description: 'Pantalón cargo con múltiples bolsillos, tiro medio.',
      basePrice: 48900,
      comparePrice: 59900,
      cost: 23000,
      status: 'PUBLISHED',
      sku: 'PT-CRG-VR',
      stockPorVariante: 4,
      stockMin: 2,
      opciones: [{ name: 'Talle', values: ['38', '40', '42', '44'] }],
      imagen: 'https://picsum.photos/seed/pantalon-cargo/800/800',
    },
    {
      name: 'Buzo frisa con capucha',
      categoria: 'Buzos',
      description: 'Buzo de frisa con capucha ajustable y bolsillo canguro.',
      basePrice: 38500,
      cost: 18000,
      status: 'PUBLISHED',
      sku: 'BZ-FRS-CH',
      stockPorVariante: 5,
      stockMin: 2,
      opciones: [
        { name: 'Talle', values: ['M', 'L'] },
        { name: 'Color', values: ['Gris', 'Negro'] },
      ],
      imagen: 'https://picsum.photos/seed/buzo-frisa/800/800',
    },
    {
      // Sin stock: la lista lo muestra en la métrica "sin stock".
      name: 'Campera bomber beige',
      categoria: 'Indumentaria',
      description: 'Campera bomber con forro interior, corte clásico.',
      basePrice: 89000,
      cost: 42000,
      status: 'PUBLISHED',
      sku: 'CP-BMB-BG',
      stockPorVariante: 0,
      stockMin: 2,
      opciones: [{ name: 'Talle', values: ['M', 'L', 'XL'] }],
      imagen: 'https://picsum.photos/seed/campera-bomber/800/800',
    },
    {
      // Sin variantes ni costo: valor de inventario cae al precio de venta.
      name: 'Gorra trucker bordada',
      categoria: 'Accesorios',
      description: 'Gorra trucker con frente bordado y malla trasera.',
      basePrice: 15900,
      status: 'PUBLISHED',
      sku: 'GR-TRK-BD',
      stockPorVariante: 24,
      stockMin: 5,
      imagen: 'https://picsum.photos/seed/gorra-trucker/800/800',
    },
    {
      // Borrador: no sale en el storefront pero sí en el panel.
      name: 'Jean tiro medio celeste',
      categoria: 'Pantalones',
      description: 'Jean de tiro medio con lavado claro.',
      basePrice: 56000,
      cost: 26000,
      status: 'DRAFT',
      sku: 'JN-TRM-CL',
      stockPorVariante: 3,
      stockMin: 2,
      opciones: [{ name: 'Talle', values: ['38', '40', '42', '44'] }],
      imagen: 'https://picsum.photos/seed/jean-celeste/800/800',
    },
    {
      name: 'Zapatilla urbana blanca',
      categoria: 'Calzado',
      description: 'Zapatilla urbana de caña baja, suela de goma.',
      basePrice: 72000,
      cost: 35000,
      status: 'PUBLISHED',
      sku: 'ZP-URB-BL',
      stockPorVariante: 3,
      stockMin: 2,
      opciones: [{ name: 'Talle', values: ['39', '40', '41', '42', '43'] }],
      imagen: 'https://picsum.photos/seed/zapatilla-urbana/800/800',
    },
    {
      name: 'Medias cortas pack x3',
      categoria: 'Accesorios',
      description: 'Pack de 3 pares de medias cortas de algodón.',
      basePrice: 8900,
      cost: 3500,
      status: 'PUBLISHED',
      sku: 'MD-CRT-P3',
      stockPorVariante: 40,
      stockMin: 10,
      imagen: 'https://picsum.photos/seed/medias-pack/800/800',
    },
  ];

  let productosCreados = 0;
  for (const p of productosSeed) {
    // Idempotencia: el seed no tiene un unique natural para productos, así que
    // se saltea si ya hay uno con el mismo nombre en este negocio.
    const yaExiste = await prisma.product.findFirst({
      where: { businessId: business.id, name: p.name, deletedAt: null },
      select: { id: true },
    });
    if (yaExiste) continue;

    await prisma.$transaction(async (tx) => {
      const producto = await tx.product.create({
        data: {
          businessId: business.id,
          categoryId: catIdPorNombre.get(p.categoria) ?? null,
          name: p.name,
          description: p.description,
          basePrice: p.basePrice,
          comparePrice: p.comparePrice ?? null,
          cost: p.cost ?? null,
          status: p.status,
        },
      });

      // Opciones y sus valores, en orden — la posición importa para armar las
      // combinaciones más abajo.
      const opciones: { values: { id: string; value: string }[] }[] = [];
      for (const [i, opt] of (p.opciones ?? []).entries()) {
        const option = await tx.productOption.create({
          data: { productId: producto.id, name: opt.name, position: i },
        });
        const values = [];
        for (const [j, value] of opt.values.entries()) {
          const creado = await tx.productOptionValue.create({
            data: { optionId: option.id, value, position: j },
          });
          values.push({ id: creado.id, value });
        }
        opciones.push({ values });
      }

      // Producto cartesiano de todas las opciones (Talle × Color).
      let combinaciones: { id: string; value: string }[][] = [[]];
      for (const opt of opciones) {
        const siguiente: { id: string; value: string }[][] = [];
        for (const combo of combinaciones) {
          for (const val of opt.values) siguiente.push([...combo, val]);
        }
        combinaciones = siguiente;
      }

      for (const combo of combinaciones) {
        const sufijo = combo.map((c) => c.value.slice(0, 3).toUpperCase()).join('-');
        const variante = await tx.productVariant.create({
          data: {
            productId: producto.id,
            sku: sufijo ? `${p.sku}-${sufijo}` : p.sku,
            price: p.basePrice,
            comparePrice: p.comparePrice ?? null,
            isDefault: combo.length === 0,
          },
        });
        if (combo.length > 0) {
          await tx.variantOptionValue.createMany({
            data: combo.map((c) => ({ variantId: variante.id, optionValueId: c.id })),
          });
        }
        await tx.variantStock.create({
          data: {
            variantId: variante.id,
            branchId: branch.id,
            quantity: p.stockPorVariante,
            stockMin: p.stockMin,
          },
        });
      }

      if (p.imagen) {
        await tx.productImage.create({
          data: { productId: producto.id, url: p.imagen, position: 0, isPrimary: true },
        });
      }
    });
    productosCreados++;
  }

  // ── 7. Super admins de plataforma (fundadores, RBT-647) ─────────────────────
  // Identidad cross-tenant, fuera del multi-tenant: email único global, sin
  // negocio. Se siembran con password temporal para poder entrar desde el día
  // uno; el googleId se vincula solo en el primer login con Google (ver
  // auth.service). `emailVerified: true` acá es solo el dato de la cuenta —
  // no reemplaza el segundo factor por mail que ahora exige el login de
  // platform admin (AuthService.issuePlatformAdminLoginCode), que pide un
  // código nuevo en cada inicio de sesión sin importar este flag.
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

  // Emails corporativos de los fundadores (RBT-647) — contraseña de prueba
  // propia (distinta de TEST_PASSWORD, a pedido explícito): "orbitatest1234".
  const foundersPasswordHash = await argon2.hash('orbitatest1234', { type: argon2.argon2id });
  const founders: { name: string; email: string }[] = [
    { name: 'CTO', email: 'cto@orbita-corp.com' },
    { name: 'CEO', email: 'ceo@orbita-corp.com' },
    { name: 'CPO', email: 'cpo@orbita-corp.com' },
    { name: 'CM', email: 'cm@orbita-corp.com' },
  ];
  for (const founder of founders) {
    await prisma.platformAdmin.upsert({
      where: { email: founder.email },
      update: { passwordHash: foundersPasswordHash, role: 'SUPERADMIN', isActive: true, emailVerified: true, googleId: null },
      create: {
        name: founder.name,
        email: founder.email,
        role: 'SUPERADMIN',
        isActive: true,
        passwordHash: foundersPasswordHash,
        emailVerified: true,
      },
    });
  }

  // ── Resumen ──────────────────────────────────────────────────────────────────

  console.log('');
  console.log('✅ Seed completado');
  console.log('');
  console.log(`Negocio: Zapatos Lorena (subdomain: zapatoslorena)`);
  console.log(
    `Catálogo: ${catIdPorNombre.size} categorías · ${productosCreados} productos nuevos ` +
      `(${productosSeed.length - productosCreados} ya existían)`,
  );
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
  console.log('│   Pide un código por mail en cada login (RBT-647)        │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ SUPER ADMINS — fundadores (mismo flujo, código por mail) │');
  console.log('│   cto@orbita-corp.com / ceo@orbita-corp.com /            │');
  console.log('│   cpo@orbita-corp.com / cm@orbita-corp.com               │');
  console.log('│   password: orbitatest1234                               │');
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

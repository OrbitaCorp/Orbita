// Migración one-off: GV Store (Next.js + Supabase propio, gvstore.com.ar) → Órbita.
// NO es una feature del producto — corre una sola vez, no vive en apps/api/src/.
// Mismo criterio que import-tefaltacalleok.ts, con una diferencia: acá el
// negocio NO existía, así que el script también lo crea (pedido del 19/11:
// alta directa en la base, sin pasar por el wizard ni por Mercado Pago).
//
// Qué crea, replicando OnboardingService.registerBusiness() +
// SubscriptionsService.confirmAndCreate() de un alta gratis:
//   - Business en modo SHOWCASE (vidriera digital), rubro tienda, publicado.
//   - Sucursal "Principal", roles owner/empleado con sus permisos, el dueño
//     (contraseña TEMPORAL: hasTempPassword, la cambia al entrar).
//   - BusinessConfig, StorefrontConfig (marca, colores, slides), NotificationConfig.
//   - Subscription de cortesía (origin COMP) hasta CORTESIA_HASTA, con su
//     PlatformAdminLog como si la hubiera cedido un superadmin.
//   - Categorías, productos con opción Talle/Número, stock y fotos (resubidas
//     al Storage de producción como webp, como products.service.ts addImage()).
//
// Fuente: export.json sacado de la base de GV Store con Prisma (solo lectura).
//
// Uso (desde apps/api, con las variables de producción en el entorno — ver
// el wrapper que exporta DATABASE_URL/SUPABASE_* desde Secret Manager):
//   DRY_RUN=true npx ts-node prisma/import-gvstore.ts
//   OWNER_PASSWORD=... npx ts-node prisma/import-gvstore.ts
// Variables obligatorias: EXPORT_JSON_PATH, LOGO_PATH, OWNER_EMAIL, OWNER_NAME,
// STORE_WHATSAPP, STORE_INSTAGRAM, COMP_UNTIL (ISO 8601) y COMP_REASON.
//
// Idempotencia: aborta si el subdominio o el email ya existen.

process.loadEnvFile?.();

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { PrismaClient, Prisma, ProductStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as argon2 from 'argon2';
import WebSocket from 'ws';
import { PERMISSIONS } from '../src/common/permisos/catalogo';

// El repo es público: los datos de la clienta y las condiciones de su cuenta
// entran por el entorno y no se escriben acá.
function requerida(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

const EXPORT_JSON_PATH = requerida('EXPORT_JSON_PATH');
const LOGO_PATH = requerida('LOGO_PATH');

const NOMBRE = 'GV Store';
const SUBDOMINIO = 'gvstore';
const EMAIL_DUENO = requerida('OWNER_EMAIL');
const NOMBRE_DUENO = requerida('OWNER_NAME');
const WHATSAPP = requerida('STORE_WHATSAPP');
const INSTAGRAM = requerida('STORE_INSTAGRAM');
const CORTESIA_HASTA = new Date(requerida('COMP_UNTIL')); // ISO 8601
if (Number.isNaN(CORTESIA_HASTA.getTime())) throw new Error('COMP_UNTIL no es una fecha ISO 8601 válida.');
const MOTIVO_CORTESIA = requerida('COMP_REASON');

const DRY_RUN = process.env.DRY_RUN === 'true';
const BUCKET_PRODUCTOS = 'product-images';
const BUCKET_TIENDA = 'business-logos';

// Paleta tomada del logo: negro de fondo, celeste de la bandera.
const NEGRO = '#0B0B0C';
const CELESTE = '#4A9FE0';
const CELESTE_CLARO = '#A9D3F5';

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as never },
});

// ── Fuente ───────────────────────────────────────────────────────────────

type Img = { url: string; sort_order: number };
type Var = { size: string; color: string | null; price: string; stock_quantity: number; is_active: boolean };
type Prod = {
  id: string; name: string; description: string | null; category_id: string | null; base_price: string;
  compare_at_price: string | null; is_active: boolean; is_featured: boolean; created_at: string;
  images: Img[]; variants: Var[];
};
type Cat = { id: string; name: string; slug: string; image_url: string | null; sort_order: number; is_active: boolean };
type Slider = { title: string; subtitle: string | null; image_url: string };
type Export = { categorias: Cat[]; productos: Prod[]; sliders: Slider[] };

// Las categorías de la tienda vieja tenían slugs heredados de otra plantilla
// ("clubes-europa" para Femenino); acá van con el nombre real.
const SLUG_CATEGORIA: Record<string, string> = { Masculino: 'masculino', Femenino: 'femenino', Accesorios: 'accesorios' };
const ORDEN_CATEGORIA: Record<string, number> = { Masculino: 0, Femenino: 1, Accesorios: 2 };
// Dos productos quedaron sin categoría en la tienda vieja.
const CATEGORIA_SUELTO: Record<string, string> = {
  'Camiseta Argentina 2026 titular': 'Masculino',
  'Musculosa Femenina': 'Femenino',
};

const ORDEN_TALLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const limpiar = (s: string) => s.trim().replace(/\s+/g, ' ');
// Typos de carga en la tienda vieja.
const NOMBRE_CORREGIDO: Record<string, string> = {
  'Camisetas De futbol': 'Camiseta de fútbol',
  'Remera Deportiva nike': 'Remera Deportiva Nike',
};
const nombreProducto = (p: { name: string }) => NOMBRE_CORREGIDO[limpiar(p.name)] ?? limpiar(p.name);
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type VarioOrbita = { valor: string; precio: number; stock: number; activa: boolean };

/** Talles normalizados (l → L, Xxl → XXL), duplicados sumados, en orden de talle. */
function variantesDe(p: Prod): { opcion: string; variantes: VarioOrbita[] } {
  const porValor = new Map<string, VarioOrbita>();
  for (const v of p.variants) {
    const valor = limpiar(v.size).toUpperCase();
    const previa = porValor.get(valor);
    if (previa) {
      previa.stock += v.stock_quantity;
      previa.activa = previa.activa || v.is_active;
    } else {
      porValor.set(valor, { valor, precio: Number(v.price), stock: v.stock_quantity, activa: v.is_active });
    }
  }
  const variantes = [...porValor.values()].sort((a, b) => {
    const ia = ORDEN_TALLES.indexOf(a.valor);
    const ib = ORDEN_TALLES.indexOf(b.valor);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  // Las pelotas vienen con "5" / "2" en el talle: es el número de pelota.
  const opcion = variantes.every((v) => /^\d+$/.test(v.valor)) ? 'Número' : 'Talle';
  return { opcion, variantes };
}

function estadoDe(p: Prod, variantes: VarioOrbita[]): ProductStatus {
  if (!p.is_active) return 'DRAFT';
  return variantes.some((v) => v.activa && v.stock > 0) ? 'PUBLISHED' : 'OUT_OF_STOCK';
}

// ── Fotos ────────────────────────────────────────────────────────────────

async function bajarComoWebp(url: string, maxLado = 2000): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ foto no disponible (${res.status}): ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).rotate().resize({ width: maxLado, height: maxLado, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch (err) {
    console.warn(`  ⚠ error bajando/convirtiendo ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function subir(bucket: string, ruta: string, cuerpo: Buffer, contentType = 'image/webp'): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(ruta, cuerpo, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo subir ${ruta} a ${bucket}: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

/** Logo: recorta el margen negro sobrante del original (1170×1197) y lo deja cuadrado. */
async function logoYFavicon(): Promise<{ logo: Buffer; favicon: Buffer }> {
  const original = fs.readFileSync(LOGO_PATH);
  const recortado = await sharp(original).trim({ background: '#000000', threshold: 30 }).toBuffer();
  const cuadrado = await sharp(recortado)
    .resize({ width: 512, height: 512, fit: 'contain', background: '#000000' })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#000000' })
    .resize(512, 512)
    .png()
    .toBuffer();
  const favicon = await sharp(cuadrado).resize(64, 64).png().toBuffer();
  return { logo: cuadrado, favicon };
}

// ── Alta del negocio ─────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: PERMISSIONS.map((p) => p.code),
  empleado: [
    'orders.view', 'customers.view', 'inventory.view', 'catalog.view', 'config.team.view',
    'messages.view', 'messages.manage', 'reservas.view', 'reservas.manage',
  ],
};
const ROLE_DEFS = [
  { name: 'owner', color: '#3B82F6' },
  { name: 'empleado', color: '#10B981' },
];

async function crearNegocio(password: string) {
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: perm.code }, update: {}, create: perm });
  }
  const permisos = await prisma.permission.findMany({ where: { code: { in: Object.values(ROLE_PERMISSIONS).flat() } } });
  const permisoPorCodigo = new Map(permisos.map((p) => [p.code, p]));
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const ahora = new Date();

  return prisma.$transaction(
    async (tx) => {
      const business = await tx.business.create({
        data: {
          name: NOMBRE,
          industry: 'tienda',
          subrubros: ['deportes', 'indumentaria'],
          description: 'Ropa deportiva, camisetas de fútbol y accesorios en Posadas, Misiones.',
          subdomain: SUBDOMINIO,
          mode: 'SHOWCASE',
          isActive: false,
          operatesPhysical: false,
          operatesOnline: true,
        },
      });
      const branch = await tx.branch.create({ data: { businessId: business.id, name: 'Principal', isDefault: true } });

      const roles: Record<string, { id: string }> = {};
      for (const def of ROLE_DEFS) {
        const role = await tx.role.create({ data: { businessId: business.id, name: def.name, color: def.color, isDefault: true } });
        roles[def.name] = role;
        const ids = (ROLE_PERMISSIONS[def.name] ?? []).map((c) => permisoPorCodigo.get(c)?.id).filter((x): x is string => !!x);
        if (ids.length) await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })) });
      }

      const member = await tx.member.create({
        data: {
          businessId: business.id,
          name: NOMBRE_DUENO,
          email: EMAIL_DUENO,
          roleId: roles.owner.id,
          status: 'ACTIVE',
          // Temporal y sin vencimiento: al entrar el panel le pide una propia.
          hasTempPassword: true,
          tempPasswordExpiresAt: null,
          passwordHash,
          emailVerified: false,
          emailVerifyDueAt: new Date(ahora.getTime() + 14 * 86_400_000),
        },
      });

      await tx.businessConfig.create({
        data: {
          businessId: business.id,
          whatsapp: WHATSAPP,
          email: EMAIL_DUENO,
          instagram: INSTAGRAM,
          acceptsMercadopago: false,
          acceptsCash: false,
          acceptsTransfer: false,
          acceptsPickup: false,
          acceptsCard: false,
          acceptsCoordinateLater: false,
        },
      });
      await tx.storefrontConfig.create({
        data: { businessId: business.id, storeName: NOMBRE, colorMode: 'light', showRating: true, showNewBadge: true, showWhatsapp: true, showLowStock: false },
      });
      await tx.notificationConfig.create({
        data: { businessId: business.id, matrix: { nuevo_pedido: { panel: true, email: true }, pago_confirmado: { panel: true, email: true } } },
      });

      // Cortesía: mismo shape que un alta gratis (confirmAndCreate) / grantComp.
      await tx.subscription.create({
        data: {
          businessId: business.id,
          origin: 'COMP',
          status: 'ACTIVE',
          plan: 'mensual',
          planActive: true,
          amount: new Prisma.Decimal(0),
          currentPeriodStart: ahora,
          currentPeriodEnd: CORTESIA_HASTA,
          grantReason: MOTIVO_CORTESIA,
        },
      });
      await tx.businessAddon.create({
        data: { businessId: business.id, type: 'ADVANCED', isActive: false, expiresAt: ahora, grantedBy: null },
      });

      return { business, branch, member };
    },
    { timeout: 30000 },
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const data: Export = JSON.parse(fs.readFileSync(EXPORT_JSON_PATH, 'utf8'));
  const catPorId = new Map(data.categorias.map((c) => [c.id, c]));
  const nombreCategoria = (p: Prod) =>
    limpiar(p.category_id ? catPorId.get(p.category_id)?.name ?? '' : CATEGORIA_SUELTO[limpiar(p.name)] ?? '');

  console.log(`Fuente: ${data.categorias.length} categorías, ${data.productos.length} productos (${data.productos.filter((p) => p.is_active).length} activos).`);
  for (const p of data.productos) {
    const { opcion, variantes } = variantesDe(p);
    console.log(
      `  ${estadoDe(p, variantes).padEnd(12)} ${limpiar(p.name).padEnd(36)} [${nombreCategoria(p) || '¿?'}] $${Number(p.base_price)} ` +
        `${opcion}: ${variantes.map((v) => `${v.valor}${v.activa ? '' : '(off)'}×${v.stock}${v.precio !== Number(p.base_price) ? `@${v.precio}` : ''}`).join(' ')} — ${p.images.length} foto(s)`,
    );
  }
  if (data.productos.some((p) => !nombreCategoria(p))) throw new Error('Hay productos sin categoría resuelta');

  const yaSub = await prisma.business.findUnique({ where: { subdomain: SUBDOMINIO } });
  const yaMail = await prisma.member.findFirst({ where: { email: { equals: EMAIL_DUENO, mode: 'insensitive' } } });
  console.log(`\nSubdominio "${SUBDOMINIO}": ${yaSub ? 'OCUPADO' : 'libre'} · email del dueño: ${yaMail ? 'YA REGISTRADO' : 'libre'}`);
  if (yaSub || yaMail) throw new Error('El subdominio o el email ya existen: no se crea nada.');
  if (DRY_RUN) {
    console.log('DRY RUN: no se escribió nada.');
    return;
  }

  const password = process.env.OWNER_PASSWORD ?? '';
  if (password.length < 8) throw new Error('Falta OWNER_PASSWORD (mínimo 8 caracteres).');

  const { business, branch } = await crearNegocio(password);
  const businessId = business.id;
  console.log(`\nNegocio creado: ${businessId} (sucursal ${branch.id})`);

  // Categorías (con su foto)
  const categoriaPorNombre = new Map<string, string>();
  for (const nombre of Object.keys(SLUG_CATEGORIA)) {
    const fuente = data.categorias.find((c) => limpiar(c.name) === nombre);
    let imageUrl: string | null = null;
    if (fuente?.image_url) {
      const webp = await bajarComoWebp(fuente.image_url, 1400);
      if (webp) imageUrl = await subir(BUCKET_PRODUCTOS, `${businessId}/categorias/${randomUUID()}.webp`, webp);
    }
    const cat = await prisma.category.create({
      data: { businessId, name: nombre, slug: SLUG_CATEGORIA[nombre], position: ORDEN_CATEGORIA[nombre], isActive: true, imageUrl },
    });
    categoriaPorNombre.set(nombre, cat.id);
  }
  console.log(`Categorías: ${categoriaPorNombre.size}`);

  const stats = { productos: 0, variantes: 0, fotos: 0, fotosFallidas: 0 };
  // Los más viejos primero: "Nuevos ingresos" ordena por fecha de alta.
  for (const p of [...data.productos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const { opcion, variantes } = variantesDe(p);
    const base = Number(p.base_price);
    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId: categoriaPorNombre.get(nombreCategoria(p))!,
        name: nombreProducto(p),
        description: p.description ? capitalizar(limpiar(p.description)) : null,
        basePrice: base,
        comparePrice: p.compare_at_price ? Number(p.compare_at_price) : null,
        status: estadoDe(p, variantes),
        isFeatured: p.is_featured,
        createdAt: new Date(p.created_at),
      },
    });
    const option = await prisma.productOption.create({ data: { productId: product.id, name: opcion, position: 0, isVisual: false } });
    for (const [i, v] of variantes.entries()) {
      const ov = await prisma.productOptionValue.create({ data: { optionId: option.id, value: v.valor, position: i } });
      const variant = await prisma.productVariant.create({
        data: { productId: product.id, price: v.precio, isDefault: false, isActive: v.activa, showStock: true },
      });
      await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId: ov.id } });
      await prisma.variantStock.create({ data: { variantId: variant.id, branchId: branch.id, quantity: v.stock } });
      stats.variantes++;
    }
    let pos = 0;
    for (const img of [...p.images].sort((a, b) => a.sort_order - b.sort_order)) {
      const webp = await bajarComoWebp(img.url);
      if (!webp) { stats.fotosFallidas++; continue; }
      const url = await subir(BUCKET_PRODUCTOS, `${businessId}/${product.id}/${randomUUID()}.webp`, webp);
      await prisma.productImage.create({ data: { productId: product.id, url, position: pos, isPrimary: pos === 0 } });
      pos++;
      stats.fotos++;
    }
    stats.productos++;
    console.log(`  ✓ ${product.name} (${pos} foto/s)`);
  }

  // Apariencia
  const { logo, favicon } = await logoYFavicon();
  const logoUrl = await subir(BUCKET_TIENDA, `${businessId}/logo-${randomUUID()}.png`, logo, 'image/png');
  const faviconUrl = await subir(BUCKET_TIENDA, `${businessId}/favicon-${randomUUID()}.png`, favicon, 'image/png');
  const slide = (urlFuente: string) => bajarComoWebp(urlFuente, 2400).then((b) => (b ? subir(BUCKET_TIENDA, `${businessId}/slide-${randomUUID()}.webp`, b) : null));
  const sliderPorTitulo = (t: string) => data.sliders.find((s) => s.title.trim().toLowerCase() === t)!;
  // "Nueva temporada" usaba una foto de 800 px con marca de agua de banco de
  // imágenes: no se migra esa foto, su texto va sobre la de "Estilo de vida".
  const [fotoPareja, fotoEspalda] = await Promise.all([
    slide(sliderPorTitulo('estilo de vida').image_url),
    slide(sliderPorTitulo('proyecto verano').image_url),
  ]);
  const base = { imageOverlay: 'diagonal', bgPattern: 'none', bgPatternScope: 'image', bgColor: '' };
  const heroSlides = [
    {
      ...base, id: 'temporada', img: fotoPareja, imageStyle: 'full', imagePosition: 'right',
      titulo: 'Nueva temporada', subtitulo: 'Los mejores conjuntos deportivos para entrenar con todo.',
      cta: 'Ver catálogo', ctaLink: '/catalogo',
    },
    {
      ...base, id: 'verano', img: fotoEspalda, imageStyle: 'centered', imagePosition: 'right', bgColor: NEGRO, imageOverlay: 'none',
      titulo: 'Proyecto verano', subtitulo: 'Fuerza y disciplina: remeras, musculosas y shorts para el gym.',
      cta: 'Ver Masculino', ctaLink: '/catalogo/masculino',
    },
  ].filter((s) => s.img);

  await prisma.storefrontConfig.update({
    where: { businessId },
    data: {
      storeName: NOMBRE,
      tagline: 'Ropa deportiva y camisetas de fútbol',
      logoUrl, faviconUrl,
      colorPrimary: NEGRO, colorSecondary: CELESTE, colorAccent: CELESTE_CLARO, colorBackground: '#FFFFFF', colorMode: 'light',
      fontFamily: 'Montserrat', fontFamilyBody: 'Poppins', fontScale: 1,
      headerLayout: 'full', gridLayout: '4col',
      headerLinks: [
        { id: 'catalogo', label: 'Catálogo', on: true },
        { id: 'ofertas', label: 'Ofertas', on: false },
        { id: 'masVendidos', label: 'Más vendidos', on: false },
      ],
      showAnnouncementBar: true, announcementScroll: true,
      shippingText: ['Entregas en Posadas y Garupá', 'Envíos a todo el país', 'Consultanos por WhatsApp'].join('\n'),
      heroSlides,
      showStatsBar: false,
      showCategoriesSection: true, categoryLayout: 'tarjetas',
      categoryIds: [...categoriaPorNombre.values()],
      showFeaturedSection: true, showNewArrivalsSection: true, showRecommendedSection: false, showBestSellersSection: false,
      showRating: false, showNewBadge: true, showOfferBadge: true, showLowStock: false, showSearch: true,
      showParallaxBanner: false, showVideo: false, showBrands: false,
      showWhatsapp: true,
      whatsappText: '¡Hola GV Store! Quiero consultar por un producto.',
      showFooter: true, showSocialFooter: true,
      homeTemplate: null,
    },
  });
  console.log('Apariencia: logo, favicon, colores, tipografías y slides');

  await prisma.business.update({ where: { id: businessId }, data: { isActive: true } });
  const admin = await prisma.platformAdmin.findFirst({ where: { email: 'contacto@orbita-corp.com' }, select: { id: true } });
  if (admin) {
    await prisma.platformAdminLog.create({
      data: {
        adminId: admin.id, action: 'grant_comp', targetType: 'subscription', targetId: businessId,
        details: { grantReason: MOTIVO_CORTESIA, currentPeriodEnd: CORTESIA_HASTA.toISOString(), via: 'prisma/import-gvstore.ts' },
      },
    });
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Negocio: ${businessId} → https://${SUBDOMINIO}.orbita.site (vidriera, cortesía hasta ${CORTESIA_HASTA.toISOString()})`);
  console.log(`Productos: ${stats.productos} · variantes: ${stats.variantes} · fotos: ${stats.fotos} (fallidas ${stats.fotosFallidas})`);
}

main()
  .catch((err) => {
    console.error('FALLÓ:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

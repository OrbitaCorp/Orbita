// ─── Contenido de la demo pública: catálogo, ventas y todo el panel ──────────
//
// Lo llama prisma/seed-demo.ts después de dejar armado el negocio. BORRA y
// vuelve a crear el contenido del negocio demo (y de ninguno más: cada
// consulta va filtrada por su id, y arriba de todo se exige isDemo).
//
// Determinístico: los ids salen de un hash de una clave fija y el azar de una
// semilla, así que resembrar da los mismos ids — lo que el visitante tiene
// guardado en su localStorage (que referencia productos por id) sigue
// apuntando a lo mismo.
//
// Las fechas son relativas a "ahora" y quedan anotadas en
// Business.demoFechasAl: DemoFechasService las corre hacia adelante con el
// paso del tiempo, así los reportes nunca se vacían.

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import WebSocket from 'ws';
import { CATEGORIAS, ETIQUETAS, PRODUCTOS, ProductoDemo } from './catalogo';
import { APELLIDOS, CALLES, CIUDADES, CONVERSACIONES, NOMBRES, RESENAS, TRANSPORTES } from './datos';

const MEDIA = join(__dirname, 'media');
const DIAS_DE_HISTORIA = 90;
const HORA = 3600 * 1000;
const DIA = 24 * HORA;
// Cliente con el que entra el visitante de la tienda demo (sin login). Mismo
// valor en la API: src/demo/demo.constants.ts. Dominio .invalid: no recibe mails.
export const EMAIL_INVITADO = 'invitado@demo.invalid';

// ── Utilidades determinísticas ─────────────────────────────────────────────

/** UUID estable a partir de una clave (formato v4 válido). */
export function idDemo(clave: string): string {
  const h = createHash('sha256').update(`orbita-demo:${clave}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function azar(semilla: number) {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    n: siguiente,
    entre: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    uno: <T>(xs: readonly T[]): T => xs[Math.floor(siguiente() * xs.length)],
    pesado: <T>(xs: readonly T[], peso: (x: T) => number): T => {
      const total = xs.reduce((s, x) => s + peso(x), 0);
      let r = siguiente() * total;
      for (const x of xs) {
        r -= peso(x);
        if (r <= 0) return x;
      }
      return xs[xs.length - 1];
    },
    si: (p: number) => siguiente() < p,
  };
}

const dec = (n: number) => new Prisma.Decimal(n.toFixed(2));

// ── Subidas: Supabase Storage (fotos) y R2 (videos), como la app ────────────

export function almacenamiento(businessId: string) {
  const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
    // Igual que SupabaseService: en Node 20 no hay WebSocket nativo.
    realtime: { transport: WebSocket as never },
  });
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '' },
    requestChecksumCalculation: 'WHEN_REQUIRED', // ver r2.service.ts
    forcePathStyle: true,
  });
  const cache = new Map<string, string>();

  return {
    /** Foto al bucket de productos (`product-images`) o de la tienda (`business-logos`). */
    async imagen(archivo: string, bucket: 'product-images' | 'business-logos'): Promise<string> {
      const clave = `${bucket}:${archivo}`;
      if (cache.has(clave)) return cache.get(clave)!;
      const ruta = `${businessId}/demo/${archivo.replace(/\//g, '-')}`;
      const { error } = await supabase.storage.from(bucket).upload(ruta, readFileSync(join(MEDIA, archivo)), {
        contentType: archivo.endsWith('.png') ? 'image/png' : 'image/webp',
        upsert: true,
      });
      if (error) throw new Error(`No se pudo subir ${archivo} a ${bucket}: ${error.message}`);
      const url = supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
      cache.set(clave, url);
      return url;
    },
    /** Video (y su póster) a R2, como uploadStorefrontVideo(). */
    async video(archivo: string): Promise<string> {
      if (cache.has(archivo)) return cache.get(archivo)!;
      const ruta = `${businessId}/demo/${archivo.replace(/\//g, '-')}`;
      await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET ?? 'orbita',
        Key: ruta,
        Body: readFileSync(join(MEDIA, archivo)),
        ContentType: archivo.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
      }));
      const url = `${(process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')}/${ruta}`;
      cache.set(archivo, url);
      return url;
    },
  };
}

// ── Borrado del contenido anterior (solo del negocio demo) ──────────────────

async function borrarContenido(prisma: PrismaClient, businessId: string) {
  const deUnPedido = { order: { businessId } };
  const deUnProducto = { product: { businessId } };
  await prisma.$transaction([
    prisma.review.deleteMany({ where: { businessId } }),
    prisma.discountRedemption.deleteMany({ where: { businessId } }),
    prisma.creditNote.deleteMany({ where: { businessId } }),
    prisma.return.deleteMany({ where: { businessId } }),
    prisma.cancellationRequest.deleteMany({ where: { businessId } }),
    prisma.stockMovement.deleteMany({ where: { businessId } }),
    prisma.payment.deleteMany({ where: { businessId } }),
    prisma.onlineOrderDetails.deleteMany({ where: deUnPedido }),
    prisma.orderStatusHistory.deleteMany({ where: deUnPedido }),
    prisma.orderItem.deleteMany({ where: deUnPedido }),
    prisma.order.deleteMany({ where: { businessId } }),
    prisma.message.deleteMany({ where: { conversation: { businessId } } }),
    prisma.conversation.deleteMany({ where: { businessId } }),
    prisma.gameSession.deleteMany({ where: { businessId } }),
    prisma.discountProduct.deleteMany({ where: { discount: { businessId } } }),
    prisma.discountCategory.deleteMany({ where: { discount: { businessId } } }),
    prisma.discount.deleteMany({ where: { businessId } }),
    prisma.address.deleteMany({ where: { customer: { businessId } } }),
    prisma.customer.deleteMany({ where: { businessId } }),
    prisma.productTag.deleteMany({ where: deUnProducto }),
    prisma.productImage.deleteMany({ where: deUnProducto }),
    prisma.variantOptionValue.deleteMany({ where: { variant: deUnProducto } }),
    prisma.variantStock.deleteMany({ where: { variant: deUnProducto } }),
    prisma.productVariant.deleteMany({ where: deUnProducto }),
    prisma.productOptionValue.deleteMany({ where: { option: deUnProducto } }),
    prisma.productOption.deleteMany({ where: deUnProducto }),
    prisma.product.deleteMany({ where: { businessId } }),
    prisma.tag.deleteMany({ where: { businessId } }),
    prisma.category.deleteMany({ where: { businessId } }),
    prisma.storeVisit.deleteMany({ where: { businessId } }),
    prisma.notification.deleteMany({ where: { businessId } }),
  ]);
}

// ── Siembra ────────────────────────────────────────────────────────────────

type Variante = { id: string; productoClave: string; productoNombre: string; categoria: string; etiqueta: string | null; precio: number; stockFinal: number };

export async function sembrarContenido(prisma: PrismaClient, businessId: string) {
  const negocio = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!negocio.isDemo) throw new Error('sembrarContenido solo corre sobre el negocio demo (isDemo).');

  const ahora = new Date();
  const hace = (ms: number) => new Date(ahora.getTime() - ms);
  const r = azar(20260928);
  const sucursal = await prisma.branch.findFirstOrThrow({ where: { businessId, isDefault: true } });
  const dueno = await prisma.member.findFirstOrThrow({ where: { businessId, readOnly: false, role: { name: 'owner' } } });
  const subir = almacenamiento(businessId);

  console.log('Borrando el contenido anterior de la demo…');
  await borrarContenido(prisma, businessId);

  // ── Categorías y etiquetas ────────────────────────────────────────────────
  console.log('Categorías, etiquetas y fotos…');
  const categoriaId: Record<string, string> = {};
  for (const [i, c] of CATEGORIAS.entries()) {
    categoriaId[c.clave] = idDemo(`categoria:${c.clave}`);
    await prisma.category.create({
      data: {
        id: categoriaId[c.clave], businessId, name: c.nombre, slug: c.slug, icon: c.icono, color: c.color, position: i,
        imageUrl: await subir.imagen(c.imagen, 'business-logos'),
        createdAt: hace(120 * DIA),
      },
    });
  }
  const etiquetaId: Record<string, string> = {};
  for (const nombre of ETIQUETAS) {
    etiquetaId[nombre] = idDemo(`etiqueta:${nombre}`);
    await prisma.tag.create({ data: { id: etiquetaId[nombre], businessId, name: nombre, createdAt: hace(120 * DIA) } });
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  console.log(`${PRODUCTOS.length} productos…`);
  const variantes: Variante[] = [];
  for (const p of PRODUCTOS) {
    const productoId = idDemo(`producto:${p.clave}`);
    // "Nuevo" (etiqueta) = cargado en los últimos días: así también lo marca el badge del storefront.
    const creado = p.etiquetas.includes('Nuevo') ? hace(r.entre(2, 9) * DIA) : hace(r.entre(30, 120) * DIA);
    const contenido = p.bloques
      ? await Promise.all(p.bloques.map(async (b, i) => ({
          id: idDemo(`bloque:${p.clave}:${i}`), url: await subir.video(b.video), eyebrow: b.eyebrow, title: b.titulo, text: b.texto,
        })))
      : undefined;
    await prisma.product.create({
      data: {
        id: productoId, businessId, categoryId: categoriaId[p.categoria], name: p.nombre, description: p.descripcion,
        basePrice: dec(p.precio), comparePrice: p.precioAnterior ? dec(p.precioAnterior) : null, cost: dec(p.costo),
        status: 'PUBLISHED', isFeatured: !!p.destacado, photoType: 'flat',
        specs: p.specs as Prisma.InputJsonValue,
        videoUrl: p.video ? await subir.video(p.video) : null,
        contentBlocks: contenido as Prisma.InputJsonValue | undefined,
        createdAt: creado, updatedAt: creado,
        productTags: { create: p.etiquetas.map((e) => ({ tagId: etiquetaId[e] })) },
      },
    });

    // Opciones y valores.
    const valorId: Record<string, string> = {};
    for (const [i, o] of (p.opciones ?? []).entries()) {
      const opcionId = idDemo(`opcion:${p.clave}:${o.nombre}`);
      await prisma.productOption.create({ data: { id: opcionId, productId: productoId, name: o.nombre, position: i, isVisual: !!o.visual } });
      for (const [j, v] of o.valores.entries()) {
        valorId[v] = idDemo(`valor:${p.clave}:${o.nombre}:${v}`);
        await prisma.productOptionValue.create({ data: { id: valorId[v], optionId: opcionId, value: v, position: j } });
      }
    }

    // Fotos (las de un color, atadas a su valor).
    const valorDeFoto = new Map<number, string>();
    for (const [valor, indices] of Object.entries(p.fotosPorValor ?? {})) for (const i of indices) valorDeFoto.set(i, valorId[valor]);
    for (const [i, foto] of p.fotos.entries()) {
      await prisma.productImage.create({
        data: {
          id: idDemo(`foto:${p.clave}:${i}`), productId: productoId, url: await subir.imagen(foto, 'product-images'),
          position: i, isPrimary: i === 0, optionValueId: valorDeFoto.get(i) ?? null,
          backgroundRemoved: i === 0, createdAt: creado,
        },
      });
    }

    // Variantes y stock.
    const lista = p.variantes ?? [{ valores: [], precio: p.precio, precioAnterior: p.precioAnterior, stock: p.stock ?? 0, sku: `NB-${p.clave.toUpperCase()}` }];
    for (const v of lista) {
      const varianteId = idDemo(`variante:${p.clave}:${v.valores.join('|') || 'default'}`);
      await prisma.productVariant.create({
        data: {
          id: varianteId, productId: productoId, sku: v.sku, price: dec(v.precio),
          comparePrice: (v.precioAnterior ?? p.precioAnterior) ? dec((v.precioAnterior ?? p.precioAnterior)!) : null,
          isDefault: !p.variantes, createdAt: creado,
          optionValues: { create: v.valores.map((x) => ({ optionValueId: valorId[x] })) },
          stock: { create: { branchId: sucursal.id, quantity: v.stock, stockMin: p.stockMinimo ?? 3 } },
        },
      });
      variantes.push({ id: varianteId, productoClave: p.clave, productoNombre: p.nombre, categoria: p.categoria, etiqueta: v.valores.join(' / ') || null, precio: v.precio, stockFinal: v.stock });
    }
  }

  // ── Descuentos y cupones ──────────────────────────────────────────────────
  console.log('Descuentos y cupones…');
  const semanaGamer = idDemo('descuento:semana-gamer');
  const cupones = {
    bienvenida: idDemo('cupon:BIENVENIDA10'),
    nebula15: idDemo('cupon:NEBULA15'),
    hotsale: idDemo('cupon:HOTSALE'),
    vip: idDemo('cupon:VIP-LUCIA'),
  };
  const lamparas3x2 = idDemo('descuento:lamparas-3x2');
  await prisma.discount.createMany({
    data: [
      { id: semanaGamer, businessId, name: 'Semana Gamer: 15 % en Gaming', type: 'PERCENT_PRODUCT', value: dec(15), scope: 'CATEGORY', application: 'AUTOMATIC', startDate: hace(10 * DIA), endDate: new Date(ahora.getTime() + 11 * DIA), activeDays: [], priority: 1, createdBy: dueno.id, createdAt: hace(11 * DIA) },
      { id: lamparas3x2, businessId, name: 'Lámparas: llevá 3, pagá 2', type: 'BUY_X_PAY_Y', value: dec(2), minQuantity: 3, scope: 'PRODUCT', application: 'AUTOMATIC', startDate: hace(40 * DIA), endDate: null, activeDays: [], createdBy: dueno.id, createdAt: hace(40 * DIA) },
      { id: cupones.bienvenida, businessId, name: 'Bienvenida: 10 % en tu primera compra', code: 'BIENVENIDA10', type: 'PERCENT_TICKET', value: dec(10), scope: 'TICKET', application: 'MANUAL', startDate: hace(95 * DIA), activeDays: [], maxUsesPerCustomer: 1, createdBy: dueno.id, createdAt: hace(95 * DIA) },
      { id: cupones.nebula15, businessId, name: '15 % en compras desde $150.000', code: 'NEBULA15', type: 'PERCENT_TICKET', value: dec(15), minAmount: dec(150000), scope: 'TICKET', application: 'MANUAL', startDate: hace(20 * DIA), endDate: new Date(ahora.getTime() + 25 * DIA), activeDays: [], maxUsesTotal: 200, linkActive: true, createdBy: dueno.id, createdAt: hace(20 * DIA) },
      { id: cupones.hotsale, businessId, name: 'Hot Sale: $20.000 de descuento', code: 'HOTSALE', type: 'AMOUNT_TICKET', value: dec(20000), minAmount: dec(100000), scope: 'TICKET', application: 'MANUAL', startDate: hace(70 * DIA), endDate: hace(63 * DIA), activeDays: [], createdBy: dueno.id, createdAt: hace(72 * DIA) },
    ],
  });
  await prisma.discountCategory.create({ data: { discountId: semanaGamer, categoryId: categoriaId.gaming } });
  await prisma.discountProduct.create({ data: { discountId: lamparas3x2, productId: idDemo('producto:lampara') } });

  // ── Clientes ──────────────────────────────────────────────────────────────
  console.log('Clientes…');
  const clientes: { id: string; nombre: string; apellido: string; email: string; telefono: string; ciudad: (typeof CIUDADES)[number]; direccionId: string; calle: string; alta: Date }[] = [];
  for (const [i, nombre] of NOMBRES.entries()) {
    const apellido = APELLIDOS[(i * 7) % APELLIDOS.length];
    const ciudad = r.pesado(CIUDADES, (c) => c[3]);
    const email = `${nombre}.${apellido}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + `${i}@example.com`;
    const alta = hace(r.entre(3, 160) * DIA + r.entre(0, 23) * HORA);
    const c = {
      id: idDemo(`cliente:${i}`), nombre, apellido, email, telefono: `11${r.entre(40000000, 69999999)}`, ciudad,
      direccionId: idDemo(`direccion:${i}`), calle: `${r.uno(CALLES)} ${r.entre(100, 4800)}`, alta,
    };
    clientes.push(c);
    await prisma.customer.create({
      data: {
        id: c.id, businessId, firstName: nombre, lastName: apellido, email, phone: c.telefono, emailVerified: true,
        createdAt: alta, updatedAt: alta,
        addresses: { create: { id: c.direccionId, alias: 'Casa', street: c.calle, city: ciudad[0], provincia: ciudad[1], zip: ciudad[2], isDefault: true, createdAt: alta } },
      },
    });
  }
  // El cupón VIP es personal: se crea ahora que existe su cliente.
  await prisma.discount.create({
    data: { id: cupones.vip, businessId, name: 'Regalo para Lucía: $15.000', code: 'VIP-LUCIA', type: 'AMOUNT_TICKET', value: dec(15000), scope: 'TICKET', application: 'MANUAL', startDate: hace(5 * DIA), endDate: new Date(ahora.getTime() + 30 * DIA), activeDays: [], maxUsesTotal: 1, isPrivate: true, customerId: clientes[0].id, createdBy: dueno.id, createdAt: hace(5 * DIA) },
  });

  // ── Pedidos ───────────────────────────────────────────────────────────────
  console.log('Pedidos…');
  const vendido = new Map<string, number>();
  const pedidos: { id: string; numero: number; clienteIdx: number | null; estado: string; creado: Date; items: { id: string; varianteId: string; productoClave: string; categoria: string; cantidad: number; precio: number }[]; total: number }[] = [];
  let numero = 1000;
  const primerPedidoDelCliente = new Set<number>();
  const usosCupon: Record<string, number> = {};

  for (let dia = DIAS_DE_HISTORIA; dia >= 0; dia--) {
    // Crecimiento: la tienda vende más hoy que hace tres meses, y más los fines de semana.
    const fecha = hace(dia * DIA);
    const finde = [0, 6].includes(fecha.getDay());
    const media = 0.7 + 2.1 * (1 - dia / DIAS_DE_HISTORIA) + (finde ? 0.8 : 0);
    const cantidad = Math.max(dia === 0 ? 3 : 0, Math.round(media + (r.n() - 0.5) * 2));
    for (let k = 0; k < cantidad; k++) {
      // Hora del día: de 8 a 23, y si es hoy, antes de ahora.
      const inicioDia = new Date(fecha); inicioDia.setHours(8, 0, 0, 0);
      let creado = new Date(inicioDia.getTime() + r.n() * 15 * HORA);
      if (creado > ahora) creado = hace(r.entre(10, 300) * 60 * 1000);
      const edad = (ahora.getTime() - creado.getTime()) / DIA;

      numero++;
      const pedidoId = idDemo(`pedido:${numero}`);
      const esPos = r.si(0.1);
      const invitado = !esPos && r.si(0.12);
      const clienteIdx = esPos && r.si(0.5) ? null : invitado ? null : r.entre(0, clientes.length - 1);
      const cliente = clienteIdx != null ? clientes[clienteIdx] : null;

      // Ítems: los productos populares aparecen más.
      const nItems = r.pesado([1, 2, 3], (n) => (n === 1 ? 70 : n === 2 ? 24 : 6));
      const items: (typeof pedidos)[number]['items'] = [];
      const usados = new Set<string>();
      for (let j = 0; j < nItems; j++) {
        const producto = r.pesado(PRODUCTOS.filter((p) => !usados.has(p.clave) && (p.stock ?? 1) > 0), (p) => p.popularidad);
        usados.add(producto.clave);
        const v = r.uno(variantes.filter((x) => x.productoClave === producto.clave));
        const cant = producto.clave === 'lampara' && r.si(0.3) ? 3 : r.si(0.1) ? 2 : 1;
        items.push({ id: idDemo(`item:${numero}:${j}`), varianteId: v.id, productoClave: producto.clave, categoria: v.categoria, cantidad: cant, precio: v.precio });
      }

      // Estado según la antigüedad.
      const delivery = !esPos && r.si(0.75);
      let estado: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
      if (esPos) estado = 'COMPLETED';
      else if (edad > 3 && r.si(0.05)) estado = 'CANCELLED';
      // Lo de las últimas ~5 horas, sin atender: así el panel muestra sus alertas
      // (pedidos pendientes, transferencias por confirmar).
      else if (edad < 0.2) estado = 'PENDING';
      else if (edad < 1.5) estado = r.si(0.5) ? 'CONFIRMED' : 'PREPARING';
      else if (edad < 5) estado = delivery ? (r.si(0.7) ? 'SHIPPED' : 'PREPARING') : 'DELIVERED';
      else if (edad < 12) estado = 'DELIVERED';
      else estado = r.si(0.88) ? 'COMPLETED' : 'DELIVERED';

      // Montos: descuento automático de Gaming (si estaba vigente), 3x2 de lámparas y cupón.
      const subtotal = items.reduce((s, it) => s + it.precio * it.cantidad, 0);
      const redenciones: Prisma.DiscountRedemptionCreateManyInput[] = [];
      const descuentoItem = new Map<string, number>();
      for (const it of items) {
        if (it.categoria === 'gaming' && edad <= 10) {
          const monto = Math.round(it.precio * it.cantidad * 0.15);
          descuentoItem.set(it.id, monto);
          redenciones.push({ id: idDemo(`redencion:${numero}:${it.id}`), businessId, orderId: pedidoId, orderItemId: it.id, customerId: cliente?.id ?? null, discountId: semanaGamer, channel: 'STOREFRONT', amount: dec(monto), createdAt: creado });
        }
        if (it.productoClave === 'lampara' && it.cantidad >= 3 && edad <= 40) {
          descuentoItem.set(it.id, it.precio);
          redenciones.push({ id: idDemo(`redencion:${numero}:${it.id}`), businessId, orderId: pedidoId, orderItemId: it.id, customerId: cliente?.id ?? null, discountId: lamparas3x2, channel: 'STOREFRONT', amount: dec(it.precio), createdAt: creado });
        }
      }
      let descuento = [...descuentoItem.values()].reduce((s, x) => s + x, 0);
      if (clienteIdx != null && !esPos && !primerPedidoDelCliente.has(clienteIdx) && r.si(0.45)) {
        const monto = Math.round((subtotal - descuento) * 0.1);
        descuento += monto;
        usosCupon.bienvenida = (usosCupon.bienvenida ?? 0) + 1;
        redenciones.push({ id: idDemo(`redencion:${numero}:cupon`), businessId, orderId: pedidoId, customerId: cliente?.id ?? null, discountId: cupones.bienvenida, channel: 'STOREFRONT', amount: dec(monto), createdAt: creado });
      } else if (!esPos && edad <= 20 && subtotal - descuento >= 150000 && r.si(0.4)) {
        const monto = Math.round((subtotal - descuento) * 0.15);
        descuento += monto;
        usosCupon.nebula15 = (usosCupon.nebula15 ?? 0) + 1;
        redenciones.push({ id: idDemo(`redencion:${numero}:cupon`), businessId, orderId: pedidoId, customerId: cliente?.id ?? null, discountId: cupones.nebula15, channel: 'STOREFRONT', amount: dec(monto), createdAt: creado });
      } else if (!esPos && edad >= 63 && edad <= 70 && subtotal >= 100000) {
        descuento += 20000;
        usosCupon.hotsale = (usosCupon.hotsale ?? 0) + 1;
        redenciones.push({ id: idDemo(`redencion:${numero}:cupon`), businessId, orderId: pedidoId, customerId: cliente?.id ?? null, discountId: cupones.hotsale, channel: 'STOREFRONT', amount: dec(20000), createdAt: creado });
      }
      if (clienteIdx != null) primerPedidoDelCliente.add(clienteIdx);
      const envio = delivery ? (subtotal - descuento >= 150000 ? 0 : 5999) : null;
      const total = Math.max(0, subtotal - descuento + (envio ?? 0));

      // Historial de estados, con horas crecientes y nunca en el futuro.
      const cadena = esPos ? ['COMPLETED'] : estado === 'CANCELLED' ? ['PENDING', 'CANCELLED']
        : ['PENDING', 'CONFIRMED', 'PREPARING', ...(delivery ? ['SHIPPED'] : []), 'DELIVERED', 'COMPLETED'].slice(0, ['PENDING', 'CONFIRMED', 'PREPARING', ...(delivery ? ['SHIPPED'] : []), 'DELIVERED', 'COMPLETED'].indexOf(estado) + 1);
      const pasos = [0, 1 * HORA, 20 * HORA, 44 * HORA, 4 * DIA, 7 * DIA];
      const historial = cadena.map((st, i) => ({ id: idDemo(`estado:${numero}:${st}`), status: st as typeof estado, createdAt: new Date(Math.min(creado.getTime() + (estado === 'CANCELLED' && i === 1 ? 26 * HORA : pasos[i]), ahora.getTime() - 60000)) }));
      const ultimo = historial[historial.length - 1].createdAt;

      // Pago.
      const metodo = esPos ? r.uno(['CASH', 'DEBIT_CARD', 'QR'] as const) : delivery ? (r.si(0.72) ? 'MERCADOPAGO' : 'TRANSFER') : r.uno(['MERCADOPAGO', 'CASH', 'TRANSFER'] as const);
      let pago: { status: 'PENDING' | 'APPROVED' | 'REFUNDED' | 'CANCELLED'; paidAt: Date | null } = { status: 'APPROVED', paidAt: creado };
      if (estado === 'CANCELLED') pago = { status: metodo === 'MERCADOPAGO' ? 'REFUNDED' : 'CANCELLED', paidAt: metodo === 'MERCADOPAGO' ? creado : null };
      else if (metodo === 'MERCADOPAGO') pago = estado === 'PENDING' && r.si(0.5) ? { status: 'PENDING', paidAt: null } : { status: 'APPROVED', paidAt: new Date(creado.getTime() + 2 * 60000) };
      else if (metodo === 'TRANSFER') pago = estado === 'PENDING' ? { status: 'PENDING', paidAt: null } : { status: 'APPROVED', paidAt: new Date(Math.min(creado.getTime() + 3 * HORA, ahora.getTime() - 60000)) };
      else if (metodo === 'CASH' && !esPos) pago = ['DELIVERED', 'COMPLETED'].includes(estado) ? { status: 'APPROVED', paidAt: historial.find((h) => h.status === 'DELIVERED')?.createdAt ?? ultimo } : { status: 'PENDING', paidAt: null };

      const ciudad = cliente?.ciudad ?? r.pesado(CIUDADES, (c) => c[3]);
      const nombreComprador = cliente ? `${cliente.nombre} ${cliente.apellido}` : `${r.uno(NOMBRES)} ${r.uno(APELLIDOS)}`;
      await prisma.order.create({
        data: {
          id: pedidoId, businessId, branchId: sucursal.id, customerId: cliente?.id ?? null, orderNumber: numero,
          channel: esPos ? 'POS' : 'ONLINE', origin: esPos ? 'MANUAL' : 'STOREFRONT', status: estado,
          subtotal: dec(subtotal), discountTotal: dec(descuento), total: dec(total),
          createdAt: creado, updatedAt: ultimo,
          items: { create: items.map((it) => ({ id: it.id, variantId: it.varianteId, productName: variantes.find((v) => v.id === it.varianteId)!.productoNombre, variantLabel: variantes.find((v) => v.id === it.varianteId)!.etiqueta, quantity: it.cantidad, unitPrice: dec(it.precio), discountAmount: dec(descuentoItem.get(it.id) ?? 0) })) },
          onlineOrderDetails: {
            create: {
              shippingMethod: esPos ? null : delivery ? 'DELIVERY' : 'PICKUP',
              shippingAddressId: delivery && cliente ? cliente.direccionId : null,
              shippingStreet: delivery ? (cliente?.calle ?? `${r.uno(CALLES)} ${r.entre(100, 4800)}`) : null,
              shippingCity: delivery ? ciudad[0] : null, shippingProvincia: delivery ? ciudad[1] : null, shippingZip: delivery ? ciudad[2] : null,
              buyerName: nombreComprador, buyerEmail: cliente?.email ?? (esPos ? null : `comprador${numero}@example.com`), buyerPhone: cliente?.telefono ?? null,
              carrier: delivery ? r.uno(TRANSPORTES) : null,
              tracking: delivery && ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(estado) ? `${r.entre(100000, 999999)}${r.entre(100000, 999999)}` : null,
              shippingCost: envio != null ? dec(envio) : null,
            },
          },
          statusHistory: { create: historial },
          payments: {
            create: {
              id: idDemo(`pago:${numero}`), businessId, method: metodo, status: pago.status, amount: dec(total), channel: esPos ? 'POS' : 'ONLINE',
              paidAt: pago.paidAt, reference: metodo === 'MERCADOPAGO' ? `${r.entre(10000000, 99999999)}${r.entre(100, 999)}` : null,
              // Comisión de Mercado Pago (acreditación inmediata): la muestra el dashboard.
              mpFeeAmount: metodo === 'MERCADOPAGO' && pago.status === 'APPROVED' ? dec(total * 0.0629) : null,
              verifiedBy: metodo === 'TRANSFER' && pago.status === 'APPROVED' ? dueno.id : null,
              verifiedAt: metodo === 'TRANSFER' && pago.status === 'APPROVED' ? pago.paidAt : null,
              // Los reportes de facturación miran updatedAt del pago: tiene que ser el momento del cobro.
              createdAt: creado, updatedAt: pago.paidAt ?? creado,
            },
          },
        },
      });
      if (redenciones.length) await prisma.discountRedemption.createMany({ data: redenciones });

      // Stock: cada venta no cancelada descuenta.
      if (estado !== 'CANCELLED') {
        await prisma.stockMovement.createMany({
          data: items.map((it) => ({ id: idDemo(`movimiento:${it.id}`), businessId, branchId: sucursal.id, variantId: it.varianteId, type: 'SALIDA' as const, quantity: -it.cantidad, reason: `Venta #${numero}`, orderId: pedidoId, createdAt: historial[Math.min(1, historial.length - 1)].createdAt })),
        });
        for (const it of items) vendido.set(it.varianteId, (vendido.get(it.varianteId) ?? 0) + it.cantidad);
      }
      pedidos.push({ id: pedidoId, numero, clienteIdx, estado, creado, items, total });
    }
  }
  // Entrada de mercadería inicial: lo vendido + lo que queda hoy.
  await prisma.stockMovement.createMany({
    data: variantes.map((v) => ({ id: idDemo(`movimiento:entrada:${v.id}`), businessId, branchId: sucursal.id, variantId: v.id, type: 'ENTRADA' as const, quantity: v.stockFinal + (vendido.get(v.id) ?? 0), reason: 'Compra a proveedor', createdBy: dueno.id, createdAt: hace(100 * DIA) })),
  });
  for (const [clave, id] of Object.entries(cupones)) {
    if (usosCupon[clave]) await prisma.discount.update({ where: { id }, data: { usesConsumed: usosCupon[clave] } });
  }
  const usosGamer = await prisma.discountRedemption.count({ where: { discountId: semanaGamer } });
  await prisma.discount.update({ where: { id: semanaGamer }, data: { usesConsumed: usosGamer } });

  // ── Cliente "Invitado" ────────────────────────────────────────────────────
  // Con quien entra cualquier visitante a la tienda demo, sin login (ver
  // AuthService.demoSession). Se queda con pedidos ya sembrados de estados
  // distintos: "Mis pedidos" arranca con historia en vez de vacío.
  const [ciudadInv, provinciaInv, cpInv] = CIUDADES[0];
  const invitado = {
    id: idDemo('cliente:invitado'), nombre: 'Invitado', apellido: 'Demo', email: EMAIL_INVITADO, telefono: '1100000000',
    ciudad: CIUDADES[0], direccionId: idDemo('direccion:invitado'), calle: 'Av. Corrientes 1234', alta: hace(150 * DIA),
  };
  await prisma.customer.create({
    data: {
      id: invitado.id, businessId, firstName: invitado.nombre, lastName: invitado.apellido, email: invitado.email, phone: invitado.telefono,
      emailVerified: true, createdAt: invitado.alta, updatedAt: invitado.alta,
      addresses: { create: { id: invitado.direccionId, alias: 'Casa', street: invitado.calle, city: ciudadInv, provincia: provinciaInv, zip: cpInv, isDefault: true, createdAt: invitado.alta } },
    },
  });
  const idxInvitado = clientes.push(invitado) - 1;
  const tomados = new Set<string>();
  for (const estado of ['PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'COMPLETED', 'CANCELLED'] as const) {
    const o = await prisma.order.findFirst({
      where: { businessId, channel: 'ONLINE', status: estado, id: { notIn: [...tomados] } },
      orderBy: { createdAt: 'desc' },
      include: { onlineOrderDetails: { select: { shippingMethod: true } } },
    });
    if (!o) continue;
    tomados.add(o.id);
    const conEnvio = o.onlineOrderDetails?.shippingMethod === 'DELIVERY';
    await prisma.order.update({
      where: { id: o.id },
      data: {
        customerId: invitado.id,
        onlineOrderDetails: {
          update: {
            buyerName: `${invitado.nombre} ${invitado.apellido}`, buyerEmail: invitado.email, buyerPhone: invitado.telefono,
            ...(conEnvio ? { shippingAddressId: invitado.direccionId, shippingStreet: invitado.calle, shippingCity: ciudadInv, shippingProvincia: provinciaInv, shippingZip: cpInv } : {}),
          },
        },
      },
    });
    await prisma.discountRedemption.updateMany({ where: { orderId: o.id }, data: { customerId: invitado.id } });
    const p = pedidos.find((x) => x.id === o.id);
    if (p) p.clienteIdx = idxInvitado;
  }

  // ── Reseñas ──────────────────────────────────────────────────────────────
  console.log('Reseñas, mensajes, devoluciones…');
  const reseñados = new Set<string>();
  const entregados = pedidos.filter((p) => p.clienteIdx != null && ['DELIVERED', 'COMPLETED'].includes(p.estado));
  let nResenas = 0;
  for (const p of entregados) {
    if (nResenas >= 42 || !r.si(0.45)) continue;
    const it = p.items[0];
    const clave = `${p.clienteIdx}:${it.productoClave}`;
    if (reseñados.has(clave)) continue;
    reseñados.add(clave);
    const cuando = new Date(Math.min(p.creado.getTime() + r.entre(5, 12) * DIA, ahora.getTime() - HORA));
    await prisma.review.create({
      data: { id: idDemo(`resena:${p.numero}`), businessId, productId: idDemo(`producto:${it.productoClave}`), customerId: clientes[p.clienteIdx!].id, orderId: p.id, text: r.uno(RESENAS[it.categoria]), createdAt: cuando, updatedAt: cuando },
    });
    nResenas++;
  }

  // ── Mensajes ─────────────────────────────────────────────────────────────
  for (const [i, c] of CONVERSACIONES.entries()) {
    const inicio = hace(c.haceHoras * HORA);
    await prisma.conversation.create({
      data: {
        id: idDemo(`conversacion:${i}`), businessId, customerId: clientes[c.cliente].id, isUnread: c.sinLeer,
        createdAt: inicio, updatedAt: new Date(inicio.getTime() + (c.mensajes.length - 1) * 7 * 60000),
        messages: { create: c.mensajes.map(([sender, text], j) => ({ id: idDemo(`mensaje:${i}:${j}`), sender, text, createdAt: new Date(inicio.getTime() + j * 7 * 60000) })) },
      },
    });
  }

  // ── Devoluciones y cancelaciones ──────────────────────────────────────────
  const conCliente = (estados: string[], desde: number, hasta: number) =>
    pedidos.filter((p) => p.clienteIdx != null && estados.includes(p.estado) && (ahora.getTime() - p.creado.getTime()) / DIA >= desde && (ahora.getTime() - p.creado.getTime()) / DIA <= hasta);
  const paraDevolver = conCliente(['DELIVERED'], 5, 12).slice(0, 2);
  for (const [i, p] of paraDevolver.entries()) {
    const it = p.items[0];
    const cuando = new Date(p.creado.getTime() + 6 * DIA);
    await prisma.return.create({
      data: {
        id: idDemo(`devolucion:${p.numero}`), businessId, orderId: p.id, orderItemId: it.id, quantity: 1, amount: dec(it.precio),
        reason: i === 0 ? 'Llegó con un rayón en la parte de atrás.' : 'No era compatible con mi equipo.',
        status: i === 0 ? 'PENDING' : 'APPROVED', refundMethod: 'REFUND', createdAt: cuando, updatedAt: cuando,
      },
    });
  }
  const paraCancelar = conCliente(['CONFIRMED', 'PENDING'], 0, 1).slice(0, 1);
  for (const p of paraCancelar) {
    await prisma.cancellationRequest.create({
      data: { id: idDemo(`cancelacion:${p.numero}`), businessId, orderId: p.id, customerId: clientes[p.clienteIdx!].id, reason: 'Me equivoqué de modelo, quiero cambiarlo por otro.', status: 'PENDING', createdAt: new Date(p.creado.getTime() + 20 * 60000) },
    });
  }
  const cancelado = pedidos.find((p) => p.estado === 'CANCELLED' && p.clienteIdx != null);
  if (cancelado) {
    await prisma.cancellationRequest.create({
      data: { id: idDemo(`cancelacion:${cancelado.numero}`), businessId, orderId: cancelado.id, customerId: clientes[cancelado.clienteIdx!].id, reason: 'Ya no lo necesito.', status: 'APPROVED', refundMethod: 'REFUND', refundStatus: 'REFUNDED', createdAt: new Date(cancelado.creado.getTime() + 25 * HORA) },
    });
  }

  // ── Visitas a la tienda (embudo de conversión) ────────────────────────────
  const visitas: Prisma.StoreVisitCreateManyInput[] = [];
  const rutas = ['/', '/', '/', '/catalogo', '/catalogo/audio', '/catalogo/gaming', '/catalogo/wearables', ...PRODUCTOS.slice(0, 10).map((p) => `/producto/${idDemo(`producto:${p.clave}`)}`)];
  for (let dia = DIAS_DE_HISTORIA; dia >= 0; dia--) {
    const fecha = hace(dia * DIA);
    const n = Math.round((60 + 170 * (1 - dia / DIAS_DE_HISTORIA)) * ([0, 6].includes(fecha.getDay()) ? 1.25 : 1) * (0.85 + r.n() * 0.3) * (dia === 0 ? 0.6 : 1));
    for (let k = 0; k < n; k++) {
      const inicioDia = new Date(fecha); inicioDia.setHours(7, 0, 0, 0);
      let cuando = new Date(inicioDia.getTime() + r.n() * 17 * HORA);
      if (cuando > ahora) cuando = hace(r.entre(1, 600) * 60 * 1000);
      visitas.push({ id: idDemo(`visita:${dia}:${k}`), businessId, domain: `${negocio.subdomain}.orbita.site`, path: r.uno(rutas), createdAt: cuando });
    }
  }
  for (let i = 0; i < visitas.length; i += 2000) await prisma.storeVisit.createMany({ data: visitas.slice(i, i + 2000) });

  // ── Notificaciones del panel ──────────────────────────────────────────────
  const recientes = pedidos.slice(-4).reverse();
  const notificaciones: Prisma.NotificationCreateManyInput[] = recientes.map((p, i) => ({
    id: idDemo(`notificacion:pedido:${p.numero}`), businessId, event: 'nuevo_pedido', title: `Nuevo pedido #${p.numero}`,
    body: `${p.clienteIdx != null ? `${clientes[p.clienteIdx].nombre} ${clientes[p.clienteIdx].apellido}` : 'Un comprador'}: $${p.total.toFixed(2)}`,
    level: 'INFO', isRead: i > 1, resourceType: 'order', resourceId: p.id, createdAt: p.creado,
  }));
  for (const clave of ['drone', 'parlante-asistente']) {
    const v = variantes.find((x) => x.productoClave === clave)!;
    notificaciones.push({ id: idDemo(`notificacion:stock:${clave}`), businessId, event: 'stock_critico', title: `Stock crítico: ${v.productoNombre}`, body: `Quedan ${v.stockFinal} unidades.`, level: 'DANGER', isRead: false, resourceType: 'variant', resourceId: v.id, createdAt: hace(r.entre(3, 20) * HORA) });
  }
  if (paraCancelar[0]) notificaciones.push({ id: idDemo('notificacion:cancelacion'), businessId, event: 'cancelacion_pedida', title: `Piden cancelar el pedido #${paraCancelar[0].numero}`, body: `El cliente pidió cancelar el pedido #${paraCancelar[0].numero}, hace falta aceptarla o rechazarla.`, level: 'WARNING', isRead: false, resourceType: 'order', resourceId: idDemo(`cancelacion:${paraCancelar[0].numero}`), createdAt: new Date(paraCancelar[0].creado.getTime() + 20 * 60000) });
  await prisma.notification.createMany({ data: notificaciones });

  await prisma.business.update({ where: { id: businessId }, data: { demoFechasAl: ahora } });

  const facturado = pedidos.filter((p) => p.estado !== 'CANCELLED').reduce((s, p) => s + p.total, 0);
  console.log(`Listo: ${pedidos.length} pedidos (${pedidos.filter((p) => p.estado === 'CANCELLED').length} cancelados), $${Math.round(facturado).toLocaleString('es-AR')} facturados, ${clientes.length} clientes, ${nResenas} reseñas, ${visitas.length} visitas.`);
}

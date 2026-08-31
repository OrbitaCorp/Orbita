// Migración one-off: catálogo de tefaltacalleok.com (Laravel + MySQL) → Órbita.
// NO es una feature del producto — corre una sola vez, no vive en apps/api/src/.
//
// Fuente: dump JSON de las tablas `categorias` y `productos` (extraído por SSH
// vía `php artisan tinker`, ver RBT-687 / conversación de la migración). Las
// imágenes se traen directo por HTTP público desde tefaltacalleok.com/storage/
// y se resuben a Supabase Storage con la misma convención que
// products.service.ts (`addImage`): bucket "product-images", conversión a
// webp calidad 82, path `${businessId}/${productId}/${uuid}.webp`.
//
// ── Fusión de "color duplicado" ─────────────────────────────────────────────
// El catálogo viejo no tenía opción de color: cada color de un mismo diseño
// era un producto Laravel distinto (mismo precio+categoría+nombre casi
// idéntico). Se detectaron 42 grupos así (88 productos → 42) usando: misma
// categoria_id + mismo precio + nombres con EXACTAMENTE un token distinto Y
// ese token está en COLOR_WHITELIST (lista armada a mano revisando los 94
// pares candidatos reales del catálogo — no una lista genérica, para no
// mezclar marcas/modelos distintos como "Adidas Performance" vs "Adidas
// Retro" o "baggy miller/oslo/gibson/destroyer", que НО son colores).
// Cada grupo se importa como UN Product con ProductOption "Color"
// (isVisual:true, fotos por color vía ProductImage.optionValueId) y, si el
// producto tiene talles, una segunda ProductOption "Talle" cruzada por
// variante. Todo lo que no cae en ningún grupo se importa como producto
// individual, igual que antes.
//
// El origen NO trackea stock por talle (columna `talles` es solo lista
// informativa, `stock` es un entero único por fila) — si hay talles, se
// reparte el stock de esa fila entre sus variantes (estimación, no dato real).
//
// Uso:
//   DRY_RUN=true  npx ts-node prisma/import-tefaltacalleok.ts   (no escribe nada, solo valida y reporta)
//   npx ts-node prisma/import-tefaltacalleok.ts                 (corrida real)
//
// Idempotencia: NO es idempotente. Aborta si ya hay productos para este
// businessId, salvo FORCE=true.

process.loadEnvFile?.();

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import WebSocket from 'ws'; // Node < 22 no expone WebSocket nativo — ver supabase.service.ts

const BUSINESS_ID = process.env.IMPORT_BUSINESS_ID ?? '0c8263e4-f06e-4212-9f3b-e4a65fe36230'; // TeFaltaCalle
const BRANCH_ID = process.env.IMPORT_BRANCH_ID ?? 'cea56a98-4656-4746-b592-23ed1068dfa7'; // sucursal "Principal"
const EXPORT_JSON_PATH =
  process.env.EXPORT_JSON_PATH ??
  'C:\\Users\\Mateo\\AppData\\Local\\Temp\\claude\\C--Users-Mateo-Desktop-Orbita-Orbita-Frontend\\33a56f11-f2bf-48d2-84ca-c90964d607db\\scratchpad\\tefaltacalleok_export.json';
const SOURCE_STORAGE_BASE = 'https://tefaltacalleok.com/storage/';
const PRODUCT_IMAGES_BUCKET = 'product-images';

const DRY_RUN = process.env.DRY_RUN === 'true';
const FORCE = process.env.FORCE === 'true';

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as any },
});

type SourceCategoria = { id: number; nombre: string; slug: string; orden: number; activa: boolean };
type SourceProducto = {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  precio: string;
  talles: string[] | null;
  categoria_id: number;
  activo: boolean;
  stock: number;
  imagen_principal: string;
  imagenes_adicionales: string[] | null;
};
type Export = { categorias: SourceCategoria[]; productos: SourceProducto[] };

// ── Detección de grupos "mismo diseño, distinto color" ──────────────────────

const STOPWORDS = new Set(['de', 'y', 'con', 'a', 'en', 'el', 'la', 'los', 'las', 'del']);
const COLOR_WHITELIST = new Set([
  'negro', 'negra', 'blanco', 'blanca', 'gris', 'azul', 'celeste', 'rojo', 'roja', 'verde',
  'rosa', 'bordo', 'beige', 'crudo', 'camel', 'oxido', 'chocolate', 'natural', 'tostado',
  'pistacho', 'topo', 'marino', 'melange', 'oliva', 'claro',
]);

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeTokens(nombre: string): string[] {
  return nombre
    .split(/\s+/)
    .map(normalizeWord)
    .filter((t) => t && !STOPWORDS.has(t));
}

function computeColorClusters(productos: SourceProducto[]): SourceProducto[][] {
  const withTokens = productos.map((p) => ({ p, tokens: normalizeTokens(p.nombre) }));
  const parent = new Map(productos.map((p) => [p.id, p.id]));
  const find = (x: number): number => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  for (let i = 0; i < withTokens.length; i++) {
    for (let j = i + 1; j < withTokens.length; j++) {
      const a = withTokens[i];
      const b = withTokens[j];
      if (a.p.categoria_id !== b.p.categoria_id || a.p.precio !== b.p.precio) continue;
      if (a.tokens.length !== b.tokens.length) continue;
      const diffIdx: number[] = [];
      for (let k = 0; k < a.tokens.length; k++) if (a.tokens[k] !== b.tokens[k]) diffIdx.push(k);
      if (diffIdx.length === 1) {
        const k = diffIdx[0];
        if (COLOR_WHITELIST.has(a.tokens[k]) && COLOR_WHITELIST.has(b.tokens[k])) {
          union(a.p.id, b.p.id);
        }
      }
    }
  }

  const groups = new Map<number, SourceProducto[]>();
  for (const p of productos) {
    const root = find(p.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(p);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}

/** Nombre base común a todo el cluster = palabras (con su casing original,
 * tomadas del primer miembro) cuya forma normalizada aparece en TODOS los
 * miembros, o son stopword. El resto (el color) se descarta acá. */
function computeCommonName(cluster: SourceProducto[]): { commonName: string; commonNormSet: Set<string> } {
  const tokenSets = cluster.map((p) => new Set(normalizeTokens(p.nombre)));
  const firstRawWords = cluster[0].nombre.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  const commonNormSet = new Set<string>();
  for (const w of firstRawWords) {
    const norm = normalizeWord(w);
    if (!norm) continue;
    const isStopword = STOPWORDS.has(norm);
    const inAll = tokenSets.every((s) => s.has(norm));
    if (isStopword || inAll) {
      kept.push(w);
      commonNormSet.add(norm);
    }
  }
  return { commonName: kept.join(' '), commonNormSet };
}

/** Etiqueta de color de UN miembro = sus palabras que no están en el nombre común. */
function colorLabelFor(member: SourceProducto, commonNormSet: Set<string>): string {
  const rawWords = member.nombre.split(/\s+/).filter(Boolean);
  const leftover = rawWords.filter((w) => {
    const norm = normalizeWord(w);
    return norm && !STOPWORDS.has(norm) && !commonNormSet.has(norm);
  });
  const label = leftover.join(' ').trim();
  if (!label) return 'Color'; // no debería pasar dado cómo se arman los clusters
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function splitStock(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function overallStatus(members: SourceProducto[]): ProductStatus {
  if (members.some((m) => m.activo && m.stock > 0)) return 'PUBLISHED';
  if (members.some((m) => m.activo)) return 'OUT_OF_STOCK';
  return 'DRAFT';
}

// ── Imágenes ─────────────────────────────────────────────────────────────

async function fetchAndReencode(relPath: string): Promise<Buffer | null> {
  const url = SOURCE_STORAGE_BASE + relPath;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ imagen no disponible (${res.status}): ${url}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return await sharp(Buffer.from(arrayBuffer)).webp({ quality: 82 }).toBuffer();
  } catch (err) {
    console.warn(`  ⚠ error bajando/convirtiendo ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function uploadImage(productId: string, webpBuffer: Buffer): Promise<string | null> {
  const storagePath = `${BUSINESS_ID}/${productId}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: false });
  if (uploadError) {
    console.warn(`  ⚠ no se pudo subir a Supabase: ${uploadError.message}`);
    return null;
  }
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

const stats = { productosOk: 0, productosError: 0, variantes: 0, imagenesOk: 0, imagenesFallidas: 0, errores: [] as string[] };

async function importStandalone(prod: SourceProducto, categoryId: string) {
  const talles = Array.isArray(prod.talles) ? prod.talles.filter(Boolean) : [];
  const status = overallStatus([prod]);

  const product = await prisma.product.create({
    data: {
      businessId: BUSINESS_ID,
      categoryId,
      name: prod.nombre,
      description: prod.descripcion ?? null,
      basePrice: prod.precio,
      status,
    },
  });

  if (talles.length > 0) {
    const option = await prisma.productOption.create({ data: { productId: product.id, name: 'Talle', position: 0, isVisual: false } });
    const quantities = splitStock(prod.stock, talles.length);
    for (const [i, talle] of talles.entries()) {
      const optionValue = await prisma.productOptionValue.create({ data: { optionId: option.id, value: String(talle), position: i } });
      const variant = await prisma.productVariant.create({ data: { productId: product.id, price: prod.precio, isDefault: false, isActive: true } });
      await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId: optionValue.id } });
      await prisma.variantStock.create({ data: { variantId: variant.id, branchId: BRANCH_ID, quantity: quantities[i] } });
      stats.variantes++;
    }
  } else {
    const variant = await prisma.productVariant.create({ data: { productId: product.id, price: prod.precio, isDefault: true, isActive: true } });
    await prisma.variantStock.create({ data: { variantId: variant.id, branchId: BRANCH_ID, quantity: prod.stock } });
    stats.variantes++;
  }

  await importImages(product.id, [prod.imagen_principal, ...(prod.imagenes_adicionales ?? [])].filter(Boolean), null, 0);
}

async function importMerged(cluster: SourceProducto[], categoryId: string) {
  const { commonName, commonNormSet } = computeCommonName(cluster);
  const status = overallStatus(cluster);
  const anyTalles = cluster.some((m) => Array.isArray(m.talles) && m.talles.length > 0);

  const product = await prisma.product.create({
    data: {
      businessId: BUSINESS_ID,
      categoryId,
      name: commonName || cluster[0].nombre,
      description: cluster[0].descripcion ?? null,
      basePrice: cluster[0].precio,
      status,
    },
  });

  const colorOption = await prisma.productOption.create({ data: { productId: product.id, name: 'Color', position: 0, isVisual: true } });
  const talleOption = anyTalles
    ? await prisma.productOption.create({ data: { productId: product.id, name: 'Talle', position: 1, isVisual: false } })
    : null;
  // Talle values: unión de todos los talles usados por cualquier color, una sola vez.
  const talleValueByName = new Map<string, string>(); // talle -> optionValueId
  if (talleOption) {
    const allTalles = [...new Set(cluster.flatMap((m) => (m.talles ?? []).filter(Boolean)))];
    for (const [i, t] of allTalles.entries()) {
      const ov = await prisma.productOptionValue.create({ data: { optionId: talleOption.id, value: String(t), position: i } });
      talleValueByName.set(String(t), ov.id);
    }
  }

  let imagePosition = 0;
  for (const [colorIdx, member] of cluster.entries()) {
    const colorLabel = colorLabelFor(member, commonNormSet);
    const colorValue = await prisma.productOptionValue.create({ data: { optionId: colorOption.id, value: colorLabel, position: colorIdx } });

    const talles = Array.isArray(member.talles) ? member.talles.filter(Boolean) : [];
    if (talles.length > 0) {
      const quantities = splitStock(member.stock, talles.length);
      for (const [i, talle] of talles.entries()) {
        const variant = await prisma.productVariant.create({ data: { productId: product.id, price: member.precio, isDefault: false, isActive: true } });
        await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId: colorValue.id } });
        const talleOptionValueId = talleValueByName.get(String(talle));
        if (talleOptionValueId) {
          await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId: talleOptionValueId } });
        }
        await prisma.variantStock.create({ data: { variantId: variant.id, branchId: BRANCH_ID, quantity: quantities[i] } });
        stats.variantes++;
      }
    } else {
      const variant = await prisma.productVariant.create({ data: { productId: product.id, price: member.precio, isDefault: colorIdx === 0, isActive: true } });
      await prisma.variantOptionValue.create({ data: { variantId: variant.id, optionValueId: colorValue.id } });
      await prisma.variantStock.create({ data: { variantId: variant.id, branchId: BRANCH_ID, quantity: member.stock } });
      stats.variantes++;
    }

    const paths = [member.imagen_principal, ...(member.imagenes_adicionales ?? [])].filter(Boolean);
    imagePosition = await importImages(product.id, paths, colorValue.id, imagePosition);
  }
}

async function importImages(productId: string, relPaths: string[], optionValueId: string | null, startPosition: number): Promise<number> {
  let position = startPosition;
  for (const relPath of relPaths) {
    const webp = await fetchAndReencode(relPath);
    if (!webp) {
      stats.imagenesFallidas++;
      continue;
    }
    const publicUrl = await uploadImage(productId, webp);
    if (!publicUrl) {
      stats.imagenesFallidas++;
      continue;
    }
    await prisma.productImage.create({
      data: { productId, optionValueId, url: publicUrl, position, isPrimary: position === 0 },
    });
    stats.imagenesOk++;
    position++;
  }
  return position;
}

async function main() {
  const raw = fs.readFileSync(path.resolve(EXPORT_JSON_PATH), 'utf8');
  const data: Export = JSON.parse(raw);

  const clusters = computeColorClusters(data.productos);
  const clusteredIds = new Set(clusters.flatMap((c) => c.map((p) => p.id)));
  const standalone = data.productos.filter((p) => !clusteredIds.has(p.id));

  console.log(`Fuente: ${data.categorias.length} categorías, ${data.productos.length} productos.`);
  console.log(`Fusión por color: ${clusters.length} grupos (${clusteredIds.size} productos) → quedan en ${clusters.length} productos. Sueltos: ${standalone.length}.`);
  console.log(`Total productos Órbita resultantes: ${clusters.length + standalone.length}`);
  console.log(`Destino: businessId=${BUSINESS_ID} branchId=${BRANCH_ID} — ${DRY_RUN ? 'DRY RUN (no escribe nada)' : 'CORRIDA REAL'}`);

  if (!DRY_RUN) {
    const business = await prisma.business.findUnique({ where: { id: BUSINESS_ID } });
    if (!business) throw new Error(`No existe Business ${BUSINESS_ID}`);
    const branch = await prisma.branch.findUnique({ where: { id: BRANCH_ID } });
    if (!branch || branch.businessId !== BUSINESS_ID) throw new Error(`Branch ${BRANCH_ID} inválida para este business`);
    const existing = await prisma.product.count({ where: { businessId: BUSINESS_ID } });
    if (existing > 0 && !FORCE) {
      throw new Error(`Ya hay ${existing} productos cargados para este business. Corré con FORCE=true si sabés lo que hacés.`);
    }
  }

  if (DRY_RUN) {
    console.log('\n── Grupos fusionados (nombre común detectado) ──');
    for (const cluster of clusters) {
      const { commonName, commonNormSet } = computeCommonName(cluster);
      const labels = cluster.map((m) => colorLabelFor(m, commonNormSet));
      console.log(`  "${commonName}" → colores: [${labels.join(', ')}]`);
    }
    return;
  }

  // ── Categorías ──
  const categoriaIdMap = new Map<number, string>();
  for (const cat of data.categorias) {
    const category = await prisma.category.upsert({
      where: { businessId_slug: { businessId: BUSINESS_ID, slug: cat.slug } },
      update: {},
      create: { businessId: BUSINESS_ID, name: cat.nombre, slug: cat.slug, isActive: cat.activa, position: cat.orden ?? 0 },
    });
    categoriaIdMap.set(cat.id, category.id);
  }
  console.log(`Categorías: ${categoriaIdMap.size} creadas/existentes`);

  for (const [idx, cluster] of clusters.entries()) {
    const categoryId = categoriaIdMap.get(cluster[0].categoria_id)!;
    const label = `[merge ${idx + 1}/${clusters.length}] "${computeCommonName(cluster).commonName}" (${cluster.length} colores, ids=${cluster.map((c) => c.id).join(',')})`;
    try {
      await importMerged(cluster, categoryId);
      console.log(`${label} → OK`);
      stats.productosOk++;
    } catch (err) {
      stats.productosError++;
      const msg = `${label} → ERROR: ${(err as Error).message}`;
      console.error(msg);
      stats.errores.push(msg);
    }
  }

  for (const [idx, prod] of standalone.entries()) {
    const label = `[standalone ${idx + 1}/${standalone.length}] "${prod.nombre}" (id=${prod.id})`;
    try {
      const categoryId = categoriaIdMap.get(prod.categoria_id);
      if (!categoryId) throw new Error(`categoria_id=${prod.categoria_id} no está en el mapa`);
      await importStandalone(prod, categoryId);
      console.log(`${label} → OK`);
      stats.productosOk++;
    } catch (err) {
      stats.productosError++;
      const msg = `${label} → ERROR: ${(err as Error).message}`;
      console.error(msg);
      stats.errores.push(msg);
    }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Productos Órbita creados OK: ${stats.productosOk}/${clusters.length + standalone.length}`);
  console.log(`Productos con error: ${stats.productosError}`);
  console.log(`Variantes creadas: ${stats.variantes}`);
  console.log(`Imágenes subidas: ${stats.imagenesOk} | fallidas: ${stats.imagenesFallidas}`);
  if (stats.errores.length > 0) {
    console.log('\nErrores:');
    stats.errores.forEach((e) => console.log(' - ' + e));
  }
}

main()
  .catch((err) => {
    console.error('FALLÓ:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

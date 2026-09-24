// Re-procesa fotos de producto YA subidas de un negocio puntual, aplicando el
// mismo tope de tamaño que products.service.ts le puso a las subidas NUEVAS
// (ver el commit "fix(productos): topear el tamaño de las fotos al subirlas"):
// fit:'inside' a 1600px de lado más largo, SIN agrandar lo que ya es chico
// (proporción intacta, nunca se recorta ni se distorsiona). Ese fix no toca
// lo que ya estaba en Storage — este script es el backfill para eso.
//
// Pensado para venustyle (fotos subidas directo del celular del vendedor, sin
// resize — de ahí el catálogo trabado al paginar) pero sirve para cualquier
// negocio: BUSINESS_SLUG elige cuál.
//
// Reprocesa y resube al MISMO path (upsert) — no hace falta tocar
// ProductImage.url en la base ni queda ninguna fila huérfana. Una foto que ya
// mide 1600px o menos de lado más largo se deja tal cual (no se re-comprime
// de nuevo sin necesidad).
//
// La base del .env es PRODUCCIÓN. Por eso:
//   BUSINESS_SLUG=venustyle node --env-file=.env scripts/reoptimizar-fotos-producto.cjs         → dry run (no escribe nada, solo reporta)
//   BUSINESS_SLUG=venustyle node --env-file=.env scripts/reoptimizar-fotos-producto.cjs --si     → lo aplica de verdad

const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const WebSocket = require('ws'); // Node < 22 no expone WebSocket nativo — ver supabase.service.ts / import-tefaltacalleok.ts

const MAX_LADO = 1600;
const BUCKET = 'product-images';

(async () => {
  const slug = process.env.BUSINESS_SLUG;
  if (!slug) {
    console.error('Falta BUSINESS_SLUG=<subdominio> (ej: BUSINESS_SLUG=venustyle)');
    process.exit(1);
  }
  const aplicar = process.argv.includes('--si');

  const prisma = new PrismaClient();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });

  const business = await prisma.business.findUnique({ where: { subdomain: slug }, select: { id: true, name: true } });
  if (!business) {
    console.error(`No existe ningún negocio con subdominio "${slug}"`);
    process.exit(1);
  }

  const imagenes = await prisma.productImage.findMany({
    where: { product: { businessId: business.id } },
    select: { id: true, url: true },
    orderBy: { id: 'asc' },
  });
  console.log(
    `${business.name} (${slug}): ${imagenes.length} fotos de producto. ` +
      (aplicar ? 'CORRIDA REAL' : 'DRY RUN (no escribe nada — correr con --si para aplicarlo)'),
  );

  let achicadas = 0;
  let yaOk = 0;
  let sinPath = 0;
  let errores = 0;
  let pesoAntes = 0;
  let pesoDespues = 0;

  const marker = `/${BUCKET}/`;
  for (const [i, img] of imagenes.entries()) {
    const idx = img.url.indexOf(marker);
    if (idx === -1) {
      sinPath++;
      continue;
    }
    const path = img.url.slice(idx + marker.length);

    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) {
        console.warn(`  ⚠ [${i + 1}/${imagenes.length}] no se pudo bajar ${path}: ${error?.message ?? 'sin datos'}`);
        errores++;
        continue;
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      const meta = await sharp(buffer).metadata();
      const lado = Math.max(meta.width ?? 0, meta.height ?? 0);

      if (lado <= MAX_LADO) {
        yaOk++;
        continue;
      }

      const nuevo = await sharp(buffer)
        .resize(MAX_LADO, MAX_LADO, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      pesoAntes += buffer.length;
      pesoDespues += nuevo.length;
      console.log(
        `  ${aplicar ? '✔' : '·'} [${i + 1}/${imagenes.length}] ${path}: ${meta.width}x${meta.height} ` +
          `(${(buffer.length / 1024).toFixed(0)} KB) → ≤${MAX_LADO}px (${(nuevo.length / 1024).toFixed(0)} KB)`,
      );

      if (aplicar) {
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, nuevo, { contentType: 'image/webp', upsert: true });
        if (upErr) {
          console.warn(`    ⚠ no se pudo resubir: ${upErr.message}`);
          errores++;
          continue;
        }
      }
      achicadas++;
    } catch (err) {
      console.warn(`  ⚠ [${i + 1}/${imagenes.length}] error con ${path}: ${err.message}`);
      errores++;
    }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Ya estaban bien (≤${MAX_LADO}px): ${yaOk}`);
  console.log(
    `${aplicar ? 'Achicadas' : 'Se achicarían'}: ${achicadas}` +
      (achicadas > 0 ? ` (${(pesoAntes / 1024 / 1024).toFixed(1)} MB → ${(pesoDespues / 1024 / 1024).toFixed(1)} MB)` : ''),
  );
  if (sinPath > 0) console.log(`Sin path reconocible del bucket ${BUCKET} (se dejan intactas): ${sinPath}`);
  if (errores > 0) console.log(`Errores: ${errores}`);
  if (!aplicar && achicadas > 0) console.log('\n(dry run: correr con --si para aplicarlo de verdad)');

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});

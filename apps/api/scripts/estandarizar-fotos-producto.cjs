// ⚠ NO CORRER SIN PORTAR EL ARREGLO DEL 05/10/2026. Este script reimplementa el
// criterio VIEJO del estandarizador: toma una foto con fondo de textura (una alfombra)
// por "fondo liso" y la pega en un lienzo cuadrado con un marco de color plano que se
// ve en la tarjeta del catálogo (caso venustyle). El panel ya usa un criterio nuevo
// (analizarBorde en apps/web/src/lib/imageStandardizer.ts: el fondo es plano solo si
// ≥90% de la banda del borde es del mismo color; si no, la foto no se toca). Para
// reparar fotos que ya quedaron con marco: scripts/quitar-marco-fotos-producto.ts.
//
// Backfill: aplica a las fotos YA EXISTENTES de un negocio puntual el mismo
// estandarizador de encuadre que ya corre en las subidas nuevas del panel
// (ver apps/web/src/lib/imageStandardizer.ts) — pedido de indecisastore para
// no tener que resubir el catálogo entero a mano.
//
// Ese estandarizador vive en el navegador (usa Canvas: <img>, CanvasRenderingContext2D).
// Acá no hay navegador, así que este script REIMPLEMENTA el mismo algoritmo
// con `sharp` en vez de llamar al código real — misma idea (detectar fondo
// uniforme o transparencia, auto-trim por bounding box, centrar en lienzo
// cuadrado 1200x1200 con fillRatio 0.90), mismos umbrales (UMBRAL_DIST=26,
// varianza de borde <=32, margen de seguridad 1.5%). La única diferencia real:
// la detección de transparencia usa el canal alfa completo de la imagen de
// análisis en vez de 100 muestras al azar (más robusto para un batch sin
// supervisión). Si algún día el algoritmo original cambia, hay que portar el
// cambio acá a mano — no se importa el módulo de apps/web porque corre en
// Node, no en navegador.
//
// Salida: mismo bucket/path/contentType que ya tenía cada foto (todas quedan
// en webp, ver subirImagenWebp en products.service.ts) — no hace falta tocar
// ProductImage.url en la base.
//
// OJO — la base de apps/api/.env es de PRUEBAS desde el 21/09 (ver
// apps/api/CLAUDE.md § y la memoria del proyecto). indecisastore es un
// negocio real: este script necesita las credenciales de PRODUCCIÓN
// (Secret Manager, proyecto orbita-api-corp), pasadas por variables de
// entorno explícitas — NO correr con --env-file=.env:
//
//   export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL --project=orbita-api-corp)
//   export DIRECT_URL=$(gcloud secrets versions access latest --secret=DIRECT_URL --project=orbita-api-corp)
//   export SUPABASE_URL=$(gcloud secrets versions access latest --secret=SUPABASE_URL --project=orbita-api-corp)
//   export SUPABASE_SERVICE_ROLE_KEY=$(gcloud secrets versions access latest --secret=SUPABASE_SERVICE_ROLE_KEY --project=orbita-api-corp)
//
//   BUSINESS_SLUG=indecisastore node scripts/estandarizar-fotos-producto.cjs                                        → dry run, no escribe nada
//   BUSINESS_SLUG=indecisastore node scripts/estandarizar-fotos-producto.cjs --muestra 8                             → procesa solo 8 fotos y las guarda en scripts/backups/<slug>-<ts>/muestra/ (original + resultado, NADA se resube) para mirar el resultado antes de correrlo en serio
//   BUSINESS_SLUG=indecisastore node scripts/estandarizar-fotos-producto.cjs --si                                    → lo aplica de verdad, guardando antes una copia de cada original en scripts/backups/<slug>-<ts>/
//   BUSINESS_SLUG=indecisastore node scripts/estandarizar-fotos-producto.cjs --fill 0.85 --muestra 8                 → probar otro fillRatio sin tocar el default
//   BUSINESS_SLUG=indecisastore node scripts/estandarizar-fotos-producto.cjs --si --desde-backup scripts/backups/indecisastore-<ts-de-la-corrida-anterior>   → RE-procesa (ej. con un fillRatio nuevo) leyendo el original real del backup de una corrida anterior, no la versión ya estandarizada que quedó en Storage
//
// El recorte automático puede equivocarse en fotos raras (fondo casi uniforme
// pero con sombra fuerte, etc.) — por eso cada foto que se toca queda
// respaldada en scripts/backups/<slug>-<ts>/<path original>, con el mismo
// nombre que tenía en el bucket, para poder revertir una puntual a mano
// (resubirla de nuevo con el mismo path).

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const WebSocket = require('ws'); // Node < 22 no expone WebSocket nativo — ver supabase.service.ts

const BUCKET = 'product-images';
const TARGET_SIZE = 1200;
const FILL_RATIO = 0.90;
const MAX_ANALISIS = 400;
const UMBRAL_DIST = 26;
const VAR_UNIFORME_MAX = 32;

async function estandarizar(buffer, fillRatio = FILL_RATIO) {
  const base = sharp(buffer, { failOn: 'none' }).rotate(); // rotate() sin args = auto-orient por EXIF, como hace el navegador al pintar el <img>
  const meta = await base.metadata();
  const origW = meta.width;
  const origH = meta.height;

  if (!origW || !origH || origW < 10 || origH < 10) {
    return { buffer, cambiado: false, motivo: 'imagen invalida o muy chica' };
  }

  const escala = Math.min(1, MAX_ANALISIS / Math.max(origW, origH));
  const aW = Math.max(1, Math.round(origW * escala));
  const aH = Math.max(1, Math.round(origH * escala));

  const { data } = await base.clone().resize(aW, aH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const totalPx = aW * aH;
  let transparentCount = 0;
  for (let i = 0; i < totalPx; i++) {
    if (data[i * 4 + 3] < 220) transparentCount++;
  }
  const tieneTransparencia = transparentCount / totalPx > 0.02;

  let esFondoUniforme = false;
  let bgR = 255, bgG = 255, bgB = 255;

  if (!tieneTransparencia) {
    const esquinas = [
      [0, 0], [aW - 1, 0], [0, aH - 1], [aW - 1, aH - 1],
      [Math.floor(aW / 2), 0], [Math.floor(aW / 2), aH - 1],
      [0, Math.floor(aH / 2)], [aW - 1, Math.floor(aH / 2)],
    ];
    const muestras = esquinas.map(([x, y]) => {
      const i = (y * aW + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    });
    bgR = Math.round(muestras.reduce((s, m) => s + m[0], 0) / muestras.length);
    bgG = Math.round(muestras.reduce((s, m) => s + m[1], 0) / muestras.length);
    bgB = Math.round(muestras.reduce((s, m) => s + m[2], 0) / muestras.length);
    const varProm = muestras.reduce((s, [r, g, b]) => s + Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2), 0) / muestras.length;
    esFondoUniforme = varProm <= VAR_UNIFORME_MAX;
  }

  // Caso "lifestyle" (fondo complejo, no uniforme y sin transparencia): no se
  // recorta nada, solo se centra en un lienzo blanco para igualar el tamaño.
  if (!tieneTransparencia && !esFondoUniforme) {
    const scale = (TARGET_SIZE * fillRatio) / Math.max(origW, origH);
    const dW = Math.max(1, Math.round(origW * scale));
    const dH = Math.max(1, Math.round(origH * scale));
    const dx = Math.round((TARGET_SIZE - dW) / 2);
    const dy = Math.round((TARGET_SIZE - dH) / 2);
    const resized = await base.clone().resize(dW, dH, { fit: 'fill' }).toBuffer();
    const out = await sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 3, background: '#ffffff' } })
      .composite([{ input: resized, left: dx, top: dy }])
      .webp({ quality: 90 })
      .toBuffer();
    return { buffer: out, cambiado: true, motivo: 'lifestyle-centrado', scale };
  }

  // Bounding box del producto sobre el lienzo de análisis.
  let minX = aW, maxX = -1, minY = aH, maxY = -1, pixelesProducto = 0;
  for (let y = 0; y < aH; y++) {
    for (let x = 0; x < aW; x++) {
      const i = (y * aW + x) * 4;
      let esProducto;
      if (tieneTransparencia) {
        esProducto = data[i + 3] > 25;
      } else {
        const dist = Math.sqrt((data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2);
        esProducto = dist > UMBRAL_DIST;
      }
      if (esProducto) {
        pixelesProducto++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (pixelesProducto < 50 || minX > maxX || minY > maxY) {
    return { buffer, cambiado: false, motivo: 'no se detecto producto (foto casi vacia)' };
  }

  const factorX = origW / aW;
  const factorY = origH / aH;
  const margenSeg = Math.max(4, Math.round(Math.min(origW, origH) * 0.015));
  const cropX = Math.max(0, Math.floor(minX * factorX) - margenSeg);
  const cropY = Math.max(0, Math.floor(minY * factorY) - margenSeg);
  const cropW = Math.min(origW - cropX, Math.ceil((maxX - minX + 1) * factorX) + margenSeg * 2);
  const cropH = Math.min(origH - cropY, Math.ceil((maxY - minY + 1) * factorY) + margenSeg * 2);

  const scale = (TARGET_SIZE * fillRatio) / Math.max(cropW, cropH);
  const destW = Math.max(1, Math.round(cropW * scale));
  const destH = Math.max(1, Math.round(cropH * scale));
  const destX = Math.round((TARGET_SIZE - destW) / 2);
  const destY = Math.round((TARGET_SIZE - destH) / 2);

  const cropped = await base.clone()
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize(destW, destH, { fit: 'fill' })
    .toBuffer();

  let out;
  if (tieneTransparencia) {
    out = await sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: destX, top: destY }])
      .webp({ quality: 90 })
      .toBuffer();
  } else {
    const bg = (bgR > 235 && bgG > 235 && bgB > 235) ? '#ffffff' : `rgb(${bgR},${bgG},${bgB})`;
    out = await sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 3, background: bg } })
      .composite([{ input: cropped, left: destX, top: destY }])
      .webp({ quality: 90 })
      .toBuffer();
  }

  return { buffer: out, cambiado: true, motivo: tieneTransparencia ? 'recorte-transparente' : 'recorte-fondo-uniforme', scale };
}

(async () => {
  const slug = process.env.BUSINESS_SLUG;
  if (!slug) {
    console.error('Falta BUSINESS_SLUG=<subdominio> (ej: BUSINESS_SLUG=indecisastore)');
    process.exit(1);
  }
  const aplicar = process.argv.includes('--si');
  const idxMuestra = process.argv.indexOf('--muestra');
  const muestra = idxMuestra !== -1 ? parseInt(process.argv[idxMuestra + 1], 10) || 5 : null;
  const idxFill = process.argv.indexOf('--fill');
  const fillRatio = idxFill !== -1 ? parseFloat(process.argv[idxFill + 1]) || FILL_RATIO : FILL_RATIO;
  // Para RE-procesar un negocio que ya pasó por este script una vez: Storage
  // ya tiene la versión estandarizada anterior, no el archivo real que subió
  // el vendedor. Reprocesar desde ahí compondría un segundo recorte/resize
  // sobre el primero (pérdida doble). --desde-backup apunta a la carpeta de
  // scripts/backups/<slug>-<ts>/ de esa corrida anterior y lee el original
  // real de ahí (mismo layout de paths que el bucket) en vez de descargarlo
  // de Supabase.
  const idxBackup = process.argv.indexOf('--desde-backup');
  const desdeBackup = idxBackup !== -1 ? process.argv[idxBackup + 1] : null;
  if (idxBackup !== -1 && !desdeBackup) {
    console.error('Falta la ruta después de --desde-backup');
    process.exit(1);
  }

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
    select: { id: true, url: true, product: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups', `${slug}-${ts}`);
  const modo = muestra ? `MUESTRA (${muestra} fotos, no resube nada)` : aplicar ? 'CORRIDA REAL' : 'DRY RUN (no escribe nada — correr con --si para aplicarlo)';
  console.log(`${business.name} (${slug}): ${imagenes.length} fotos de producto. ${modo}`);

  const lista = muestra ? imagenes.slice(0, muestra) : imagenes;
  const marker = `/${BUCKET}/`;

  let cambiadas = 0, sinCambio = 0, sinPath = 0, errores = 0, ampliadas = 0;

  for (const [i, img] of lista.entries()) {
    const idx = img.url.indexOf(marker);
    if (idx === -1) {
      console.warn(`  ⚠ [${i + 1}/${lista.length}] URL sin path reconocible del bucket ${BUCKET}: ${img.url}`);
      sinPath++;
      continue;
    }
    const storagePath = img.url.slice(idx + marker.length);

    try {
      let original;
      if (desdeBackup) {
        const backupPath = path.join(desdeBackup, storagePath);
        if (!fs.existsSync(backupPath)) {
          console.warn(`  ⚠ [${i + 1}/${lista.length}] no está en el backup: ${backupPath}`);
          errores++;
          continue;
        }
        original = fs.readFileSync(backupPath);
      } else {
        const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
        if (error || !data) {
          console.warn(`  ⚠ [${i + 1}/${lista.length}] no se pudo bajar ${storagePath}: ${error?.message ?? 'sin datos'}`);
          errores++;
          continue;
        }
        original = Buffer.from(await data.arrayBuffer());
      }
      const { buffer: procesada, cambiado, motivo, scale } = await estandarizar(original, fillRatio);

      const nombreProducto = img.product?.name ?? '(sin nombre)';
      if (!cambiado) {
        console.log(`  · [${i + 1}/${lista.length}] ${nombreProducto} — sin cambios (${motivo})`);
        sinCambio++;
        continue;
      }

      // scale > 1 = el recorte del producto se AGRANDA para llenar el lienzo
      // (no hay más pixeles reales que estirar) — ahí sí se puede notar menos
      // nitidez. scale <= 1 es downscale (normal, sin pérdida perceptible).
      const amplio = scale > 1.02;
      if (amplio) ampliadas++;
      const avisoAmpliacion = amplio ? ` ⚠ se agranda ${scale.toFixed(2)}x — puede perder nitidez` : '';
      console.log(`  ${aplicar || muestra ? '✔' : '·'} [${i + 1}/${lista.length}] ${nombreProducto} — ${motivo} (${(original.length / 1024).toFixed(0)} KB → ${(procesada.length / 1024).toFixed(0)} KB)${avisoAmpliacion}`);
      cambiadas++;

      if (muestra) {
        const dir = path.join(backupDir, 'muestra');
        fs.mkdirSync(dir, { recursive: true });
        const base = storagePath.replace(/\//g, '__').replace(/\.webp$/, '');
        fs.writeFileSync(path.join(dir, `${base}__ANTES.webp`), original);
        fs.writeFileSync(path.join(dir, `${base}__DESPUES.webp`), procesada);
        continue;
      }

      if (aplicar) {
        const backupPath = path.join(backupDir, storagePath);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, original);

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, procesada, { contentType: 'image/webp', upsert: true });
        if (upErr) {
          console.warn(`    ⚠ no se pudo resubir: ${upErr.message}`);
          errores++;
          continue;
        }
      }
    } catch (err) {
      console.warn(`  ⚠ [${i + 1}/${lista.length}] error con ${storagePath}: ${err.message}`);
      errores++;
    }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Se ${aplicar ? 'estandarizaron' : muestra ? 'habrían estandarizado (muestra guardada localmente)' : 'estandarizarían'}: ${cambiadas}`);
  console.log(`Sin cambios (ya centradas o sin producto detectable): ${sinCambio}`);
  if (ampliadas > 0) console.log(`⚠ Se agrandan (foto de origen chica para el recorte final, pueden perder nitidez): ${ampliadas}`);
  if (sinPath > 0) console.log(`Sin path reconocible del bucket ${BUCKET}: ${sinPath}`);
  if (errores > 0) console.log(`Errores: ${errores}`);
  if (muestra) console.log(`\nMuestra guardada en: ${path.join(backupDir, 'muestra')} (mirar los pares __ANTES/__DESPUES antes de correr --si)`);
  else if (aplicar) console.log(`\nBackup de los originales tocados en: ${backupDir}`);
  else if (cambiadas > 0) console.log('\n(dry run: correr con --muestra 8 para ver resultados antes de aplicar, o con --si para aplicarlo de verdad)');

  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});

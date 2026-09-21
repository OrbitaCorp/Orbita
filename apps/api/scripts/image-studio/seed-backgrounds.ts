// Genera y sube a R2 las variantes pre-armadas de cada estilo del catálogo
// de ImageStudioService (ver src/image-studio/background-styles.ts).
//
// Por qué existe: generar el fondo con Flux en vivo en cada uso real
// consumía cuota y agregaba 2-4s de espera por click, para algo que ni
// depende del producto del vendedor (el fondo es genérico, centro vacío a
// propósito). Este script corre UNA VEZ (y de nuevo si se amplía el
// catálogo o se quiere refrescar variedad) y deja las imágenes ya listas en
// R2 — el flujo real (ImageStudioService.generateBackground) las lee de ahí
// en vez de llamar a Flux, salvo que el vendedor pida una descripción
// personalizada (ver comentario en ese archivo).
//
// Uso: npx ts-node -P tsconfig.json scripts/image-studio/seed-backgrounds.ts
// Necesita las mismas env vars que el resto (CF_WORKERS_AI_API_TOKEN,
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) — correr
// con `node -r dotenv/config` o exportadas a mano, según cómo se cargue el
// .env en el entorno donde se corra.
import { ConfigService } from '@nestjs/config';
import { CloudflareImageService } from '../../src/cloudflare/cloudflare-image.service';
import { R2Service } from '../../src/r2/r2.service';
import { BACKGROUND_STYLES } from '../../src/image-studio/background-styles';

const VARIANTES_POR_ESTILO = 3;
const CARPETA_R2 = 'image-studio/backgrounds';

async function main() {
  const config = new ConfigService(process.env as Record<string, string>);
  const cloudflareImage = new CloudflareImageService(config);
  const r2 = new R2Service(config);

  const resultado: Record<string, string[]> = {};

  for (const [key, style] of Object.entries(BACKGROUND_STYLES)) {
    resultado[key] = [];
    for (let i = 0; i < VARIANTES_POR_ESTILO; i++) {
      process.stdout.write(`${key} [${i + 1}/${VARIANTES_POR_ESTILO}]... `);
      try {
        const { buffer } = await cloudflareImage.generateImage(style.prompt);
        const path = `${CARPETA_R2}/${key}/${i}.jpg`;
        const url = await r2.upload(path, buffer, 'image/jpeg');
        resultado[key].push(path);
        console.log('OK ->', url);
      } catch (err) {
        console.log('FALLÓ:', err instanceof Error ? err.message : err);
      }
    }
  }

  console.log('\n\n=== Resultado (para pegar en background-styles.ts) ===\n');
  console.log(JSON.stringify(resultado, null, 2));
}

main().catch((err) => {
  console.error('Script falló:', err);
  process.exit(1);
});

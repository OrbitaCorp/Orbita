import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Hallazgo `secretos-tarball-cloud-build` de la auditoría interna.
//
// 14 tarballs de gs://orbita-api-corp_cloudbuild/source/ (03/09 al 10/09/2026)
// subieron `apps/api/.env.bak2` con DATABASE_URL, DIRECT_URL, JWT_SECRET y
// SUPABASE_SERVICE_ROLE_KEY en claro. La causa fue de una línea: el
// .gitignore de apps/api listaba `.env`, `.env.local` y `.env.*.local`, y
// `gcloud builds submit`, cuando no hay .gcloudignore, usa justamente ese
// .gitignore. Una copia con otro nombre pasaba derecho.
//
// Este test fija las dos defensas: que el .gcloudignore exista y excluya
// cualquier .env, y que los .gitignore cubran las copias con nombre libre.
// No prueba que no haya secretos hoy — prueba que el patrón no se angoste otra
// vez, que es lo que falló.

const API = join(__dirname, '..', '..');
const RAIZ = join(API, '..', '..');

const leer = (p: string) => readFileSync(p, 'utf8');
/** Líneas útiles: sin comentarios ni vacías. */
const reglas = (contenido: string) =>
  contenido
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

/** ¿Alguna regla cubre un archivo con este nombre en la raíz del directorio? */
function cubre(contenido: string, archivo: string): boolean {
  let cubierto = false;
  for (const regla of reglas(contenido)) {
    const negada = regla.startsWith('!');
    const patron = negada ? regla.slice(1) : regla;
    // Solo hacen falta los patrones que se usan acá: literal y con `*`.
    const re = new RegExp('^' + patron.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    if (re.test(archivo)) cubierto = !negada;
  }
  return cubierto;
}

// Nombres reales y plausibles de copias del .env. `.env.bak2` es el que se
// filtró de verdad.
const COPIAS = ['.env', '.env.bak2', '.env.bak', '.env.viejo', '.env.produccion', '.env.local'];

describe('El .env de producción nunca sale del repo local (hallazgo secretos-tarball-cloud-build)', () => {
  it('apps/api tiene .gcloudignore: es lo que mira gcloud builds submit', () => {
    expect(existsSync(join(API, '.gcloudignore'))).toBe(true);
  });

  it.each(COPIAS)('el .gcloudignore deja fuera del tarball %s', (archivo) => {
    expect(cubre(leer(join(API, '.gcloudignore')), archivo)).toBe(true);
  });

  it.each(COPIAS)('el .gitignore de apps/api cubre %s', (archivo) => {
    expect(cubre(leer(join(API, '.gitignore')), archivo)).toBe(true);
  });

  it.each(COPIAS)('el .gitignore de la raíz cubre %s', (archivo) => {
    expect(cubre(leer(join(RAIZ, '.gitignore')), archivo)).toBe(true);
  });

  // La plantilla sí se versiona: es la lista de variables que hay que cargar,
  // sin valores. Si un patrón nuevo se la lleva puesta, el alta de alguien
  // nuevo se queda sin referencia.
  it('.env.example sigue versionado en los dos .gitignore', () => {
    expect(cubre(leer(join(API, '.gitignore')), '.env.example')).toBe(false);
    expect(cubre(leer(join(RAIZ, '.gitignore')), '.env.example')).toBe(false);
  });

  it('el Dockerfile no copia ningún .env a la imagen', () => {
    const dockerfile = leer(join(API, 'Dockerfile'));
    const copias = dockerfile.split('\n').filter((l) => /^\s*COPY\b/i.test(l) && /\.env/i.test(l));
    expect(copias).toEqual([]);
  });
});

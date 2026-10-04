// A qué base apuntan los e2e (auditoría interna 10/09, hallazgo ALTO base-prueba).
//
// Los e2e crean negocios, pedidos y cuentas de verdad. Cuando se escribió este
// guard el .env local era producción; desde el corte del 2026-09-20 el .env es
// la base de DESARROLLO (hhaqlzrcskmwnvhgydon) y producción es otro proyecto
// ("Orbita Produccion", dgergykdihtvsglfumsb) al que solo llega Cloud Run (ver
// el CLAUDE.md de la raíz, § Dos bases de datos).
//
// Aun así el guard no confía en el .env: es una LISTA BLANCA. Los e2e arrancan
// solo si E2E_DATABASE_URL (y E2E_DIRECT_URL, si se pasa aparte) apuntan a la
// base de dev: contienen REF_DEV y no contienen la ref de producción. Cualquier
// otra URL (producción, un .env que alguien cambió, una base desconocida) corta
// antes de conectar. Ya no existe un escape para escribir en producción: el
// viejo E2E_PERMITIR_PRODUCCION=si se sacó, un e2e contra prod no tiene caso.
// Cómo pasar las URLs sin imprimirlas: DEPLOYMENT.md § Correr los e2e contra dev.
// ConfigModule y Prisma no pisan variables ya definidas, así que lo que se
// setea acá gana sobre el .env.

/** Ref del proyecto Supabase de desarrollo: la única base donde corren los e2e. */
export const REF_DEV = 'hhaqlzrcskmwnvhgydon';
// Producción. Se chequea además de la lista blanca por si una URL trae las dos.
const REF_PRODUCCION = 'dgergykdihtvsglfumsb';

// Los mensajes nunca incluyen la URL: tiene la contraseña de la base.
export const MENSAJE_E2E_SIN_BASE =
  'Los e2e necesitan E2E_DATABASE_URL (y E2E_DIRECT_URL) apuntando a la base de desarrollo. ' +
  'Ver apps/api/DEPLOYMENT.md, "Correr los e2e contra dev".';
export const MENSAJE_E2E_NO_ES_DEV =
  `E2E_DATABASE_URL / E2E_DIRECT_URL no apuntan a la base de desarrollo (${REF_DEV}): ` +
  'los e2e escriben datos y solo corren contra dev, nunca contra producción ni otra base.';

const esDev = (url: string) => url.includes(REF_DEV) && !url.includes(REF_PRODUCCION);

/** Ajusta DATABASE_URL/DIRECT_URL para los e2e. Devuelve un error si el destino no es dev. */
export function prepararBaseE2E(env: NodeJS.ProcessEnv): string | null {
  if (!env.E2E_DATABASE_URL) return MENSAJE_E2E_SIN_BASE;
  const pool = env.E2E_DATABASE_URL;
  const directa = env.E2E_DIRECT_URL || pool;
  // Las dos: DIRECT_URL es la que usan las migraciones de Prisma.
  if (!esDev(pool) || !esDev(directa)) return MENSAJE_E2E_NO_ES_DEV;
  env.DATABASE_URL = pool;
  env.DIRECT_URL = directa;
  return null;
}

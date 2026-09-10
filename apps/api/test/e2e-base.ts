// A qué base apuntan los e2e (auditoría interna 10/09, hallazgo ALTO base-prueba).
//
// apps/api/.env es PRODUCCIÓN, y los e2e crean negocios, pedidos y cuentas
// de verdad. Antes corrían contra esa base sin avisar. Ahora arrancan solo si:
//   - E2E_DATABASE_URL apunta a una base de prueba (y E2E_DIRECT_URL, si hace
//     falta otra para las migraciones): se usa en lugar de la del .env, o
//   - E2E_PERMITIR_PRODUCCION=si, a propósito y sabiendo que escribe en prod.
// ConfigModule no pisa variables ya definidas, así que lo que se setea acá gana.

export const MENSAJE_E2E_SIN_BASE =
  'Los e2e no corren contra la base del .env (es producción). Definí E2E_DATABASE_URL con una base de prueba, ' +
  'o E2E_PERMITIR_PRODUCCION=si si de verdad querés escribir en producción.';

/** Ajusta DATABASE_URL/DIRECT_URL para los e2e. Devuelve un error si no hay destino permitido. */
export function prepararBaseE2E(env: NodeJS.ProcessEnv): string | null {
  if (env.E2E_DATABASE_URL) {
    env.DATABASE_URL = env.E2E_DATABASE_URL;
    env.DIRECT_URL = env.E2E_DIRECT_URL || env.E2E_DATABASE_URL;
    return null;
  }
  if (env.E2E_PERMITIR_PRODUCCION === 'si') return null;
  return MENSAJE_E2E_SIN_BASE;
}

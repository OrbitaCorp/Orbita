import { prepararBaseE2E, MENSAJE_E2E_SIN_BASE, MENSAJE_E2E_NO_ES_DEV, REF_DEV } from '../e2e-base';

// Auditoría interna 10/09, hallazgo base-prueba: los e2e escriben en la base
// (negocios, pedidos, cuentas). Desde el corte del 2026-09-20 corren SOLO
// contra la base de desarrollo: lista blanca con la ref de dev, sin escape.
const DEV = `postgresql://postgres.${REF_DEV}:x@pooler.example.com:6543/postgres`;
const DEV_DIRECTA = `postgresql://postgres:x@db.${REF_DEV}.supabase.co:5432/postgres`;
const PROD = 'postgresql://postgres.dgergykdihtvsglfumsb:x@pooler.example.com:6543/postgres';

describe('prepararBaseE2E', () => {
  it('sin E2E_DATABASE_URL no arranca, y no toca DATABASE_URL', () => {
    const env = { DATABASE_URL: DEV } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_SIN_BASE);
    expect(env.DATABASE_URL).toBe(DEV);
  });

  it('con E2E_DATABASE_URL de dev, la usa en lugar de la del .env', () => {
    const env = { DATABASE_URL: 'postgres://otra', DIRECT_URL: 'postgres://otra-directa', E2E_DATABASE_URL: DEV } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBeNull();
    expect(env.DATABASE_URL).toBe(DEV);
    expect(env.DIRECT_URL).toBe(DEV);
  });

  it('respeta E2E_DIRECT_URL si está (y también tiene que ser de dev)', () => {
    const env = { E2E_DATABASE_URL: DEV, E2E_DIRECT_URL: DEV_DIRECTA } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBeNull();
    expect(env.DIRECT_URL).toBe(DEV_DIRECTA);
  });

  it('E2E_DATABASE_URL de producción: no arranca y no pisa nada', () => {
    const env = { DATABASE_URL: 'postgres://antes', E2E_DATABASE_URL: PROD } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_NO_ES_DEV);
    expect(env.DATABASE_URL).toBe('postgres://antes');
  });

  it('una base que no es la de dev (otra cualquiera) tampoco: es lista blanca', () => {
    const env = { E2E_DATABASE_URL: 'postgres://localhost:5432/cualquiera' } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_NO_ES_DEV);
  });

  it('pool de dev con directa de producción: no arranca (las migraciones irían a prod)', () => {
    const env = { E2E_DATABASE_URL: DEV, E2E_DIRECT_URL: PROD } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_NO_ES_DEV);
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('la ref de prod metida en una URL con la de dev no pasa', () => {
    const env = { E2E_DATABASE_URL: `${DEV}?x=dgergykdihtvsglfumsb` } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_NO_ES_DEV);
  });

  it('E2E_PERMITIR_PRODUCCION ya no existe: no abre nada', () => {
    const env = { DATABASE_URL: PROD, E2E_PERMITIR_PRODUCCION: 'si' } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_SIN_BASE);
  });

  it('los mensajes nunca incluyen la URL', () => {
    const env = { E2E_DATABASE_URL: PROD } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).not.toContain('pooler.example.com');
  });
});

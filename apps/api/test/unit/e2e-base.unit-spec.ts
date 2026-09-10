import { prepararBaseE2E, MENSAJE_E2E_SIN_BASE } from '../e2e-base';

// Auditoría interna 10/09, hallazgo base-prueba: los e2e no escriben en la
// base del .env (producción) salvo que se pida a propósito.
describe('prepararBaseE2E', () => {
  it('sin base de prueba ni permiso explícito, no arranca', () => {
    const env = { DATABASE_URL: 'postgres://prod' } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBe(MENSAJE_E2E_SIN_BASE);
    expect(env.DATABASE_URL).toBe('postgres://prod');
  });

  it('con E2E_DATABASE_URL, la usa en lugar de la del .env', () => {
    const env = { DATABASE_URL: 'postgres://prod', DIRECT_URL: 'postgres://prod-directa', E2E_DATABASE_URL: 'postgres://prueba' } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBeNull();
    expect(env.DATABASE_URL).toBe('postgres://prueba');
    expect(env.DIRECT_URL).toBe('postgres://prueba');
  });

  it('respeta E2E_DIRECT_URL si está', () => {
    const env = { E2E_DATABASE_URL: 'postgres://pool', E2E_DIRECT_URL: 'postgres://directa' } as NodeJS.ProcessEnv;
    prepararBaseE2E(env);
    expect(env.DIRECT_URL).toBe('postgres://directa');
  });

  it('con E2E_PERMITIR_PRODUCCION=si corre contra lo que haya', () => {
    const env = { DATABASE_URL: 'postgres://prod', E2E_PERMITIR_PRODUCCION: 'si' } as NodeJS.ProcessEnv;
    expect(prepararBaseE2E(env)).toBeNull();
    expect(env.DATABASE_URL).toBe('postgres://prod');
  });
});

export const SEED_USERS = {
  owner: { email: 'dueno@zapatoslorena.test', password: 'Test1234!' },
  employee: { email: 'empleado@zapatoslorena.test', password: 'Test1234!' },
  customerWithAccount: { email: 'cliente@zapatoslorena.test', password: 'Test1234!' },
  customerWithoutAccount: { email: 'sinregistrar@zapatoslorena.test' },
  // Super admin de plataforma (identidad cross-tenant, sin negocio).
  platformAdmin: { email: 'vegaalanadrian@gmail.com', password: 'Test1234!' },
};

export const SEED_BUSINESS_SLUG = 'zapatoslorena';

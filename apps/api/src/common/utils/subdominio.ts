import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// Subdominios de tienda (<sub>.orbita.site). Una sola regla para todos los
// caminos que eligen uno: el wizard (GET /onboarding/check-subdomain, PUT
// /onboarding/business, el alta con pago) y las sugerencias de Orbi.
//
// Auditoría interna 10/09, ítem `api.businesses`: cada camino tenía su propio
// regex y ninguno describía una etiqueta DNS válida (aceptaban "-tienda-",
// "a" o 200 caracteres), y no había nada reservado: cualquiera podía quedarse
// con soporte.orbita.site o pagos.orbita.site y armar una tienda que se hace
// pasar por Órbita ante sus propios clientes.

// Etiqueta DNS: 3 a 63 caracteres, minúsculas, números y guiones, sin guion al
// principio ni al final.
export const SUBDOMINIO_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

// Nombres que son de Órbita (o que un visitante leería como si lo fueran).
// Ninguno está tomado en producción al 10/09.
export const SUBDOMINIOS_RESERVADOS: readonly string[] = [
  'www', 'api', 'app', 'admin', 'administrador', 'panel', 'superadmin', 'dashboard',
  'mail', 'email', 'correo', 'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2', 'dns',
  'cdn', 'static', 'assets', 'img', 'media', 'files', 'status', 'blog', 'docs',
  'help', 'ayuda', 'soporte', 'support', 'contacto', 'orbita', 'orbi',
  'pagos', 'pago', 'checkout', 'billing', 'facturacion', 'cuenta', 'cuentas',
  'login', 'auth', 'oauth', 'seguridad', 'security', 'legal', 'terminos', 'privacidad',
  'tienda', 'tiendas', 'dev', 'staging', 'test', 'demo', 'preview', 'mercadopago', 'google',
];

// null = válido. Si no, el motivo en castellano (sirve de mensaje de error y
// de `reason` en check-subdomain).
export function motivoSubdominioInvalido(subdominio: string): string | null {
  if (!SUBDOMINIO_RE.test(subdominio)) {
    return 'El subdominio tiene que tener entre 3 y 63 caracteres: minúsculas, números y guiones, sin guion al principio ni al final';
  }
  // "xn--" es el prefijo de los dominios internacionalizados: con dos guiones
  // seguidos se pueden armar nombres que el navegador muestra parecidos a
  // otros. Ninguna tienda real los necesita.
  if (subdominio.includes('--')) return 'El subdominio no puede tener dos guiones seguidos';
  if (SUBDOMINIOS_RESERVADOS.includes(subdominio)) return 'Ese subdominio está reservado, elegí otro';
  return null;
}

// Decorador de class-validator con la misma regla, para los DTOs.
export function EsSubdominio(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'esSubdominio',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && motivoSubdominioInvalido(value) === null,
        defaultMessage: (args?: ValidationArguments) =>
          motivoSubdominioInvalido(String(args?.value ?? '')) ?? 'Subdominio inválido',
      },
    });
  };
}

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
// Ninguno de los de la primera tanda estaba tomado en producción al 10/09; los
// de la ampliación (11/10) hay que chequearlos contra producción antes de
// desplegar.
//
// Se agrupan por el riesgo que tapan. Un subdominio reservado NO afecta a las
// tiendas que ya lo tienen: la regla corre al elegir o cambiar uno.
const INFRA = [
  'www', 'api', 'app', 'apps', 'admin', 'administrador', 'administrator', 'panel', 'superadmin', 'root',
  'dashboard', 'consola', 'console', 'mail', 'email', 'correo', 'webmail', 'smtp', 'imap', 'pop', 'pop3',
  'mx1', 'mx2', 'autodiscover', 'autoconfig', 'ftp', 'sftp', 'ssh', 'vpn', 'ns1', 'ns2', 'ns3', 'dns',
  'cdn', 'static', 'assets', 'img', 'imagenes', 'media', 'files', 'archivos', 'upload', 'uploads', 'download',
  'descargas', 'status', 'health', 'metrics', 'grafana', 'sentry', 'git', 'github',
  'gitlab', 'jenkins', 'docs', 'doc', 'wiki', 'blog', 'webhook', 'webhooks', 'callback', 'redirect',
  'internal', 'interno', 'intranet', 'cron', 'cloudrun', 'firebase', 'vercel', 'supabase', 'gcp',
  'aws', 'azure', 'n8n', 'localhost', 'default', 'null', 'undefined', 'system', 'sistema',
];

// Genéricos de entorno o de producto: se reservan tal cual, pero no se les
// persiguen las variantes ("tienda1", "demo2" son nombres razonables).
const GENERICOS = [
  'dev', 'staging', 'stage', 'sandbox', 'beta', 'alpha', 'prod', 'produccion', 'production', 'uat',
  'test', 'tests', 'demo', 'demos', 'preview', 'tienda', 'tiendas', 'turnos', 'ventas', 'marketing',
  'manual', 'tutoriales', 'planes', 'precios', 'pricing',
];

// Lo que un cliente de Órbita esperaría que sea de Órbita: soporte, cobros,
// cuentas, seguridad. Son los que sirven para armar un phishing.
const CONFIANZA = [
  'help', 'ayuda', 'soporte', 'support', 'contacto', 'contact', 
  'abuse', 'abuso', 'denuncia', 'denuncias', 'seguridad', 'security', 'legal', 'terminos', 'terms',
  'privacidad', 'privacy', 'postmaster', 'webmaster', 'hostmaster', 'noreply',
  'login', 'signin', 'signup', 'registro', 'register', 'registrarse', 'auth', 'oauth', 'sso', 'cuenta', 'cuentas',
  'account', 'accounts', 'password', 'recuperar', 'verificar', 'verify', 
  'pagos', 'pago', 'pay', 'payment', 'payments', 'checkout', 'billing', 'facturacion', 'factura', 'facturas',
  'invoice', 'cobros', 'suscripcion', 'suscripciones', 'subscription',
  'oficial', 'official',
];

// Marcas y organismos a los que alguien le creería un enlace.
const TERCEROS = [
  'orbita', 'orbi', 'orbitacorp', 'mercadopago', 'mercadolibre', 'google', 'gmail', 'whatsapp',
  'instagram', 'facebook', 'meta', 'tiktok', 'youtube', 'paypal', 'stripe', 'visa', 'mastercard', 
  'microsoft', 'resend', 'afip', 'arca', 'anses', 'gob', 'gobierno', 'galicia',
  'santander', 'bbva', 'uala', 'brubank', 'binance',
];

// Palabras que no queremos colgadas de orbita.site (Safe Browsing penaliza al
// dominio entero por un subdominio).
const ABUSO = ['porn', 'porno', 'xxx', 'sexo', 'nazi', 'hitler', 'phishing', 'scam', 'estafa', 'fraude'];

export const SUBDOMINIOS_RESERVADOS: readonly string[] = [...new Set([
  ...INFRA, ...GENERICOS, ...CONFIANZA, ...TERCEROS, ...ABUSO,
])];

// Contra estos se prueban también las variantes disfrazadas (ver `variantes`).
// Las de menos de 3 letras no entran: "mp3" o "ci2" son nombres de tienda.
const PERSEGUIDOS = new Set<string>([...INFRA, ...CONFIANZA, ...TERCEROS, ...ABUSO].filter((w) => w.length >= 3));

// "orbita" pegado a una palabra de confianza ("orbita-soporte", "soporteorbita",
// "orbitaoficial") es un phishing, no una tienda. Solo palabras largas: una de
// 3 letras caería dentro de nombres de verdad.
const ORBITA_RE = /orbita/;
const CONFIANZA_LARGAS = CONFIANZA.filter((w) => w.length >= 5);

// Marcas de pagos y de gobierno que no pueden aparecer ni como parte del
// nombre ("mercadopago-ayuda", "afip-turnos").
const PROHIBIDO_DENTRO = ['mercadopago', 'mercadolibre', 'paypal', 'afip', 'binance'];

const LEET: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't' };

// Cómo se podría leer un subdominio disfrazado: sin guiones ("log-in"), sin
// los números del final ("admin2") y con números por letras ("s0porte",
// "ap1"). El 1 es ambiguo (i o l), se prueban las dos.
function variantes(subdominio: string): Set<string> {
  const sinGuiones = subdominio.replace(/-/g, '');
  const sinNumeros = sinGuiones.replace(/\d+$/, '');
  const salida = new Set<string>([sinGuiones, sinNumeros]);
  for (const base of [sinGuiones, sinNumeros]) {
    const leet = base.replace(/[03457]/g, (c) => LEET[c]);
    salida.add(leet);
    salida.add(leet.replace(/1/g, 'i'));
    salida.add(leet.replace(/1/g, 'l'));
  }
  return salida;
}

function esReservadoODisfrazado(subdominio: string): boolean {
  if (SUBDOMINIOS_RESERVADOS.includes(subdominio)) return true;
  const vs = variantes(subdominio);
  for (const v of vs) {
    if (PERSEGUIDOS.has(v)) return true;
    if (PROHIBIDO_DENTRO.some((marca) => v.includes(marca))) return true;
    if (ORBITA_RE.test(v) && CONFIANZA_LARGAS.some((w) => v.includes(w))) return true;
  }
  return false;
}

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
  if (esReservadoODisfrazado(subdominio)) return 'Ese subdominio está reservado, elegí otro';
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

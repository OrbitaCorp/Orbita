import { createHash, timingSafeEqual } from 'crypto';
import { isIP } from 'net';

// Cuántos proxies hay delante de la API (Firebase Hosting y el balanceador de
// Cloud Run). Sin `trust proxy`, Express toma como IP del cliente la del
// último proxy: todos los @Throttle y el tope por IP del wizard de Orbi
// comparten unos pocos baldes entre TODOS los usuarios (auditoría interna
// 10/09, ítem trans.rate-limit).
//
// Nunca `true`: con `true` Express toma la primera IP de X-Forwarded-For, que
// la escribe el cliente, y cualquiera se saltearía los límites. Tiene que ser
// el número exacto de saltos, medido con GET /api/v1/health/ip (ver
// DEPLOYMENT.md). Sin la variable, todo queda como estaba.
export function saltosDeProxy(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.TRUST_PROXY_HOPS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// ─── IP del cliente cuando el pedido pasa por el BFF de Next.js ──────────────
//
// `trust proxy` (arriba) arregla lo que va del navegador a la API. Pero login,
// refresh, registro, alta y sesiones pasan por el BFF de Next.js en Vercel
// (apps/web/src/lib/auth/bff.ts): a la API llegan TODOS con la IP de Vercel y
// comparten un solo balde de throttling — un atacante bloquea el login de
// todos, y la "IP" de las sesiones activas es la del servidor (auditoría
// interna 10/09, hallazgo rate-limit-ip-proxy, segunda mitad).
//
// El BFF manda la IP real en X-Orbita-Client-Ip junto con un secreto
// compartido en X-Orbita-Client-Ip-Secret. Acá se usa esa IP SOLO si el
// secreto coincide con BFF_IP_SECRET (comparación en tiempo constante); si
// no, o si el secret no está configurado, se sigue con req.ip como siempre.
// Nunca se lee X-Forwarded-For a mano: eso ya lo resuelve Express con el
// número exacto de saltos, y leerlo acá abriría la puerta a que el cliente
// elija su propia IP.

export const HEADER_IP_CLIENTE = 'x-orbita-client-ip';
export const HEADER_SECRETO_IP_CLIENTE = 'x-orbita-client-ip-secret';
export const LARGO_MINIMO_SECRETO_BFF = 32;

type Encabezados = Record<string, string | string[] | undefined>;
export type PedidoConIp = { ip?: string; headers?: Encabezados };

function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Igualdad en tiempo constante: se comparan los SHA-256 de los dos valores,
// que siempre miden lo mismo, así timingSafeEqual no tira por largos
// distintos ni filtra el largo del secreto por el tiempo de respuesta.
function secretoCoincide(recibido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recibido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

// La IP que reenvió el BFF, o null si el pedido no vino por el BFF con el
// secreto correcto (o el secret no está configurado, o la IP no es una IP).
export function ipReenviadaPorBff(req: PedidoConIp, env: NodeJS.ProcessEnv = process.env): string | null {
  const secreto = env.BFF_IP_SECRET;
  if (!secreto || secreto.length < LARGO_MINIMO_SECRETO_BFF) return null;
  const headers = req.headers ?? {};
  const recibido = primerValor(headers[HEADER_SECRETO_IP_CLIENTE]);
  const ip = primerValor(headers[HEADER_IP_CLIENTE])?.trim();
  if (!recibido || !ip) return null;
  if (!secretoCoincide(recibido, secreto)) return null;
  return isIP(ip) ? ip : null;
}

// Punto único para límites por IP y para registrar la IP de una sesión: la
// que reenvió el BFF si el secreto coincide, si no la que ve Express.
export function ipDelCliente(req: PedidoConIp, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return ipReenviadaPorBff(req, env) ?? req.ip;
}

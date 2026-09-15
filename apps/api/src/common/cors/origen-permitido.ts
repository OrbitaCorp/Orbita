import { Logger } from '@nestjs/common';

// Origen de CORS para las tiendas con dominio propio (auditoría interna
// 10/09, hallazgo `hallazgo.cors-dominios-propios`).
//
// La lista estática de main.ts acepta orbita.site y sus subdominios, pero una
// tienda en dominio propio (Configuración → Dominios) llama a la API desde el
// navegador con credenciales (lib/storefront/api.ts), así que carrito,
// checkout y juegos quedaban bloqueados por CORS en cuanto se activara el
// primer dominio. Acá se resuelve consultando CustomDomain (ACTIVE y con DNS
// verificado) con caché en memoria, para no pegarle a la base en cada
// request: cada carga de la tienda dispara varias llamadas seguidas.
//
// Nunca "*": con credentials:true el navegador lo rechaza, y de paso
// abriría la API a cualquier página.

// El callback de `origin` que espera enableCors (paquete `cors`): con
// `true` refleja el Origin de la request en Access-Control-Allow-Origin y
// agrega Vary: Origin; con `false` no pone ningún header y el navegador
// bloquea la respuesta. Un error como primer argumento cortaría la request
// con 500 — acá nunca se usa, un origen desconocido se rechaza en silencio.
export type OrigenCallback = (err: Error | null, permitido?: boolean) => void;
export type OrigenDeCors = (origin: string | undefined, cb: OrigenCallback) => void;

export interface OpcionesOrigenPermitido {
  // Orígenes que pasan siempre (FRONTEND_URL, orbita.site, dev): strings por
  // igualdad exacta o RegExp — los mismos valores que antes iban en el array.
  fijos: ReadonlyArray<string | RegExp>;
  // Consulta a la base: ¿este host es un CustomDomain ACTIVE con dnsVerified?
  esDominioPropioActivo: (host: string) => Promise<boolean>;
  // Cuánto se recuerda cada respuesta (positiva Y negativa). Default 5 min:
  // activar un dominio tarda ese tiempo en verse, y un dominio que se
  // elimina o suspende sigue pasando CORS ese mismo rato — aceptable.
  ttlMs?: number;
  // Tope de hosts en caché: cualquiera puede mandar un Origin inventado y
  // sin tope la caché negativa crecería sin fin.
  maxEntradas?: number;
}

export const TTL_CACHE_MS = 5 * 60_000;
export const MAX_ENTRADAS_CACHE = 500;

// Solo https://<host>, sin puerto ni path (un dominio propio se sirve por
// Vercel con https siempre). Host en minúsculas como lo serializa el
// navegador: etiquetas DNS de 1 a 63 caracteres sin guion al principio ni
// al final, al menos un punto, y el TLD empieza con letra (cubre "xn--").
const ORIGEN_HTTPS_RE = /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62})$/;
const MAX_LARGO_HOST = 253;

export function hostDeOrigenHttps(origin: string): string | null {
  const m = ORIGEN_HTTPS_RE.exec(origin);
  if (!m || m[1].length > MAX_LARGO_HOST) return null;
  return m[1];
}

// Los dominios se guardan en minúsculas y tal cual los escribió el negocio,
// con o sin "www." (domains.service.ts#linkDomain). Si el guardado es el
// apex ("tienda.com") y el navegador está en "www.tienda.com", se acepta
// también: quien controla la zona DNS del apex controla el www, no se abre
// nada nuevo. La inversa (guardado con www, navegador en el apex) no hace
// falta: Vercel redirige al que está vinculado antes de que la tienda cargue.
export function candidatosDeHost(host: string): string[] {
  return host.startsWith('www.') && host.length > 4 ? [host, host.slice(4)] : [host];
}

const logger = new Logger('CORS');

export function crearOrigenPermitido(opciones: OpcionesOrigenPermitido): OrigenDeCors {
  const { fijos, esDominioPropioActivo } = opciones;
  const ttlMs = opciones.ttlMs ?? TTL_CACHE_MS;
  const maxEntradas = opciones.maxEntradas ?? MAX_ENTRADAS_CACHE;

  // Map conserva el orden de inserción: la primera entrada es la más vieja.
  const cache = new Map<string, { permitido: boolean; vence: number }>();
  // Consultas en curso por host: la primera carga de una tienda dispara
  // varias requests a la vez y todas caerían a la base antes de que la
  // primera respuesta llegue a la caché.
  const enCurso = new Map<string, Promise<boolean>>();

  const esFijo = (origin: string): boolean =>
    fijos.some((fijo) => (typeof fijo === 'string' ? fijo === origin : fijo.test(origin)));

  const guardar = (host: string, permitido: boolean, ahora: number): void => {
    cache.delete(host); // re-insertar lo manda al final: cuenta como el más nuevo
    if (cache.size >= maxEntradas) {
      for (const [h, e] of cache) if (e.vence <= ahora) cache.delete(h);
      if (cache.size >= maxEntradas) {
        const masViejo = cache.keys().next().value;
        if (masViejo !== undefined) cache.delete(masViejo);
      }
    }
    cache.set(host, { permitido, vence: ahora + ttlMs });
  };

  const consultar = async (host: string): Promise<boolean> => {
    for (const candidato of candidatosDeHost(host)) {
      if (await esDominioPropioActivo(candidato)) return true;
    }
    return false;
  };

  const resolverDominioPropio = (host: string): Promise<boolean> => {
    const ahora = Date.now();
    const recordado = cache.get(host);
    if (recordado && recordado.vence > ahora) return Promise.resolve(recordado.permitido);

    const pendiente = enCurso.get(host);
    if (pendiente) return pendiente;

    const consulta = consultar(host)
      .then((permitido) => {
        guardar(host, permitido, Date.now());
        return permitido;
      })
      .finally(() => enCurso.delete(host));
    enCurso.set(host, consulta);
    return consulta;
  };

  return (origin, cb) => {
    // Sin Origin: curl, server-to-server, same-origin — no es una request
    // cross-origin y el paquete `cors` no pone header alguno igual.
    if (!origin) return cb(null, true);
    if (esFijo(origin)) return cb(null, true);

    const host = hostDeOrigenHttps(origin);
    if (!host) return cb(null, false);

    resolverDominioPropio(host).then(
      (permitido) => cb(null, permitido),
      (err: unknown) => {
        // La base no respondió: se rechaza sin cachear, la próxima request
        // vuelve a intentar. Nunca se pasa el error al callback (sería 500
        // sin headers de CORS: el navegador tapa el motivo real).
        logger.error(`No se pudo verificar el dominio propio "${host}" para CORS: ${err instanceof Error ? err.message : String(err)}`);
        cb(null, false);
      },
    );
  };
}

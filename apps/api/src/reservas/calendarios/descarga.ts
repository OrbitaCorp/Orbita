// Bajar el calendario .ics que un dueño conectó, con el cuidado que pide
// pedirle a internet una dirección que escribió un usuario:
//
// - Solo Airbnb, por lista fija de dominios (`www.airbnb.<país>`). Sin esto, el
//   campo sería una forma de hacer que el servidor le pida cosas a la red
//   interna o a quien sea.
// - Solo https, sin usuario ni puerto, y la ruta termina en .ics.
// - Sin seguir redirecciones: si Airbnb redirige (al login, por ejemplo), eso
//   no es el calendario.
// - Con tiempo y tamaño máximos.
//
// Nunca tira: devuelve el texto o el motivo, ya en castellano para mostrar.

/** Cuánto se espera a Airbnb. */
export const ESPERA_MS = 8_000;
/** Un calendario de un año son unos pocos KB; más que esto no es un calendario. */
export const MAXIMO_BYTES = 1_000_000;
const MAXIMO_URL = 600;

/** Los sitios de Airbnb por país: `www.airbnb.<sufijo>`. */
const SUFIJOS_DE_AIRBNB = ['com', 'com.ar', 'com.br', 'es', 'mx', 'cl', 'com.co', 'com.pe', 'com.uy', 'com.py', 'com.bo', 'com.ec', 'pt', 'it', 'fr', 'de', 'co.uk'];
const HOSTS_DE_AIRBNB = new Set(SUFIJOS_DE_AIRBNB.map((s) => `www.airbnb.${s}`));

const QUE_PEGAR = 'Pegá el enlace de Airbnb que termina en .ics (en Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar calendario).';
const NO_ES_EL_CALENDARIO = 'Airbnb no respondió con el calendario. Volvé a copiar el enlace desde Airbnb.';

/**
 * null si el enlace sirve; si no, qué pegar. Fuera de producción también vale
 * el host de `RESERVAS_ICAL_HOST_DE_PRUEBA` (con su puerto, por http o https),
 * para probar en local con un archivo propio.
 */
export function errorDeUrl(url: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const texto = url.trim();
  if (!texto || texto.length > MAXIMO_URL) return QUE_PEGAR;
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return QUE_PEGAR;
  }
  if (u.username || u.password || !u.pathname.toLowerCase().endsWith('.ics')) return QUE_PEGAR;
  const dePrueba = env.NODE_ENV !== 'production' ? env.RESERVAS_ICAL_HOST_DE_PRUEBA : undefined;
  if (dePrueba && u.host === dePrueba && (u.protocol === 'http:' || u.protocol === 'https:')) return null;
  if (u.protocol !== 'https:' || u.port || !HOSTS_DE_AIRBNB.has(u.hostname.toLowerCase())) return QUE_PEGAR;
  return null;
}

export type Descarga = { ok: true; texto: string } | { ok: false; motivo: string };

/** Lee el cuerpo de a partes y corta apenas pasa el máximo: nunca junta un archivo enorme en memoria. */
async function leerHasta(res: Response, maximo: number): Promise<string | null> {
  if (!res.body) return '';
  const lector = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString('utf8');
}

export async function descargarCalendario(url: string, deps: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv } = {}): Promise<Descarga> {
  const error = errorDeUrl(url, deps.env);
  if (error) return { ok: false, motivo: error };
  const pedir = deps.fetch ?? fetch;
  try {
    const res = await pedir(url.trim(), { redirect: 'manual', signal: AbortSignal.timeout(ESPERA_MS), headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' } });
    if (res.status >= 300 && res.status < 400) return { ok: false, motivo: NO_ES_EL_CALENDARIO };
    if (!res.ok) return { ok: false, motivo: `Airbnb respondió ${res.status}.` };
    const texto = await leerHasta(res, MAXIMO_BYTES);
    if (texto === null) return { ok: false, motivo: 'El calendario es demasiado grande.' };
    // Con su apertura y su cierre: un archivo que llegó cortado traería menos noches de las que hay, y liberaría de más.
    if (!texto.includes('BEGIN:VCALENDAR') || !texto.includes('END:VCALENDAR')) return { ok: false, motivo: NO_ES_EL_CALENDARIO };
    return { ok: true, texto };
  } catch (e) {
    const nombre = e instanceof Error ? e.name : '';
    return { ok: false, motivo: nombre === 'TimeoutError' || nombre === 'AbortError' ? 'Airbnb no respondió a tiempo.' : 'No se pudo conectar con Airbnb.' };
  }
}

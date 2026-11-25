// iCalendar (.ics) en el servidor: el formato con el que Airbnb publica las
// noches ocupadas de un aviso y con el que acepta las de afuera. Acá se lee el
// de Airbnb (para bloquear esas noches en Órbita) y se genera el de Órbita
// (para que Airbnb bloquee las suyas). Sin dependencias: es texto con líneas CRLF.
//
// Es el mismo lector y generador que apps/web/src/lib/reservas/ics.ts, con los
// mismos casos de prueba. El servidor solo genera eventos de día entero
// (VALUE=DATE con DTEND exclusivo): es lo que usa una estadía.
//
// Además decide dos cosas que son solo de la sincronización:
// - qué es cada evento que manda Airbnb (una reserva o un cierre), y
// - cuáles de esos cierres son el eco de lo que Órbita le había mandado.
import { esFecha, sumarDias } from './tiempo';

/** Tope de eventos que se leen de un archivo: lo que sobra se ignora. */
export const MAX_EVENTOS = 500;

// ─── Generar ─────────────────────────────────────────────────────────────────

export interface EventoParaExportar {
  /** Estable: la misma reserva da el mismo UID cada vez que se exporta. */
  uid: string;
  titulo: string;
  /** Día de entrada. */
  desde: string;
  /** Día de salida (exclusivo: esa noche queda libre). */
  hasta: string;
}

const dd = (n: number): string => String(n).padStart(2, '0');

/** Texto seguro dentro de un valor: escapa coma, punto y coma, barra y saltos de línea. */
const escapar = (s: string): string => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Bytes que ocupa un carácter en UTF-8: la "ñ" y las tildes ocupan dos. */
const bytesUTF8 = (c: string): number => { const n = c.codePointAt(0) ?? 0; return n < 0x80 ? 1 : n < 0x800 ? 2 : n < 0x10000 ? 3 : 4; };

/**
 * Las líneas largas se parten a 75 bytes (no caracteres) con un espacio al
 * principio de la continuación (RFC 5545), sin cortar una letra con tilde.
 */
function plegar(linea: string): string {
  const out: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const c of linea) {
    const b = bytesUTF8(c);
    if (bytes + b > 75) { out.push(actual); actual = ' '; bytes = 1; }
    actual += c;
    bytes += b;
  }
  out.push(actual);
  return out.join('\r\n');
}

export function generarICS(eventos: EventoParaExportar[], o: { nombre: string; ahora?: Date }): string {
  const ahora = o.ahora ?? new Date();
  const sello = `${ahora.getUTCFullYear()}${dd(ahora.getUTCMonth() + 1)}${dd(ahora.getUTCDate())}T${dd(ahora.getUTCHours())}${dd(ahora.getUTCMinutes())}${dd(ahora.getUTCSeconds())}Z`;
  const lineas: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Órbita//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapar(o.nombre)}`];
  for (const e of eventos) {
    lineas.push(
      'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${sello}`, `SUMMARY:${escapar(e.titulo)}`,
      `DTSTART;VALUE=DATE:${e.desde.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${e.hasta.replace(/-/g, '')}`,
      'END:VEVENT',
    );
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

// ─── Leer ────────────────────────────────────────────────────────────────────

export interface EventoLeido {
  uid: string;
  titulo: string;
  /** Día de entrada. */
  desde: string;
  /** Día de salida, exclusivo. Siempre posterior a `desde`. */
  hasta: string;
  diaEntero: boolean;
}

const desplegar = (texto: string): string => texto.replace(/\r?\n[ \t]/g, '');

const aFecha = (v: string): string | null => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  const f = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  return f && esFecha(f) ? f : null;
};

// De una pasada: con reemplazos en cadena, una barra escapada seguida de "n" ("\\n") salía como salto de línea.
const desescapar = (s: string): string => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/**
 * Lee los eventos de un .ics, hasta MAX_EVENTOS. Tolerante: lo que no
 * entiende (un evento sin fecha, una fecha que no existe, un texto que no es
 * un calendario) lo ignora, y nunca tira. Un evento sin salida válida ocupa
 * una noche.
 */
export function leerICS(texto: string): EventoLeido[] {
  const out: EventoLeido[] = [];
  const bloques = desplegar(texto).split(/BEGIN:VEVENT/).slice(1);
  for (const b of bloques) {
    if (out.length >= MAX_EVENTOS) break;
    const cuerpo = b.split(/END:VEVENT/)[0];
    const campo = (nombre: string) => {
      const m = new RegExp(`^${nombre}(;[^:\\n]*)?:(.*)$`, 'mi').exec(cuerpo);
      return m ? { params: m[1] ?? '', valor: m[2].trim() } : null;
    };
    const ds = campo('DTSTART');
    if (!ds) continue;
    const desde = aFecha(ds.valor);
    if (!desde) continue;
    const de = campo('DTEND');
    const fin = de ? aFecha(de.valor) : null;
    const hasta = fin && fin > desde ? fin : sumarDias(desde, 1);
    out.push({
      // Sin UID, uno que sale de las fechas: el mismo archivo da siempre el mismo.
      uid: campo('UID')?.valor || `${desde}_${hasta}`,
      titulo: desescapar(campo('SUMMARY')?.valor ?? ''),
      desde, hasta,
      diaEntero: /VALUE=DATE(?!-)/i.test(ds.params) || /^\d{8}$/.test(ds.valor),
    });
  }
  return out;
}

// ─── Lo que manda Airbnb ─────────────────────────────────────────────────────

/**
 * RESERVADO: una reserva hecha en Airbnb ("Reserved"). CERRADO: noches que
 * Airbnb da por no disponibles ("Airbnb (Not available)"): las cerró el dueño
 * a mano, las cierra una regla del aviso, o las importó de otro calendario
 * (el de Órbita, entre ellos).
 */
export type TipoExterno = 'RESERVADO' | 'CERRADO';

/** Ante la duda es un cierre: igual bloquea, pero no cuenta como reserva. */
export function clasificarEvento(titulo: string): TipoExterno {
  return titulo.trim().toLowerCase().startsWith('reserv') ? 'RESERVADO' : 'CERRADO';
}

export interface NochesExportadas { desde: string; hasta: string }

/**
 * Saca el eco: Airbnb vuelve a publicar como "no disponible" lo que importó
 * del calendario de Órbita, y a veces lo sigue publicando cuando Órbita ya lo
 * liberó. Un CERRADO con exactamente las mismas fechas de algo que Órbita
 * exportó alguna vez (también una reserva ya cancelada) es eso, y no bloquea.
 * Si no coincide exacto (Airbnb lo juntó con otro cierre), se bloquea. Un
 * RESERVADO no se descarta nunca.
 */
export function sinEco<T extends { desde: string; hasta: string; tipo: TipoExterno }>(eventos: T[], exportadas: NochesExportadas[]): T[] {
  const propias = new Set(exportadas.map((x) => `${x.desde}|${x.hasta}`));
  return eventos.filter((e) => e.tipo === 'RESERVADO' || !propias.has(`${e.desde}|${e.hasta}`));
}

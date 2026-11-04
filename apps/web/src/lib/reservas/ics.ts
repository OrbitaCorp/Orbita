// iCalendar (.ics): el formato que entienden Google Calendar, Apple Calendar,
// Airbnb y Booking. Se genera en el navegador a partir de las reservas de una
// cancha, un salón o una propiedad, y se lee el de un calendario externo para
// marcar bloqueos. Sin dependencias: el formato es texto con líneas CRLF.
//
// Las estadías van como eventos de día entero (VALUE=DATE, con DTEND exclusivo,
// como pide el estándar); los turnos, bloques y canchas, con hora en UTC.
import { partes, type ISO } from './fechas'

export interface EventoICS {
  /** Identificador estable: la misma reserva da el mismo UID aunque se exporte dos veces. */
  uid: string
  titulo: string
  descripcion?: string
  lugar?: string
  /** Día entero: de `fecha` a `hasta` (exclusivo). Sin hora. */
  fecha?: ISO
  hasta?: ISO
  /** Con hora: fecha + minutos desde las 00:00, en la zona horaria dada. */
  inicio?: { fecha: ISO; minuto: number }
  fin?: { fecha: ISO; minuto: number }
}

export interface OpcionesICS {
  /** Nombre del calendario (X-WR-CALNAME). */
  nombre: string
  /** Desfase de la zona horaria en minutos respecto de UTC. Argentina: -180. */
  zonaMin?: number
  /** Para que el archivo sea reproducible en tests. */
  ahora?: Date
}

const dd = (n: number) => String(n).padStart(2, '0')

/** Texto seguro dentro de un valor: escapa coma, punto y coma, barra y saltos de línea. */
export const escaparICS = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** "20261114" para un día entero. */
export const fechaICS = (f: ISO) => f.replace(/-/g, '')

/** "20261114T190000Z": la hora local pasada a UTC. */
export function fechaHoraICS(fecha: ISO, minuto: number, zonaMin = -180): string {
  const { anio, mes, dia } = partes(fecha)
  const utc = new Date(Date.UTC(anio, mes - 1, dia, 0, minuto - zonaMin))
  return `${utc.getUTCFullYear()}${dd(utc.getUTCMonth() + 1)}${dd(utc.getUTCDate())}T${dd(utc.getUTCHours())}${dd(utc.getUTCMinutes())}00Z`
}

/** Bytes que ocupa un carácter en UTF-8: la "ñ" y las tildes ocupan dos. */
const bytesUTF8 = (c: string) => { const n = c.codePointAt(0) ?? 0; return n < 0x80 ? 1 : n < 0x800 ? 2 : n < 0x10000 ? 3 : 4 }

/**
 * Las líneas largas se parten a 75 bytes (no caracteres: "Cabaña" ocupa siete)
 * con un espacio al principio de la continuación (RFC 5545). Se recorre por
 * carácter para no cortar una letra con tilde ni un emoji al medio.
 */
function plegar(linea: string): string {
  const out: string[] = []
  let actual = ''
  let bytes = 0
  for (const c of linea) {
    const b = bytesUTF8(c)
    if (bytes + b > 75) { out.push(actual); actual = ' '; bytes = 1 }
    actual += c
    bytes += b
  }
  out.push(actual)
  return out.join('\r\n')
}

export function generarICS(eventos: EventoICS[], o: OpcionesICS): string {
  const ahora = o.ahora ?? new Date()
  const sello = `${ahora.getUTCFullYear()}${dd(ahora.getUTCMonth() + 1)}${dd(ahora.getUTCDate())}T${dd(ahora.getUTCHours())}${dd(ahora.getUTCMinutes())}${dd(ahora.getUTCSeconds())}Z`
  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Órbita//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparICS(o.nombre)}`,
  ]
  for (const e of eventos) {
    lineas.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${sello}`, `SUMMARY:${escaparICS(e.titulo)}`)
    if (e.fecha) {
      lineas.push(`DTSTART;VALUE=DATE:${fechaICS(e.fecha)}`)
      lineas.push(`DTEND;VALUE=DATE:${fechaICS(e.hasta ?? e.fecha)}`)
    } else if (e.inicio && e.fin) {
      lineas.push(`DTSTART:${fechaHoraICS(e.inicio.fecha, e.inicio.minuto, o.zonaMin)}`)
      lineas.push(`DTEND:${fechaHoraICS(e.fin.fecha, e.fin.minuto, o.zonaMin)}`)
    }
    if (e.descripcion) lineas.push(`DESCRIPTION:${escaparICS(e.descripcion)}`)
    if (e.lugar) lineas.push(`LOCATION:${escaparICS(e.lugar)}`)
    lineas.push('END:VEVENT')
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(plegar).join('\r\n') + '\r\n'
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export interface EventoLeido {
  uid: string
  titulo: string
  /** Día de inicio. */
  desde: ISO
  /** Día de fin, exclusivo en los de día entero; en los con hora, el día en que terminan. */
  hasta: ISO
  diaEntero: boolean
}

const desplegar = (texto: string) => texto.replace(/\r?\n[ \t]/g, '')

const aISO = (v: string): ISO | null => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// De una pasada: con reemplazos en cadena, una barra escapada seguida de "n" ("\\n") salía como salto de línea.
const desescapar = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))

/**
 * Lee los eventos de un .ics. Tolerante: ignora lo que no entiende y los
 * eventos sin fechas. Sirve para marcar como ocupadas las fechas que trae un
 * calendario externo.
 */
export function leerICS(texto: string): EventoLeido[] {
  const out: EventoLeido[] = []
  const bloques = desplegar(texto).split(/BEGIN:VEVENT/).slice(1)
  for (const b of bloques) {
    const cuerpo = b.split(/END:VEVENT/)[0]
    const campo = (nombre: string) => {
      const m = new RegExp(`^${nombre}(;[^:\\n]*)?:(.*)$`, 'mi').exec(cuerpo)
      return m ? { params: m[1] ?? '', valor: m[2].trim() } : null
    }
    const ds = campo('DTSTART'), de = campo('DTEND')
    if (!ds) continue
    const desde = aISO(ds.valor)
    if (!desde) continue
    const diaEntero = /VALUE=DATE/i.test(ds.params) || /^\d{8}$/.test(ds.valor)
    const hasta = (de && aISO(de.valor)) ?? desde
    out.push({ uid: campo('UID')?.valor ?? `${desde}-${out.length}`, titulo: desescapar(campo('SUMMARY')?.valor ?? 'Reservado'), desde, hasta, diaEntero })
  }
  return out
}

/** Para descargar el archivo desde el navegador. */
export function descargarICS(contenido: string, nombreArchivo: string) {
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo.endsWith('.ics') ? nombreArchivo : `${nombreArchivo}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revocar en el acto puede cortar la descarga en Safari y Firefox: se libera después.
  setTimeout(() => URL.revokeObjectURL(url), 40_000)
}

// Fechas de Difusión (programar publicaciones, calendario). La persona elige la hora en su reloj; al servidor viaja
// como una fecha completa (ISO, UTC), así que no hay confusión de zonas.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const dos = (n: number) => String(n).padStart(2, '0')

/** Para el valor de un <input type="datetime-local">: "2026-10-13T19:00", en la hora local de la persona. */
export function aInputLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}

/** El valor de un <input type="datetime-local"> como fecha (null si está vacío o es inválido). */
export function deInputLocal(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null
  const f = new Date(valor)
  return Number.isNaN(f.getTime()) ? null : f
}

/** "mar 13 oct · 19:00" (con el año si no es el actual). */
export function cuando(iso: string | Date, ahora: Date = new Date()): string {
  const f = typeof iso === 'string' ? new Date(iso) : iso
  const anio = f.getFullYear() === ahora.getFullYear() ? '' : ` ${f.getFullYear()}`
  return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}${anio} · ${dos(f.getHours())}:${dos(f.getMinutes())}`
}

/** "martes" para un día de la semana (0 = domingo). */
export const nombreDelDia = (dia: number): string => DIAS[dia] ?? ''
export const nombreCortoDelDia = (dia: number): string => DIAS_CORTOS[dia] ?? ''
export const nombreDelMes = (mes: number): string => MESES[mes] ?? ''

/** "19 a 21 h" para una ventana de 3 horas que empieza en `desde`. */
export function ventanaHoraria(desde: number): string {
  return `${desde} a ${(desde + 3) % 24} h`
}

/** "2026-10" de una fecha. */
export function claveDeMes(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}`
}

/** Las semanas de un mes para el calendario (lunes primero): cada semana son 7 días; los de otro mes, `null`. */
export function semanasDelMes(anio: number, mes: number): (Date | null)[][] {
  const primero = new Date(anio, mes, 1)
  const diasDelMes = new Date(anio, mes + 1, 0).getDate()
  const vacios = (primero.getDay() + 6) % 7 // lunes = 0
  const celdas: (Date | null)[] = [...Array(vacios).fill(null), ...Array.from({ length: diasDelMes }, (_, i) => new Date(anio, mes, i + 1))]
  while (celdas.length % 7 !== 0) celdas.push(null)
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7))
}

/** ¿Es el mismo día del calendario? */
export const mismoDia = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

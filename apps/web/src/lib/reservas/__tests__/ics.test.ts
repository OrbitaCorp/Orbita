import { describe, expect, it } from 'vitest'
import { escaparICS, fechaHoraICS, generarICS, leerICS } from '../ics'

describe('ics', () => {
  const ahora = new Date(Date.UTC(2026, 9, 26, 12, 0, 0))

  it('genera un calendario válido con líneas CRLF y un evento con hora en UTC', () => {
    const texto = generarICS([{ uid: 'r1@orbita', titulo: 'Fútbol 5 · Cancha A', inicio: { fecha: '2026-11-14', minuto: 19 * 60 }, fin: { fecha: '2026-11-14', minuto: 20 * 60 }, lugar: 'Complejo La Cancha' }], { nombre: 'Cancha A', ahora })
    expect(texto.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(texto).toContain('X-WR-CALNAME:Cancha A')
    expect(texto).toContain('UID:r1@orbita')
    expect(texto).toContain('DTSTAMP:20261026T120000Z')
    // 19:00 de Argentina (UTC-3) son las 22:00 UTC.
    expect(texto).toContain('DTSTART:20261114T220000Z')
    expect(texto).toContain('DTEND:20261114T230000Z')
    expect(texto.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(texto.split('\r\n').every(l => l.length <= 75)).toBe(true)
  })

  it('una estadía va como día entero, con la salida exclusiva', () => {
    const texto = generarICS([{ uid: 'e1', titulo: 'Reservado', fecha: '2026-11-14', hasta: '2026-11-16' }], { nombre: 'Cabaña', ahora })
    expect(texto).toContain('DTSTART;VALUE=DATE:20261114')
    expect(texto).toContain('DTEND;VALUE=DATE:20261116')
  })

  it('escapa lo que el formato pide y pliega las líneas largas', () => {
    expect(escaparICS('Cumple de Juan; torta, globos\ny más')).toBe('Cumple de Juan\\; torta\\, globos\\ny más')
    const largo = 'x'.repeat(200)
    const texto = generarICS([{ uid: 'l', titulo: largo, fecha: '2026-11-14', hasta: '2026-11-15' }], { nombre: 'c', ahora })
    expect(texto).toContain('\r\n x')
    expect(leerICS(texto)[0].titulo).toBe(largo)
  })

  it('pliega por bytes, no por caracteres, sin partir una letra con tilde', () => {
    const titulo = 'Cabaña Arrayán · Cabañas del Bosque · niñas y niños 🎉 · '.repeat(4).trim()
    const texto = generarICS([{ uid: 'b', titulo, fecha: '2026-11-14', hasta: '2026-11-16' }], { nombre: 'Cabañas', ahora })
    expect(texto.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(texto).not.toContain('\uFFFD')
    expect(leerICS(texto)[0].titulo).toBe(titulo)
  })

  it('una barra escapada no se confunde con un salto de línea', () => {
    const titulo = 'Sala 1\\norte; con coma, y\nsalto'
    const texto = generarICS([{ uid: 'e', titulo, fecha: '2026-11-14', hasta: '2026-11-15' }], { nombre: 'c', ahora })
    expect(leerICS(texto)[0].titulo).toBe(titulo)
  })

  it('lee un .ics externo (Airbnb manda bloqueos como día entero)', () => {
    const externo = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Airbnb Inc//Hosting Calendar//EN',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261220', 'DTEND;VALUE=DATE:20261227', 'UID:abc@airbnb.com', 'SUMMARY:Reserved', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261105T190000Z', 'DTEND:20261105T210000Z', 'SUMMARY:Cumple\\, Pedro', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const ev = leerICS(externo)
    expect(ev).toHaveLength(2)
    expect(ev[0]).toEqual({ uid: 'abc@airbnb.com', titulo: 'Reserved', desde: '2026-12-20', hasta: '2026-12-27', diaEntero: true })
    expect(ev[1].titulo).toBe('Cumple, Pedro')
    expect(ev[1].diaEntero).toBe(false)
    expect(ev[1].desde).toBe('2026-11-05')
  })

  it('pasa horas locales a UTC', () => {
    expect(fechaHoraICS('2026-11-14', 23 * 60, -180)).toBe('20261115T020000Z')
  })
})

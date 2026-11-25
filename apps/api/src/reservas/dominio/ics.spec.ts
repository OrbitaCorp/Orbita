import { MAX_EVENTOS, clasificarEvento, generarICS, leerICS, sinEco, type TipoExterno } from './ics';

// Lectura y generación: los mismos casos que apps/web/src/lib/reservas/__tests__/ics.test.ts
// (el servidor solo genera eventos de día entero: es lo que usa una estadía).
describe('reservas · .ics', () => {
  const ahora = new Date(Date.UTC(2026, 9, 26, 12, 0, 0));

  it('genera un calendario válido con líneas CRLF y eventos de día entero, con la salida exclusiva', () => {
    const texto = generarICS([{ uid: 'e1@orbita.site', titulo: 'Reservado', desde: '2026-11-14', hasta: '2026-11-16' }], { nombre: 'Cabaña', ahora });
    expect(texto.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(texto).toContain('X-WR-CALNAME:Cabaña');
    expect(texto).toContain('UID:e1@orbita.site');
    expect(texto).toContain('DTSTAMP:20261026T120000Z');
    expect(texto).toContain('DTSTART;VALUE=DATE:20261114');
    expect(texto).toContain('DTEND;VALUE=DATE:20261116');
    expect(texto.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('sin eventos devuelve un calendario válido y vacío', () => {
    const texto = generarICS([], { nombre: 'Cabaña', ahora });
    expect(texto).toContain('BEGIN:VCALENDAR');
    expect(texto).toContain('END:VCALENDAR');
    expect(texto).not.toContain('BEGIN:VEVENT');
    expect(leerICS(texto)).toEqual([]);
  });

  it('escapa lo que el formato pide y pliega las líneas largas por bytes, sin partir una letra con tilde', () => {
    const titulo = 'Cabaña Arrayán; niñas, niños 🎉 · '.repeat(6).trim();
    const texto = generarICS([{ uid: 'b', titulo, desde: '2026-11-14', hasta: '2026-11-16' }], { nombre: 'Cabañas', ahora });
    expect(texto.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(texto).not.toContain('�');
    expect(leerICS(texto)[0].titulo).toBe(titulo);
  });

  it('una barra escapada no se confunde con un salto de línea', () => {
    const titulo = 'Sala 1\\norte; con coma, y\nsalto';
    const texto = generarICS([{ uid: 'e', titulo, desde: '2026-11-14', hasta: '2026-11-15' }], { nombre: 'c', ahora });
    expect(leerICS(texto)[0].titulo).toBe(titulo);
  });

  it('lee un .ics externo (Airbnb manda sus noches como día entero)', () => {
    const externo = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Airbnb Inc//Hosting Calendar//EN',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261220', 'DTEND;VALUE=DATE:20261227', 'UID:abc@airbnb.com', 'SUMMARY:Reserved', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261107', 'SUMMARY:Airbnb (Not available)', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const ev = leerICS(externo);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toEqual({ uid: 'abc@airbnb.com', titulo: 'Reserved', desde: '2026-12-20', hasta: '2026-12-27', diaEntero: true });
    expect(ev[1].titulo).toBe('Airbnb (Not available)');
    // Sin UID, uno estable por fechas: el mismo archivo da el mismo identificador.
    expect(ev[1].uid).toBe(leerICS(externo)[1].uid);
  });

  it('un evento con hora ocupa las noches desde su día de inicio hasta su día de fin', () => {
    const texto = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:h', 'DTSTART:20261210T150000Z', 'DTEND:20261212T100000Z', 'SUMMARY:Reserved', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(leerICS(texto)[0]).toMatchObject({ desde: '2026-12-10', hasta: '2026-12-12', diaEntero: false });
  });

  it('con la salida anterior o igual a la entrada, o sin salida, es una sola noche', () => {
    const ev = (lineas: string[]) => leerICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', ...lineas, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'))[0];
    expect(ev(['DTSTART;VALUE=DATE:20261210', 'DTEND;VALUE=DATE:20261210'])).toMatchObject({ desde: '2026-12-10', hasta: '2026-12-11' });
    expect(ev(['DTSTART;VALUE=DATE:20261210', 'DTEND;VALUE=DATE:20261201'])).toMatchObject({ desde: '2026-12-10', hasta: '2026-12-11' });
    expect(ev(['DTSTART;VALUE=DATE:20261210'])).toMatchObject({ desde: '2026-12-10', hasta: '2026-12-11' });
  });

  it('ignora lo que no entiende: eventos sin fecha, fechas que no existen, texto que no es un calendario', () => {
    const texto = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Sin fecha', 'END:VEVENT', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261340', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(leerICS(texto)).toEqual([]);
    expect(leerICS('<html><body>Error 403</body></html>')).toEqual([]);
    expect(leerICS('')).toEqual([]);
  });

  it('un archivo con más de 500 eventos se corta en 500', () => {
    const eventos = Array.from({ length: 600 }, (_, i) => ['BEGIN:VEVENT', `UID:u${i}`, 'DTSTART;VALUE=DATE:20261210', 'DTEND;VALUE=DATE:20261212', 'END:VEVENT']).flat();
    expect(MAX_EVENTOS).toBe(500);
    expect(leerICS(['BEGIN:VCALENDAR', ...eventos, 'END:VCALENDAR'].join('\r\n'))).toHaveLength(500);
  });
});

describe('reservas · qué es cada evento de Airbnb', () => {
  it('una reserva de Airbnb es RESERVADO; lo demás, CERRADO', () => {
    expect(clasificarEvento('Reserved')).toBe('RESERVADO');
    expect(clasificarEvento('Reservado')).toBe('RESERVADO');
    expect(clasificarEvento('  reserved  ')).toBe('RESERVADO');
    expect(clasificarEvento('Airbnb (Not available)')).toBe('CERRADO');
    expect(clasificarEvento('')).toBe('CERRADO');
    expect(clasificarEvento('Cualquier otra cosa')).toBe('CERRADO');
  });

  it('el eco: un CERRADO con las fechas exactas de algo exportado se descarta; un RESERVADO, nunca', () => {
    const exportadas = [{ desde: '2026-12-10', hasta: '2026-12-13' }];
    const ev = (desde: string, hasta: string, tipo: TipoExterno) => ({ desde, hasta, tipo });
    expect(sinEco([ev('2026-12-10', '2026-12-13', 'CERRADO')], exportadas)).toEqual([]);
    expect(sinEco([ev('2026-12-10', '2026-12-13', 'RESERVADO')], exportadas)).toHaveLength(1);
    // Airbnb juntó nuestro rango con un día que el dueño cerró a mano: no coincide exacto, se bloquea.
    expect(sinEco([ev('2026-12-10', '2026-12-15', 'CERRADO')], exportadas)).toHaveLength(1);
    // Un cierre suelto del dueño en Airbnb, que Órbita nunca exportó: se bloquea.
    expect(sinEco([ev('2026-12-20', '2026-12-22', 'CERRADO')], exportadas)).toHaveLength(1);
    expect(sinEco([ev('2026-12-10', '2026-12-13', 'CERRADO')], [])).toHaveLength(1);
  });
});

import { MAXIMO_BYTES_CSV, MAXIMO_FILAS_CSV, leerCsvDeAirbnb, type EstadiaLeida } from './csv-airbnb';

// El archivo de ganancias de Airbnb, leído sin base ni internet. Airbnb no
// documenta el formato: estos ejemplos salen de lo que publicaron anfitriones
// (el de inglés) y de la traducción más probable (el de castellano).

const CABECERA = 'Date,Type,Confirmation Code,Start Date,Nights,Guest,Listing,Details,Reference,Currency,Amount,Paid Out,Host Fee,Cleaning Fee';
const EN = [
  CABECERA,
  '12/28/2026,Reservation,HMABC12345,12/20/2026,7,Ana Pérez,"Cabaña del Monte, con pileta",,,ARS,580000.00,,17400.00,10000.00',
  '12/29/2026,Payout,,,,,,Transfer to bank,,ARS,,580000.00,,',
].join('\r\n');

const ANA: EstadiaLeida = {
  codigo: 'HMABC12345', aviso: 'Cabaña del Monte, con pileta', entrada: '2026-12-20', salida: '2026-12-27', noches: 7,
  huesped: 'Ana Pérez', montoNeto: 580000, comision: 17400, limpieza: 10000, montoBruto: 597400, moneda: 'ARS',
};

const estadias = (texto: string): EstadiaLeida[] => {
  const r = leerCsvDeAirbnb(texto);
  if (!r.ok) throw new Error(r.motivo);
  return r.estadias;
};
/** Un archivo en inglés con una fila por reserva: [código, inicio, noches, monto] y lo demás fijo. */
const conFilas = (...filas: string[]) => [CABECERA, ...filas].join('\n');
const fila = (codigo: string, inicio: string, noches: number | string, monto: string, tipo = 'Reservation', fecha = '') =>
  `${fecha},${tipo},${codigo},${inicio},${noches},Ana,Cabaña,,,ARS,${monto},,,`;

describe('alquileres · leer el archivo de ganancias de Airbnb', () => {
  it('lee una reserva: fechas, noches, salida, huésped, aviso con coma entre comillas y plata', () => {
    expect(leerCsvDeAirbnb(EN)).toEqual({ ok: true, otrasFilas: 1, descartadas: [], estadias: [ANA] });
  });

  it('en castellano, con punto y coma, coma decimal y marca de inicio de archivo, da lo mismo', () => {
    const ES = '﻿' + [
      'Fecha;Tipo;Código de confirmación;Fecha de inicio;Noches;Huésped;Anuncio;Moneda;Monto;Tarifa de servicio;Tarifa de limpieza',
      '28/12/2026;Reservación;HMABC12345;20/12/2026;7;Ana Pérez;Cabaña del Monte, con pileta;ARS;580.000,00;17.400,00;10.000,00',
    ].join('\n');
    expect(estadias(ES)).toEqual([ANA]);
  });

  it('las columnas se reconocen por nombre, en cualquier orden y sin importar mayúsculas', () => {
    const otro = [
      'LISTING,amount,Currency,Guest,Nights,Start Date,Confirmation Code,Host Fee,Cleaning Fee',
      '"Cabaña del Monte, con pileta",580000.00,ars,Ana Pérez,7,12/20/2026,HMABC12345,17400.00,10000.00',
    ].join('\n');
    expect(estadias(otro)).toEqual([ANA]);
  });

  it('una fila de ajuste con el mismo código se suma a su estadía, diga lo que diga su tipo; una devolución total la deja en cero', () => {
    const conInicio = conFilas(fila('HM1', '12/20/2026', 7, '580000.00'), fila('HM1', '12/20/2026', 7, '-580000.00', 'Resolution Adjustment'));
    expect(estadias(conInicio)).toMatchObject([{ codigo: 'HM1', montoNeto: 0, noches: 7 }]);
    // El ajuste a veces viene sin la fecha de inicio: se suma igual a la estadía de ese código.
    const sinInicio = conFilas(fila('HM1', '12/20/2026', 7, '580000.00'), fila('HM1', '', '', '"(80,000.00)"', 'Resolution Adjustment'));
    const r = leerCsvDeAirbnb(sinInicio);
    expect(r.ok && r.estadias).toMatchObject([{ codigo: 'HM1', montoNeto: 500000 }]);
    expect(r.ok && r.otrasFilas).toBe(0);
  });

  it('el orden de las fechas se decide con todo el archivo: alcanza la fecha de un pago con día mayor que 12', () => {
    const texto = conFilas(fila('HM1', '05/01/2027', 2, '10'), fila('', '', '', '', 'Payout', '25/01/2027'));
    expect(estadias(texto)[0]).toMatchObject({ entrada: '2027-01-05', salida: '2027-01-07' });
  });

  it('si ninguna fecha lo define, un archivo en castellano se lee día/mes y uno en inglés, mes/día', () => {
    const es = ['Código de confirmación;Fecha de inicio;Noches;Anuncio;Moneda;Monto', 'HM1;05/01/2027;2;Cabaña;ARS;10'].join('\n');
    expect(estadias(es)[0].entrada).toBe('2027-01-05');
    expect(estadias(conFilas(fila('HM1', '05/01/2027', 2, '10')))[0].entrada).toBe('2027-05-01');
  });

  it('si viene la columna de ganancias brutas, se usa esa', () => {
    const texto = ['Confirmation Code,Start Date,Nights,Listing,Currency,Amount,Host Fee,Gross Earnings', 'HM1,12/20/2026,7,Cabaña,ARS,580000,17400,600000'].join('\n');
    expect(estadias(texto)[0]).toMatchObject({ montoBruto: 600000, montoNeto: 580000, comision: 17400 });
  });

  it('dos filas con el mismo código se suman en una estadía', () => {
    const texto = conFilas(fila('HM1', '12/20/2026', 7, '290000.00'), fila('HM1', '12/20/2026', 7, '290000.00'));
    expect(estadias(texto)).toHaveLength(1);
    expect(estadias(texto)[0].montoNeto).toBe(580000);
  });

  it('un archivo con día/mes/año (un primer número mayor que 12 en alguna fecha) se lee entero así', () => {
    const texto = conFilas(fila('HM1', '20/12/2026', 3, '10'), fila('HM2', '05/01/2027', 2, '10'));
    expect(estadias(texto).map((e) => e.entrada)).toEqual(['2026-12-20', '2027-01-05']);
  });

  it('una fecha que no se entiende deja esa fila afuera, con su línea y su motivo', () => {
    const r = leerCsvDeAirbnb(conFilas(fila('HM1', 'pronto', 2, '10'), fila('HM2', '12/31/2026', 2, '10')));
    expect(r).toMatchObject({ ok: true, descartadas: [{ linea: 2, motivo: 'No se entiende la fecha de inicio.' }] });
    expect(r.ok && r.estadias.map((e) => e.codigo)).toEqual(['HM2']);
  });

  it('un monto negativo entre paréntesis o con signo se lee negativo', () => {
    expect(estadias(conFilas(fila('HM1', '12/20/2026', 2, '"(1,200.50)"')))[0].montoNeto).toBe(-1200.5);
    const es = ['Código de confirmación;Fecha de inicio;Noches;Anuncio;Moneda;Monto', 'HM1;20/12/2026;2;Cabaña;ARS;-1.200,50'].join('\n');
    expect(estadias(es)[0].montoNeto).toBe(-1200.5);
  });

  it('si falta una columna necesaria no se lee nada y se dice cuál', () => {
    expect(leerCsvDeAirbnb('Date,Type,Start Date,Nights,Listing,Currency,Amount\n1/1/2027,Reservation,1/1/2027,2,X,ARS,10'))
      .toEqual({ ok: false, motivo: 'Al archivo le falta la columna del código de confirmación. Descargalo de Airbnb con todas las columnas.' });
    expect(leerCsvDeAirbnb('Confirmation Code,Start Date,Listing,Currency,Amount\nHM1,1/1/2027,X,ARS,10'))
      .toEqual({ ok: false, motivo: 'Al archivo le falta la columna de las noches. Descargalo de Airbnb con todas las columnas.' });
  });

  it('un archivo vacío, sin encabezado o que no es un CSV se rechaza', () => {
    expect(leerCsvDeAirbnb('')).toEqual({ ok: false, motivo: 'El archivo está vacío.' });
    expect(leerCsvDeAirbnb('  \r\n ')).toEqual({ ok: false, motivo: 'El archivo está vacío.' });
    expect(leerCsvDeAirbnb('<html><body>Iniciá sesión</body></html>'))
      .toEqual({ ok: false, motivo: 'No parece el archivo de ganancias de Airbnb. Tiene que ser el CSV que se descarga desde Ingresos.' });
    // Sin encabezado: la primera línea son datos, no nombres de columna.
    expect(leerCsvDeAirbnb(fila('HM1', '12/20/2026', 7, '10'))).toMatchObject({ ok: false });
  });

  it('más de 5.000 filas o más de 2 MB se rechaza', () => {
    const muchas = conFilas(...Array.from({ length: MAXIMO_FILAS_CSV + 1 }, (_, i) => fila(`HM${i}`, '12/20/2026', 1, '10')));
    expect(leerCsvDeAirbnb(muchas)).toEqual({ ok: false, motivo: 'El archivo es demasiado grande. Descargalo por año.' });
    expect(leerCsvDeAirbnb(CABECERA + '\n' + 'x'.repeat(MAXIMO_BYTES_CSV))).toEqual({ ok: false, motivo: 'El archivo es demasiado grande. Descargalo por año.' });
    expect(MAXIMO_BYTES_CSV).toBe(2_000_000);
    expect(MAXIMO_FILAS_CSV).toBe(5_000);
  });

  it('sin columna de fin, la salida es la entrada más las noches; con columna de fin y sin noches, al revés', () => {
    expect(estadias(conFilas(fila('HM1', '12/30/2026', 3, '10')))[0]).toMatchObject({ entrada: '2026-12-30', salida: '2027-01-02', noches: 3 });
    const conFin = ['Confirmation Code,Start Date,End Date,Listing,Currency,Amount', 'HM1,12/30/2026,01/02/2027,Cabaña,ARS,10'].join('\n');
    expect(estadias(conFin)[0]).toMatchObject({ entrada: '2026-12-30', salida: '2027-01-02', noches: 3 });
  });

  it('la moneda sale en mayúsculas y un salto de línea dentro de comillas no corta la fila', () => {
    const texto = ['Confirmation Code,Start Date,Nights,Guest,Listing,Currency,Amount', 'HM1,12/20/2026,2,Ana,"Cabaña\ndel Monte",usd,300', 'HM2,12/25/2026,1,Luis,Depto,USD,100'].join('\n');
    expect(estadias(texto)).toMatchObject([{ codigo: 'HM1', aviso: 'Cabaña del Monte', moneda: 'USD', montoNeto: 300 }, { codigo: 'HM2', moneda: 'USD' }]);
  });
});

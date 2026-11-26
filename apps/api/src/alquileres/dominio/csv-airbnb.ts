// Leer el archivo de ganancias que un anfitrión descarga de Airbnb (CSV).
//
// Airbnb no documenta el formato y el anfitrión puede elegir qué columnas
// baja. Por eso:
//
// - Cada columna se reconoce POR NOMBRE (en inglés o en castellano), nunca por
//   posición, sin importar mayúsculas, acentos ni orden.
// - Si falta una columna necesaria no se lee nada y se dice cuál.
// - Una fila es de una estadía si tiene código de confirmación. Las filas del
//   mismo código se suman: una reserva pagada en partes, o con un ajuste o una
//   devolución, queda en una sola estadía (su neto puede dar cero o menos; qué
//   hacer con eso lo decide quien la usa).
// - Las demás filas (transferencias al banco) se cuentan y no se leen.
//
// Función pura: no toca la base ni la red, y nunca tira. Los textos de los
// motivos van al dueño tal cual. Diseño:
// docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md

export const MAXIMO_BYTES_CSV = 2_000_000;
export const MAXIMO_FILAS_CSV = 5_000;

export interface EstadiaLeida {
  codigo: string;
  aviso: string;
  /** AAAA-MM-DD. `salida` es el día en que se va (la entrada más las noches). */
  entrada: string;
  salida: string;
  noches: number;
  huesped: string | null;
  montoBruto: number;
  comision: number;
  limpieza: number;
  /** Lo que le quedó al anfitrión por esta estadía. */
  montoNeto: number;
  /** En mayúsculas, tres letras. */
  moneda: string;
}

export interface FilaDescartada {
  /** Número de fila del archivo; el encabezado es la 1. */
  linea: number;
  motivo: string;
}

export type LecturaCsv =
  | { ok: true; estadias: EstadiaLeida[]; descartadas: FilaDescartada[]; otrasFilas: number }
  | { ok: false; motivo: string };

type Dato = 'codigo' | 'inicio' | 'fin' | 'noches' | 'huesped' | 'aviso' | 'moneda' | 'neto' | 'comision' | 'limpieza' | 'bruto';

/** Los nombres con que se conoce cada columna, ya en minúsculas y sin acentos. */
const COLUMNAS: Record<Dato, { en: string[]; es: string[] }> = {
  codigo: { en: ['confirmation code'], es: ['codigo de confirmacion'] },
  inicio: { en: ['start date', 'check-in', 'checkin'], es: ['fecha de inicio', 'fecha de llegada', 'llegada'] },
  fin: { en: ['end date', 'check-out', 'checkout'], es: ['fecha de finalizacion', 'fecha de salida', 'salida'] },
  noches: { en: ['nights'], es: ['noches'] },
  huesped: { en: ['guest'], es: ['huesped'] },
  aviso: { en: ['listing'], es: ['anuncio', 'alojamiento'] },
  moneda: { en: ['currency'], es: ['moneda'] },
  neto: { en: ['amount'], es: ['monto', 'importe'] },
  comision: { en: ['host fee', 'service fee', 'host service fee'], es: ['tarifa de servicio', 'tarifa por servicio', 'comision de servicio', 'tarifa de servicio del anfitrion'] },
  limpieza: { en: ['cleaning fee'], es: ['tarifa de limpieza', 'gastos de limpieza'] },
  bruto: { en: ['gross earnings'], es: ['ganancias brutas', 'ingresos brutos'] },
};

/** Cómo se nombra cada columna necesaria cuando falta. */
const FALTA: Partial<Record<Dato, string>> = {
  codigo: 'del código de confirmación',
  inicio: 'de la fecha de inicio',
  noches: 'de las noches',
  aviso: 'del anuncio',
  moneda: 'de la moneda',
  neto: 'del monto',
};

const DEMASIADO_GRANDE = 'El archivo es demasiado grande. Descargalo por año.';
const NO_ES = 'No parece el archivo de ganancias de Airbnb. Tiene que ser el CSV que se descarga desde Ingresos.';

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpio = (s: string) => s.replace(/\s+/g, ' ').trim();
const nombre = (s: string) => sinAcentos(limpio(s)).toLowerCase();
const redondo = (n: number) => Math.round(n * 100) / 100;

/** El separador de la primera línea: el que más aparece fuera de comillas, entre coma y punto y coma. */
function separadorDe(texto: string): ',' | ';' {
  let comas = 0;
  let puntos = 0;
  let entreComillas = false;
  for (const c of texto) {
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas && (c === '\n' || c === '\r')) break;
    else if (!entreComillas && c === ',') comas++;
    else if (!entreComillas && c === ';') puntos++;
  }
  return puntos > comas ? ';' : ',';
}

/** Las filas del archivo, con comillas, comillas dobles adentro y saltos de línea entre comillas. null si son demasiadas. */
function partir(texto: string, sep: string, maximo: number): string[][] | null {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const cerrarFila = () => {
    fila.push(celda);
    celda = '';
    if (fila.some((c) => c.trim() !== '')) filas.push(fila);
    fila = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarFila();
      if (filas.length > maximo) return null;
    } else celda += c;
  }
  cerrarFila();
  return filas.length > maximo ? null : filas;
}

/** Un monto con o sin símbolo, con coma o punto decimal, negativo con signo o entre paréntesis. '' es 0; null si no se entiende. */
function monto(texto: string): number | null {
  const t = texto.trim();
  if (!t) return 0;
  const negativo = /^\(.*\)$/.test(t) || /^[^\d]*-/.test(t) || /-$/.test(t);
  let d = t.replace(/[^\d.,]/g, '');
  if (!/\d/.test(d)) return null;
  // El último separador seguido de uno o dos dígitos es el decimal; los demás son de miles.
  const m = /[.,](\d{1,2})$/.exec(d);
  if (m) d = `${d.slice(0, m.index).replace(/[.,]/g, '')}.${m[1]}`;
  else d = d.replace(/[.,]/g, '');
  const n = Number(d);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

type Orden = 'DM' | 'MD';
const PARTES = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function armar(anio: number, mes: number, dia: number): string | null {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return f.toISOString().slice(0, 10);
}

/** AAAA-MM-DD, o null si no es una fecha. Una fecha que por sí sola dice su orden (un número mayor que 12) lo usa. */
function fecha(texto: string, orden: Orden): string | null {
  const t = texto.trim();
  const iso = ISO.exec(t);
  if (iso) return armar(+iso[1], +iso[2], +iso[3]);
  const p = PARTES.exec(t);
  if (!p) return null;
  const [a, b] = [+p[1], +p[2]];
  const anio = p[3].length === 2 ? 2000 + +p[3] : +p[3];
  const propio: Orden = a > 12 ? 'DM' : b > 12 ? 'MD' : orden;
  return propio === 'DM' ? armar(anio, b, a) : armar(anio, a, b);
}

const sumarDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

export function leerCsvDeAirbnb(texto: string): LecturaCsv {
  if (Buffer.byteLength(texto, 'utf8') > MAXIMO_BYTES_CSV) return { ok: false, motivo: DEMASIADO_GRANDE };
  const cuerpo = texto.replace(/^﻿/, '');
  if (!cuerpo.trim()) return { ok: false, motivo: 'El archivo está vacío.' };
  const filas = partir(cuerpo, separadorDe(cuerpo), MAXIMO_FILAS_CSV + 1);
  if (!filas) return { ok: false, motivo: DEMASIADO_GRANDE };
  if (filas.length === 0) return { ok: false, motivo: 'El archivo está vacío.' };

  // Qué columna es cada dato, y en qué idioma vienen los encabezados.
  const encabezados = filas[0].map(nombre);
  const indice: Partial<Record<Dato, number>> = {};
  let enCastellano = 0;
  let enIngles = 0;
  for (const dato of Object.keys(COLUMNAS) as Dato[]) {
    const es = encabezados.findIndex((h) => COLUMNAS[dato].es.includes(h));
    const en = encabezados.findIndex((h) => COLUMNAS[dato].en.includes(h));
    if (en >= 0) { indice[dato] = en; enIngles++; }
    else if (es >= 0) { indice[dato] = es; enCastellano++; }
  }
  if (enIngles + enCastellano === 0) return { ok: false, motivo: NO_ES };
  const necesarias: Dato[] = ['codigo', 'inicio', 'aviso', 'moneda', 'neto'];
  const falta = necesarias.find((d) => indice[d] === undefined) ?? (indice.noches === undefined && indice.fin === undefined ? 'noches' : undefined);
  if (falta) return { ok: false, motivo: `Al archivo le falta la columna ${FALTA[falta]}. Descargalo de Airbnb con todas las columnas.` };

  // El orden de las fechas, una vez para todo el archivo: lo dice cualquier fecha con un número mayor que 12,
  // en cualquier columna de fecha (también la del pago). Sin evidencia, el idioma de los encabezados.
  const columnasDeFecha = encabezados.flatMap((h, i) => (/\b(date|fecha)\b/.test(h) || i === indice.inicio || i === indice.fin ? [i] : []));
  let primeroGrande = false;
  let segundoGrande = false;
  for (const f of filas.slice(1)) {
    for (const i of columnasDeFecha) {
      const p = PARTES.exec((f[i] ?? '').trim());
      if (!p) continue;
      if (+p[1] > 12) primeroGrande = true;
      if (+p[2] > 12) segundoGrande = true;
    }
  }
  const orden: Orden = primeroGrande && !segundoGrande ? 'DM' : segundoGrande && !primeroGrande ? 'MD' : enCastellano > enIngles ? 'DM' : 'MD';

  const celda = (f: string[], d: Dato) => (indice[d] === undefined ? '' : limpio(f[indice[d]] ?? ''));
  const porCodigo = new Map<string, EstadiaLeida & { brutoLeido: number }>();
  const descartadas: FilaDescartada[] = [];
  const sueltas: { linea: number; f: string[] }[] = [];
  let otrasFilas = 0;

  filas.slice(1).forEach((f, n) => {
    const linea = n + 2;
    const codigo = celda(f, 'codigo');
    if (!codigo) { otrasFilas++; return; }
    // Un ajuste puede venir sin fecha de inicio: se suma después a la estadía de su código, si la hay.
    if (!celda(f, 'inicio')) { sueltas.push({ linea, f }); return; }
    const descartar = (motivo: string) => { descartadas.push({ linea, motivo }); };

    const entrada = fecha(celda(f, 'inicio'), orden);
    if (!entrada) return descartar('No se entiende la fecha de inicio.');
    const fin = celda(f, 'fin') ? fecha(celda(f, 'fin'), orden) : null;
    const leidas = Number.parseInt(celda(f, 'noches'), 10);
    const noches = Number.isInteger(leidas) && leidas > 0 ? leidas : fin && fin > entrada ? diasEntre(entrada, fin) : 0;
    if (noches <= 0 || noches > 366) return descartar('No se sabe cuántas noches fueron.');
    const aviso = celda(f, 'aviso');
    if (!aviso) return descartar('No dice de qué anuncio es.');
    const moneda = celda(f, 'moneda').toUpperCase();
    if (!/^[A-Z]{3}$/.test(moneda)) return descartar('No dice la moneda.');
    const [neto, comision, limpieza, bruto] = (['neto', 'comision', 'limpieza', 'bruto'] as const).map((d) => monto(celda(f, d)));
    if (neto === null || comision === null || limpieza === null || bruto === null) return descartar('No se entiende el monto.');

    const ya = porCodigo.get(codigo);
    if (!ya) {
      porCodigo.set(codigo, {
        codigo, aviso, entrada, salida: sumarDias(entrada, noches), noches, huesped: celda(f, 'huesped') || null,
        montoBruto: 0, comision: Math.abs(comision), limpieza: Math.abs(limpieza), montoNeto: neto, moneda, brutoLeido: bruto,
      });
    } else if (ya.moneda !== moneda) descartar('Tiene otra moneda que el resto de su reserva.');
    else {
      ya.montoNeto += neto;
      ya.comision += Math.abs(comision);
      ya.limpieza += Math.abs(limpieza);
      ya.brutoLeido += bruto;
    }
  });

  for (const { linea, f } of sueltas) {
    const ya = porCodigo.get(celda(f, 'codigo'));
    if (!ya) { otrasFilas++; continue; }
    const neto = monto(celda(f, 'neto'));
    if (neto === null) { descartadas.push({ linea, motivo: 'No se entiende el monto.' }); continue; }
    ya.montoNeto += neto;
  }

  const estadias = [...porCodigo.values()].map(({ brutoLeido, ...e }) => ({
    ...e,
    montoNeto: redondo(e.montoNeto),
    comision: redondo(e.comision),
    limpieza: redondo(e.limpieza),
    montoBruto: redondo(brutoLeido > 0 ? brutoLeido : e.montoNeto + e.comision),
  }));
  return { ok: true, estadias, descartadas: descartadas.sort((a, b) => a.linea - b.linea), otrasFilas };
}

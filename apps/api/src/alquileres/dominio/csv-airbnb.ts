// Leer el archivo de ganancias que un anfitrión descarga de Airbnb (CSV).
//
// Airbnb no documenta el formato y el anfitrión puede elegir qué columnas
// baja. Por eso:
//
// - Cada columna se reconoce POR NOMBRE (en inglés o en castellano), nunca por
//   posición, sin importar mayúsculas, acentos ni orden.
// - Si falta una columna necesaria no se lee nada y se dice cuál.
// - El archivo es un historial de movimientos: cada fila con código de
//   confirmación es un MOVIMIENTO de esa estadía (el pago de la reserva, otra
//   cuota, un ajuste, una devolución). La estadía es la suma de sus
//   movimientos, y su neto puede dar cero o menos.
// - Cada movimiento lleva una clave que sale de lo que dice su fila (fecha,
//   tipo y montos). Con eso quien guarda puede juntar dos archivos de períodos
//   distintos sin duplicar lo que se repite ni pisar lo que ya tenía: una
//   estadía larga pagada en dos archivos, o un ajuste que llega en el del año
//   siguiente.
// - Un movimiento de una estadía que no está en este archivo (un ajuste
//   suelto) sale aparte, para sumarlo a la que ya esté guardada.
// - Las demás filas (transferencias al banco) se cuentan y no se leen.
//
// Función pura: no toca la base ni la red, y nunca tira. Los textos de los
// motivos van al dueño tal cual. Diseño:
// docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md

export const MAXIMO_BYTES_CSV = 2_000_000;
export const MAXIMO_FILAS_CSV = 5_000;
/** Lo que entra en la columna del código (alquileres_ingresos_externos.codigo_externo). */
const MAXIMO_CODIGO = 40;

/** Una fila del archivo, de una estadía. `comision` va con el signo que traía: una devolución resta. */
export interface Movimiento {
  /** Lo que identifica a la fila: su fecha, su tipo y sus montos, y cuál es si hay dos iguales. */
  clave: string;
  neto: number;
  comision: number;
  limpieza: number;
  bruto: number;
}

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
  /** Lo que le quedó al anfitrión por esta estadía, según este archivo. */
  montoNeto: number;
  /** En mayúsculas, tres letras. */
  moneda: string;
  /** Las filas de este archivo que la forman; los cuatro montos de arriba son su suma. */
  movimientos: Movimiento[];
}

/** Un movimiento con código cuya estadía no está en el archivo: se suma a la ya guardada, si la hay. */
export interface AjusteSuelto {
  codigo: string;
  /** null si la fila no la dice. */
  moneda: string | null;
  movimiento: Movimiento;
}

export interface FilaDescartada {
  /** Número de línea del archivo; el encabezado es la 1. */
  linea: number;
  motivo: string;
}

export type LecturaCsv =
  | { ok: true; estadias: EstadiaLeida[]; ajustes: AjusteSuelto[]; descartadas: FilaDescartada[]; otrasFilas: number }
  | { ok: false; motivo: string };

type Dato = 'codigo' | 'inicio' | 'fin' | 'noches' | 'huesped' | 'aviso' | 'moneda' | 'neto' | 'comision' | 'limpieza' | 'bruto' | 'fecha' | 'tipo';

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
  // La fecha y el tipo de la fila (del pago, no de la estadía): solo para reconocer el movimiento.
  fecha: { en: ['date'], es: ['fecha'] },
  tipo: { en: ['type'], es: ['tipo'] },
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

/** Los cuatro montos de una estadía: la suma de sus movimientos. La comisión y la limpieza quedan en positivo. */
export function totalesDe(movimientos: Movimiento[]): { montoNeto: number; comision: number; limpieza: number; montoBruto: number } {
  const suma = (de: (m: Movimiento) => number) => redondo(movimientos.reduce((s, m) => s + de(m), 0));
  const montoNeto = suma((m) => m.neto);
  const comision = Math.abs(suma((m) => m.comision));
  const bruto = suma((m) => m.bruto);
  return { montoNeto, comision, limpieza: Math.abs(suma((m) => m.limpieza)), montoBruto: bruto > 0 ? bruto : redondo(montoNeto + comision) };
}

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

interface Fila { linea: number; celdas: string[] }

/**
 * Las filas del archivo, cada una con la línea en que empieza. Entiende
 * comillas, comillas dobles adentro y saltos de línea entre comillas; las
 * líneas vacías no son filas. null si son demasiadas.
 */
function partir(texto: string, sep: string, maximo: number): Fila[] | null {
  const filas: Fila[] = [];
  let celdas: string[] = [];
  let celda = '';
  let entreComillas = false;
  let linea = 1;
  let empezoEn = 1;
  const cerrarFila = () => {
    celdas.push(celda);
    celda = '';
    if (celdas.some((c) => c.trim() !== '')) filas.push({ linea: empezoEn, celdas });
    celdas = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const salto = c === '\n' || c === '\r';
    if (salto && c === '\r' && texto[i + 1] === '\n') i++;
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += salto ? '\n' : c;
      if (salto) linea++;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { celdas.push(celda); celda = ''; }
    else if (salto) {
      cerrarFila();
      if (filas.length > maximo) return null;
      linea++;
      empezoEn = linea;
    } else celda += c;
  }
  cerrarFila();
  return filas.length > maximo ? null : filas;
}

/** Un monto con o sin símbolo, con coma o punto decimal, negativo con signo o entre paréntesis. '' es 0; null si no se entiende. */
function monto(texto: string): number | null {
  // El menos tipográfico (−) y los guiones largos también son un menos.
  const t = texto.trim().replace(/[−–—]/g, '-');
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

/** Una fila con código, ya leída: su movimiento y, si los trae bien, los datos de la estadía. */
interface Leida {
  linea: number;
  codigo: string;
  moneda: string | null;
  /** La fila quiso ser de una estadía (trae fecha de inicio). */
  conInicio: boolean;
  /** Los datos de la estadía, o por qué no se pudieron leer. */
  estadia: { entrada: string; salida: string; noches: number; aviso: string; huesped: string | null; moneda: string } | { motivo: string };
  /** La clave todavía sin el número de orden entre iguales. */
  base: string;
  montos: Omit<Movimiento, 'clave'>;
}

export function leerCsvDeAirbnb(texto: string): LecturaCsv {
  if (Buffer.byteLength(texto, 'utf8') > MAXIMO_BYTES_CSV) return { ok: false, motivo: DEMASIADO_GRANDE };
  const cuerpo = texto.replace(/^﻿/, '');
  if (!cuerpo.trim()) return { ok: false, motivo: 'El archivo está vacío.' };
  const filas = partir(cuerpo, separadorDe(cuerpo), MAXIMO_FILAS_CSV + 1);
  if (!filas) return { ok: false, motivo: DEMASIADO_GRANDE };
  if (filas.length === 0) return { ok: false, motivo: 'El archivo está vacío.' };

  // Qué columna es cada dato, y en qué idioma vienen los encabezados.
  const encabezados = filas[0].celdas.map(nombre);
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
      const p = PARTES.exec((f.celdas[i] ?? '').trim());
      if (!p) continue;
      if (+p[1] > 12) primeroGrande = true;
      if (+p[2] > 12) segundoGrande = true;
    }
  }
  const orden: Orden = primeroGrande && !segundoGrande ? 'DM' : segundoGrande && !primeroGrande ? 'MD' : enCastellano > enIngles ? 'DM' : 'MD';

  const celda = (f: Fila, d: Dato) => (indice[d] === undefined ? '' : limpio(f.celdas[indice[d]] ?? ''));
  const descartadas: FilaDescartada[] = [];
  const leidas: Leida[] = [];
  let otrasFilas = 0;

  // 1. Cada fila con código, leída por separado.
  for (const f of filas.slice(1)) {
    const codigo = celda(f, 'codigo');
    if (!codigo) { otrasFilas++; continue; }
    if (codigo.length > MAXIMO_CODIGO) { descartadas.push({ linea: f.linea, motivo: 'El código de confirmación es demasiado largo.' }); continue; }
    const [neto, comision, limpieza, bruto] = (['neto', 'comision', 'limpieza', 'bruto'] as const).map((d) => monto(celda(f, d)));
    if (neto === null || comision === null || limpieza === null || bruto === null) { descartadas.push({ linea: f.linea, motivo: 'No se entiende el monto.' }); continue; }
    const monedaLeida = celda(f, 'moneda').toUpperCase();
    const moneda = /^[A-Z]{3}$/.test(monedaLeida) ? monedaLeida : null;
    const conInicio = celda(f, 'inicio') !== '';

    let estadia: Leida['estadia'];
    const entrada = fecha(celda(f, 'inicio'), orden);
    const fin = celda(f, 'fin') ? fecha(celda(f, 'fin'), orden) : null;
    const nochesLeidas = Number.parseInt(celda(f, 'noches'), 10);
    const noches = !entrada ? 0 : Number.isInteger(nochesLeidas) && nochesLeidas > 0 ? nochesLeidas : fin && fin > entrada ? diasEntre(entrada, fin) : 0;
    const aviso = celda(f, 'aviso');
    if (!entrada) estadia = { motivo: 'No se entiende la fecha de inicio.' };
    else if (noches <= 0 || noches > 366) estadia = { motivo: 'No se sabe cuántas noches fueron.' };
    else if (!aviso) estadia = { motivo: 'No dice de qué anuncio es.' };
    else if (!moneda) estadia = { motivo: 'No dice la moneda.' };
    else estadia = { entrada, salida: sumarDias(entrada, noches), noches, aviso, huesped: celda(f, 'huesped') || null, moneda };

    // La clave: la fecha del pago (ya como AAAA-MM-DD, así no depende del idioma del archivo), el tipo y los montos.
    const delPago = celda(f, 'fecha');
    const base = [fecha(delPago, orden) ?? delPago, nombre(celda(f, 'tipo')), neto, comision, limpieza, bruto].join('|');
    leidas.push({ linea: f.linea, codigo, moneda, conInicio, estadia, base, montos: { neto, comision, limpieza, bruto } });
  }

  // 2. Por código: la primera fila que trae bien la estadía la define, y todas sus filas son sus movimientos.
  const porCodigo = new Map<string, Leida[]>();
  for (const l of leidas) porCodigo.set(l.codigo, [...(porCodigo.get(l.codigo) ?? []), l]);
  const estadias: EstadiaLeida[] = [];
  const ajustes: AjusteSuelto[] = [];
  for (const [codigo, suyas] of porCodigo) {
    const principal = suyas.find((l) => !('motivo' in l.estadia));
    const repetidas = new Map<string, number>();
    // Dos filas iguales (dos pagos idénticos el mismo día) son dos movimientos: la clave lleva cuál es.
    const movimiento = (l: Leida): Movimiento => {
      const n = (repetidas.get(l.base) ?? 0) + 1;
      repetidas.set(l.base, n);
      return { clave: `${l.base}#${n}`, ...l.montos };
    };
    if (!principal || 'motivo' in principal.estadia) {
      // La estadía no está en el archivo. Lo que quiso serlo y no se pudo leer queda afuera con su motivo;
      // lo demás (un ajuste sin fecha de inicio) sale suelto, para sumarlo a la que ya esté guardada.
      for (const l of suyas) {
        if (l.conInicio && 'motivo' in l.estadia) descartadas.push({ linea: l.linea, motivo: l.estadia.motivo });
        else ajustes.push({ codigo, moneda: l.moneda, movimiento: movimiento(l) });
      }
      continue;
    }
    const datos = principal.estadia;
    const movimientos: Movimiento[] = [];
    for (const l of suyas) {
      if (l.moneda && l.moneda !== datos.moneda) descartadas.push({ linea: l.linea, motivo: 'Tiene otra moneda que el resto de su reserva.' });
      else movimientos.push(movimiento(l));
    }
    estadias.push({ codigo, ...datos, ...totalesDe(movimientos), movimientos });
  }
  return { ok: true, estadias, ajustes, descartadas: descartadas.sort((a, b) => a.linea - b.linea), otrasFilas };
}

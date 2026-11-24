// El precio de una estadía (un ALOJAMIENTO reservado por noches), calculado
// en el servidor. Cada noche vale el precio base del recurso o el de su
// temporada, con un recargo los viernes y los sábados si el dueño lo pide, y
// se suma una limpieza fija por estadía.
//
// Es la misma cuenta que hace el sitio antes de reservar
// (apps/web/src/lib/reservas/estadia.ts, precioEstadia), con los mismos casos
// de prueba: el total que ve la persona es el que se guarda en la reserva. Si
// cambia una regla allá, cambia acá.
//
// La tarifa vive en `datos.tarifa` del recurso. Sin eso, una estadía vale el
// precio del recurso por la cantidad de noches, como antes de que existiera.
import { diaDeSemana, esFecha, sumarDias } from './tiempo';

export interface Temporada {
  nombre: string;
  /** Las dos fechas están adentro de la temporada. */
  desde: string;
  hasta: string;
  precioNoche: number;
}

export interface TarifaEstadia {
  /** Precio por noche fuera de temporada: el precio del recurso. */
  precioNoche: number;
  temporadas: Temporada[];
  /** Recargo (%) sobre el precio de la noche los viernes y los sábados. 0 = sin recargo. */
  finDeSemanaPct: number;
  /** Tarifa fija de limpieza por estadía. */
  limpieza: number;
}

/** Hasta cuánto recargo de fin de semana se acepta: más que eso es un dato mal cargado. */
const RECARGO_MAXIMO = 200;

const redondearCien = (n: number): number => Math.round(n / 100) * 100;
/** Sin multiplicar por 1,15: en coma flotante 45.000 × 1,15 da 51.749,99 y redondea para abajo. */
const conAjuste = (monto: number, pct: number): number => (monto * (100 + pct)) / 100;
const esMonto = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * La tarifa de un alojamiento a partir del precio del recurso y de sus
 * `datos`. Lee con cuidado: una temporada sin fechas, al revés o con un
 * precio negativo no se aplica, y un recargo o una limpieza que no son un
 * número razonable valen 0. Nunca tira.
 */
export function tarifaDeAlojamiento(precioBase: number, datos: unknown): TarifaEstadia {
  const d = (datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {}) as Record<string, unknown>;
  const t = (d.tarifa && typeof d.tarifa === 'object' && !Array.isArray(d.tarifa) ? d.tarifa : {}) as Record<string, unknown>;
  const temporadas: Temporada[] = [];
  for (const x of Array.isArray(t.temporadas) ? t.temporadas : []) {
    if (!x || typeof x !== 'object') continue;
    const { nombre, desde, hasta, precioNoche } = x as Record<string, unknown>;
    if (!esFecha(desde) || !esFecha(hasta) || desde > hasta || !esMonto(precioNoche)) continue;
    temporadas.push({ nombre: typeof nombre === 'string' ? nombre : '', desde, hasta, precioNoche });
  }
  return {
    precioNoche: esMonto(precioBase) ? precioBase : 0,
    temporadas,
    finDeSemanaPct: esMonto(t.finDeSemanaPct) && t.finDeSemanaPct <= RECARGO_MAXIMO ? t.finDeSemanaPct : 0,
    limpieza: esMonto(t.limpieza) ? t.limpieza : 0,
  };
}

/**
 * La temporada de una noche. Si se pisan dos (Carnaval adentro de la
 * temporada alta), manda la más corta: es la más específica.
 */
export function temporadaDe(noche: string, temporadas: Temporada[]): Temporada | null {
  let elegida: Temporada | null = null;
  for (const t of temporadas) {
    if (noche < t.desde || noche > t.hasta) continue;
    // Las fechas son AAAA-MM-DD: restar los días sirve para comparar largos.
    if (!elegida || Date.parse(t.hasta) - Date.parse(t.desde) < Date.parse(elegida.hasta) - Date.parse(elegida.desde)) elegida = t;
  }
  return elegida;
}

/**
 * Una noche lleva el nombre del día en que se duerme: la del viernes y la del
 * sábado son las de fin de semana. La del domingo ya es de semana (se sale el
 * lunes).
 */
export function nocheDeFinDeSemana(noche: string): boolean {
  const d = diaDeSemana(noche); // 0 = domingo … 6 = sábado
  return d === 5 || d === 6;
}

export interface PrecioDeEstadia {
  noches: { noche: string; precio: number }[];
  subtotal: number;
  limpieza: number;
  total: number;
}

/** El precio de cada noche de [entrada, salida) y el total con la limpieza. */
export function precioDeEstadia(entrada: string, salida: string, t: TarifaEstadia): PrecioDeEstadia {
  const noches: { noche: string; precio: number }[] = [];
  for (let noche = entrada; noche < salida; noche = sumarDias(noche, 1)) {
    const base = temporadaDe(noche, t.temporadas)?.precioNoche ?? t.precioNoche;
    const finDeSemana = t.finDeSemanaPct > 0 && nocheDeFinDeSemana(noche);
    noches.push({ noche, precio: redondearCien(finDeSemana ? conAjuste(base, t.finDeSemanaPct) : base) });
  }
  const subtotal = noches.reduce((s, n) => s + n.precio, 0);
  const limpieza = noches.length ? t.limpieza : 0;
  return { noches, subtotal, limpieza, total: subtotal + limpieza };
}

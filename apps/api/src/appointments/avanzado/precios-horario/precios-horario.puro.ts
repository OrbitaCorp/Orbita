// Precios por horario (P4.4): la cuenta, PURA. CONTRATO § 1.3:
//   precio = redondear(price * (100 + adjustPercent) / 100), con la regla
//   activa cuyo día y franja contienen el INICIO del turno; si hay más de una,
//   la de mayor descuento (el adjustPercent más bajo).
import { diaDeSemana, fechaYMinutos } from '../../horarios/horarios';
import { redondear } from '../comun/dinero';

export interface ReglaPrecio {
  id?: string;
  /** 0 = lunes … 6 = domingo. */
  weekdays: number[];
  /** Minutos desde las 00:00 de Argentina, inclusive. */
  fromMin: number;
  /** Exclusivo. */
  toMin: number;
  /** Negativo = descuento, positivo = recargo. */
  adjustPercent: number;
  isActive: boolean;
}

export interface PrecioAjustado {
  precio: number;
  /** 0 si no aplica ninguna regla. */
  adjustPercent: number;
  reglaId: string | null;
}

/** La regla que aplica a un turno que empieza en `instante`, o null. */
export function reglaQueAplica<R extends ReglaPrecio>(reglas: readonly R[], instante: Date): R | null {
  const { fecha, minutos } = fechaYMinutos(instante);
  const dia = diaDeSemana(fecha);
  let elegida: R | null = null;
  for (const r of reglas) {
    if (!r.isActive || r.adjustPercent === 0) continue;
    if (!r.weekdays.includes(dia) || minutos < r.fromMin || minutos >= r.toMin) continue;
    if (!elegida || r.adjustPercent < elegida.adjustPercent) elegida = r;
  }
  return elegida;
}

export const precioConAjuste = (precioBase: number, adjustPercent: number): number =>
  Math.max(0, redondear((precioBase * (100 + adjustPercent)) / 100));

/** Precio de un turno que empieza en `instante`, con las reglas dadas. */
export function ajustarPrecioConReglas(reglas: readonly ReglaPrecio[], precioBase: number, instante: Date): PrecioAjustado {
  const r = reglaQueAplica(reglas, instante);
  if (!r) return { precio: precioBase, adjustPercent: 0, reglaId: null };
  return { precio: precioConAjuste(precioBase, r.adjustPercent), adjustPercent: r.adjustPercent, reglaId: r.id ?? null };
}

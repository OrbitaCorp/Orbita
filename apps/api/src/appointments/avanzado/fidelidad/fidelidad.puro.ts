// Programa de fidelidad (P4.5): la cuenta de la tarjeta de sellos, PURA.
import type { ConfigAvanzado } from '../../appointments.types';

export interface ReglasTarjeta {
  /** Sellos para completar la tarjeta. */
  needed: number;
  /** 'desde': solo suma un turno de `minimo` pesos o más. */
  suma: 'todos' | 'desde';
  minimo: number;
  /** 0 = los sellos no vencen. */
  vencenMeses: number;
  /** La tarjeta nueva arranca con un sello de regalo. */
  selloDeBienvenida: boolean;
  premio: { tipo: 'gratis' | 'descuento' | 'a-convenir'; serviceId: string | null; pct: number };
  fuente: 'avanzado' | 'basica';
}

/**
 * Qué tarjeta usa el negocio (CONTRATO § P4.5): si "Programa de fidelidad"
 * actúa (add-on + prendida), su config; si no, la básica de la cuenta
 * (`account.loyaltyStamps`, premio a convenir, sin vencimiento). null = no hay
 * tarjeta.
 */
export function reglasTarjeta(avanzada: NonNullable<ConfigAvanzado['fidelidad']> | null, loyaltyStampsBasico: number): ReglasTarjeta | null {
  if (avanzada && avanzada.sellos > 0) {
    return {
      needed: avanzada.sellos, suma: avanzada.suma, minimo: avanzada.minimo, vencenMeses: avanzada.vencenMeses,
      selloDeBienvenida: avanzada.selloDeBienvenida,
      premio: { tipo: avanzada.premio, serviceId: avanzada.serviceId, pct: avanzada.pct }, fuente: 'avanzado',
    };
  }
  if (loyaltyStampsBasico > 0) {
    return { needed: loyaltyStampsBasico, suma: 'todos', minimo: 0, vencenMeses: 0, selloDeBienvenida: false, premio: { tipo: 'a-convenir', serviceId: null, pct: 0 }, fuente: 'basica' };
  }
  return null;
}

export interface EstadoTarjeta {
  stamps: number;
  rewardsEarned: number;
  lastStampAt: Date | null;
}

/** ¿Vencieron los sellos de la tarjeta en curso? (pasaron `vencenMeses` desde el último). */
export function sellosVencidos(t: EstadoTarjeta, reglas: ReglasTarjeta, ahora: Date): boolean {
  if (reglas.vencenMeses <= 0 || !t.lastStampAt || t.stamps === 0) return false;
  const limite = new Date(t.lastStampAt);
  limite.setUTCMonth(limite.getUTCMonth() + reglas.vencenMeses);
  return ahora.getTime() > limite.getTime();
}

/**
 * Suma un sello (si el turno suma) y devuelve la tarjeta nueva. Al llegar a
 * `needed`: stamps = 0 y rewardsEarned + 1.
 */
export function conUnSelloMas(t: EstadoTarjeta, reglas: ReglasTarjeta, monto: number, ahora: Date): EstadoTarjeta & { sumo: boolean; completo: boolean } {
  if (reglas.suma === 'desde' && monto < reglas.minimo) return { ...t, sumo: false, completo: false };
  const base = sellosVencidos(t, reglas, ahora) ? 0 : t.stamps;
  const stamps = base + 1;
  if (stamps >= reglas.needed) return { stamps: 0, rewardsEarned: t.rewardsEarned + 1, lastStampAt: ahora, sumo: true, completo: true };
  return { stamps, rewardsEarned: t.rewardsEarned, lastStampAt: ahora, sumo: true, completo: false };
}

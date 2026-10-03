// Precio, descuento y seña de un turno (CONTRATO.md § 1.3). PURO: el service
// le pasa lo que leyó de la base y guarda lo que devuelve. Siempre en el
// servidor: lo que mande el cliente se ignora.

/** Redondeo al peso. */
export const redondear = (n: number): number => Math.round(n);

export interface ReglasCobro {
  depositEnabled: boolean;
  depositForNoShows: boolean;
  depositType: string; // 'percent' | 'fixed'
  depositPercent: number;
  depositFixed: number;
  accountEnabled: boolean;
  welcomeDiscountPercent: number;
  onlineCharge: string; // 'deposit' | 'total' | 'customer_choice'
}

export interface PerfilCobro {
  noShowCount: number;
  depositCredit: number;
  welcomeUsedAt: Date | null;
}

export interface EntradaCobro {
  /** Precio de lista del servicio. */
  precioServicio: number;
  /** % de "Precios por horario" (P4); 0 o ausente = sin ajuste. */
  ajustePercent?: number;
  /** Precio puesto a mano en el panel: reemplaza al de lista (y al ajuste). */
  precioManual?: number;
  reglas: ReglasCobro;
  /** Perfil de Turnos del cliente; null = cliente nuevo o sin ficha. */
  perfil: PerfilCobro | null;
  /** La reserva viene con la cuenta de cliente (sesión de ESTE negocio). */
  conCuenta: boolean;
  /** Descuento de un cupón de "Recuperar clientes" (P4). No se acumula con la bienvenida: gana el mayor. */
  descuentoCupon?: number;
  /** Lo que cubre un pack, una gift card o la membresía (P4). Con algo cubierto no se pide seña. */
  cubierto?: number;
  /** Con `onlineCharge = customer_choice`: lo que eligió el cliente. */
  pay?: 'deposit' | 'total';
}

export interface ResultadoCobro {
  /** Precio de lista con el ajuste por horario (lo que se guarda en `price`). */
  precio: number;
  adjustPercent: number;
  /** Descuento aplicado (lo que se guarda en `discountAmount`). */
  descuento: number;
  /** Se aplicó el de bienvenida: hay que marcar `welcomeUsedAt`. */
  usaBienvenida: boolean;
  /** Lo que cubrió un pack / gift card / membresía. */
  cubierto: number;
  /** precio - descuento - cubierto. */
  aPagar: number;
  /** Seña pedida, ya descontado el crédito a favor (lo que se guarda en `depositAmount`). */
  sena: number;
  /** Crédito de señas que se consume al crear. */
  creditoUsado: number;
  /** Lo que habría que cobrar online según `onlineCharge` (seña o total). */
  cobroOnline: number;
}

export function calcularCobro(e: EntradaCobro): ResultadoCobro {
  const ajuste = e.precioManual === undefined ? e.ajustePercent ?? 0 : 0;
  const base = e.precioManual ?? e.precioServicio;
  const precio = ajuste ? redondear((base * (100 + ajuste)) / 100) : base;

  const r = e.reglas;
  const pct = r.welcomeDiscountPercent;
  // Sin perfil todavía también corre: nunca la usó.
  const nuncaLaUso = !e.perfil || e.perfil.welcomeUsedAt === null;
  const deBienvenida = r.accountEnabled && pct > 0 && e.conCuenta && nuncaLaUso ? redondear((precio * pct) / 100) : 0;
  const cupon = Math.max(0, e.descuentoCupon ?? 0);
  const descuento = Math.min(precio, Math.max(deBienvenida, cupon));
  const usaBienvenida = deBienvenida > 0 && deBienvenida >= cupon;

  const sinCubrir = precio - descuento;
  const cubierto = Math.min(sinCubrir, Math.max(0, e.cubierto ?? 0));
  const aPagar = sinCubrir - cubierto;

  const noShows = e.perfil?.noShowCount ?? 0;
  const pideSena = aPagar > 0 && cubierto === 0 && (r.depositEnabled || (r.depositForNoShows && noShows > 0));
  let sena = 0;
  if (pideSena) sena = r.depositType === 'fixed' ? Math.min(r.depositFixed, aPagar) : redondear((aPagar * r.depositPercent) / 100);
  const creditoUsado = Math.min(sena, Math.max(0, e.perfil?.depositCredit ?? 0));
  sena -= creditoUsado;

  const total = r.onlineCharge === 'total' || (r.onlineCharge === 'customer_choice' && e.pay === 'total');
  const cobroOnline = total ? aPagar : sena;

  return { precio, adjustPercent: ajuste, descuento, usaBienvenida, cubierto, aPagar, sena, creditoUsado, cobroOnline };
}

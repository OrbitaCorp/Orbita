// Seguimiento a clientes (superadmin → Seguimiento): en qué etapa está cada
// tienda, calculado con lo que ya hay en la base. Función pura a propósito:
// se prueba sin Postgres y la pantalla y el envío usan exactamente la misma.

export const ETAPAS = [
  'baja',
  'pago_pendiente',
  'pausada',
  'por_vencer',
  'bienvenida',
  'sin_productos',
  'sin_publicar',
  'se_enfrio',
  'sin_ventas',
  'vendiendo',
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ES_ETAPA = (v: unknown): v is Etapa => typeof v === 'string' && (ETAPAS as readonly string[]).includes(v);

const DIA_MS = 24 * 60 * 60 * 1000;
// Recién creada: los primeros días sin productos es normal, el correo es de bienvenida.
export const DIAS_BIENVENIDA = 3;
// Sin entrar al panel durante este tiempo, la tienda "se enfrió".
export const DIAS_SIN_ENTRAR = 14;
// Aviso de vencimiento, solo para lo que no se renueva solo.
export const DIAS_POR_VENCER = 5;

export type DatosSeguimiento = {
  creadoEl: Date;
  publicada: boolean; // isActive
  pausada: boolean;
  dadaDeBaja: boolean; // cancelledAt, o suscripción CANCELLED
  productos: number;
  pedidos: number;
  ultimoAccesoDueno: Date | null;
  suscripcion: {
    status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
    currentPeriodEnd: Date;
    // Débito automático de Mercado Pago: el período se renueva sin que el
    // dueño haga nada, así que no hay vencimiento que avisar.
    renuevaSolo: boolean;
  } | null;
};

// La primera que aplica gana: primero lo que corta la tienda (baja, pago,
// pausa, vencimiento), después el armado en orden y al final cómo le va.
export function etapaDe(d: DatosSeguimiento, ahora = new Date()): Etapa {
  const s = d.suscripcion;
  if (d.dadaDeBaja || s?.status === 'CANCELLED') return 'baja';
  if (s && (s.status === 'PAST_DUE' || s.status === 'SUSPENDED')) return 'pago_pendiente';
  if (d.pausada) return 'pausada';
  if (s && s.status === 'ACTIVE' && !s.renuevaSolo) {
    const faltan = s.currentPeriodEnd.getTime() - ahora.getTime();
    if (faltan >= 0 && faltan <= DIAS_POR_VENCER * DIA_MS) return 'por_vencer';
  }
  if (d.productos === 0) {
    return ahora.getTime() - d.creadoEl.getTime() < DIAS_BIENVENIDA * DIA_MS ? 'bienvenida' : 'sin_productos';
  }
  if (!d.publicada) return 'sin_publicar';
  const ultimoAcceso = d.ultimoAccesoDueno ?? d.creadoEl;
  if (ahora.getTime() - ultimoAcceso.getTime() > DIAS_SIN_ENTRAR * DIA_MS) return 'se_enfrio';
  if (d.pedidos === 0) return 'sin_ventas';
  return 'vendiendo';
}

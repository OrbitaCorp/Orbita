// Eventos de notificación válidos para notification_config.matrix y para los
// avisos por rol (Role.notificationEvents). Vivía dentro de businesses.service.ts;
// se sacó acá para que roles y notificaciones usen la misma lista.
export const NOTIFICATION_EVENTS = [
  'nuevo_pedido',
  'pedido_cancelado',
  'stock_critico',
  'devolucion',
  'cancelacion_pedida', // el cliente PIDE cancelar (no la cancela sola) — ver CancellationsService
  'pago_confirmado',
  'resumen_diario',
  'cliente_nuevo',
  'reporte_semanal',
  // Tanda del 25/09 (pedido explícito de Ale, "que sea configurable desde
  // notificaciones"): dominio_comprado, cobro_suscripcion, primera_venta y
  // resena_nueva pasan por el mismo dispatch() de siempre (panel + email a
  // members, ver notifications.service.ts). invitacion_cuenta_invitado es
  // distinto — el destinatario es el CLIENTE invitado, no el equipo del
  // negocio — así que solo usa esta matriz como gate (channel "email" =
  // "mandar o no este mail"), nunca pasa por dispatch()/sendEmailToMembers
  // (ver orders.service.ts). Su "panel" queda sin efecto a propósito: no
  // tiene sentido una campanita por cada invitado, ver comentario ahí.
  'dominio_comprado',
  'cobro_suscripcion',
  'primera_venta',
  'resena_nueva',
  'invitacion_cuenta_invitado',
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

// Los que le llegan al EQUIPO del negocio: todos menos el de la invitación al
// cliente invitado. Son los que se pueden repartir por rol.
export const EVENTOS_AL_EQUIPO: readonly NotificationEvent[] = NOTIFICATION_EVENTS.filter(
  (e) => e !== 'invitacion_cuenta_invitado',
);

// Nombres de rol que reciben todo, siempre (mismo criterio que RolesGuard y
// RolesService: owner/admin son "el propietario").
export const ROLES_PROPIETARIO = ['owner', 'admin'];

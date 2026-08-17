// Datos ficticios para la sección "Testeo" del panel de plataforma (RBT-607,
// pedido de Ale 16/08 tras el rediseño visual: "necesito poder verlos todo
// el tiempo"). Cada entrada es una plantilla (o una variante suya, cuando el
// contenido cambia según datos opcionales) con el contexto que espera su
// .hbs — es SOLO data, no toca MailService ni nada con estado.
export type MailPreviewFixture = {
  id: string;
  label: string;
  group: 'Cuenta' | 'Equipo' | 'Pedidos' | 'Plataforma';
  template: string;
  // Plantillas de plataforma (Órbita→negocio) usan el branding fijo de
  // Órbita; el resto usa FIXTURE_BUSINESS_BRANDING (negocio ficticio) — así
  // el preview muestra el footer con redes sociales tal como se vería en un
  // negocio real que las cargó.
  isPlatform: boolean;
  subject: string;
  data: Record<string, unknown>;
};

export const FIXTURE_BUSINESS_BRANDING = {
  storeName: 'Panadería López (ficticio)',
  logoUrl: null as string | null,
  colorPrimary: '#0d9488',
  colorBackground: '#eef4ff',
  instagram: 'https://instagram.com/ejemplo',
  facebook: 'https://facebook.com/ejemplo',
  tiktok: null as string | null,
};

export const MAIL_PREVIEW_FIXTURES: MailPreviewFixture[] = [
  {
    id: 'welcome',
    label: 'Bienvenida',
    group: 'Cuenta',
    template: 'welcome',
    isPlatform: false,
    subject: 'Bienvenido a Panadería López (ficticio)',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName },
  },
  {
    id: 'reset-password',
    label: 'Recuperar contraseña',
    group: 'Cuenta',
    template: 'reset-password',
    isPlatform: false,
    subject: 'Recuperá tu contraseña',
    data: { code: '482913', expiresIn: '15 minutos' },
  },
  {
    id: 'password-changed',
    label: 'Contraseña actualizada',
    group: 'Cuenta',
    template: 'password-changed',
    isPlatform: false,
    subject: 'Tu contraseña fue actualizada',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName },
  },
  {
    id: 'member-invitation',
    label: 'Invitación al equipo',
    group: 'Equipo',
    template: 'member-invitation',
    isPlatform: false,
    subject: `Te invitaron a gestionar ${FIXTURE_BUSINESS_BRANDING.storeName}`,
    data: {
      storeName: FIXTURE_BUSINESS_BRANDING.storeName,
      roleName: 'Vendedor',
      panelUrl: 'https://panel.orbita.site',
      tempPassword: 'Xk29-Trq4',
    },
  },
  {
    id: 'member-access-reminder-con-clave',
    label: 'Recordatorio de acceso (con contraseña nueva)',
    group: 'Equipo',
    template: 'member-access-reminder',
    isPlatform: false,
    subject: `Tu acceso al panel de ${FIXTURE_BUSINESS_BRANDING.storeName}`,
    data: {
      storeName: FIXTURE_BUSINESS_BRANDING.storeName,
      panelUrl: 'https://panel.orbita.site',
      tempPassword: 'Nn88-Vbc1',
    },
  },
  {
    id: 'member-access-reminder-sin-clave',
    label: 'Recordatorio de acceso (sin contraseña nueva)',
    group: 'Equipo',
    template: 'member-access-reminder',
    isPlatform: false,
    subject: `Tu acceso al panel de ${FIXTURE_BUSINESS_BRANDING.storeName}`,
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, panelUrl: 'https://panel.orbita.site' },
  },
  {
    id: 'order-confirmation',
    label: 'Pedido confirmado',
    group: 'Pedidos',
    template: 'order-confirmation',
    isPlatform: false,
    subject: 'Pedido #1042 confirmado',
    data: {
      storeName: FIXTURE_BUSINESS_BRANDING.storeName,
      orderNumber: 1042,
      total: '$26.470',
      items: [
        { name: 'Medialunas x12', quantity: 2, price: '$4.500' },
        { name: 'Torta de chocolate', quantity: 1, price: '$17.470' },
      ],
    },
  },
  {
    id: 'order-shipped-con-tracking',
    label: 'Pedido despachado (con seguimiento)',
    group: 'Pedidos',
    template: 'order-shipped',
    isPlatform: false,
    subject: 'Tu pedido #1042 está en camino',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042, tracking: 'OCA-994211AR' },
  },
  {
    id: 'order-shipped-sin-tracking',
    label: 'Pedido despachado (sin seguimiento)',
    group: 'Pedidos',
    template: 'order-shipped',
    isPlatform: false,
    subject: 'Tu pedido #1042 está en camino',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042 },
  },
  {
    id: 'order-ready-pickup-con-direccion',
    label: 'Listo para retirar (con dirección)',
    group: 'Pedidos',
    template: 'order-ready-pickup',
    isPlatform: false,
    subject: 'Tu pedido #1042 está listo para retirar',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042, pickupAddress: 'Av. Siempre Viva 742' },
  },
  {
    id: 'order-ready-pickup-sin-direccion',
    label: 'Listo para retirar (sin dirección)',
    group: 'Pedidos',
    template: 'order-ready-pickup',
    isPlatform: false,
    subject: 'Tu pedido #1042 está listo para retirar',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042 },
  },
  {
    id: 'order-delivered',
    label: 'Pedido entregado',
    group: 'Pedidos',
    template: 'order-delivered',
    isPlatform: false,
    subject: 'Tu pedido #1042 fue entregado',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042 },
  },
  {
    id: 'thanks-for-purchase',
    label: 'Gracias por tu compra',
    group: 'Pedidos',
    template: 'thanks-for-purchase',
    isPlatform: false,
    subject: `¡Gracias por tu compra en ${FIXTURE_BUSINESS_BRANDING.storeName}!`,
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042, customerName: 'Marina' },
  },
  {
    id: 'review-request',
    label: 'Pedido de reseña',
    group: 'Pedidos',
    template: 'review-request',
    isPlatform: false,
    subject: `¿Qué te pareció tu compra en ${FIXTURE_BUSINESS_BRANDING.storeName}?`,
    data: {
      storeName: FIXTURE_BUSINESS_BRANDING.storeName,
      productName: 'Torta de chocolate',
      reviewUrl: 'https://tienda.orbita.site/review/1',
    },
  },
  {
    id: 'return-approved',
    label: 'Devolución aprobada',
    group: 'Pedidos',
    template: 'return-approved',
    isPlatform: false,
    subject: 'Tu devolución fue aprobada',
    data: { storeName: FIXTURE_BUSINESS_BRANDING.storeName, orderNumber: 1042, refundMethod: 'Mercado Pago', amount: '$17.470' },
  },
  {
    id: 'platform-admin-login-code',
    label: 'Código de acceso (2FA admin)',
    group: 'Plataforma',
    template: 'platform-admin-login-code',
    isPlatform: true,
    subject: 'Tu código de acceso a Órbita',
    data: { code: '773102', expiresIn: '10 minutos' },
  },
  {
    id: 'subscription-payment-failed',
    label: 'Pago de suscripción fallido',
    group: 'Plataforma',
    template: 'subscription-payment-failed',
    isPlatform: true,
    subject: 'No pudimos cobrar tu suscripción de Órbita',
    data: { businessName: FIXTURE_BUSINESS_BRANDING.storeName, amount: '$14.900', retryDate: '20/08/2026', graceDaysLeft: 5 },
  },
  {
    id: 'subscription-suspended',
    label: 'Tienda suspendida',
    group: 'Plataforma',
    template: 'subscription-suspended',
    isPlatform: true,
    subject: 'Tu tienda en Órbita fue suspendida',
    data: { businessName: FIXTURE_BUSINESS_BRANDING.storeName, reactivateUrl: 'https://panel.orbita.site/facturacion' },
  },
];

// Cliente "Invitado" de la tienda demo: con el que entra cualquier visitante,
// sin login (ver AuthService.demoSession). Lo crea prisma/demo/sembrar.ts con
// este mismo email; .invalid no es una casilla real (MailService no le manda nada).
export const EMAIL_INVITADO_DEMO = 'invitado@demo.invalid';

// Tiendas de la demo pública. Cada una es un negocio isDemo sembrado con
// `pnpm seed:demo` (ver prisma/seed-demo.ts, --tienda): la de tecnología
// (Nébula Tech, la original), la de ropa (Nébula Moda, la que abre "Probá la
// demo") y la de regalería (Nébula Regalos, con la plantilla Confeti). El
// panel de la demo es siempre el de Nébula Tech: es el único negocio demo con
// un miembro visitante (readOnly).
export const DEMO_SLUG_PANEL = 'demo';
export const DEMO_SLUGS = ['demo', 'demo-moda', 'demo-regalos'] as const;

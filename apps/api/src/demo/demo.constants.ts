// Cliente "Invitado" de la tienda demo: con el que entra cualquier visitante,
// sin login (ver AuthService.demoSession). Lo crea prisma/demo/sembrar.ts con
// este mismo email; .invalid no es una casilla real (MailService no le manda nada).
export const EMAIL_INVITADO_DEMO = 'invitado@demo.invalid';

// Los dos tipos de video de la cola (no se mezclan en el panel):
//   · MARKETING: se usa afuera y se puede pasar como borrador a TikTok o Instagram.
//   · TUTORIAL: es interno y puede cubrir un ítem de la lista de tutoriales.
// Quién aprueba NO depende del tipo sino de quién lo subió (ver politica-aprobacion.ts).
export const TIPOS_VIDEO = ['MARKETING', 'TUTORIAL'] as const;
export type TipoVideo = (typeof TIPOS_VIDEO)[number];

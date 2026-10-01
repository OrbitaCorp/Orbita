// La forma del manual que lee Orbi. manual.generated.ts (GENERADO desde apps/web,
// ver apps/web/src/modules/ventas/panel/manual/paraOrbi.ts) cumple este tipo:
// si el generador cambia de forma y nadie toca esto, typecheck rompe acá.

/** Adónde lleva el botón "Ir a…" de un tema: una sección del panel y, si hace falta, su vista. */
export type DestinoDelManual = { seccion: string; vista?: string; label: string };

export type TemaDelManual = {
  id: string;
  capitulo: string;
  titulo: string;
  /** Texto plano: los botones van entre comillas, con el nombre exacto de la pantalla. */
  texto: string;
  destino?: DestinoDelManual;
};

/** Una tarea de los Primeros pasos (el checklist del Inicio). */
export type PasoDelManual = {
  id: string;
  titulo: string;
  etapa: 1 | 2;
  grupo?: string;
  destino: DestinoDelManual;
};

/** Un módulo del menú lateral y los permisos que lo muestran (alcanza con uno). */
export type ModuloDelMenu = { id: string; label: string; permisos: string[] };

export type ManualGenerado = {
  version: string;
  temas: TemaDelManual[];
  primerosPasos: PasoDelManual[];
  modulosDelMenu: ModuloDelMenu[];
};

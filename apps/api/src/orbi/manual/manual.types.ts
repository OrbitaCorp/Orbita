// La forma del manual que lee Orbi. manual.generated.ts (GENERADO desde apps/web,
// ver apps/web/src/modules/orbi/manual/artefacto.ts) cumple este tipo:
// si el generador cambia de forma y nadie toca esto, typecheck rompe acá.

/** Adónde lleva el botón "Ir a…" de un tema: una sección del panel y, si hace falta, su vista. */
export type DestinoDelManual = { seccion: string; vista?: string; label: string };

export type TemaDelManual = {
  id: string;
  capitulo: string;
  titulo: string;
  /** Cómo lo preguntaría la persona, cuando el título solo no alcanza. Va en el índice. */
  pista?: string;
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

/**
 * El manual de un módulo nuevo (Turnos, Alquileres, Gimnasio): sus temas, en
 * texto plano, sin botón "Ir a…" (el panel de cada módulo no tiene rutas de
 * Tienda). Viaja aparte de `temas` y Orbi todavía no lo lee: `temas` es lo que
 * va en el índice del prompt de cada mensaje de Tienda, y los módulos no usan
 * Orbi (no se paga IA por ellos). Queda listo para cuando se decida usarlo.
 */
export type ManualDeModulo = {
  modulo: 'turnos' | 'alquileres' | 'gimnasio';
  nombre: string;
  temas: Omit<TemaDelManual, 'destino'>[];
};

export type ManualGenerado = {
  version: string;
  /** Solo Tienda: es lo que ve Orbi. */
  temas: TemaDelManual[];
  primerosPasos: PasoDelManual[];
  modulosDelMenu: ModuloDelMenu[];
  modulos: ManualDeModulo[];
};

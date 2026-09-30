// ESPEJO de apps/web/src/modules/ventas/panel/secciones.ts. La imagen de la API
// se construye solo con apps/api y no puede importar del front, así que la
// lista se copia acá. apps/web/src/modules/ventas/panel/secciones.test.ts
// compara los dos archivos como texto: si tocás una lista, tocá la otra igual,
// en el mismo orden. No pongas apóstrofes en los comentarios dentro de los
// arrays: el test lee los strings con una regex.
//
// Son las secciones que el panel realmente monta (componentMap de
// AdminSeccionShell) y las sub-vistas de Configuración (?vista=). Lo usa la tool
// navigateTo para no armar nunca un link a una pantalla que no existe.

export const SECCIONES_DEL_PANEL = [
  'dashboard',
  'pedidos',
  'catalogo',
  'categorias',
  'clientes',
  'reportes',
  'configuracion',
  'descuentos',
  'cupones',
  'mensajes',
  'perfil',
  'avanzado',
  'manual',
] as const;

// 'general' queda por compatibilidad con URLs viejas sin ?vista= (sin vista,
// Configuración cae en 'negocio').
export const VISTAS_DE_CONFIGURACION = [
  'general',
  'negocio',
  'contacto',
  'pagos',
  'envios',
  'redes',
  'postventa',
  'peligro',
  'apariencia',
  'equipo',
  'notificaciones',
  'suscripcion',
  'dominios',
  'soporte',
  'actividad',
] as const;

export type SeccionDelPanel = (typeof SECCIONES_DEL_PANEL)[number];
export type VistaDeConfiguracion = (typeof VISTAS_DE_CONFIGURACION)[number];

// Fuente de verdad de las secciones del panel y de las sub-vistas de
// Configuración. Es un módulo puro (sin React ni Next) para que también lo lea
// un test y para que la API tenga un espejo idéntico.
//
// - AdminSeccionShell tipa `componentMap` con SECCIONES_DEL_PANEL: agregar o
//   sacar una sección sin tocar esta lista no compila.
// - ConfigTabs.tsx deriva `VistaConfig` de VISTAS_DE_CONFIGURACION.
// - apps/api/src/orbi/navegacion/secciones.ts es una COPIA de este archivo (la
//   imagen de la API se construye solo con apps/api y no puede importar del
//   front). secciones.test.ts compara los dos como texto: si tocás una lista
//   acá, tocá la otra igual, en el mismo orden. No pongas apóstrofes en los
//   comentarios dentro de los arrays: el test lee los strings con una regex.
//
// Las rutas son /admin/ventas/<seccion> (el shell toma los DOS ÚLTIMOS
// segmentos como módulo y sección) y las subsecciones de Configuración van por
// ?vista=<vista>, no como un tercer segmento.

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
] as const

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
] as const

export type SeccionDelPanel = (typeof SECCIONES_DEL_PANEL)[number]
export type VistaDeConfiguracion = (typeof VISTAS_DE_CONFIGURACION)[number]

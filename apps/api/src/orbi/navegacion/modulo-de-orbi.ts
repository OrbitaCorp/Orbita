import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION, type SeccionDelPanel } from './secciones';

// Los módulos que entiende el prompt del panel (prompts/panel.ts, capa 3) y, los
// que tienen datos, ModuleDataService. NO son las secciones del panel: el panel
// manda module 'ventas' (penúltimo segmento de /admin/ventas/<seccion>, ver
// useOrbiContext.ts) y la pantalla real en section. Hasta que existió este
// archivo nadie traducía una cosa a la otra, así que ninguna pantalla recibía su
// capa ni su snapshot: todo caía al prompt genérico.
export const MODULOS_DE_ORBI = [
  'dashboard',
  'pedidos',
  'catalogo',
  'clientes',
  'descuentos',
  'configuracion',
  'mensajes',
] as const;

export type ModuloDeOrbi = (typeof MODULOS_DE_ORBI)[number];

// Record sobre SeccionDelPanel a propósito: si el panel suma una sección,
// typecheck rompe acá hasta que alguien decida a qué capa va. undefined es una
// decisión, no un olvido: esas pantallas caen al prompt genérico.
const MODULO_DE_LA_SECCION: Record<SeccionDelPanel, ModuloDeOrbi | undefined> = {
  dashboard: 'dashboard',
  pedidos: 'pedidos',
  catalogo: 'catalogo',
  // Categorías es parte del catálogo: el snapshot ya trae categorías y
  // categorías vacías, y las tools de productos son las que sirven ahí.
  categorias: 'catalogo',
  clientes: 'clientes',
  // Reportes tiene sus tools (getSalesReport y compañía) pero no capa propia.
  // La del dashboard le diría "estás en el Dashboard", y su permiso
  // (reports.dashboard) es más fuerte que el de la pantalla (reports.view).
  reportes: undefined,
  configuracion: 'configuracion',
  descuentos: 'descuentos',
  // La capa de descuentos ya cubre cupones (createCoupon, listDiscounts).
  cupones: 'descuentos',
  mensajes: 'mensajes',
  perfil: undefined,
  avanzado: undefined,
  manual: undefined,
};

const SECCIONES_CONOCIDAS = new Set<string>([...SECCIONES_DEL_PANEL, ...VISTAS_DE_CONFIGURACION]);
const MODULOS = new Set<string>(MODULOS_DE_ORBI);

/**
 * A qué módulo de Orbi corresponde una sección del panel. undefined si la
 * sección no tiene capa propia o no existe. `seccion` viene del cliente: se
 * mira con hasOwnProperty para que 'constructor' o '__proto__' no resuelvan a
 * nada raro.
 */
export function moduloDeOrbiParaSeccion(seccion?: string): ModuloDeOrbi | undefined {
  if (!seccion || !Object.prototype.hasOwnProperty.call(MODULO_DE_LA_SECCION, seccion)) return undefined;
  return MODULO_DE_LA_SECCION[seccion as SeccionDelPanel];
}

/**
 * El módulo y la sección con los que se arma el prompt del panel.
 *
 * - module ya es un módulo de Orbi: se respeta (builds viejos del front, o uno
 *   futuro que mande la clave directa). La API se despliega aparte y las pestañas
 *   abiertas siguen con el front que tenían.
 * - module es 'ventas' o no vino: decide section, vía moduloDeOrbiParaSeccion.
 * - si nada resuelve, queda como vino y cae al prompt genérico.
 *
 * section es texto libre (hasta 60 caracteres) y termina en el system prompt:
 * solo pasa si es una sección o vista real del panel. Y si fue la que eligió el
 * módulo no se repite (configuracion le diría "estás en la sección
 * configuracion de la configuración").
 */
export function resolverModuloDelPanel(
  module?: string,
  section?: string,
): { modulo?: string; seccion?: string } {
  const seccionConocida = section && SECCIONES_CONOCIDAS.has(section) ? section : undefined;

  if (module && MODULOS.has(module)) {
    return { modulo: module, seccion: seccionConocida };
  }

  const desdeLaSeccion = (!module || module === 'ventas') ? moduloDeOrbiParaSeccion(seccionConocida) : undefined;
  if (desdeLaSeccion) {
    return { modulo: desdeLaSeccion, seccion: seccionConocida === desdeLaSeccion ? undefined : seccionConocida };
  }

  return { modulo: module, seccion: seccionConocida };
}

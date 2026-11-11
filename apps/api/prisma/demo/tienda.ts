// ─── Qué tienda de la demo se siembra ───────────────────────────────────────
//
// La demo pública tiene dos tiendas con el mismo armado (catálogo, ventas,
// descuentos, mensajes): Nébula Tech (tecnología, subdominio `demo`, la del
// panel) y Nébula Moda (ropa y accesorios, `demo-moda`, la que abre "Probá la
// demo"). sembrar.ts es uno solo; lo propio de cada rubro vive acá.
//
// `prefijoIds` separa los ids determinísticos: Nébula Tech va sin prefijo
// (sus ids no cambian al resembrar, y el localStorage de quien ya visitó la
// demo sigue apuntando a lo mismo) y Nébula Moda con el suyo, para no chocar.
import { CATEGORIAS, ETIQUETAS, PRODUCTOS, ProductoDemo } from './catalogo';
import { CONVERSACIONES, RESENAS } from './datos';

export type CategoriaDemo = { clave: string; nombre: string; slug: string; icono: string; color: string; imagen: string };
export type ConversacionDemo = { cliente: number; haceHoras: number; sinLeer: boolean; mensajes: [('CUSTOMER' | 'STORE'), string][] };

export type TiendaDemo = {
  prefijoIds: string;
  semilla: number;
  categorias: readonly CategoriaDemo[];
  etiquetas: readonly string[];
  productos: ProductoDemo[];
  resenas: Record<string, string[]>;
  conversaciones: ConversacionDemo[];
  skuPrefijo: string;
  /** La foto principal salió del estudio con "Blanco liso" (fondo quitado). */
  fondoQuitadoEnPrincipal: boolean;
  /** Descuento automático de la semana: un % en una categoría. */
  semana: { nombre: string; categoria: string };
  /** Código del cupón de 15 % en compras grandes. */
  cupon15: string;
  /** 3x2: productos, y cuál se suele comprar de a tres en los pedidos sembrados. */
  tresPorDos: { productos: string[]; deATres: string };
  dosPorUno: string[];
  relampago: { nombre: string; productos: string[] };
  /** Productos con alerta de stock crítico en las notificaciones. */
  stockCritico: string[];
  /** Categorías que aparecen en las visitas sembradas (además del home y el catálogo). */
  categoriasVisitadas: string[];
  motivosDevolucion: [string, string];
  motivoCancelacion: string;
};

export const NEBULA_TECH: TiendaDemo = {
  prefijoIds: '',
  semilla: 20260928,
  categorias: CATEGORIAS,
  etiquetas: ETIQUETAS,
  productos: PRODUCTOS,
  resenas: RESENAS,
  conversaciones: CONVERSACIONES,
  skuPrefijo: 'NB',
  fondoQuitadoEnPrincipal: true,
  semana: { nombre: 'Semana Gamer: 15 % en Gaming', categoria: 'gaming' },
  cupon15: 'NEBULA15',
  tresPorDos: { productos: ['lampara', 'tira-led', 'enchufe'], deATres: 'lampara' },
  dosPorUno: ['funda', 'cargador', 'soporte-auto'],
  relampago: { nombre: 'Favoritos de Nébula', productos: ['auriculares-anc', 'smartwatch-gps', 'parlante-redondo', 'tablet', 'drone', 'robot-aspiradora'] },
  stockCritico: ['drone', 'parlante-asistente'],
  categoriasVisitadas: ['audio', 'gaming', 'wearables'],
  motivosDevolucion: ['Llegó con un rayón en la parte de atrás.', 'No era compatible con mi equipo.'],
  motivoCancelacion: 'Me equivoqué de modelo, quiero cambiarlo por otro.',
};

// ─── Nébula Moda: lo propio del rubro para sembrar.ts ───────────────────────
//
// Mismo armado que Nébula Tech (ver ../tienda.ts). Lo que nombran los
// anuncios de la tienda (ANUNCIOS_DEMO_MODA en apps/web MenuDemoTienda.tsx) y
// la cartelera del home (./apariencia.ts) existe acá: 2x1 en remeras, 3x2 en
// gorros y bufandas, cupón MODA15 y la semana del calzado.
import type { TiendaDemo } from '../tienda';
import { CATEGORIAS_MODA, ETIQUETAS_MODA, PRODUCTOS_MODA } from './catalogo';
import { CONVERSACIONES_MODA, RESENAS_MODA } from './datos';

export const NEBULA_MODA: TiendaDemo = {
  prefijoIds: 'moda:',
  semilla: 20261111,
  categorias: CATEGORIAS_MODA,
  etiquetas: ETIQUETAS_MODA,
  productos: PRODUCTOS_MODA,
  resenas: RESENAS_MODA,
  conversaciones: CONVERSACIONES_MODA,
  skuPrefijo: 'NM',
  fondoQuitadoEnPrincipal: false,
  semana: { nombre: 'Semana del calzado: 15 % en Calzado', categoria: 'calzado' },
  cupon15: 'MODA15',
  tresPorDos: { productos: ['gorro-lana', 'bufanda-tejida', 'cuello-tejido'], deATres: 'gorro-lana' },
  dosPorUno: ['remera-basica', 'remera-rayada', 'remera-oversize'],
  // Ninguno está en otro descuento (ni en Calzado, ni en el 2x1 ni en el 3x2):
  // el precio que muestra la sección es el que cobra el carrito.
  relampago: { nombre: 'Favoritos de Nébula Moda', productos: ['campera-jean', 'vestido-floral', 'sweater-mostaza', 'mochila-mostaza', 'reloj-cuero', 'campera-cuero'] },
  stockCritico: ['campera-cuero', 'botines-oxford'],
  categoriasVisitadas: ['calzado', 'abrigos', 'vestidos'],
  motivosDevolucion: ['El talle me quedó chico, quiero cambiarlo.', 'El color es distinto al de la foto.'],
  motivoCancelacion: 'Me equivoqué de talle, quiero cambiarlo por otro.',
};

// ─── Nébula Regalos: lo propio del rubro para sembrar.ts ────────────────────
//
// Mismo armado que Nébula Tech y Nébula Moda (ver ../tienda.ts). Lo que
// nombran los anuncios de la tienda (ANUNCIOS_DEMO_REGALOS en apps/web
// MenuDemoTienda.tsx) y la cartelera del home (./apariencia.ts) existe acá:
// 2x1 en tazas, 3x2 en velas, cupón REGALOS15 y la semana de los peluches.
import type { TiendaDemo } from '../tienda';
import { CATEGORIAS_REGALOS, ETIQUETAS_REGALOS, PRODUCTOS_REGALOS } from './catalogo';
import { CONVERSACIONES_REGALOS, RESENAS_REGALOS } from './datos';

export const NEBULA_REGALOS: TiendaDemo = {
  prefijoIds: 'regalos:',
  semilla: 20261117,
  categorias: CATEGORIAS_REGALOS,
  etiquetas: ETIQUETAS_REGALOS,
  productos: PRODUCTOS_REGALOS,
  resenas: RESENAS_REGALOS,
  conversaciones: CONVERSACIONES_REGALOS,
  skuPrefijo: 'NR',
  fondoQuitadoEnPrincipal: false,
  semana: { nombre: 'Semana de los peluches: 15 % en Peluches y juguetes', categoria: 'peluches' },
  cupon15: 'REGALOS15',
  tresPorDos: { productos: ['vela-soja', 'velas-ambar', 'velitas-te'], deATres: 'velitas-te' },
  dosPorUno: ['taza-rayada', 'taza-blanca', 'taza-verde-agua', 'taza-terracota'],
  // Ninguno está en otro descuento: el precio de la sección es el que cobra el carrito.
  relampago: { nombre: 'Favoritos de Nébula Regalos', productos: ['tetera-hierro', 'cuaderno-floral', 'bombones', 'jarra-florero', 'acuarelas', 'terrario'] },
  stockCritico: ['triciclo', 'terrario'],
  categoriasVisitadas: ['velas', 'peluches', 'dulces'],
  motivosDevolucion: ['La taza llegó con el asa despegada.', 'El color es distinto al de la foto.'],
  motivoCancelacion: 'Me equivoqué de aroma, quiero cambiarlo por otro.',
};

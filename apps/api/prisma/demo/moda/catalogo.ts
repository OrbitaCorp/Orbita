// ─── Catálogo de la demo pública: Nébula Moda ───────────────────────────────
//
// Ropa, calzado y accesorios. Mismo formato que el de Nébula Tech
// (../catalogo.ts), datos puros sin Prisma. Las fotos están en ../media/moda
// (Unsplash, CC0 — subidas a Wikimedia Commons cuando su licencia era CC0;
// autor y link en media/moda/creditos.json). Son fotos de ambiente, con gente
// usando la prenda: así se ve una tienda de ropa real, y no se les quita el
// fondo. Los videos son recorridos sobre esas mismas fotos.
//
// Precios en pesos. `popularidad` (1–10) decide cuánto aparece cada producto
// en los pedidos sembrados.
import type { ProductoDemo, VarianteDemo } from '../catalogo';

export const CATEGORIAS_MODA = [
  { clave: 'calzado', nombre: 'Calzado', slug: 'calzado', icono: 'Footprints', color: '#9A3412', imagen: 'moda/categorias/calzado.webp' },
  { clave: 'remeras', nombre: 'Remeras y camisas', slug: 'remeras-y-camisas', icono: 'Shirt', color: '#1D4ED8', imagen: 'moda/categorias/remeras-y-camisas.webp' },
  { clave: 'abrigos', nombre: 'Buzos y camperas', slug: 'buzos-y-camperas', icono: 'Layers', color: '#57534E', imagen: 'moda/categorias/buzos-y-camperas.webp' },
  { clave: 'pantalones', nombre: 'Pantalones', slug: 'pantalones', icono: 'Ruler', color: '#0F766E', imagen: 'moda/categorias/pantalones.webp' },
  { clave: 'vestidos', nombre: 'Vestidos y polleras', slug: 'vestidos-y-polleras', icono: 'Sparkles', color: '#BE185D', imagen: 'moda/categorias/vestidos-y-polleras.webp' },
  { clave: 'accesorios', nombre: 'Accesorios', slug: 'accesorios', icono: 'ShoppingBag', color: '#A16207', imagen: 'moda/categorias/accesorios.webp' },
] as const;

export const ETIQUETAS_MODA = ['Nuevo', 'Más vendido', 'Otoño-invierno', 'Básicos', 'Cuero', 'Ideal para regalar', 'Envío en 24 h'];

const P = (clave: string, n = 1) => Array.from({ length: n }, (_, i) => `moda/productos/${clave}-${i + 1}.webp`);

const ROPA = ['S', 'M', 'L', 'XL'];
const ROPA_MUJER = ['XS', 'S', 'M', 'L'];
const JEAN = ['36', '38', '40', '42', '44'];
const CALZADO_UNISEX = ['37', '38', '39', '40', '41', '42', '43'];
const CALZADO_MUJER = ['35', '36', '37', '38', '39', '40'];

/**
 * Variantes de un producto: el producto cartesiano de los valores, con stock
 * fijo (no al azar: resembrar da lo mismo) y SKU legible. `stocks` se recorre
 * en ciclo; los talles de las puntas quedan con menos stock, como en una
 * tienda real.
 */
function variantes(sku: string, precio: number, opciones: string[][], stocks: number[], precioAnterior?: number): VarianteDemo[] {
  const combos = opciones.reduce<string[][]>((acc, valores) => acc.flatMap((c) => valores.map((v) => [...c, v])), [[]]);
  return combos.map((valores, i) => ({
    valores, precio, precioAnterior, stock: stocks[i % stocks.length],
    sku: `${sku}-${valores.map((v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3).toUpperCase()).join('-')}`,
  }));
}

const CUIDADO_ALGODON = { label: 'Cuidado', value: 'Lavar a 30 °C, del revés. No usar secarropas.' };
const CAMBIOS = { label: 'Cambios', value: '30 días, por talle o color' };

export const PRODUCTOS_MODA: ProductoDemo[] = [
  // ── Calzado ───────────────────────────────────────────────────────────────
  {
    clave: 'zapatillas-lona-blancas', nombre: 'Zapatillas de lona blancas', categoria: 'calzado', destacado: true, popularidad: 10,
    descripcion: 'Las zapatillas que van con todo: capellada de lona de algodón, suela de caucho vulcanizado y plantilla acolchada. Blancas, livianas y fáciles de limpiar.',
    precio: 74999, costo: 36000, etiquetas: ['Más vendido', 'Básicos', 'Envío en 24 h'],
    specs: [
      { label: 'Capellada', value: 'Lona de algodón' },
      { label: 'Suela', value: 'Caucho vulcanizado' },
      { label: 'Plantilla', value: 'Acolchada, removible' },
      { label: 'Calce', value: 'Normal: pedí tu número de siempre' },
      CAMBIOS,
    ],
    fotos: P('zapatillas-lona-blancas', 2),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-LONA-BLA', 74999, [CALZADO_UNISEX], [6, 12, 18, 22, 20, 14, 7]),
  },
  {
    clave: 'zapatillas-lona-azul', nombre: 'Zapatillas de lona azul marino', categoria: 'calzado', popularidad: 7,
    descripcion: 'El mismo clásico de lona, en azul marino: disimula el uso diario y combina con jean y con negro. Suela de caucho y ojalillos metálicos.',
    precio: 74999, costo: 36000, etiquetas: ['Básicos'],
    specs: [
      { label: 'Capellada', value: 'Lona de algodón' },
      { label: 'Suela', value: 'Caucho vulcanizado' },
      { label: 'Calce', value: 'Normal' },
      CAMBIOS,
    ],
    fotos: P('zapatillas-lona-azul'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-LONA-AZU', 74999, [CALZADO_UNISEX], [4, 8, 12, 14, 12, 9, 5]),
  },
  {
    clave: 'zapatillas-cana-alta-rojas', nombre: 'Zapatillas caña alta rojas', categoria: 'calzado', popularidad: 6,
    descripcion: 'Caña alta de lona roja con cordones blancos: el toque de color del look. Puntera de goma reforzada y suela antideslizante.',
    precio: 84999, precioAnterior: 99999, costo: 41000, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Capellada', value: 'Lona de algodón, caña alta' },
      { label: 'Suela', value: 'Caucho antideslizante' },
      { label: 'Calce', value: 'Normal' },
      CAMBIOS,
    ],
    fotos: P('zapatillas-cana-alta-rojas'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-CANA-ROJ', 84999, [CALZADO_UNISEX], [3, 6, 9, 10, 8, 6, 3], 99999),
  },
  {
    clave: 'borcegos-marrones', nombre: 'Borcegos de cuero marrón', categoria: 'calzado', destacado: true, popularidad: 9,
    descripcion: 'Borcegos de cuero vacuno engrasado, con costura a la vista y suela de goma con buen agarre. Se ablandan con el uso y duran años.',
    precio: 159999, costo: 82000, etiquetas: ['Cuero', 'Otoño-invierno', 'Más vendido'],
    specs: [
      { label: 'Capellada', value: 'Cuero vacuno engrasado' },
      { label: 'Forro', value: 'Cuero' },
      { label: 'Suela', value: 'Goma, cosida' },
      { label: 'Calce', value: 'Normal; con medias gruesas, medio número más' },
      CAMBIOS,
    ],
    fotos: P('borcegos-marrones', 2),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-BORC-MAR', 159999, [CALZADO_UNISEX], [3, 7, 10, 12, 11, 8, 4]),
  },
  {
    clave: 'botines-oxford', nombre: 'Botines Oxford de cuero', categoria: 'calzado', popularidad: 4, stockMinimo: 3,
    descripcion: 'Botines con picado inglés y suela de goma blanca: lo formal de un Oxford con la comodidad de un borcego. Cuero de primera, cosido a mano.',
    precio: 189999, costo: 99000, etiquetas: ['Cuero', 'Nuevo'],
    specs: [
      { label: 'Capellada', value: 'Cuero vacuno con picado inglés' },
      { label: 'Suela', value: 'Goma, cosida' },
      { label: 'Calce', value: 'Horma amplia' },
      CAMBIOS,
    ],
    fotos: P('botines-oxford'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-OXFO', 189999, [CALZADO_UNISEX], [1, 2, 2, 3, 2, 1, 1]),
  },
  {
    clave: 'zapatos-cuero', nombre: 'Zapatos de cuero marrón', categoria: 'calzado', popularidad: 5,
    descripcion: 'Zapatos de vestir de cuero suave, con cordones encerados y suela de cuero con taco de goma. Para la oficina o un casamiento.',
    precio: 139999, costo: 71000, etiquetas: ['Cuero'],
    specs: [
      { label: 'Capellada', value: 'Cuero vacuno' },
      { label: 'Suela', value: 'Cuero con taco de goma' },
      { label: 'Calce', value: 'Normal' },
      CAMBIOS,
    ],
    fotos: P('zapatos-cuero', 2),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX.slice(2) }],
    variantes: variantes('NM-ZAPA-MAR', 139999, [CALZADO_UNISEX.slice(2)], [5, 8, 9, 6, 3]),
  },
  {
    clave: 'mocasines-gamuza', nombre: 'Mocasines de gamuza', categoria: 'calzado', popularidad: 4,
    descripcion: 'Mocasines de gamuza color arena, sin cordones y con suela flexible. Para usar sin medias en primavera y verano.',
    precio: 119999, precioAnterior: 139999, costo: 58000, etiquetas: ['Cuero'],
    specs: [
      { label: 'Capellada', value: 'Gamuza' },
      { label: 'Suela', value: 'Goma flexible' },
      { label: 'Calce', value: 'Calzan justo: si estás entre dos, el más grande' },
      CAMBIOS,
    ],
    fotos: P('mocasines-gamuza'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX.slice(2) }],
    variantes: variantes('NM-MOCA', 119999, [CALZADO_UNISEX.slice(2)], [4, 6, 7, 5, 2], 139999),
  },
  {
    clave: 'botas-cana-alta', nombre: 'Botas caña alta de gamuza', categoria: 'calzado', destacado: true, popularidad: 6,
    descripcion: 'Botas bucaneras de gamuza suela, con taco bajo y cierre interno. Quedan con vestido, con pollera o arriba del jean.',
    precio: 179999, costo: 92000, etiquetas: ['Otoño-invierno', 'Nuevo'],
    specs: [
      { label: 'Capellada', value: 'Gamuza' },
      { label: 'Caña', value: 'Sobre la rodilla, con cierre interno' },
      { label: 'Taco', value: '3 cm' },
      CAMBIOS,
    ],
    fotos: P('botas-cana-alta'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_MUJER }],
    variantes: variantes('NM-BOTA-ALT', 179999, [CALZADO_MUJER], [2, 5, 7, 6, 4, 2]),
  },
  {
    clave: 'sandalias-tiras', nombre: 'Sandalias de tiras', categoria: 'calzado', popularidad: 5,
    descripcion: 'Sandalias planas con tiras elastizadas verde oliva y plantilla anatómica. Livianas, se ajustan solas y no lastiman.',
    precio: 59999, costo: 27000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Tiras', value: 'Elástico de alta resistencia' },
      { label: 'Plantilla', value: 'Anatómica, de EVA' },
      { label: 'Calce', value: 'Normal' },
      CAMBIOS,
    ],
    fotos: P('sandalias-tiras'),
    opciones: [{ nombre: 'Talle', valores: CALZADO_UNISEX }],
    variantes: variantes('NM-SAND', 59999, [CALZADO_UNISEX], [4, 7, 9, 9, 7, 5, 3]),
  },

  // ── Remeras y camisas ─────────────────────────────────────────────────────
  {
    clave: 'remera-basica', nombre: 'Remera básica de algodón', categoria: 'remeras', destacado: true, popularidad: 10,
    descripcion: 'La remera de todos los días: algodón peinado de 24/1, cuello redondo reforzado y costuras dobles. No se deforma ni se achica al lavarla.',
    precio: 22999, costo: 9000, etiquetas: ['Básicos', 'Más vendido', 'Envío en 24 h'],
    specs: [
      { label: 'Tela', value: 'Jersey de algodón peinado 24/1' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('remera-basica', 3),
    opciones: [{ nombre: 'Color', valores: ['Azul', 'Blanco', 'Negro', 'Verde'] }, { nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-REM-BAS', 22999, [['Azul', 'Blanco', 'Negro', 'Verde'], ROPA], [14, 26, 22, 9]),
  },
  {
    clave: 'remera-rayada', nombre: 'Remera rayada', categoria: 'remeras', popularidad: 7,
    descripcion: 'Rayas finas bordó y negras sobre algodón suave, con un pequeño parche bordado en el pecho. Un clásico que no pasa de moda.',
    precio: 27999, costo: 11500, etiquetas: ['Básicos'],
    specs: [
      { label: 'Tela', value: 'Jersey de algodón listado' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('remera-rayada'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-REM-RAY', 27999, [ROPA], [8, 15, 13, 6]),
  },
  {
    clave: 'remera-oversize', nombre: 'Remera oversize blanca', categoria: 'remeras', popularidad: 8,
    descripcion: 'Remera larga y holgada, con hombros caídos y algodón grueso que no transparenta. Para usar sola o abajo de una camisa abierta.',
    precio: 29999, costo: 12500, etiquetas: ['Básicos', 'Nuevo'],
    specs: [
      { label: 'Tela', value: 'Algodón 20/1 de 180 g' },
      { label: 'Calce', value: 'Oversize: si la querés al cuerpo, un talle menos' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('remera-oversize'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-REM-OVE', 29999, [ROPA], [10, 18, 16, 8]),
  },
  {
    clave: 'camisa-blanca', nombre: 'Camisa blanca de poplín', categoria: 'remeras', popularidad: 6,
    descripcion: 'Camisa de poplín de algodón, cuello italiano y botones nacarados. Entallada pero cómoda: va con traje o con jean.',
    precio: 54999, costo: 24000, etiquetas: ['Básicos'],
    specs: [
      { label: 'Tela', value: 'Poplín 100 % algodón' },
      { label: 'Calce', value: 'Slim' },
      { label: 'Cuidado', value: 'Lavar a 30 °C. Planchar con vapor.' },
      CAMBIOS,
    ],
    fotos: P('camisa-blanca'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-CAM-BLA', 54999, [ROPA], [6, 11, 10, 5]),
  },
  {
    clave: 'camisa-cuadros', nombre: 'Camisa leñadora a cuadros', categoria: 'remeras', popularidad: 7,
    descripcion: 'Franela de algodón a cuadros rojos y negros, abrigada y suave por dentro. Sirve como camisa o como abrigo liviano abierta.',
    precio: 49999, precioAnterior: 59999, costo: 21000, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Tela', value: 'Franela de algodón cepillada' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('camisa-cuadros', 2),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-CAM-CUA', 49999, [ROPA], [7, 12, 11, 6], 59999),
  },
  {
    clave: 'camisa-jean', nombre: 'Camisa de jean', categoria: 'remeras', popularidad: 5,
    descripcion: 'Camisa de denim liviano lavado, con dos bolsillos y botones a presión. Combina con todo, incluso con más jean.',
    precio: 57999, costo: 25000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Denim de 6 oz, lavado a la piedra' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('camisa-jean'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-CAM-JEA', 57999, [ROPA], [5, 9, 8, 4]),
  },
  {
    clave: 'blusa-volados', nombre: 'Blusa con volados', categoria: 'remeras', popularidad: 5,
    descripcion: 'Blusa crudo de viscosa con volados en las mangas y escote redondo. Fresca, cae bien y no se arruga.',
    precio: 39999, costo: 17000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Tela', value: 'Viscosa' },
      { label: 'Calce', value: 'Suelto' },
      { label: 'Cuidado', value: 'Lavar a mano o en ciclo delicado.' },
      CAMBIOS,
    ],
    fotos: P('blusa-volados'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-BLU-VOL', 39999, [ROPA_MUJER], [5, 10, 9, 5]),
  },

  // ── Buzos y camperas ──────────────────────────────────────────────────────
  {
    clave: 'buzo-canguro', nombre: 'Buzo canguro con capucha', categoria: 'abrigos', destacado: true, popularidad: 9,
    descripcion: 'Buzo de frisa invisible, con capucha forrada, bolsillo canguro y puños elastizados. El abrigo que se usa todo el invierno.',
    precio: 64999, costo: 29000, etiquetas: ['Más vendido', 'Otoño-invierno', 'Básicos'],
    specs: [
      { label: 'Tela', value: 'Frisa invisible, 80 % algodón' },
      { label: 'Capucha', value: 'Forrada, con cordón' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('buzo-canguro', 3),
    opciones: [{ nombre: 'Color', valores: ['Gris', 'Rojo'], visual: true }, { nombre: 'Talle', valores: ROPA }],
    fotosPorValor: { Gris: [0, 2], Rojo: [1] },
    variantes: variantes('NM-BUZ-CAN', 64999, [['Gris', 'Rojo'], ROPA], [8, 16, 14, 7, 4, 9, 8, 3]),
    video: 'moda/videos/ficha-buzo-canguro.mp4',
    bloques: [
      { video: 'moda/videos/bloque-canguro-1.mp4', eyebrow: 'Frisa invisible', titulo: 'Abriga sin pesar', texto: 'Por fuera, algodón liso; por dentro, frisa suave que guarda el calor. Liviano para llevarlo todo el día.' },
      { video: 'moda/videos/bloque-canguro-2.mp4', eyebrow: 'Calce regular', titulo: 'Para él y para ella', texto: 'Un corte recto que queda bien en todos los cuerpos. Revisá la tabla de talles: va del S al XL.' },
    ],
  },
  {
    clave: 'buzo-crew', nombre: 'Buzo cuello redondo crudo', categoria: 'abrigos', popularidad: 6,
    descripcion: 'Buzo sin capucha color crudo, de rústico peinado y puños acanalados. Queda prolijo con una camisa abajo.',
    precio: 54999, costo: 24000, etiquetas: ['Básicos'],
    specs: [
      { label: 'Tela', value: 'Rústico peinado' },
      { label: 'Calce', value: 'Regular' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('buzo-crew'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-BUZ-CRE', 54999, [ROPA], [6, 11, 10, 5]),
  },
  {
    clave: 'sweater-mostaza', nombre: 'Sweater de lana mostaza', categoria: 'abrigos', popularidad: 6,
    descripcion: 'Sweater tejido de lana y acrílico en color mostaza, cuello redondo y hombros caídos. Calentito y con mucho color.',
    precio: 69999, costo: 31000, etiquetas: ['Otoño-invierno', 'Ideal para regalar'],
    specs: [
      { label: 'Tejido', value: '50 % lana, 50 % acrílico' },
      { label: 'Calce', value: 'Holgado' },
      { label: 'Cuidado', value: 'Lavar a mano con agua fría. Secar en horizontal.' },
      CAMBIOS,
    ],
    fotos: P('sweater-mostaza'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-SWE-MOS', 69999, [ROPA_MUJER], [4, 8, 7, 4]),
  },
  {
    clave: 'sweater-jacquard', nombre: 'Sweater jacquard', categoria: 'abrigos', popularidad: 4,
    descripcion: 'Sweater con guarda jacquard en tonos azul, rojo y mostaza. Tejido en punto firme, ideal para los días más fríos.',
    precio: 74999, costo: 33000, etiquetas: ['Otoño-invierno', 'Nuevo'],
    specs: [
      { label: 'Tejido', value: 'Lana y acrílico, punto jacquard' },
      { label: 'Calce', value: 'Regular' },
      { label: 'Cuidado', value: 'Lavar a mano con agua fría. Secar en horizontal.' },
      CAMBIOS,
    ],
    fotos: P('sweater-jacquard'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-SWE-JAC', 74999, [ROPA], [4, 7, 6, 3]),
  },
  {
    clave: 'cardigan-gris', nombre: 'Cardigan de punto gris', categoria: 'abrigos', popularidad: 5,
    descripcion: 'Cardigan largo de punto trenzado, con botones de madera. Abriga y se lleva abierto arriba de una remera.',
    precio: 72999, costo: 32000, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Tejido', value: 'Punto trenzado, acrílico y lana' },
      { label: 'Botones', value: 'Madera' },
      { label: 'Cuidado', value: 'Lavar a mano. Secar en horizontal.' },
      CAMBIOS,
    ],
    fotos: P('cardigan-gris', 2),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-CAR-GRI', 72999, [ROPA_MUJER], [4, 8, 7, 3]),
  },
  {
    clave: 'campera-jean', nombre: 'Campera de jean clásica', categoria: 'abrigos', destacado: true, popularidad: 9,
    descripcion: 'La campera de jean de siempre: denim rígido de 12 oz, lavado claro, bolsillos con tapa y botones metálicos. Mejora con cada uso.',
    precio: 99999, costo: 46000, etiquetas: ['Más vendido', 'Básicos', 'Ideal para regalar'],
    specs: [
      { label: 'Tela', value: 'Denim 100 % algodón, 12 oz' },
      { label: 'Lavado', value: 'Celeste a la piedra' },
      { label: 'Calce', value: 'Regular: llega a la cadera' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('campera-jean', 3),
    opciones: [{ nombre: 'Talle', valores: ['XS', ...ROPA] }],
    variantes: variantes('NM-CAM-JEN', 99999, [['XS', ...ROPA]], [4, 9, 14, 11, 5]),
    video: 'moda/videos/ficha-campera-jean.mp4',
    bloques: [
      { video: 'moda/videos/bloque-jean-1.mp4', eyebrow: 'Denim de 12 oz', titulo: 'Hecha para durar', texto: 'Algodón rígido que se ablanda y toma tu forma con el uso. Costuras dobles y remaches en los puntos de esfuerzo.' },
      { video: 'moda/videos/bloque-jean-2.mp4', eyebrow: 'Combina con todo', titulo: 'Con vestido o con jean', texto: 'Arriba de un vestido en primavera, con buzo abajo en invierno. Es la prenda que más se usa del placard.' },
    ],
  },
  {
    clave: 'campera-cuero', nombre: 'Campera de cuero marrón', categoria: 'abrigos', destacado: true, popularidad: 5, stockMinimo: 3,
    descripcion: 'Campera motoquera de cuero ovino marrón, con cierres metálicos y forro de satén. Una inversión que dura toda la vida.',
    precio: 389999, costo: 205000, etiquetas: ['Cuero', 'Otoño-invierno'],
    specs: [
      { label: 'Material', value: 'Cuero ovino' },
      { label: 'Forro', value: 'Satén' },
      { label: 'Calce', value: 'Al cuerpo: si vas a usarla con buzo, un talle más' },
      { label: 'Cuidado', value: 'Limpieza especializada. Hidratar el cuero una vez por temporada.' },
      CAMBIOS,
    ],
    fotos: P('campera-cuero'),
    opciones: [{ nombre: 'Talle', valores: ROPA }],
    variantes: variantes('NM-CAM-CUE', 389999, [ROPA], [1, 2, 2, 1]),
  },
  {
    clave: 'campera-inflable', nombre: 'Campera inflable', categoria: 'abrigos', popularidad: 7,
    descripcion: 'Campera inflable con relleno de pluma sintética, capucha fija y cierre a dos vías. Liviana, abriga mucho y se guarda en su propio bolsillo.',
    precio: 139999, precioAnterior: 169999, costo: 66000, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Exterior', value: 'Nylon repelente al agua' },
      { label: 'Relleno', value: 'Pluma sintética' },
      { label: 'Calce', value: 'Regular' },
      { label: 'Cuidado', value: 'Lavarropas en ciclo delicado, con agua fría.' },
      CAMBIOS,
    ],
    fotos: P('campera-inflable', 2),
    opciones: [{ nombre: 'Color', valores: ['Azul', 'Blanco'], visual: true }, { nombre: 'Talle', valores: ROPA }],
    fotosPorValor: { Azul: [0], Blanco: [1] },
    variantes: variantes('NM-CAM-INF', 139999, [['Azul', 'Blanco'], ROPA], [4, 8, 7, 3, 3, 6, 5, 2], 169999),
  },
  {
    clave: 'tapado-azul', nombre: 'Tapado oversize azul', categoria: 'abrigos', popularidad: 4,
    descripcion: 'Tapado de paño azul francia, cruzado y con cuello grande. Holgado para usarlo arriba de un sweater.',
    precio: 189999, costo: 94000, etiquetas: ['Otoño-invierno', 'Nuevo'],
    specs: [
      { label: 'Tela', value: 'Paño de lana y poliéster' },
      { label: 'Forro', value: 'Completo' },
      { label: 'Calce', value: 'Oversize' },
      { label: 'Cuidado', value: 'Limpieza en seco.' },
      CAMBIOS,
    ],
    fotos: P('tapado-azul'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-TAP-AZU', 189999, [ROPA_MUJER], [2, 4, 4, 2]),
  },

  // ── Pantalones ────────────────────────────────────────────────────────────
  {
    clave: 'jean-mom', nombre: 'Jean mom celeste', categoria: 'pantalones', destacado: true, popularidad: 9,
    descripcion: 'Jean de tiro alto y pierna recta, en denim celeste con 2 % de elastano. Marca la cintura y no aprieta.',
    precio: 69999, costo: 31000, etiquetas: ['Más vendido', 'Básicos'],
    specs: [
      { label: 'Tela', value: 'Denim 98 % algodón, 2 % elastano' },
      { label: 'Tiro', value: 'Alto' },
      { label: 'Calce', value: 'Mom: recto y holgado en la cadera' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('jean-mom'),
    opciones: [{ nombre: 'Talle', valores: JEAN }],
    variantes: variantes('NM-JEA-MOM', 69999, [JEAN], [6, 13, 15, 9, 4]),
  },
  {
    clave: 'jean-negro', nombre: 'Jean chupín negro', categoria: 'pantalones', popularidad: 8,
    descripcion: 'Jean negro ajustado, con elastano para moverse cómodo y un negro que no destiñe. El que combina con todo.',
    precio: 66999, costo: 29500, etiquetas: ['Básicos'],
    specs: [
      { label: 'Tela', value: 'Denim negro, 3 % elastano' },
      { label: 'Tiro', value: 'Medio' },
      { label: 'Calce', value: 'Chupín' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('jean-negro'),
    opciones: [{ nombre: 'Talle', valores: JEAN }],
    variantes: variantes('NM-JEA-NEG', 66999, [JEAN], [5, 11, 13, 8, 4]),
  },
  {
    clave: 'pantalon-chino', nombre: 'Pantalón chino beige', categoria: 'pantalones', popularidad: 6,
    descripcion: 'Chino de gabardina elastizada color arena, con puño elástico en el ruedo. Prolijo para la oficina y cómodo para el finde.',
    precio: 62999, costo: 27000, etiquetas: ['Básicos', 'Nuevo'],
    specs: [
      { label: 'Tela', value: 'Gabardina de algodón con elastano' },
      { label: 'Calce', value: 'Jogger: ruedo con puño' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('pantalon-chino'),
    opciones: [{ nombre: 'Talle', valores: JEAN }],
    variantes: variantes('NM-PAN-CHI', 62999, [JEAN], [4, 9, 11, 7, 3]),
  },
  {
    clave: 'pantalon-sastrero', nombre: 'Pantalón sastrero gris', categoria: 'pantalones', popularidad: 4,
    descripcion: 'Pantalón de pierna ancha en tela de lana fría gris, con pinzas y pliegue marcado. Elegante y muy cómodo.',
    precio: 79999, costo: 36000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Lana fría' },
      { label: 'Calce', value: 'Pierna ancha, tiro alto' },
      { label: 'Cuidado', value: 'Limpieza en seco o lavado a mano.' },
      CAMBIOS,
    ],
    fotos: P('pantalon-sastrero'),
    opciones: [{ nombre: 'Talle', valores: JEAN }],
    variantes: variantes('NM-PAN-SAS', 79999, [JEAN], [3, 6, 7, 4, 2]),
  },
  {
    clave: 'pantalon-cargo', nombre: 'Pantalón cargo verde', categoria: 'pantalones', popularidad: 5,
    descripcion: 'Cargo de gabardina verde inglés con bolsillos laterales y ruedo ajustable. Resistente, para el día a día o una escapada.',
    precio: 72999, costo: 32000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Tela', value: 'Gabardina de algodón' },
      { label: 'Bolsillos', value: 'Seis, dos laterales con tapa' },
      { label: 'Calce', value: 'Recto' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('pantalon-cargo'),
    opciones: [{ nombre: 'Talle', valores: JEAN }],
    variantes: variantes('NM-PAN-CAR', 72999, [JEAN], [3, 7, 8, 5, 3]),
  },
  {
    clave: 'short-jean', nombre: 'Short de jean', categoria: 'pantalones', popularidad: 6,
    descripcion: 'Short de jean tiro alto con ruedo deshilachado. Lavado claro, ideal para el verano.',
    precio: 39999, precioAnterior: 47999, costo: 17000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Denim 100 % algodón' },
      { label: 'Tiro', value: 'Alto' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('short-jean', 2),
    opciones: [{ nombre: 'Talle', valores: JEAN.slice(0, 4) }],
    variantes: variantes('NM-SHO-JEA', 39999, [JEAN.slice(0, 4)], [5, 9, 8, 4], 47999),
  },

  // ── Vestidos y polleras ───────────────────────────────────────────────────
  {
    clave: 'vestido-floral', nombre: 'Vestido floral de breteles', categoria: 'vestidos', destacado: true, popularidad: 8,
    descripcion: 'Vestido midi de fibrana con estampa floral sobre fondo negro, breteles finos regulables y botones al frente. Fresco y fácil de usar.',
    precio: 74999, costo: 33000, etiquetas: ['Nuevo', 'Más vendido'],
    specs: [
      { label: 'Tela', value: 'Fibrana estampada' },
      { label: 'Largo', value: 'Midi' },
      { label: 'Cuidado', value: 'Lavar a mano o en ciclo delicado.' },
      CAMBIOS,
    ],
    fotos: P('vestido-floral'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-VES-FLO', 74999, [ROPA_MUJER], [5, 10, 9, 4]),
  },
  {
    clave: 'vestido-largo-negro', nombre: 'Vestido largo negro', categoria: 'vestidos', popularidad: 5,
    descripcion: 'Vestido largo de jersey negro con escote en la espalda. Cae recto y se lleva de día con sandalias o de noche con tacos.',
    precio: 89999, costo: 40000, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Tela', value: 'Jersey de viscosa' },
      { label: 'Largo', value: 'Al tobillo' },
      { label: 'Cuidado', value: 'Lavar a mano.' },
      CAMBIOS,
    ],
    fotos: P('vestido-largo-negro'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-VES-LAR', 89999, [ROPA_MUJER], [3, 6, 6, 3]),
  },
  {
    clave: 'vestido-cruzado', nombre: 'Vestido estampado bordó', categoria: 'vestidos', popularidad: 4,
    descripcion: 'Vestido largo de crepe con estampa geométrica bordó y azul, cuello mao, mangas largas y cinto trenzado. Favorece a todos los cuerpos.',
    precio: 84999, costo: 38000, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Tela', value: 'Crepe' },
      { label: 'Largo', value: 'A media pierna' },
      { label: 'Cuidado', value: 'Lavar a mano.' },
      CAMBIOS,
    ],
    fotos: P('vestido-cruzado'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-VES-CRU', 84999, [ROPA_MUJER], [3, 6, 5, 3]),
  },
  {
    clave: 'vestido-camisero', nombre: 'Vestido camisero estampado', categoria: 'vestidos', popularidad: 5,
    descripcion: 'Vestido camisero rosa con estampa de golondrinas, volado en el ruedo y cinto del mismo género.',
    precio: 79999, precioAnterior: 94999, costo: 35000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Fibrana' },
      { label: 'Largo', value: 'Sobre la rodilla' },
      { label: 'Cuidado', value: 'Lavar a mano o en ciclo delicado.' },
      CAMBIOS,
    ],
    fotos: P('vestido-camisero'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-VES-CAM', 79999, [ROPA_MUJER], [3, 7, 6, 3], 94999),
  },
  {
    clave: 'pollera-plisada', nombre: 'Pollera plisada azul', categoria: 'vestidos', popularidad: 4,
    descripcion: 'Pollera midi plisada azul marino, con cintura elástica. Se mueve con vos y combina con remera o sweater.',
    precio: 54999, costo: 24000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Poliéster plisado permanente' },
      { label: 'Largo', value: 'Midi' },
      { label: 'Cuidado', value: 'Lavar a mano. No planchar los pliegues.' },
      CAMBIOS,
    ],
    fotos: P('pollera-plisada'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-POL-PLI', 54999, [ROPA_MUJER], [4, 7, 6, 3]),
  },
  {
    clave: 'pollera-tableada', nombre: 'Pollera tableada bordó', categoria: 'vestidos', popularidad: 5,
    descripcion: 'Pollera corta tableada en bordó, con cierre lateral invisible. Con medias de lana y borcegos, el look de invierno.',
    precio: 49999, costo: 21500, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Tela', value: 'Gabardina' },
      { label: 'Largo', value: 'Corta' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('pollera-tableada', 2),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-POL-TAB', 49999, [ROPA_MUJER], [4, 8, 7, 3]),
  },
  {
    clave: 'pollera-tubo', nombre: 'Pollera tubo blanca', categoria: 'vestidos', popularidad: 3,
    descripcion: 'Pollera tubo de bengalina blanca con tajo atrás. Al cuerpo, con buena elasticidad para caminar cómoda.',
    precio: 46999, costo: 20000, etiquetas: [],
    specs: [
      { label: 'Tela', value: 'Bengalina elastizada' },
      { label: 'Largo', value: 'Midi' },
      CUIDADO_ALGODON,
      CAMBIOS,
    ],
    fotos: P('pollera-tubo'),
    opciones: [{ nombre: 'Talle', valores: ROPA_MUJER }],
    variantes: variantes('NM-POL-TUB', 46999, [ROPA_MUJER], [3, 5, 5, 2]),
  },

  // ── Accesorios ────────────────────────────────────────────────────────────
  {
    clave: 'mochila-mostaza', nombre: 'Mochila urbana mostaza', categoria: 'accesorios', destacado: true, popularidad: 7,
    descripcion: 'Mochila de lona encerada con tapa, compartimiento acolchado para notebook de 15" y correas regulables. Resiste la lluvia.',
    precio: 89999, costo: 41000, etiquetas: ['Ideal para regalar', 'Nuevo'],
    specs: [
      { label: 'Material', value: 'Lona encerada' },
      { label: 'Capacidad', value: '20 litros' },
      { label: 'Notebook', value: 'Hasta 15", con funda acolchada' },
      { label: 'Medidas', value: '42 × 30 × 14 cm' },
    ],
    fotos: P('mochila-mostaza', 2), stock: 18,
  },
  {
    clave: 'sombrero-paja', nombre: 'Sombrero de paja', categoria: 'accesorios', popularidad: 5,
    descripcion: 'Sombrero de paja natural tejida a mano, con ala ancha y cinta negra. Para la playa, el campo o la ciudad.',
    precio: 34999, costo: 14000, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Material', value: 'Paja natural' },
      { label: 'Ala', value: '9 cm' },
      { label: 'Talle', value: 'Único, con ajuste interno' },
    ],
    fotos: P('sombrero-paja', 2), stock: 22,
  },
  {
    clave: 'anteojos-sol', nombre: 'Anteojos de sol clásicos', categoria: 'accesorios', destacado: true, popularidad: 7,
    descripcion: 'Anteojos de sol de acetato con lentes polarizadas y filtro UV400. El modelo cuadrado que le queda bien a casi todos.',
    precio: 59999, costo: 24000, etiquetas: ['Ideal para regalar', 'Envío en 24 h'],
    specs: [
      { label: 'Armazón', value: 'Acetato' },
      { label: 'Lentes', value: 'Polarizadas, filtro UV400' },
      { label: 'Incluye', value: 'Estuche rígido y paño' },
    ],
    fotos: P('anteojos-sol', 2),
    opciones: [{ nombre: 'Color', valores: ['Negro', 'Carey'], visual: true }],
    fotosPorValor: { Negro: [0], Carey: [1] },
    variantes: [
      { valores: ['Negro'], precio: 59999, stock: 16, sku: 'NM-ANT-NEG' },
      { valores: ['Carey'], precio: 59999, stock: 11, sku: 'NM-ANT-CAR' },
    ],
  },
  {
    clave: 'reloj-cuero', nombre: 'Reloj analógico con malla de cuero', categoria: 'accesorios', popularidad: 6,
    descripcion: 'Reloj de cuarzo con caja de acero, cristal mineral y malla de cuero intercambiable. Resiste salpicaduras.',
    precio: 119999, costo: 54000, etiquetas: ['Ideal para regalar', 'Cuero'],
    specs: [
      { label: 'Caja', value: 'Acero inoxidable, 40 mm' },
      { label: 'Máquina', value: 'Cuarzo japonés' },
      { label: 'Malla', value: 'Cuero, 20 mm, intercambiable' },
      { label: 'Resistencia', value: '3 ATM (salpicaduras)' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: P('reloj-cuero', 2),
    opciones: [{ nombre: 'Malla', valores: ['Suela', 'Marrón oscuro'] }],
    variantes: [
      { valores: ['Suela'], precio: 119999, stock: 9, sku: 'NM-REL-SUE' },
      { valores: ['Marrón oscuro'], precio: 119999, stock: 7, sku: 'NM-REL-MAR' },
    ],
  },
  {
    clave: 'cartera-cuero', nombre: 'Cartera de cuero suela', categoria: 'accesorios', popularidad: 5,
    descripcion: 'Cartera bandolera de cuero vacuno color suela, con tapa y correa regulable. Entra todo lo del día sin ser grande.',
    precio: 129999, costo: 61000, etiquetas: ['Cuero', 'Ideal para regalar'],
    specs: [
      { label: 'Material', value: 'Cuero vacuno' },
      { label: 'Medidas', value: '24 × 18 × 8 cm' },
      { label: 'Correa', value: 'Regulable, hasta 120 cm' },
    ],
    fotos: P('cartera-cuero'), stock: 10,
  },
  {
    clave: 'bolso-viaje', nombre: 'Bolso de viaje de cuero', categoria: 'accesorios', popularidad: 3,
    descripcion: 'Bolso de fin de semana de cuero engrasado, con manijas, correa desmontable y bolsillos externos. Entra en el portaequipaje.',
    precio: 249999, costo: 128000, etiquetas: ['Cuero'],
    specs: [
      { label: 'Material', value: 'Cuero vacuno engrasado' },
      { label: 'Capacidad', value: '40 litros' },
      { label: 'Medidas', value: '55 × 30 × 25 cm' },
    ],
    fotos: P('bolso-viaje', 2), stock: 5,
  },
  {
    clave: 'cinturon-cuero', nombre: 'Cinturón de cuero', categoria: 'accesorios', popularidad: 6,
    descripcion: 'Cinturón de cuero liso de 3,5 cm con hebilla metálica envejecida. Va con jean y con pantalón de vestir.',
    precio: 32999, costo: 13000, etiquetas: ['Cuero', 'Básicos'],
    specs: [
      { label: 'Material', value: 'Cuero vacuno' },
      { label: 'Ancho', value: '3,5 cm' },
      { label: 'Hebilla', value: 'Metal envejecido' },
    ],
    fotos: P('cinturon-cuero'),
    opciones: [{ nombre: 'Talle', valores: ['85', '90', '95', '100', '105'] }],
    variantes: variantes('NM-CIN', 32999, [['85', '90', '95', '100', '105']], [4, 8, 9, 7, 3]),
  },
  {
    clave: 'gorro-lana', nombre: 'Gorro de lana con pompón', categoria: 'accesorios', popularidad: 6,
    descripcion: 'Gorro tejido en punto inglés con pompón, suave y abrigado. Talle único que se adapta a todas las cabezas.',
    precio: 19999, costo: 7000, etiquetas: ['Otoño-invierno', 'Ideal para regalar'],
    specs: [
      { label: 'Tejido', value: 'Acrílico y lana, punto inglés' },
      { label: 'Talle', value: 'Único' },
    ],
    fotos: P('gorro-lana'),
    opciones: [{ nombre: 'Color', valores: ['Celeste', 'Gris', 'Crudo'] }],
    variantes: [
      { valores: ['Celeste'], precio: 19999, stock: 14, sku: 'NM-GOR-CEL' },
      { valores: ['Gris'], precio: 19999, stock: 18, sku: 'NM-GOR-GRI' },
      { valores: ['Crudo'], precio: 19999, stock: 12, sku: 'NM-GOR-CRU' },
    ],
  },
  {
    clave: 'bufanda-tejida', nombre: 'Bufanda tejida', categoria: 'accesorios', popularidad: 5,
    descripcion: 'Bufanda larga de punto grueso, con flecos en las puntas. Abriga de verdad y le da color a cualquier abrigo.',
    precio: 27999, costo: 10500, etiquetas: ['Otoño-invierno'],
    specs: [
      { label: 'Tejido', value: 'Acrílico y lana' },
      { label: 'Medidas', value: '190 × 30 cm' },
    ],
    fotos: P('bufanda-tejida', 2),
    opciones: [{ nombre: 'Color', valores: ['Terracota', 'Escocesa'] }],
    variantes: [
      { valores: ['Terracota'], precio: 27999, stock: 13, sku: 'NM-BUF-TER' },
      { valores: ['Escocesa'], precio: 27999, stock: 9, sku: 'NM-BUF-ESC' },
    ],
  },
  {
    clave: 'cuello-tejido', nombre: 'Cuello tejido crudo', categoria: 'accesorios', popularidad: 4,
    descripcion: 'Cuello circular de punto trenzado grueso, sin puntas que se desarmen. Se pone y se saca en un segundo.',
    precio: 24999, costo: 9000, etiquetas: ['Otoño-invierno', 'Nuevo'],
    specs: [
      { label: 'Tejido', value: 'Acrílico, punto trenzado' },
      { label: 'Talle', value: 'Único' },
    ],
    fotos: P('cuello-tejido'), stock: 15,
  },
];

// ─── Catálogo de la demo pública: Nébula Regalos ────────────────────────────
//
// Regalería: tazas, velas, peluches, papelería, deco y dulces. Mismo formato
// que el de Nébula Tech (../catalogo.ts), datos puros sin Prisma. Las fotos
// están en ../media/regalos (Unsplash, CC0 — subidas a Wikimedia Commons
// cuando su licencia era CC0; autor y link en media/regalos/creditos.json).
// Son fotos de ambiente y no se les quita el fondo. Los videos son
// recorridos sobre esas mismas fotos.
//
// Precios en pesos. `popularidad` (1–10) decide cuánto aparece cada producto
// en los pedidos sembrados.
import type { ProductoDemo } from '../catalogo';

export const CATEGORIAS_REGALOS = [
  { clave: 'tazas', nombre: 'Tazas y teteras', slug: 'tazas-y-teteras', icono: 'Coffee', color: '#6C3BE4', imagen: 'regalos/categorias/tazas-y-teteras.webp' },
  { clave: 'velas', nombre: 'Velas y aromas', slug: 'velas-y-aromas', icono: 'Flame', color: '#F2603D', imagen: 'regalos/categorias/velas-y-aromas.webp' },
  { clave: 'peluches', nombre: 'Peluches y juguetes', slug: 'peluches-y-juguetes', icono: 'Gift', color: '#DB2777', imagen: 'regalos/categorias/peluches-y-juguetes.webp' },
  { clave: 'papeleria', nombre: 'Papelería', slug: 'papeleria', icono: 'NotebookPen', color: '#0E7490', imagen: 'regalos/categorias/papeleria.webp' },
  { clave: 'deco', nombre: 'Deco y plantas', slug: 'deco-y-plantas', icono: 'Flower2', color: '#15803D', imagen: 'regalos/categorias/deco-y-plantas.webp' },
  { clave: 'dulces', nombre: 'Dulces y chocolates', slug: 'dulces-y-chocolates', icono: 'Candy', color: '#B45309', imagen: 'regalos/categorias/dulces-y-chocolates.webp' },
] as const;

export const ETIQUETAS_REGALOS = ['Nuevo', 'Más vendido', 'Ideal para regalar', 'Hecho a mano', 'Cumpleaños', 'Para la casa', 'Envío en 24 h'];

const P = (clave: string, n = 1) => Array.from({ length: n }, (_, i) => `regalos/productos/${clave}-${i + 1}.webp`);

const CERAMICA = { label: 'Cuidado', value: 'Apta lavavajillas y microondas' };
const PAQUETE = { label: 'Paquete de regalo', value: 'Sin cargo, con tarjeta escrita a mano' };
const DULCE = (peso: string, dura: string) => [
  { label: 'Contenido', value: peso },
  { label: 'Conservación', value: 'En lugar fresco y seco, lejos del sol' },
  { label: 'Consumir dentro de', value: dura },
];

export const PRODUCTOS_REGALOS: ProductoDemo[] = [
  // ── Tazas y teteras ───────────────────────────────────────────────────────
  {
    clave: 'taza-rayada', nombre: 'Taza rayada amarilla', categoria: 'tazas', destacado: true, popularidad: 10,
    descripcion: 'Taza de cerámica con rayas amarillas pintadas a mano, de 350 ml: entra un café con leche bien cargado. Alegra cualquier mañana.',
    precio: 14999, costo: 6000, etiquetas: ['Más vendido', 'Ideal para regalar', 'Envío en 24 h'],
    specs: [{ label: 'Material', value: 'Cerámica esmaltada' }, { label: 'Capacidad', value: '350 ml' }, CERAMICA, PAQUETE],
    fotos: P('taza-rayada'), stock: 46,
  },
  {
    clave: 'taza-blanca', nombre: 'Taza blanca clásica', categoria: 'tazas', popularidad: 8,
    descripcion: 'La taza de todos los días: cerámica blanca, borde redondeado y asa cómoda. Va con cualquier vajilla.',
    precio: 11999, costo: 4500, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Cerámica' }, { label: 'Capacidad', value: '300 ml' }, CERAMICA],
    fotos: P('taza-blanca'), stock: 52,
  },
  {
    clave: 'taza-verde-agua', nombre: 'Taza verde agua', categoria: 'tazas', popularidad: 7,
    descripcion: 'Taza de cerámica esmaltada en verde agua, con un brillo suave. Combina con mantel a cuadros y desayuno largo.',
    precio: 13999, costo: 5500, etiquetas: ['Nuevo'],
    specs: [{ label: 'Material', value: 'Cerámica esmaltada' }, { label: 'Capacidad', value: '320 ml' }, CERAMICA],
    fotos: P('taza-verde-agua'), stock: 31,
  },
  {
    clave: 'taza-terracota', nombre: 'Taza terracota', categoria: 'tazas', popularidad: 6,
    descripcion: 'Taza color terracota con base de corcho para no marcar el escritorio. Ideal para la oficina en casa.',
    precio: 15999, costo: 6500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Cerámica con base de corcho' }, { label: 'Capacidad', value: '300 ml' }, CERAMICA, PAQUETE],
    fotos: P('taza-terracota'), stock: 24,
  },
  {
    clave: 'taza-artesanal', nombre: 'Taza artesanal esmaltada', categoria: 'tazas', destacado: true, popularidad: 6,
    descripcion: 'Taza torneada a mano por ceramistas de Córdoba, con esmalte de efecto. Cada una es única: el color varía un poco.',
    precio: 24999, costo: 11000, etiquetas: ['Hecho a mano', 'Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Gres esmaltado, torneado a mano' }, { label: 'Capacidad', value: '280 ml' }, { label: 'Cuidado', value: 'Lavar a mano' }, PAQUETE],
    fotos: P('taza-artesanal'), stock: 12, stockMinimo: 4,
  },
  {
    clave: 'tetera-hierro', nombre: 'Tetera de hierro fundido', categoria: 'tazas', destacado: true, popularidad: 5,
    descripcion: 'Tetera de hierro fundido con infusor de acero: mantiene el té caliente un buen rato. Pesada, firme y para toda la vida.',
    precio: 69999, costo: 34000, etiquetas: ['Ideal para regalar', 'Para la casa'],
    specs: [{ label: 'Material', value: 'Hierro fundido esmaltado por dentro' }, { label: 'Capacidad', value: '800 ml' }, { label: 'Incluye', value: 'Infusor de acero inoxidable' }, { label: 'Cuidado', value: 'Lavar a mano y secar enseguida' }],
    fotos: P('tetera-hierro', 2),
    opciones: [{ nombre: 'Color', valores: ['Negro', 'Azul'], visual: true }],
    fotosPorValor: { Negro: [0], Azul: [1] },
    variantes: [
      { valores: ['Negro'], precio: 69999, stock: 9, sku: 'NR-TET-HIE-NEG' },
      { valores: ['Azul'], precio: 69999, stock: 6, sku: 'NR-TET-HIE-AZU' },
    ],
  },
  {
    clave: 'tetera-vidrio', nombre: 'Tetera de vidrio con infusor', categoria: 'tazas', popularidad: 6,
    descripcion: 'Tetera de vidrio borosilicato: ves cómo se abre el té mientras se infusiona. Resiste el agua hirviendo.',
    precio: 32999, costo: 15000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Vidrio borosilicato' }, { label: 'Capacidad', value: '600 ml' }, { label: 'Incluye', value: 'Infusor de vidrio' }],
    fotos: P('tetera-vidrio'), stock: 18,
  },
  {
    clave: 'tetera-roja', nombre: 'Tetera de cerámica roja', categoria: 'tazas', popularidad: 4,
    descripcion: 'Tetera redonda de cerámica roja brillante, para cuatro tazas. Un clásico que queda lindo en la mesa del patio.',
    precio: 38999, precioAnterior: 46999, costo: 17000, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Cerámica esmaltada' }, { label: 'Capacidad', value: '1 litro' }, CERAMICA],
    fotos: P('tetera-roja'), stock: 10,
  },

  // ── Velas y aromas ────────────────────────────────────────────────────────
  {
    clave: 'vela-soja', nombre: 'Vela de soja en frasco', categoria: 'velas', destacado: true, popularidad: 10,
    descripcion: 'Vela de cera de soja con mecha de algodón, en frasco de vidrio reutilizable. Perfuma el ambiente sin humo y dura unas 40 horas.',
    precio: 21999, costo: 8500, etiquetas: ['Más vendido', 'Hecho a mano', 'Ideal para regalar'],
    specs: [{ label: 'Cera', value: 'Soja 100 % natural' }, { label: 'Duración', value: 'Unas 40 horas' }, { label: 'Frasco', value: 'Vidrio reutilizable, 200 g' }, PAQUETE],
    fotos: P('vela-soja'),
    opciones: [{ nombre: 'Aroma', valores: ['Vainilla', 'Lavanda', 'Sándalo', 'Frutos rojos'] }],
    variantes: [
      { valores: ['Vainilla'], precio: 21999, stock: 22, sku: 'NR-VEL-SOJ-VAI' },
      { valores: ['Lavanda'], precio: 21999, stock: 18, sku: 'NR-VEL-SOJ-LAV' },
      { valores: ['Sándalo'], precio: 21999, stock: 11, sku: 'NR-VEL-SOJ-SAN' },
      { valores: ['Frutos rojos'], precio: 21999, stock: 14, sku: 'NR-VEL-SOJ-FRU' },
    ],
    video: 'regalos/videos/ficha-vela-soja.mp4',
    bloques: [
      { video: 'regalos/videos/bloque-vela-1.mp4', eyebrow: 'Cera de soja', titulo: 'Arde limpia y pareja', texto: 'Sin parafina ni humo negro: la soja se consume lenta y deja el frasco limpio para usarlo después.' },
      { video: 'regalos/videos/bloque-vela-2.mp4', eyebrow: 'Hecha a mano', titulo: 'Una por una', texto: 'Las hacemos en tandas chicas, en nuestro taller. Elegí el aroma y te la mandamos lista para regalar.' },
    ],
  },
  {
    clave: 'velas-ambar', nombre: 'Velas en frasco ámbar x 3', categoria: 'velas', popularidad: 6,
    descripcion: 'Set de tres velas en frascos de vidrio ámbar con tapa, en tamaños distintos. Lindas encendidas y apagadas.',
    precio: 34999, costo: 14000, etiquetas: ['Ideal para regalar', 'Para la casa'],
    specs: [{ label: 'Cera', value: 'Soja' }, { label: 'Contenido', value: '3 frascos (90, 150 y 200 g)' }, PAQUETE],
    fotos: P('velas-ambar'), stock: 14,
  },
  {
    clave: 'candelabro', nombre: 'Candelabro de bronce', categoria: 'velas', popularidad: 4,
    descripcion: 'Palmatoria de bronce con asa y platillo, para una vela de cena. Incluye una vela blanca larga.',
    precio: 42999, costo: 19000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Bronce' }, { label: 'Alto', value: '14 cm (sin la vela)' }, { label: 'Incluye', value: 'Una vela de 20 cm' }],
    fotos: P('candelabro'), stock: 8,
  },
  {
    clave: 'farol', nombre: 'Farol de metal blanco', categoria: 'velas', popularidad: 5,
    descripcion: 'Farol de metal y vidrio con manija, para velas o luces led. Queda lindo en el balcón o en la mesa del jardín.',
    precio: 36999, precioAnterior: 42999, costo: 16000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Metal pintado y vidrio' }, { label: 'Alto', value: '28 cm' }, { label: 'Uso', value: 'Interior y exterior cubierto' }],
    fotos: P('farol'), stock: 11,
  },
  {
    clave: 'velas-cumple', nombre: 'Velitas Happy Birthday', categoria: 'velas', popularidad: 8,
    descripcion: 'Set de velitas de colores con las letras de Happy Birthday, para la torta. Llegan en su cajita, listas para usar.',
    precio: 4999, costo: 1500, etiquetas: ['Cumpleaños', 'Envío en 24 h'],
    specs: [{ label: 'Contenido', value: '13 velitas con letras' }, { label: 'Alto', value: '6 cm' }],
    fotos: P('velas-cumple'), stock: 64,
  },
  {
    clave: 'portavela-corazon', nombre: 'Portavela corazón', categoria: 'velas', popularidad: 5,
    descripcion: 'Portavela de metal envejecido con un corazón calado: la luz de la vela dibuja la forma en la pared.',
    precio: 18999, costo: 7500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Metal con terminación envejecida' }, { label: 'Uso', value: 'Para velas de té' }, PAQUETE],
    fotos: P('portavela-corazon'), stock: 20,
  },
  {
    clave: 'velitas-te', nombre: 'Velitas de té x 24', categoria: 'velas', popularidad: 7,
    descripcion: 'Caja de 24 velitas de té en cápsula de aluminio, de 4 horas cada una. Para portavelas, hornitos o una mesa con muchas luces.',
    precio: 7999, costo: 3000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Contenido', value: '24 velitas' }, { label: 'Duración', value: '4 horas cada una' }],
    fotos: P('velitas-te'), stock: 58,
  },
  {
    clave: 'hornito-aromas', nombre: 'Hornito para aromas', categoria: 'velas', popularidad: 4,
    descripcion: 'Hornito de cerámica calada para esencias o ceras aromáticas. Se usa con una velita de té abajo.',
    precio: 16999, costo: 6800, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Cerámica esmaltada' }, { label: 'Alto', value: '13 cm' }, { label: 'Uso', value: 'Con velitas de té' }],
    fotos: P('hornito-aromas'), stock: 13,
  },

  // ── Peluches y juguetes ───────────────────────────────────────────────────
  {
    clave: 'oso-peluche', nombre: 'Oso de peluche grande', categoria: 'peluches', destacado: true, popularidad: 9,
    descripcion: 'Oso de peluche de 60 cm, súper suave, con costuras reforzadas y ojos bordados (sin piezas chicas). Para abrazar fuerte.',
    precio: 45999, costo: 20000, etiquetas: ['Más vendido', 'Ideal para regalar', 'Cumpleaños'],
    specs: [{ label: 'Alto', value: '60 cm' }, { label: 'Relleno', value: 'Fibra siliconada hipoalergénica' }, { label: 'Seguridad', value: 'Ojos bordados, apto desde el nacimiento' }, { label: 'Cuidado', value: 'Lavar a mano con agua fría' }, PAQUETE],
    fotos: P('oso-peluche', 2),
    opciones: [{ nombre: 'Tamaño', valores: ['40 cm', '60 cm'] }],
    variantes: [
      { valores: ['40 cm'], precio: 32999, stock: 16, sku: 'NR-OSO-40' },
      { valores: ['60 cm'], precio: 45999, stock: 9, sku: 'NR-OSO-60' },
    ],
    video: 'regalos/videos/ficha-oso.mp4',
    bloques: [
      { video: 'regalos/videos/bloque-oso-1.mp4', eyebrow: 'Súper suave', titulo: 'Hecho para abrazar', texto: 'Pelo largo y relleno que no se apelmaza: sigue esponjoso después de muchos abrazos y lavados.' },
      { video: 'regalos/videos/bloque-oso-2.mp4', eyebrow: 'Listo para regalar', titulo: 'Llega envuelto', texto: 'Lo mandamos en caja, con moño y una tarjeta con lo que nos pidas que escribamos.' },
    ],
  },
  {
    clave: 'camioneta-roja', nombre: 'Camioneta de colección', categoria: 'peluches', popularidad: 4,
    descripcion: 'Camioneta pickup roja de metal, escala 1:24, con puertas que se abren. Para coleccionistas grandes y chicos.',
    precio: 27999, costo: 12500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Metal y plástico' }, { label: 'Escala', value: '1:24' }, { label: 'Edad', value: 'Desde 8 años' }],
    fotos: P('camioneta-roja'), stock: 12,
  },
  {
    clave: 'cubos-apilables', nombre: 'Cubos apilables ilustrados', categoria: 'peluches', popularidad: 6,
    descripcion: 'Diez cubos de cartón reforzado con animales y números: se apilan en torre o se guardan uno adentro del otro.',
    precio: 21999, costo: 9000, etiquetas: ['Nuevo', 'Ideal para regalar'],
    specs: [{ label: 'Contenido', value: '10 cubos' }, { label: 'Material', value: 'Cartón reforzado' }, { label: 'Edad', value: 'Desde 1 año' }],
    fotos: P('cubos-apilables'), stock: 19,
  },
  {
    clave: 'triciclo', nombre: 'Triciclo clásico', categoria: 'peluches', popularidad: 3,
    descripcion: 'Triciclo de metal rojo con asiento regulable y ruedas de goma: el de toda la vida, para empezar a pedalear.',
    precio: 119999, costo: 58000, etiquetas: ['Cumpleaños'],
    specs: [{ label: 'Material', value: 'Metal pintado' }, { label: 'Edad', value: 'De 2 a 5 años' }, { label: 'Peso máximo', value: '25 kg' }],
    fotos: P('triciclo'), stock: 4, stockMinimo: 2,
  },
  {
    clave: 'rompecabezas', nombre: 'Rompecabezas de 1000 piezas', categoria: 'peluches', popularidad: 6,
    descripcion: 'Rompecabezas de 1000 piezas de cartón grueso que encastran firme. Para armar en familia una tarde de lluvia.',
    precio: 24999, costo: 10500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Piezas', value: '1000' }, { label: 'Medida armado', value: '68 × 48 cm' }, { label: 'Edad', value: 'Desde 12 años' }],
    fotos: P('rompecabezas'), stock: 21,
  },
  {
    clave: 'globos', nombre: 'Set de globos x 10', categoria: 'peluches', popularidad: 8,
    descripcion: 'Diez globos de látex grueso, con cinta para colgarlos. Para el cumpleaños, la sorpresa o decorar la vidriera.',
    precio: 5999, costo: 1800, etiquetas: ['Cumpleaños', 'Envío en 24 h'],
    specs: [{ label: 'Contenido', value: '10 globos de 30 cm y cinta' }, { label: 'Material', value: 'Látex' }],
    fotos: P('globos', 2),
    opciones: [{ nombre: 'Diseño', valores: ['Lunares', 'Lisos'], visual: true }],
    fotosPorValor: { Lunares: [0], Lisos: [1] },
    variantes: [
      { valores: ['Lunares'], precio: 5999, stock: 44, sku: 'NR-GLO-LUN' },
      { valores: ['Lisos'], precio: 4999, stock: 51, sku: 'NR-GLO-LIS' },
    ],
  },
  {
    clave: 'munequito', nombre: 'Muñequito de colección', categoria: 'peluches', popularidad: 3,
    descripcion: 'Figura de colección de 8 cm, con capa y gorro. Un pequeño compañero para el escritorio o la biblioteca.',
    precio: 13999, costo: 5500, etiquetas: ['Nuevo'],
    specs: [{ label: 'Alto', value: '8 cm' }, { label: 'Material', value: 'Vinilo' }, { label: 'Edad', value: 'Desde 8 años' }],
    fotos: P('munequito'), stock: 15,
  },

  // ── Papelería ─────────────────────────────────────────────────────────────
  {
    clave: 'cuaderno-floral', nombre: 'Cuaderno tapa floral', categoria: 'papeleria', destacado: true, popularidad: 9,
    descripcion: 'Cuaderno A5 de tapa dura con estampa de hojas, 96 hojas lisas de 90 g. Para dibujar, anotar o regalar.',
    precio: 12999, costo: 5000, etiquetas: ['Más vendido', 'Ideal para regalar'],
    specs: [{ label: 'Tamaño', value: 'A5' }, { label: 'Hojas', value: '96 lisas, 90 g' }, { label: 'Tapa', value: 'Dura, estampada' }],
    fotos: P('cuaderno-floral', 2), stock: 38,
  },
  {
    clave: 'agenda-semanal', nombre: 'Agenda semanal 2027', categoria: 'papeleria', popularidad: 8,
    descripcion: 'Agenda con una semana a la vista, calendario anual y hojas para notas. Tapa de cartón celeste con espiral metálico.',
    precio: 18999, costo: 7800, etiquetas: ['Nuevo', 'Envío en 24 h'],
    specs: [{ label: 'Tamaño', value: '15 × 21 cm' }, { label: 'Formato', value: 'Semana a la vista' }, { label: 'Encuadernación', value: 'Espiral metálico' }],
    fotos: P('agenda-semanal'), stock: 33,
  },
  {
    clave: 'cuaderno-tapa-dura', nombre: 'Cuaderno de tapa dura rayado', categoria: 'papeleria', popularidad: 6,
    descripcion: 'Cuaderno cosido que se abre bien plano, con hojas rayadas color marfil. Ideal para escribir a mano todos los días.',
    precio: 14999, costo: 6000, etiquetas: [],
    specs: [{ label: 'Tamaño', value: 'A5' }, { label: 'Hojas', value: '120 rayadas, color marfil' }, { label: 'Encuadernación', value: 'Cosida, abre plano' }],
    fotos: P('cuaderno-tapa-dura'), stock: 25,
  },
  {
    clave: 'lapices-colores', nombre: 'Lápices de colores x 24', categoria: 'papeleria', popularidad: 7,
    descripcion: 'Veinticuatro lápices de colores de mina blanda y colores intensos, en lata. Para chicos y grandes que pintan.',
    precio: 15999, costo: 6500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Contenido', value: '24 colores' }, { label: 'Mina', value: 'Blanda, 3,3 mm' }, { label: 'Presentación', value: 'Lata metálica' }],
    fotos: P('lapices-colores'), stock: 29,
  },
  {
    clave: 'acuarelas', nombre: 'Set de acuarelas con block', categoria: 'papeleria', destacado: true, popularidad: 5,
    descripcion: 'Estuche de 24 pastillas de acuarela, tres pinceles y un block espiralado de 300 g. Todo para empezar a pintar.',
    precio: 29999, costo: 13000, etiquetas: ['Ideal para regalar', 'Nuevo'],
    specs: [{ label: 'Acuarelas', value: '24 pastillas' }, { label: 'Incluye', value: '3 pinceles y block A5 de 300 g' }],
    fotos: P('acuarelas'), stock: 14,
  },
  {
    clave: 'pinceles', nombre: 'Set de pinceles x 12', categoria: 'papeleria', popularidad: 3,
    descripcion: 'Doce pinceles de pelo sintético en distintas formas y tamaños, para acuarela, acrílico o témpera.',
    precio: 13999, costo: 5800, etiquetas: [],
    specs: [{ label: 'Contenido', value: '12 pinceles' }, { label: 'Pelo', value: 'Sintético' }],
    fotos: P('pinceles'), stock: 17,
  },
  {
    clave: 'sobres', nombre: 'Sobres y tarjetas x 10', categoria: 'papeleria', popularidad: 5,
    descripcion: 'Diez tarjetas lisas con sus sobres de papel texturado. Para escribir a mano lo que un mensaje no dice.',
    precio: 6999, costo: 2500, etiquetas: ['Ideal para regalar'],
    specs: [{ label: 'Contenido', value: '10 tarjetas y 10 sobres' }, { label: 'Tamaño', value: '10 × 15 cm' }],
    fotos: P('sobres'), stock: 41,
  },
  {
    clave: 'libreta-cuero', nombre: 'Libreta de cuero', categoria: 'papeleria', popularidad: 4,
    descripcion: 'Libreta de bolsillo con tapa de cuero curtido que se oscurece con el uso, y repuesto de hojas intercambiable.',
    precio: 26999, costo: 12000, etiquetas: ['Hecho a mano', 'Ideal para regalar'],
    specs: [{ label: 'Tapa', value: 'Cuero vacuno' }, { label: 'Tamaño', value: '10 × 14 cm' }, { label: 'Hojas', value: 'Repuesto de 64 hojas' }],
    fotos: P('libreta-cuero'), stock: 10,
  },
  {
    clave: 'cuaderno-espiral', nombre: 'Cuaderno espiralado A4', categoria: 'papeleria', popularidad: 5,
    descripcion: 'Cuaderno A4 con espiral doble y hojas rayadas con margen. Para la facu, el trabajo o la lista del súper.',
    precio: 9999, costo: 3800, etiquetas: ['Envío en 24 h'],
    specs: [{ label: 'Tamaño', value: 'A4' }, { label: 'Hojas', value: '80 rayadas' }],
    fotos: P('cuaderno-espiral'), stock: 36,
  },

  // ── Deco y plantas ────────────────────────────────────────────────────────
  {
    clave: 'jarra-florero', nombre: 'Jarra florero blanca', categoria: 'deco', destacado: true, popularidad: 7,
    descripcion: 'Jarra de cerámica blanca que sirve de florero: queda linda con flores frescas, secas o sola en un estante.',
    precio: 22999, costo: 9500, etiquetas: ['Para la casa', 'Ideal para regalar'],
    specs: [{ label: 'Material', value: 'Cerámica' }, { label: 'Alto', value: '22 cm' }, PAQUETE],
    fotos: P('jarra-florero'), stock: 17,
  },
  {
    clave: 'florero-vidrio', nombre: 'Florero de vidrio alto', categoria: 'deco', popularidad: 5,
    descripcion: 'Florero cilíndrico de vidrio grueso, de 30 cm, para ramos de tallo largo.',
    precio: 17999, costo: 7000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Vidrio' }, { label: 'Alto', value: '30 cm' }],
    fotos: P('florero-vidrio'), stock: 13,
  },
  {
    clave: 'suculenta', nombre: 'Suculenta en maceta blanca', categoria: 'deco', popularidad: 8,
    descripcion: 'Haworthia en maceta de cerámica blanca: casi no pide riego y vive feliz cerca de una ventana. El regalo que dura.',
    precio: 9999, costo: 3500, etiquetas: ['Más vendido', 'Ideal para regalar'],
    specs: [{ label: 'Planta', value: 'Haworthia' }, { label: 'Maceta', value: 'Cerámica, 9 cm' }, { label: 'Cuidado', value: 'Riego cada 10 días, luz indirecta' }],
    fotos: P('suculenta'), stock: 34,
  },
  {
    clave: 'terrario', nombre: 'Terrario de vidrio armado', categoria: 'deco', popularidad: 5,
    descripcion: 'Esfera de vidrio con un mini jardín de suculentas, piedras y musgo, lista para regalar.',
    precio: 32999, costo: 14000, etiquetas: ['Hecho a mano', 'Ideal para regalar'],
    specs: [{ label: 'Medida', value: '18 cm de diámetro' }, { label: 'Incluye', value: 'Suculentas, sustrato y piedras' }, { label: 'Cuidado', value: 'Rociar con agua una vez por semana' }],
    fotos: P('terrario'), stock: 8,
  },
  {
    clave: 'cactus', nombre: 'Cactus en maceta de barro', categoria: 'deco', popularidad: 6,
    descripcion: 'Cactus orejas de conejo en maceta de barro: resiste a los más olvidadizos.',
    precio: 8999, costo: 3200, etiquetas: [],
    specs: [{ label: 'Planta', value: 'Opuntia microdasys' }, { label: 'Maceta', value: 'Barro, 10 cm' }, { label: 'Cuidado', value: 'Riego cada 15 días, mucho sol' }],
    fotos: P('cactus'), stock: 27,
  },
  {
    clave: 'macetas-barro', nombre: 'Set de macetas de barro x 3', categoria: 'deco', popularidad: 4,
    descripcion: 'Tres macetas de barro cocido con agujero y plato, de 10, 12 y 14 cm. Para empezar la colección de plantas.',
    precio: 14999, costo: 6000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Material', value: 'Barro cocido' }, { label: 'Medidas', value: '10, 12 y 14 cm' }],
    fotos: P('macetas-barro'), stock: 19,
  },
  {
    clave: 'almohadon', nombre: 'Almohadón estampado', categoria: 'deco', popularidad: 6,
    descripcion: 'Almohadón de 45 × 45 cm con funda de algodón estampada y cierre invisible. Incluye el relleno.',
    precio: 19999, precioAnterior: 24999, costo: 8000, etiquetas: ['Para la casa'],
    specs: [{ label: 'Medida', value: '45 × 45 cm' }, { label: 'Funda', value: 'Algodón, lavable' }, { label: 'Relleno', value: 'Vellón siliconado' }],
    fotos: P('almohadon', 2),
    opciones: [{ nombre: 'Estampa', valores: ['Geométrica', 'Floral'], visual: true }],
    fotosPorValor: { Geométrica: [0], Floral: [1] },
    variantes: [
      { valores: ['Geométrica'], precio: 19999, precioAnterior: 24999, stock: 14, sku: 'NR-ALM-GEO' },
      { valores: ['Floral'], precio: 19999, precioAnterior: 24999, stock: 10, sku: 'NR-ALM-FLO' },
    ],
  },
  {
    clave: 'manta-tejida', nombre: 'Manta tejida', categoria: 'deco', popularidad: 5,
    descripcion: 'Manta de punto grueso de 120 × 150 cm, con flecos. Para el sillón, los pies de la cama o las noches de serie.',
    precio: 39999, costo: 18000, etiquetas: ['Para la casa', 'Ideal para regalar'],
    specs: [{ label: 'Medida', value: '120 × 150 cm' }, { label: 'Material', value: 'Acrílico y algodón' }, { label: 'Cuidado', value: 'Lavar a mano con agua fría' }],
    fotos: P('manta-tejida'),
    opciones: [{ nombre: 'Color', valores: ['Verde lima', 'Gris', 'Crudo'] }],
    variantes: [
      { valores: ['Verde lima'], precio: 39999, stock: 6, sku: 'NR-MAN-VER' },
      { valores: ['Gris'], precio: 39999, stock: 9, sku: 'NR-MAN-GRI' },
      { valores: ['Crudo'], precio: 39999, stock: 7, sku: 'NR-MAN-CRU' },
    ],
  },
  {
    clave: 'lamina', nombre: 'Lámina enmarcada', categoria: 'deco', popularidad: 4,
    descripcion: 'Ilustración impresa en papel de algodón con marco de madera negra y vidrio. Lista para colgar.',
    precio: 34999, costo: 15000, etiquetas: ['Para la casa', 'Nuevo'],
    specs: [{ label: 'Medida', value: '30 × 40 cm' }, { label: 'Marco', value: 'Madera negra con vidrio' }, { label: 'Papel', value: 'Algodón, 300 g' }],
    fotos: P('lamina'), stock: 9,
  },

  // ── Dulces y chocolates ───────────────────────────────────────────────────
  {
    clave: 'bombones', nombre: 'Caja de bombones surtidos', categoria: 'dulces', destacado: true, popularidad: 9,
    descripcion: 'Dieciséis bombones de chocolate con rellenos de dulce de leche, frutos rojos y almendra, en caja para regalo.',
    precio: 24999, costo: 10500, etiquetas: ['Más vendido', 'Ideal para regalar'],
    specs: [...DULCE('16 bombones (200 g)', '30 días'), PAQUETE],
    fotos: P('bombones'), stock: 26,
  },
  {
    clave: 'macarons', nombre: 'Caja de macarons x 12', categoria: 'dulces', popularidad: 8,
    descripcion: 'Doce macarons de colores: frambuesa, pistacho, limón, vainilla, chocolate y café. Hechos con almendra.',
    precio: 21999, costo: 9500, etiquetas: ['Ideal para regalar', 'Cumpleaños'],
    specs: [...DULCE('12 macarons', '10 días en heladera')],
    fotos: P('macarons', 2), stock: 18,
  },
  {
    clave: 'cookies', nombre: 'Cookies con chips x 6', categoria: 'dulces', popularidad: 7,
    descripcion: 'Seis cookies grandes con chips de chocolate, crocantes por fuera y blanditas por dentro. Recién horneadas.',
    precio: 9999, costo: 3800, etiquetas: ['Envío en 24 h'],
    specs: [...DULCE('6 cookies (420 g)', '7 días')],
    fotos: P('cookies', 2), stock: 30,
  },
  {
    clave: 'galletitas-manteca', nombre: 'Galletitas de manteca en lata', categoria: 'dulces', popularidad: 5,
    descripcion: 'Galletitas de manteca en lata decorada: un clásico para regalar y después usar la lata.',
    precio: 16999, costo: 7000, etiquetas: ['Ideal para regalar'],
    specs: [...DULCE('300 g', '45 días'), { label: 'Presentación', value: 'Lata metálica reutilizable' }],
    fotos: P('galletitas-manteca'), stock: 22,
  },
  {
    clave: 'chocolate-amargo', nombre: 'Chocolate amargo 70 %', categoria: 'dulces', popularidad: 6,
    descripcion: 'Tableta de chocolate amargo de 70 % cacao, hecha con cacao de origen. Intenso y poco dulce.',
    precio: 7999, costo: 3200, etiquetas: [],
    specs: [...DULCE('100 g', '6 meses'), { label: 'Cacao', value: '70 %' }],
    fotos: P('chocolate-amargo'), stock: 47,
  },
  {
    clave: 'huevitos', nombre: 'Huevitos de chocolate x 250 g', categoria: 'dulces', popularidad: 5,
    descripcion: 'Huevitos de chocolate con leche envueltos en papel metalizado de colores. Para la mesa dulce o la búsqueda del tesoro.',
    precio: 8999, costo: 3600, etiquetas: ['Cumpleaños'],
    specs: [...DULCE('250 g', '3 meses')],
    fotos: P('huevitos'), stock: 35,
  },
  {
    clave: 'cupcakes', nombre: 'Box de cupcakes x 6', categoria: 'dulces', popularidad: 6,
    descripcion: 'Seis cupcakes de vainilla con frosting de colores y granas. Ideales para un cumpleaños o una sorpresa.',
    precio: 18999, costo: 8000, etiquetas: ['Cumpleaños', 'Ideal para regalar'],
    specs: [...DULCE('6 cupcakes', '3 días en heladera'), { label: 'Envío', value: 'Solo CABA y GBA, en el día' }],
    fotos: P('cupcakes'), stock: 12,
  },
];

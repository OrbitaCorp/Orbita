// ─── Catálogo de la demo pública: Nébula Tech ───────────────────────────────
//
// Datos puros (sin Prisma): los usa prisma/seed-demo.ts. Las fotos y videos
// están en ./media (Pexels, licencia libre — autor y link en
// media/creditos.json). La primera foto de cada producto es la principal,
// recortada con el "Blanco liso" del estudio de fotos de Órbita.
//
// Precios en pesos. `popularidad` (1–10) solo decide cuánto aparece cada
// producto en los pedidos sembrados: arma el ranking de "más vendidos".

export type Especificacion = { label: string; value: string };

export type VarianteDemo = {
  valores: string[]; // en el orden de `opciones`
  precio: number;
  precioAnterior?: number;
  stock: number;
  sku: string;
};

export type ProductoDemo = {
  clave: string;
  nombre: string;
  categoria: string; // clave de CATEGORIAS
  descripcion: string;
  precio: number;
  precioAnterior?: number; // oferta: precio tachado
  costo: number;
  destacado?: boolean;
  etiquetas: string[];
  specs: Especificacion[];
  fotos: string[]; // rutas dentro de media/
  // Opción visual (Color/Malla): qué fotos van con cada valor, por índice de `fotos`.
  fotosPorValor?: Record<string, number[]>;
  opciones?: { nombre: string; valores: string[]; visual?: boolean }[];
  variantes?: VarianteDemo[];
  stock?: number; // sin variantes
  stockMinimo?: number;
  video?: string; // video de la ficha (media/)
  bloques?: { video: string; eyebrow: string; titulo: string; texto: string }[];
  popularidad: number;
};

export const CATEGORIAS = [
  { clave: 'audio', nombre: 'Audio', slug: 'audio', icono: 'Headphones', color: '#7C3AED', imagen: 'categorias/audio.webp' },
  { clave: 'celulares', nombre: 'Celulares y accesorios', slug: 'celulares-y-accesorios', icono: 'Smartphone', color: '#2563EB', imagen: 'categorias/celulares-y-accesorios.webp' },
  { clave: 'computacion', nombre: 'Computación', slug: 'computacion', icono: 'Laptop', color: '#0891B2', imagen: 'categorias/computacion.webp' },
  { clave: 'gaming', nombre: 'Gaming', slug: 'gaming', icono: 'Gamepad2', color: '#DB2777', imagen: 'categorias/gaming.webp' },
  { clave: 'hogar', nombre: 'Hogar inteligente', slug: 'hogar-inteligente', icono: 'House', color: '#059669', imagen: 'categorias/hogar-inteligente.webp' },
  { clave: 'wearables', nombre: 'Wearables', slug: 'wearables', icono: 'Watch', color: '#EA580C', imagen: 'categorias/wearables.webp' },
] as const;

export const ETIQUETAS = ['Nuevo', 'Más vendido', 'Inalámbrico', 'Gaming', 'Home office', 'Ideal para regalar', 'Envío en 24 h'];

const P = (archivo: string) => `productos/${archivo}`;

export const PRODUCTOS: ProductoDemo[] = [
  // ── Audio ───────────────────────────────────────────────────────────────
  {
    clave: 'auriculares-anc', nombre: 'Auriculares Nébula Pulse ANC', categoria: 'audio', destacado: true, popularidad: 10,
    descripcion: 'Auriculares over-ear con cancelación activa de ruido, 40 horas de batería y carga rápida: 10 minutos te dan 5 horas de música. Almohadillas de espuma viscoelástica para usarlos todo el día.',
    precio: 189999, costo: 104000, etiquetas: ['Más vendido', 'Inalámbrico', 'Ideal para regalar'],
    specs: [
      { label: 'Cancelación de ruido', value: 'Activa (ANC) con modo ambiente' },
      { label: 'Batería', value: 'Hasta 40 h (30 h con ANC)' },
      { label: 'Conectividad', value: 'Bluetooth 5.3, multipunto' },
      { label: 'Carga', value: 'USB-C, carga rápida' },
      { label: 'Peso', value: '250 g' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('auriculares-over-ear-con-cancelacion-de-ruido-1.webp'), P('auriculares-over-ear-con-cancelacion-de-ruido-2.webp'), P('auriculares-over-ear-con-cancelacion-de-ruido-3.webp'), P('auriculares-over-ear-con-cancelacion-de-ruido-4.webp')],
    opciones: [{ nombre: 'Color', valores: ['Blanco', 'Negro'], visual: true }],
    fotosPorValor: { Blanco: [0, 1, 2], Negro: [3] },
    variantes: [
      { valores: ['Blanco'], precio: 189999, stock: 34, sku: 'NB-PULSE-WHT' },
      { valores: ['Negro'], precio: 189999, stock: 21, sku: 'NB-PULSE-BLK' },
    ],
    video: 'videos/ficha-de-los-auriculares.mp4',
    bloques: [
      { video: 'videos/bloque-auriculares-ciudad.mp4', eyebrow: 'Cancelación activa de ruido', titulo: 'La ciudad, en silencio', texto: 'Tráfico, colectivo u oficina: la cancelación activa baja el ruido de afuera y te deja solo con lo que querés escuchar.' },
      { video: 'videos/bloque-auriculares-musica.mp4', eyebrow: 'Sonido Hi-Res', titulo: 'Escuchá cada detalle', texto: 'Drivers de 40 mm afinados para graves con cuerpo y voces claras, a cualquier volumen.' },
      { video: 'videos/bloque-auriculares-plegables.mp4', eyebrow: 'Diseño plegable', titulo: 'De la mesa a la mochila', texto: 'Se pliegan en segundos y entran en su estuche rígido. 250 gramos que ni vas a notar.' },
    ],
  },
  {
    clave: 'earbuds', nombre: 'Auriculares in-ear Nébula Buds', categoria: 'audio', popularidad: 9,
    descripcion: 'Auriculares in-ear inalámbricos con estuche de carga: 6 horas por carga y 24 horas en total. Livianos, resistentes al sudor y con controles táctiles.',
    precio: 79999, costo: 41000, etiquetas: ['Inalámbrico', 'Ideal para regalar'],
    specs: [
      { label: 'Batería', value: '6 h + 18 h con el estuche' },
      { label: 'Resistencia', value: 'IPX4 (sudor y salpicaduras)' },
      { label: 'Conectividad', value: 'Bluetooth 5.3' },
      { label: 'Controles', value: 'Táctiles' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('auriculares-in-ear-inalambricos-1.webp')], stock: 48,
  },
  {
    clave: 'parlante', nombre: 'Parlante portátil Nébula Go', categoria: 'audio', popularidad: 8,
    descripcion: 'Parlante bluetooth compacto con sonido 360°, 12 horas de batería y correa para llevarlo a todos lados. Resistente al agua.',
    precio: 64999, precioAnterior: 84999, costo: 33000, etiquetas: ['Inalámbrico', 'Ideal para regalar'],
    specs: [
      { label: 'Potencia', value: '10 W' },
      { label: 'Batería', value: 'Hasta 12 h' },
      { label: 'Resistencia', value: 'IPX6' },
      { label: 'Conectividad', value: 'Bluetooth 5.1, entrada auxiliar' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('parlante-bluetooth-portatil-1.webp')], stock: 27,
  },
  {
    clave: 'microfono', nombre: 'Micrófono USB Nébula Cast', categoria: 'audio', destacado: true, popularidad: 6,
    descripcion: 'Micrófono de condensador USB para streaming, podcast y videollamadas. Conectás y usás: sin drivers, con control de ganancia y salida para auriculares.',
    precio: 119999, costo: 62000, etiquetas: ['Nuevo', 'Home office'],
    specs: [
      { label: 'Tipo', value: 'Condensador, patrón cardioide' },
      { label: 'Resolución', value: '24 bit / 96 kHz' },
      { label: 'Conexión', value: 'USB-C' },
      { label: 'Extras', value: 'Monitoreo sin latencia, silencio táctil' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('microfono-usb-para-streaming-1.webp'), P('microfono-usb-para-streaming-2.webp')], stock: 16,
  },

  // ── Celulares y accesorios ────────────────────────────────────────────────
  {
    clave: 'smartphone', nombre: 'Smartphone Nébula X1', categoria: 'celulares', destacado: true, popularidad: 4,
    descripcion: 'Pantalla AMOLED de 6,5" a 120 Hz, triple cámara de 50 MP y batería de 5000 mAh con carga de 45 W. Rápido, liviano y con dos años de actualizaciones.',
    precio: 899999, costo: 610000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Pantalla', value: 'AMOLED 6,5" 120 Hz' },
      { label: 'Cámaras', value: '50 MP + 12 MP + 8 MP' },
      { label: 'Batería', value: '5000 mAh, carga de 45 W' },
      { label: 'Memoria RAM', value: '8 GB' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('smartphone-nebula-x1-1.webp'), P('smartphone-nebula-x1-2.webp'), P('smartphone-nebula-x1-3.webp')],
    opciones: [{ nombre: 'Almacenamiento', valores: ['128 GB', '256 GB'] }],
    variantes: [
      { valores: ['128 GB'], precio: 899999, stock: 12, sku: 'NB-X1-128' },
      { valores: ['256 GB'], precio: 1049999, stock: 8, sku: 'NB-X1-256' },
    ],
  },
  {
    clave: 'cargador', nombre: 'Cargador rápido GaN 65 W', categoria: 'celulares', popularidad: 8,
    descripcion: 'Cargador de tecnología GaN con dos USB-C y un USB-A: carga una notebook y el celular al mismo tiempo. La mitad de tamaño que uno común.',
    precio: 39999, costo: 18000, etiquetas: ['Home office'],
    specs: [
      { label: 'Potencia', value: '65 W máximo' },
      { label: 'Puertos', value: '2 × USB-C + 1 × USB-A' },
      { label: 'Compatibilidad', value: 'Celulares, tablets y notebooks USB-C' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('cargador-rapido-65-w-1.webp')], stock: 64,
  },
  {
    clave: 'powerbank', nombre: 'Batería portátil 20.000 mAh', categoria: 'celulares', popularidad: 7,
    descripcion: 'Batería externa de 20.000 mAh con cuatro salidas y carga rápida de 22,5 W. Carga un celular hasta cuatro veces.',
    precio: 49999, precioAnterior: 64999, costo: 23000, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Capacidad', value: '20.000 mAh' },
      { label: 'Salidas', value: '1 × USB-C + 3 × USB-A' },
      { label: 'Carga rápida', value: '22,5 W' },
      { label: 'Garantía', value: '6 meses' },
    ],
    fotos: [P('bateria-portatil-20-000-mah-1.webp'), P('bateria-portatil-20-000-mah-2.webp')], stock: 39,
  },
  {
    clave: 'soporte-auto', nombre: 'Soporte magnético para auto', categoria: 'celulares', popularidad: 5,
    descripcion: 'Soporte imantado para la rejilla del aire: el celular se engancha con una mano y gira 360°. Incluye placas metálicas adhesivas.',
    precio: 19999, costo: 7000, etiquetas: [],
    specs: [
      { label: 'Montaje', value: 'Rejilla de ventilación' },
      { label: 'Rotación', value: '360°' },
      { label: 'Compatibilidad', value: 'Celulares de hasta 7"' },
    ],
    fotos: [P('soporte-magnetico-para-auto-1.webp'), P('soporte-magnetico-para-auto-2.webp')], stock: 55,
  },

  // ── Computación ───────────────────────────────────────────────────────────
  {
    clave: 'notebook', nombre: 'Notebook Nébula Book 14', categoria: 'computacion', destacado: true, popularidad: 3,
    descripcion: 'Notebook de 14" con cuerpo de aluminio, pantalla 2.8K y hasta 18 horas de batería. Pesa 1,3 kg: pensada para trabajar desde cualquier lado.',
    precio: 1499999, costo: 1080000, etiquetas: ['Home office', 'Nuevo'],
    specs: [
      { label: 'Pantalla', value: '14" 2.8K, 90 Hz' },
      { label: 'Procesador', value: '8 núcleos, 4,4 GHz' },
      { label: 'Almacenamiento', value: 'SSD de 512 GB' },
      { label: 'Batería', value: 'Hasta 18 h' },
      { label: 'Peso', value: '1,3 kg' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('notebook-14-1.webp'), P('notebook-14-2.webp')],
    opciones: [{ nombre: 'Memoria RAM', valores: ['16 GB', '32 GB'] }],
    variantes: [
      { valores: ['16 GB'], precio: 1499999, stock: 7, sku: 'NB-BOOK14-16' },
      { valores: ['32 GB'], precio: 1799999, stock: 4, sku: 'NB-BOOK14-32' },
    ],
  },
  {
    clave: 'monitor', nombre: 'Monitor 27" 4K Nébula View', categoria: 'computacion', popularidad: 3,
    descripcion: 'Monitor IPS de 27" en 4K con colores calibrados de fábrica y USB-C con carga de 65 W: un solo cable para la notebook.',
    precio: 549999, precioAnterior: 629999, costo: 360000, etiquetas: ['Home office'],
    specs: [
      { label: 'Panel', value: 'IPS 27" 3840 × 2160' },
      { label: 'Frecuencia', value: '60 Hz' },
      { label: 'Conexiones', value: 'USB-C 65 W, HDMI 2.0, DisplayPort' },
      { label: 'Color', value: '99 % sRGB, calibrado de fábrica' },
      { label: 'Garantía', value: '24 meses' },
    ],
    fotos: [P('monitor-27-4k-1.webp'), P('monitor-27-4k-2.webp')], stock: 9,
  },
  {
    clave: 'teclado', nombre: 'Teclado mecánico Nébula Keys 75', categoria: 'computacion', destacado: true, popularidad: 8,
    descripcion: 'Teclado mecánico compacto 75 % con switches intercambiables en caliente, perilla de volumen y conexión triple: cable, bluetooth y 2.4 GHz.',
    precio: 139999, costo: 71000, etiquetas: ['Gaming', 'Home office', 'Más vendido'],
    specs: [
      { label: 'Formato', value: '75 % (84 teclas)' },
      { label: 'Conexión', value: 'USB-C, Bluetooth y 2.4 GHz' },
      { label: 'Switches', value: 'Intercambiables en caliente' },
      { label: 'Batería', value: '4000 mAh' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('teclado-mecanico-1.webp'), P('teclado-mecanico-2.webp')],
    opciones: [{ nombre: 'Switch', valores: ['Rojo (lineal)', 'Marrón (táctil)'] }],
    variantes: [
      { valores: ['Rojo (lineal)'], precio: 139999, stock: 18, sku: 'NB-KEYS75-RED' },
      { valores: ['Marrón (táctil)'], precio: 139999, stock: 13, sku: 'NB-KEYS75-BRN' },
    ],
    video: 'videos/ficha-teclado.mp4',
  },
  {
    clave: 'mouse', nombre: 'Mouse ergonómico inalámbrico', categoria: 'computacion', popularidad: 7,
    descripcion: 'Mouse vertical que mantiene la muñeca en posición natural. Sensor de 4000 DPI, recargable por USB-C y silencioso.',
    precio: 59999, costo: 27000, etiquetas: ['Home office', 'Inalámbrico'],
    specs: [
      { label: 'Sensor', value: 'Óptico, hasta 4000 DPI' },
      { label: 'Conexión', value: 'Bluetooth y receptor USB' },
      { label: 'Batería', value: 'Recargable, hasta 70 días' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('mouse-ergonomico-inalambrico-1.webp'), P('mouse-ergonomico-inalambrico-2.webp')], stock: 31,
  },
  {
    clave: 'hub', nombre: 'Hub USB-C 8 en 1', categoria: 'computacion', popularidad: 6,
    descripcion: 'Todos los puertos que le faltan a tu notebook en un solo adaptador: HDMI 4K, Ethernet, lector de tarjetas y carga de 100 W.',
    precio: 44999, costo: 19000, etiquetas: ['Home office'],
    specs: [
      { label: 'Puertos', value: 'HDMI 4K, 3 × USB-A, USB-C PD 100 W, Ethernet, SD y microSD' },
      { label: 'Compatibilidad', value: 'Notebooks y tablets con USB-C' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('hub-usb-c-8-en-1-1.webp'), P('hub-usb-c-8-en-1-2.webp')], stock: 42,
  },
  {
    clave: 'drone', nombre: 'Drone plegable Nébula Sky 4K', categoria: 'computacion', destacado: true, popularidad: 2,
    descripcion: 'Drone plegable con cámara 4K estabilizada, 34 minutos de vuelo y regreso automático. El combo incluye control, tres baterías y bolso.',
    precio: 1299999, costo: 920000, etiquetas: ['Nuevo', 'Ideal para regalar'],
    specs: [
      { label: 'Cámara', value: '4K 30 fps, gimbal de 3 ejes' },
      { label: 'Autonomía', value: 'Hasta 34 min por batería' },
      { label: 'Alcance', value: 'Hasta 10 km' },
      { label: 'Incluye', value: 'Control, 3 baterías, bolso y hélices de repuesto' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('drone-plegable-con-camara-4k-1.webp'), P('drone-plegable-con-camara-4k-2.webp')], stock: 2, stockMinimo: 3,
    bloques: [
      { video: 'videos/home-video-principal.mp4', eyebrow: 'Estabilización de 3 ejes', titulo: 'Tomas limpias, aunque sople viento', texto: 'El gimbal compensa cada movimiento y la cámara graba en 4K sin temblores.' },
      { video: 'videos/bloque-drone-cielo.mp4', eyebrow: '34 minutos de vuelo', titulo: 'Más tiempo en el aire', texto: 'Una batería alcanza para recorrer, encuadrar y volver con margen. Con las tres que vienen en la caja, tenés la tarde entera.' },
      { video: 'videos/bloque-drone-estable.mp4', eyebrow: 'Vuelo en el lugar', titulo: 'Quieto como en un trípode', texto: 'Los sensores lo mantienen fijo en el aire para fotos nítidas y timelapses sin mover el encuadre.' },
    ],
  },

  // ── Gaming ────────────────────────────────────────────────────────────────
  {
    clave: 'joystick', nombre: 'Joystick inalámbrico Nébula Pad', categoria: 'gaming', destacado: true, popularidad: 7,
    descripcion: 'Joystick inalámbrico compatible con PC, celulares y consolas. Gatillos con vibración, 20 horas de batería y botones traseros programables.',
    precio: 74999, costo: 36000, etiquetas: ['Gaming', 'Inalámbrico', 'Ideal para regalar'],
    specs: [
      { label: 'Compatibilidad', value: 'PC, Android, iOS y consolas' },
      { label: 'Conexión', value: 'Bluetooth y USB-C' },
      { label: 'Batería', value: 'Hasta 20 h' },
      { label: 'Extras', value: '2 botones traseros programables' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('joystick-inalambrico-1.webp'), P('joystick-inalambrico-2.webp')],
    opciones: [{ nombre: 'Color', valores: ['Lavanda', 'Blanco'], visual: true }],
    fotosPorValor: { Lavanda: [0], Blanco: [1] },
    variantes: [
      { valores: ['Lavanda'], precio: 74999, stock: 15, sku: 'NB-PAD-LAV' },
      { valores: ['Blanco'], precio: 74999, stock: 22, sku: 'NB-PAD-WHT' },
    ],
    video: 'videos/ficha-joystick.mp4',
  },
  {
    clave: 'auris-gamer', nombre: 'Auriculares gamer Nébula Arena', categoria: 'gaming', popularidad: 5,
    descripcion: 'Auriculares gamer con sonido envolvente 7.1, micrófono desmontable con cancelación de ruido y luces personalizables.',
    precio: 89999, costo: 45000, etiquetas: ['Gaming'],
    specs: [
      { label: 'Sonido', value: 'Envolvente 7.1 virtual' },
      { label: 'Micrófono', value: 'Desmontable, con cancelación de ruido' },
      { label: 'Conexión', value: 'USB y jack 3,5 mm' },
      { label: 'Garantía', value: '12 meses' },
    ],
    // Agotado a propósito: muestra cómo se ve un producto sin stock.
    fotos: [P('auriculares-gamer-1.webp')], stock: 0,
  },
  {
    clave: 'mousepad', nombre: 'Mousepad XL con luces', categoria: 'gaming', popularidad: 6,
    descripcion: 'Mousepad de 90 × 40 cm con borde de luces RGB, base antideslizante y superficie de tela para máxima precisión.',
    precio: 29999, precioAnterior: 39999, costo: 12000, etiquetas: ['Gaming'],
    specs: [
      { label: 'Tamaño', value: '90 × 40 cm' },
      { label: 'Luces', value: 'RGB, 14 efectos' },
      { label: 'Base', value: 'Goma antideslizante' },
    ],
    fotos: [P('mousepad-xl-con-luces-1.webp')], stock: 36,
  },
  {
    clave: 'consola-retro', nombre: 'Consola retro portátil', categoria: 'gaming', popularidad: 6,
    descripcion: 'Consola portátil con pantalla IPS de 3,5" y miles de clásicos para jugar donde quieras. Batería de 5 horas y salida a TV.',
    precio: 99999, costo: 52000, etiquetas: ['Gaming', 'Ideal para regalar', 'Nuevo'],
    specs: [
      { label: 'Pantalla', value: 'IPS 3,5"' },
      { label: 'Batería', value: 'Hasta 5 h' },
      { label: 'Salida', value: 'HDMI a TV' },
      { label: 'Garantía', value: '6 meses' },
    ],
    fotos: [P('consola-retro-portatil-1.webp'), P('consola-retro-portatil-2.webp')], stock: 19,
  },

  // ── Hogar inteligente ──────────────────────────────────────────────────────
  {
    clave: 'lampara', nombre: 'Lámpara LED inteligente', categoria: 'hogar', popularidad: 7,
    descripcion: 'Lámpara LED Wi-Fi con 16 millones de colores y blancos regulables. La manejás desde el celular o con la voz, y programás rutinas.',
    precio: 24999, costo: 9500, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Potencia', value: '9 W (equivale a 60 W)' },
      { label: 'Rosca', value: 'E27' },
      { label: 'Conexión', value: 'Wi-Fi 2.4 GHz, sin hub' },
      { label: 'Compatibilidad', value: 'Asistentes de voz' },
    ],
    fotos: [P('lampara-led-inteligente-1.webp'), P('lampara-led-inteligente-2.webp')],
    opciones: [{ nombre: 'Pack', valores: ['1 unidad', '3 unidades'] }],
    variantes: [
      { valores: ['1 unidad'], precio: 24999, stock: 70, sku: 'NB-LUZ-1' },
      { valores: ['3 unidades'], precio: 64999, stock: 25, sku: 'NB-LUZ-3' },
    ],
  },
  {
    clave: 'camara', nombre: 'Cámara de seguridad Wi-Fi 360°', categoria: 'hogar', popularidad: 6,
    descripcion: 'Cámara de interior con giro de 360°, visión nocturna y detección de movimiento. Hablá y escuchá desde el celular.',
    precio: 54999, costo: 26000, etiquetas: [],
    specs: [
      { label: 'Resolución', value: '2K' },
      { label: 'Visión nocturna', value: 'Hasta 10 m' },
      { label: 'Audio', value: 'Bidireccional' },
      { label: 'Almacenamiento', value: 'microSD o nube' },
    ],
    fotos: [P('camara-de-seguridad-wi-fi-1.webp'), P('camara-de-seguridad-wi-fi-2.webp')], stock: 24,
  },
  {
    clave: 'enchufe', nombre: 'Enchufe inteligente (pack × 2)', categoria: 'hogar', popularidad: 5,
    descripcion: 'Dos enchufes Wi-Fi para prender y apagar cualquier aparato desde el celular, con horarios y medición de consumo.',
    precio: 34999, costo: 14000, etiquetas: ['Home office'],
    specs: [
      { label: 'Carga máxima', value: '16 A' },
      { label: 'Conexión', value: 'Wi-Fi 2.4 GHz' },
      { label: 'Extras', value: 'Medición de consumo, temporizador' },
    ],
    fotos: [P('enchufe-inteligente-2-1.webp'), P('enchufe-inteligente-2-2.webp')], stock: 33,
  },
  {
    clave: 'parlante-asistente', nombre: 'Parlante inteligente con asistente', categoria: 'hogar', popularidad: 4,
    descripcion: 'Parlante con asistente de voz: música, alarmas y control de tus dispositivos inteligentes, todo sin tocar el celular.',
    precio: 129999, costo: 70000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Sonido', value: 'Woofer de 3" y 2 tweeters' },
      { label: 'Conexión', value: 'Wi-Fi y Bluetooth' },
      { label: 'Micrófonos', value: '4, de campo lejano' },
    ],
    fotos: [P('parlante-con-asistente-de-voz-1.webp'), P('parlante-con-asistente-de-voz-2.webp')], stock: 3, stockMinimo: 5,
  },

  // ── Wearables ──────────────────────────────────────────────────────────────
  {
    clave: 'smartwatch', nombre: 'Smartwatch Nébula Watch', categoria: 'wearables', destacado: true, popularidad: 9,
    descripcion: 'Reloj inteligente con pantalla AMOLED siempre encendida, GPS, medición de pulso y oxígeno, y 7 días de batería. Resistente al agua hasta 50 m.',
    precio: 249999, costo: 139000, etiquetas: ['Más vendido', 'Ideal para regalar'],
    specs: [
      { label: 'Pantalla', value: 'AMOLED 1,9", siempre encendida' },
      { label: 'Batería', value: 'Hasta 7 días' },
      { label: 'Sensores', value: 'Pulso, oxígeno en sangre, GPS' },
      { label: 'Resistencia', value: '5 ATM (50 m)' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('smartwatch-1.webp'), P('smartwatch-2.webp'), P('smartwatch-3.webp')],
    opciones: [{ nombre: 'Malla', valores: ['Negra', 'Blanca'], visual: true }],
    fotosPorValor: { Negra: [0, 2], Blanca: [1] },
    variantes: [
      { valores: ['Negra'], precio: 249999, stock: 17, sku: 'NB-WATCH-BLK' },
      { valores: ['Blanca'], precio: 249999, stock: 11, sku: 'NB-WATCH-WHT' },
    ],
    video: 'videos/ficha-del-smartwatch.mp4',
  },
  {
    clave: 'pulsera', nombre: 'Pulsera fitness Nébula Band', categoria: 'wearables', popularidad: 7,
    descripcion: 'Pulsera de actividad con pantalla a color, 14 días de batería y más de 100 modos de entrenamiento. Mide sueño, pulso y pasos.',
    precio: 44999, precioAnterior: 59999, costo: 19000, etiquetas: ['Ideal para regalar'],
    specs: [
      { label: 'Pantalla', value: 'AMOLED 1,5" a color' },
      { label: 'Batería', value: 'Hasta 14 días' },
      { label: 'Resistencia', value: '5 ATM' },
      { label: 'Modos', value: 'Más de 100 deportes' },
    ],
    fotos: [P('pulsera-fitness-1.webp'), P('pulsera-fitness-2.webp')], stock: 46,
  },

  // ── Segunda tanda (29/09): 13 más, para tres páginas completas de catálogo ──
  {
    clave: 'tocadiscos', nombre: 'Tocadiscos Bluetooth Nébula Vinyl', categoria: 'audio', destacado: true, popularidad: 5,
    descripcion: 'Tocadiscos de valija con parlantes incorporados y Bluetooth: escuchá tus vinilos o mandá el sonido a un parlante externo. Tres velocidades y salida RCA.',
    precio: 159999, costo: 86000, etiquetas: ['Nuevo', 'Ideal para regalar'],
    specs: [
      { label: 'Velocidades', value: '33, 45 y 78 RPM' },
      { label: 'Parlantes', value: 'Estéreo incorporados' },
      { label: 'Conectividad', value: 'Bluetooth 5.0, salida RCA y auriculares' },
      { label: 'Formato', value: 'Valija portátil' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('tocadiscos-bluetooth-nebula-vinyl-1.webp'), P('tocadiscos-bluetooth-nebula-vinyl-2.webp')],
    opciones: [{ nombre: 'Color', valores: ['Blanco', 'Negro'], visual: true }],
    fotosPorValor: { Blanco: [0], Negro: [1] },
    variantes: [
      { valores: ['Blanco'], precio: 159999, stock: 9, sku: 'NB-VINYL-WHT' },
      { valores: ['Negro'], precio: 159999, stock: 6, sku: 'NB-VINYL-BLK' },
    ],
    video: 'videos/ficha-tocadiscos.mp4',
  },
  {
    clave: 'auris-estudio', nombre: 'Auriculares de estudio Nébula Studio', categoria: 'audio', popularidad: 4,
    descripcion: 'Auriculares cerrados de monitoreo para grabar, mezclar o jugar: respuesta plana, cable desmontable y almohadillas que aíslan del ruido.',
    precio: 99999, costo: 52000, etiquetas: ['Home office'],
    specs: [
      { label: 'Tipo', value: 'Cerrados, over-ear' },
      { label: 'Respuesta', value: '15 Hz – 28 kHz' },
      { label: 'Impedancia', value: '32 Ω' },
      { label: 'Cable', value: 'Desmontable, 3 m' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('auriculares-de-estudio-nebula-studio-1.webp'), P('auriculares-de-estudio-nebula-studio-2.webp')], stock: 14,
  },
  {
    clave: 'cargador-inalambrico', nombre: 'Cargador inalámbrico 15 W', categoria: 'celulares', popularidad: 7,
    descripcion: 'Base de carga inalámbrica de 15 W: apoyás el celular y carga, con o sin funda. Luz de estado suave que no molesta de noche.',
    precio: 29999, precioAnterior: 39999, costo: 12500, etiquetas: ['Inalámbrico', 'Envío en 24 h'],
    specs: [
      { label: 'Potencia', value: 'Hasta 15 W' },
      { label: 'Compatibilidad', value: 'Celulares con carga Qi' },
      { label: 'Funda', value: 'Carga a través de fundas de hasta 5 mm' },
      { label: 'Conexión', value: 'USB-C (cable incluido)' },
    ],
    fotos: [P('cargador-inalambrico-15-w-1.webp')], stock: 38,
  },
  {
    clave: 'funda', nombre: 'Funda de silicona para celular', categoria: 'celulares', popularidad: 8,
    descripcion: 'Funda de silicona suave al tacto, con interior de microfibra y bordes elevados que protegen la cámara y la pantalla.',
    precio: 14999, costo: 4500, etiquetas: ['Envío en 24 h'],
    specs: [
      { label: 'Material', value: 'Silicona con interior de microfibra' },
      { label: 'Protección', value: 'Bordes elevados en cámara y pantalla' },
      { label: 'Carga inalámbrica', value: 'Compatible' },
    ],
    fotos: [P('funda-de-silicona-1.webp'), P('funda-de-silicona-2.webp')],
    opciones: [{ nombre: 'Color', valores: ['Rojo', 'Amarillo'], visual: true }],
    fotosPorValor: { Rojo: [0], Amarillo: [1] },
    variantes: [
      { valores: ['Rojo'], precio: 14999, stock: 40, sku: 'NB-FUNDA-RED' },
      { valores: ['Amarillo'], precio: 14999, stock: 25, sku: 'NB-FUNDA-YEL' },
    ],
  },
  {
    clave: 'tablet', nombre: 'Tablet Nébula Tab 11"', categoria: 'computacion', destacado: true, popularidad: 3,
    descripcion: 'Pantalla de 11" 2K para ver series, estudiar o dibujar con lápiz. Batería para todo el día y parlantes cuádruples.',
    precio: 449999, costo: 298000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'Pantalla', value: '11" 2K, 90 Hz' },
      { label: 'Memoria', value: '8 GB RAM + 128 GB' },
      { label: 'Batería', value: '8000 mAh, hasta 12 h' },
      { label: 'Audio', value: 'Cuatro parlantes' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('tablet-nebula-tab-11-1.webp')], stock: 11,
  },
  {
    clave: 'ssd', nombre: 'Disco SSD externo 1 TB', categoria: 'computacion', popularidad: 6,
    descripcion: 'Disco sólido externo de 1 TB, hasta 1050 MB/s por USB-C. Del tamaño de una tarjeta y resistente a golpes.',
    precio: 129999, costo: 71000, etiquetas: ['Home office'],
    specs: [
      { label: 'Capacidad', value: '1 TB' },
      { label: 'Velocidad', value: 'Hasta 1050 MB/s' },
      { label: 'Conexión', value: 'USB-C 3.2 (cables C y A incluidos)' },
      { label: 'Resistencia', value: 'Caídas de hasta 2 m' },
      { label: 'Garantía', value: '36 meses' },
    ],
    fotos: [P('disco-ssd-externo-1-tb-1.webp'), P('disco-ssd-externo-1-tb-2.webp')], stock: 19,
  },
  {
    clave: 'soporte-notebook', nombre: 'Soporte de aluminio para notebook', categoria: 'computacion', popularidad: 6,
    descripcion: 'Eleva la pantalla a la altura de los ojos y mejora la postura. Aluminio macizo, altura regulable y base que ventila la notebook.',
    precio: 39999, costo: 17000, etiquetas: ['Home office'],
    specs: [
      { label: 'Material', value: 'Aluminio' },
      { label: 'Compatibilidad', value: 'Notebooks de 10" a 17"' },
      { label: 'Altura', value: 'Regulable, 6 posiciones' },
    ],
    fotos: [P('soporte-de-aluminio-para-notebook-1.webp'), P('soporte-de-aluminio-para-notebook-2.webp')], stock: 22,
  },
  {
    clave: 'silla-gamer', nombre: 'Silla gamer Nébula Throne', categoria: 'gaming', destacado: true, popularidad: 4,
    descripcion: 'Silla ergonómica con almohadones lumbar y cervical, respaldo reclinable hasta 155° y apoyabrazos regulables.',
    precio: 279999, precioAnterior: 339999, costo: 170000, etiquetas: ['Gaming', 'Home office'],
    specs: [
      { label: 'Reclinable', value: 'Hasta 155°' },
      { label: 'Apoyabrazos', value: 'Regulables en altura' },
      { label: 'Soporta', value: 'Hasta 130 kg' },
      { label: 'Tapizado', value: 'Cuero sintético' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('silla-gamer-nebula-throne-1.webp')], stock: 7,
  },
  {
    clave: 'monitor-curvo', nombre: 'Monitor curvo 34" Nébula Arc', categoria: 'gaming', popularidad: 2,
    descripcion: 'Ultrawide curvo de 34" a 165 Hz: más campo de visión para jugar y dos ventanas lado a lado para trabajar.',
    precio: 749999, costo: 505000, etiquetas: ['Gaming', 'Home office'],
    specs: [
      { label: 'Pantalla', value: '34" WQHD 3440 × 1440, curva 1500R' },
      { label: 'Frecuencia', value: '165 Hz, 1 ms' },
      { label: 'Conexiones', value: '2 HDMI, DisplayPort, USB-C' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('monitor-curvo-34-gamer-1.webp'), P('monitor-curvo-34-gamer-2.webp')], stock: 5,
  },
  {
    clave: 'robot-aspiradora', nombre: 'Robot aspiradora Nébula Clean', categoria: 'hogar', destacado: true, popularidad: 4,
    descripcion: 'Aspira y trapea solo, con mapeo láser de la casa. Lo programás desde la app y vuelve a cargarse cuando termina.',
    precio: 389999, costo: 245000, etiquetas: ['Nuevo', 'Inalámbrico'],
    specs: [
      { label: 'Navegación', value: 'Mapeo láser (LiDAR)' },
      { label: 'Succión', value: '4000 Pa' },
      { label: 'Funciones', value: 'Aspira y trapea' },
      { label: 'Batería', value: 'Hasta 150 min' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('robot-aspiradora-nebula-clean-1.webp'), P('robot-aspiradora-nebula-clean-2.webp')], stock: 9,
    video: 'videos/ficha-robot-aspiradora.mp4',
    bloques: [
      { video: 'videos/bloque-robot-alfombras.mp4', eyebrow: 'Detecta alfombras', titulo: 'Sube la potencia donde hace falta', texto: 'Reconoce las alfombras y aspira más fuerte, sin mojarlas cuando está trapeando.' },
      { video: 'videos/bloque-robot-bordes.mp4', eyebrow: 'Bordes y rincones', titulo: 'Llega hasta el zócalo', texto: 'El cepillo lateral barre contra las paredes y el perfil bajo lo deja pasar por debajo de los muebles.' },
      { video: 'videos/bloque-robot-casa.mp4', eyebrow: 'Mapeo láser', titulo: 'Conoce toda tu casa', texto: 'Arma el mapa en la primera pasada: después elegís qué ambientes limpia y a qué hora, desde la app.' },
    ],
  },
  {
    clave: 'tira-led', nombre: 'Tira LED RGB 5 m', categoria: 'hogar', popularidad: 7,
    descripcion: 'Tira de luces RGB de 5 metros, autoadhesiva y cortable. Millones de colores, efectos que siguen la música y control desde el celular.',
    precio: 24999, precioAnterior: 32999, costo: 9000, etiquetas: ['Gaming', 'Ideal para regalar'],
    specs: [
      { label: 'Largo', value: '5 m, cortable cada 10 cm' },
      { label: 'Colores', value: 'RGB, 16 millones' },
      { label: 'Control', value: 'App, control remoto y voz' },
    ],
    fotos: [P('tira-led-rgb-5-m-1.webp'), P('tira-led-rgb-5-m-2.webp')], stock: 55,
  },
  {
    clave: 'smartwatch-gps', nombre: 'Smartwatch deportivo Nébula Run GPS', categoria: 'wearables', popularidad: 5,
    descripcion: 'Reloj para correr con GPS propio: medí ritmo, distancia y recorrido sin llevar el celular. Hasta 10 días de batería.',
    precio: 239999, costo: 150000, etiquetas: ['Nuevo'],
    specs: [
      { label: 'GPS', value: 'Integrado, multibanda' },
      { label: 'Batería', value: 'Hasta 10 días (20 h con GPS)' },
      { label: 'Resistencia', value: '5 ATM' },
      { label: 'Sensores', value: 'Pulso, oxígeno en sangre, altímetro' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('smartwatch-deportivo-con-gps-1.webp'), P('smartwatch-deportivo-con-gps-2.webp')], stock: 13,
  },
  {
    clave: 'visor-vr', nombre: 'Visor de realidad virtual Nébula VR', categoria: 'wearables', popularidad: 3,
    descripcion: 'Visor de realidad virtual con seguimiento de movimiento y dos controles. Juegos, videos 360° y ejercicios, todo inmersivo.',
    precio: 519999, costo: 350000, etiquetas: ['Gaming', 'Nuevo'],
    specs: [
      { label: 'Resolución', value: '1832 × 1920 por ojo' },
      { label: 'Frecuencia', value: '90 Hz' },
      { label: 'Controles', value: 'Dos, con seguimiento' },
      { label: 'Batería', value: 'Hasta 3 h' },
      { label: 'Garantía', value: '12 meses' },
    ],
    fotos: [P('visor-de-realidad-virtual-1.webp'), P('visor-de-realidad-virtual-2.webp')], stock: 6,
    video: 'videos/ficha-visor-vr.mp4',
  },
];

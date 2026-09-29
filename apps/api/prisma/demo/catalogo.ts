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
      { video: 'videos/vertical-formato-reels.mp4', eyebrow: 'Listo para redes', titulo: 'Grabá en vertical', texto: 'Cambiá a formato vertical con un toque y subí tus videos directo a reels.' },
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
];

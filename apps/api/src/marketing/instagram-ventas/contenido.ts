// Lo que dice el bot de ventas de Órbita en Instagram (Superadmin → Marketing → Instagram → Respuestas automáticas).
//
// Todo sale de lo que ya dice la web de Órbita: las preguntas frecuentes de la portada (Cierre.tsx), las prestaciones
// de los planes (planesDatos.ts) y los precios vigentes de la API. Un test (instagram-ventas.unit-spec.ts) compara las
// preguntas frecuentes con la web: si cambian allá, este archivo tiene que cambiar también, porque es lo único que la IA
// sabe de Órbita.
//
// Límites de Instagram (verificados en la documentación de Meta, 24/11/2026):
// - respuestas rápidas: hasta 13, título de hasta 20 caracteres;
// - tarjetas (generic template): hasta 10, título y subtítulo de hasta 80 caracteres, hasta 3 botones (web_url o postback);
// - preguntas frecuentes (ice breakers): hasta 4;
// - texto: hasta 1000 bytes.
// Las tarjetas, los botones y las preguntas frecuentes NO se ven desde la computadora: cada mensaje lleva en el texto
// lo necesario para seguir sin ellos.

export const OPCION = {
  COMO: 'ORB_COMO',
  PRECIOS: 'ORB_PRECIOS',
  DEMO: 'ORB_DEMO',
  EMPEZAR: 'ORB_EMPEZAR',
  PERSONA: 'ORB_PERSONA',
} as const;
export type Opcion = (typeof OPCION)[keyof typeof OPCION];
export const OPCIONES: readonly string[] = Object.values(OPCION);

export interface Boton {
  titulo: string;
  /** Una opción del bot (vuelve como postback) o una dirección que se abre en el navegador. */
  opcion?: Opcion;
  url?: string;
}
export interface Tarjeta {
  titulo: string;
  subtitulo: string;
  imagen: string;
  botones: Boton[];
}
export type Pieza = { texto: string } | { tarjetas: Tarjeta[] };
export interface Respuesta {
  piezas: Pieza[];
  /** Botones al pie de la última pieza (respuestas rápidas). */
  siguientes: Opcion[];
  /** Pidió una persona: el bot se calla en la charla y avisa al equipo. */
  derivar?: boolean;
}

export const TITULO_OPCION: Record<Opcion, string> = {
  ORB_COMO: 'Cómo funciona',
  ORB_PRECIOS: 'Precios',
  ORB_DEMO: 'Ver la demo',
  ORB_EMPEZAR: 'Empezar ahora',
  ORB_PERSONA: 'Hablar con alguien',
};

/** Las cuatro preguntas frecuentes que Instagram muestra al abrir el chat por primera vez. */
export const PREGUNTAS_FRECUENTES: { pregunta: string; opcion: Opcion }[] = [
  { pregunta: '¿Qué es Órbita?', opcion: OPCION.COMO },
  { pregunta: '¿Cuánto cuesta?', opcion: OPCION.PRECIOS },
  { pregunta: 'Quiero ver una demo', opcion: OPCION.DEMO },
  { pregunta: 'Quiero hablar con alguien', opcion: OPCION.PERSONA },
];

export const MENU: Opcion[] = [OPCION.COMO, OPCION.PRECIOS, OPCION.DEMO, OPCION.PERSONA];

// Cómo escribe el bot (pedido del equipo, 25/11/2026): como una persona por chat. Mensajes cortos, de a uno, con el
// "escribiendo…" entre uno y otro (cada texto de `piezas` es un mensaje aparte), sin tirar toda la información junta, y
// ofreciendo antes de mandar: "¿Querés ver una tienda de ejemplo?" en vez de pegar los links de la demo.

// Instagram deja UN solo mensaje privado por comentario: este va en uno, corto y con las opciones.
export const SALUDO_COMENTARIO_POR_DEFECTO =
  '¡Hola! Te escribo por tu comentario. ¿Querés que te cuente cómo funciona Órbita, los precios o ver una tienda de ejemplo?';
export const RESPUESTAS_PUBLICAS_POR_DEFECTO = ['¡Te escribimos por privado!', '¡Listo, te mandamos un mensaje!', 'Te contamos todo por mensaje privado.'];
export const PALABRAS_CLAVE_POR_DEFECTO = ['info', 'precio', 'precios', 'quiero', 'cuanto', 'costo', 'me interesa'];

/** El saludo: dos mensajes cortos. El último lleva el menú (y lo dice en el texto, para la computadora). */
export const SALUDO = '¡Hola! Gracias por escribirnos.';
export const BIENVENIDA = '¿Querés vender online? Contame qué vendés, o elegí: cómo funciona, precios, la demo o hablar con alguien.';

/**
 * La pregunta con la que el bot ofrece la demo. Si la persona contesta que sí ("dale", "sí"), le llega la demo: por eso la
 * IA la tiene que usar tal cual (está en el prompt).
 */
export const OFRECE_DEMO = '¿Querés ver una tienda de ejemplo?';

export const AVISA_AL_DERIVAR = 'Listo, le aviso al equipo y te responden por acá.';
export const PIDE_DATOS_AL_DERIVAR = '¿Qué vendés y más o menos cuántos productos tenés? Así llegamos con la respuesta.';

export interface Enlaces {
  sitio: string;
  alta: string;
  planes: string;
  demoTienda: string;
  demoPanel: string;
  imagen: (archivo: string) => string;
}

/** Las direcciones salen del sitio público de Órbita; el alta lleva el origen para medir lo que sale del chat. */
export function enlacesDe(sitio: string): Enlaces {
  const base = sitio.replace(/\/+$/, '');
  let dominio = 'orbita.site';
  try {
    dominio = new URL(base).hostname.replace(/^www\./, '');
  } catch {
    /* queda el de producción */
  }
  const protocolo = base.startsWith('http://') ? 'http' : 'https';
  return {
    sitio: base,
    alta: `${base}/onboarding/rubro?utm_source=instagram&utm_medium=dm&utm_campaign=bot`,
    planes: `${base}/planes`,
    demoTienda: `${protocolo}://demo-moda.${dominio}/`,
    demoPanel: `${protocolo}://demo.${dominio}/panel`,
    imagen: (archivo) => `${base}/instagram-bot/${archivo}`,
  };
}

export interface Precios {
  base: number;
  avanzado: number;
  /** Promo vigente de la web, si hay. */
  campania: { base: number; avanzado: number; meses: number } | null;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

export function respuestaDe(opcion: Opcion, e: Enlaces, p: Precios): Respuesta {
  switch (opcion) {
    case OPCION.COMO:
      return {
        piezas: [
          { texto: 'Órbita es tu tienda online con panel propio: catálogo, stock y pedidos en un solo lugar.' },
          { texto: 'La armás en minutos eligiendo tu rubro, cobrás con tu Mercado Pago y no te cobramos comisión por venta.' },
          { texto: OFRECE_DEMO },
        ],
        siguientes: [OPCION.DEMO, OPCION.PRECIOS, OPCION.PERSONA],
      };
    case OPCION.PRECIOS: {
      const c = p.campania;
      const lista = c
        ? `Base: ${pesos(c.base)} por mes los primeros ${c.meses} ${c.meses === 1 ? 'mes' : 'meses'} (después ${pesos(p.base)}).\nCon el paquete Avanzado: ${pesos(c.avanzado)} (después ${pesos(p.avanzado)}).`
        : `Base: ${pesos(p.base)} por mes.\nCon el paquete Avanzado (juegos, anuncios, plantillas y más): ${pesos(p.avanzado)} por mes.`;
      return {
        piezas: [
          { texto: 'Es un solo panel con todo incluido y sin comisión por venta.' },
          { texto: lista },
          { texto: `Sin permanencia: cancelás cuando quieras. ${OFRECE_DEMO}` },
        ],
        siguientes: [OPCION.DEMO, OPCION.EMPEZAR, OPCION.PERSONA],
      };
    }
    case OPCION.DEMO:
      return {
        piezas: [
          { texto: '¡Dale! Podés recorrer una tienda y su panel sin crear cuenta.' },
          {
            tarjetas: [
              { titulo: 'Tienda de ejemplo', subtitulo: 'Navegá, armá un carrito y mirá el checkout como lo vería tu cliente.', imagen: e.imagen('tienda.jpg'), botones: [{ titulo: 'Abrir la tienda', url: e.demoTienda }] },
              { titulo: 'Panel de ejemplo', subtitulo: 'Cargá un producto, mirá los pedidos y los reportes.', imagen: e.imagen('panel.png'), botones: [{ titulo: 'Abrir el panel', url: e.demoPanel }] },
            ],
          },
          // En la computadora no se ven las tarjetas: los links van también en el texto.
          { texto: `Tienda: ${e.demoTienda}\nPanel: ${e.demoPanel}` },
          { texto: 'Cuando la recorras, contame qué te pareció.' },
        ],
        siguientes: [OPCION.PRECIOS, OPCION.EMPEZAR, OPCION.PERSONA],
      };
    case OPCION.EMPEZAR:
      return {
        piezas: [
          { texto: '¡Buenísimo! Creás tu cuenta acá, te lleva unos minutos:' },
          { texto: e.alta },
          { texto: 'Si te trabás en algún paso, escribime por acá.' },
        ],
        siguientes: [OPCION.PERSONA],
      };
    case OPCION.PERSONA:
      return {
        piezas: [{ texto: AVISA_AL_DERIVAR }, { texto: PIDE_DATOS_AL_DERIVAR }],
        siguientes: [],
        derivar: true,
      };
  }
}

export const DERIVAR_SIN_RESPUESTA = 'Esa no la sé con seguridad, y prefiero no inventarte. Le paso tu pregunta al equipo y te responden por acá.';

/**
 * Después de derivar, el bot se calla. Pero si lo último que dijo fue una pregunta (o un "le paso tu pregunta") y la
 * persona contesta, quedarse mudo se lee como que nadie la leyó: agradece UNA vez y le pasa al equipo lo que contó.
 */
export const GRACIAS_AL_DERIVAR = '¡Gracias! Ya se lo pasé al equipo con lo que me contaste. Te responden por acá en cuanto puedan.';
export const ULTIMOS_DEL_BOT_AL_DERIVAR = [DERIVAR_SIN_RESPUESTA];

/**
 * Cuánto vale la pregunta de "¿qué vendés?" después de derivar. Pasado este plazo (o si el equipo todavía no contestó
 * y la persona vuelve a escribir), lo nuevo ya no es la respuesta a esa pregunta: el bot vuelve a atender.
 */
export const PLAZO_DERIVADO_MS = 2 * 3_600_000;

const PALABRAS_DE_SALUDO = new Set([
  'hola', 'holi', 'buenas', 'buen', 'buenos', 'dia', 'dias', 'tardes', 'noches', 'que', 'tal', 'como', 'estas', 'andas',
  'va', 'todo', 'bien', 'hey', 'ey', 'saludos', 'hi', 'hello',
]);

/** ¿El mensaje es solo un saludo ("Hola", "hola que tal", "buenas tardes!!")? No es la respuesta a una pregunta. */
export function esSaludo(texto: string): boolean {
  const palabras = normalizar(texto).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter(Boolean)
    .map((p) => p.replace(/(.)\1+$/, '$1'));
  return palabras.length > 0 && palabras.length <= 6 && palabras.every((p) => PALABRAS_DE_SALUDO.has(p));
}

const PALABRAS_DE_INFO = new Set([
  ...PALABRAS_DE_SALUDO, 'necesito', 'necesitaria', 'quiero', 'quisiera', 'queria', 'info', 'informacion', 'mas', 'me', 'das', 'pasas', 'pasan',
  'podes', 'podrias', 'pueden', 'dar', 'pasar', 'por', 'favor', 'porfa', 'una', 'consulta', 'consultar', 'sobre', 'orbita', 'de', 'la', 'el', 'y', 'mi', 'te',
]);

/**
 * ¿Pide información en general ("Hola necesito info", "quisiera más información por favor")? Sin una pregunta puntual:
 * va la presentación corta de Órbita (con la pregunta de la demo) en vez de que la IA conteste todo de una.
 */
export function esPedidoDeInfo(texto: string): boolean {
  const palabras = normalizar(texto).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter(Boolean).map((p) => p.replace(/(.)\1+$/, '$1'));
  return palabras.length > 0 && palabras.length <= 12 && palabras.some((p) => p === 'info' || p === 'informacion' || p === 'consulta')
    && palabras.every((p) => PALABRAS_DE_INFO.has(p));
}

/** ¿Contestó que sí ("dale", "sí, porfa", "obvio")? Se usa para la pregunta de la demo. */
export function esSi(texto: string): boolean {
  const t = normalizar(texto).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/(.)\1+/g, '$1');
  return /^(si|dale|ok|oka|okey|obvio|claro|bueno|de una|me encantaria|me interesa|si dale|dale si|si porfa|si por favor|si quiero|quiero|si me interesa|si claro|claro que si|porfa|mostrame|si mostrame)$/.test(t);
}

// ── Lo que la IA sabe de Órbita ──────────────────────────────────────────────
// Copiado de la web (ver el test). La IA responde solo con esto y, si no alcanza, deriva.

export const PREGUNTAS_DE_LA_WEB: { q: string; a: string }[] = [
  { q: '¿Necesito saber de tecnología?', a: 'No. Elegís tu rubro, cargás tus productos o servicios y tu tienda queda publicada. No hay nada que instalar ni servidores que configurar.' },
  { q: '¿Órbita se queda con una parte de mis ventas?', a: 'No. La comisión por venta es 0%: cobrás vos, en tu cuenta de Mercado Pago. Lo único que pagás es la suscripción del panel.' },
  { q: '¿Puedo usar mi propio dominio?', a: 'Sí. Podés conectar un dominio que ya tengas, sin importar dónde lo hayas comprado, o comprar uno nuevo desde el panel y queda vinculado solo.' },
  { q: '¿Y si doy turnos o tengo un gimnasio?', a: 'Hoy Órbita resuelve tiendas con productos y stock. Turnos y agenda (gimnasios incluido) es lo próximo que llega: cuando esté, tu cuenta lo va a tener sin que migres nada.' },
  { q: '¿Puedo vender productos con talles, números de serie o por peso?', a: 'Sí. Al elegir tu rubro, el panel se configura para eso: variantes por talle y color, control por número de serie o IMEI, o venta por metro, kilo y litro, según lo que vendas.' },
  { q: '¿Qué pasa si quiero dejarlo?', a: 'Cancelás cuando quieras desde tu panel, sin penalidad ni permanencia: se corta el débito y no se te vuelve a cobrar.' },
];

export const PRESTACIONES_DE_LA_WEB: string[] = [
  'Catálogo que entiende tu rubro: variantes por talle y color, número de serie o IMEI, o venta por metro, kilo y litro.',
  'Cobrás a tu manera: con tu Mercado Pago, por transferencia o coordinando el pago aparte con tu cliente.',
  'Tu dominio propio: comprá uno nuevo desde el panel, o conectá el que ya tenés sin importar dónde lo compraste.',
  'Pedidos de punta a punta: estados, historial y notas de crédito.',
  'Stock siempre al día: inventario por variante, alertas cuando queda poco y movimientos con su historial.',
  'Clientes, mensajes y equipo: quién te compra y cuánto, bandeja de conversaciones, y empleados con permisos por rol.',
  'Orbi, tu asistente con IA: te responde sobre tus ventas, tu stock y tus pedidos, y te ayuda a resolver cosas en el panel.',
  'Reportes que se entienden: ventas, productos, clientes, inventario y pagos.',
  'Descuentos y cupones con sus límites y vencimientos, aplicados solos en el carrito.',
  'Sin comisiones por venta: cobrás vos, en tu propia cuenta.',
  'Soporte prioritario por WhatsApp.',
  'Solo con el paquete Avanzado: plantillas de portada, modales de anuncios, juegos con premio, prueba social, 2x1 y 3x2, oferta relámpago y fotos sin fondo automáticas.',
];

export function promptDeVentas(e: Enlaces, p: Precios): string {
  const c = p.campania;
  const precios = c
    ? `Base: ${pesos(c.base)} por mes y Base + Avanzado: ${pesos(c.avanzado)} por mes, como precio promocional por ${c.meses} meses; después ${pesos(p.base)} y ${pesos(p.avanzado)}.`
    : `Base: ${pesos(p.base)} por mes. Base + Avanzado: ${pesos(p.avanzado)} por mes.`;
  return [
    'Sos el asistente de Órbita en Instagram. Órbita es una plataforma argentina para tener una tienda online con panel de administración, stock y pedidos, sin comisiones por venta.',
    'Respondés a personas que pueden querer usar Órbita para su negocio. Tu objetivo es ayudarlas a decidir y, si les sirve, que creen su cuenta.',
    '',
    'Reglas:',
    '- Respondé SOLO con la información de abajo. No inventes funciones, integraciones, plazos, descuentos ni precios.',
    '- Si la respuesta no está abajo, o te piden algo que solo puede resolver una persona (un caso puntual, un reclamo, una factura), respondé exactamente [DERIVAR] y nada más.',
    '- Español rioplatense, cálido y natural, como una persona del equipo que contesta por chat. Sin listas, sin asteriscos ni negritas, sin emojis.',
    '- Escribí corto: de 1 a 3 mensajes separados por una línea en blanco (cada parte le llega como un mensaje aparte), de una o dos oraciones cada uno.',
    '- Respondé solo lo que te preguntaron. No sueltes todo junto (funciones, precios y links a la vez): contá lo justo y dejá algo para después, que la persona quiera seguir preguntando.',
    '- Terminá con UNA pregunta corta que despierte curiosidad y lleve a probar Órbita (por ejemplo "¿Querés ver cómo queda una tienda de ropa?", "¿Te cuento cuánto sale?").',
    `- No pegues links si no los pidieron: ofrecé primero. Para ofrecer la demo usá exactamente esta pregunta: "${OFRECE_DEMO}". El link para crear la cuenta pasalo solo cuando la persona quiera empezar.`,
    '- No pidas datos personales (DNI, tarjeta, contraseñas).',
    '',
    `Precios vigentes: ${precios} No hay comisión por venta. El primer mes se paga al crear la cuenta.`,
    `Crear la cuenta: ${e.alta}`,
    `Comparar planes: ${e.planes}`,
    `Demo sin crear cuenta: tienda ${e.demoTienda} y panel ${e.demoPanel}`,
    '',
    'Qué incluye:',
    ...PRESTACIONES_DE_LA_WEB.map((x) => `- ${x}`),
    '',
    'Preguntas frecuentes:',
    ...PREGUNTAS_DE_LA_WEB.map((x) => `- ${x.q} ${x.a}`),
  ].join('\n');
}

/** Pasa a minúsculas y saca acentos, para comparar palabras clave sin depender de cómo se escribió. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** ¿El comentario tiene alguna de las palabras clave? Busca palabras enteras ("info" no dispara con "informal"). */
export function tienePalabraClave(comentario: string, palabras: string[]): boolean {
  const c = ` ${normalizar(comentario).replace(/[^a-z0-9ñ ]/g, ' ')} `.replace(/\s+/g, ' ');
  return palabras.some((p) => {
    const n = normalizar(p).replace(/[^a-z0-9ñ ]/g, ' ').trim();
    return !!n && c.includes(` ${n} `);
  });
}

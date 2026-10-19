// El menú de opciones que Orbi le manda al cliente por WhatsApp: qué opciones hay por defecto, cómo se validan las que
// edita el dueño, y cómo se arma el mensaje (lista, botones, o texto numerado si WhatsApp no deja mandar el interactivo).
// Sin dependencias de Nest: lo usan el bot y la configuración.

export type MenuEstilo = 'LISTA' | 'BOTONES';
export type Modalidad = 'CONVERSACIONAL' | 'MENU_Y_CONVERSACION' | 'SOLO_MENU';

export interface OpcionDeMenu {
  /** Las de fábrica: catalogo, pedidos, promos, envios, horarios, persona. Las del dueño: custom-<n>. */
  id: string;
  titulo: string;
  descripcion?: string;
  activa: boolean;
  /** Solo las del dueño (custom-*): el texto fijo con el que se contesta al elegirla. */
  respuesta?: string;
}

/** Límites de WhatsApp para los mensajes interactivos (y de Órbita para lo que escribe el dueño). */
export const LIMITES_MENU = {
  tituloLista: 24,
  tituloBoton: 20,
  descripcion: 72,
  bienvenida: 600,
  respuesta: 1000,
  opcionesLista: 10,
  opcionesBotones: 3,
} as const;

export const OPCIONES_DE_FABRICA = ['catalogo', 'pedidos', 'promos', 'envios', 'horarios', 'persona'] as const;

export const OPCIONES_POR_DEFECTO: OpcionDeMenu[] = [
  { id: 'catalogo', titulo: 'Ver el catálogo', descripcion: 'Productos, precios y stock', activa: true },
  { id: 'pedidos', titulo: 'Mis pedidos', descripcion: 'Estado de tus compras', activa: true },
  { id: 'promos', titulo: 'Promos y cupones', descripcion: 'Ofertas y descuentos vigentes', activa: true },
  { id: 'envios', titulo: 'Envíos y pagos', descripcion: 'Cómo comprar y recibir', activa: true },
  { id: 'horarios', titulo: 'Horarios y contacto', descripcion: 'Cuándo y dónde encontrarnos', activa: true },
  { id: 'persona', titulo: 'Hablar con alguien', descripcion: 'Te contesta una persona del equipo', activa: true },
];

export const bienvenidaPorDefecto = (tienda: string): string => `¡Hola! Soy Orbi, el asistente virtual de ${tienda}. ¿Qué querés saber?`;

/** Lo que Orbi le pide al modelo cuando el cliente elige una opción de fábrica (en las modalidades con IA). */
export const PEDIDO_DE_OPCION: Record<string, string> = {
  catalogo: 'Quiero ver el catálogo: qué productos tienen, con precios.',
  pedidos: 'Quiero saber el estado de mis pedidos.',
  promos: 'Quiero saber qué promos, ofertas y cupones hay vigentes.',
  envios: 'Quiero saber cómo son los envíos y las formas de pago.',
  horarios: 'Quiero saber los horarios de atención y cómo contactarlos.',
};

/** Marca del menú en texto: con ella se sabe que el último mensaje de Orbi fue un menú y un "2" suelto es la opción 2. */
export const MARCA_MENU_TEXTO = 'Respondé con el número de la opción';

const texto = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/**
 * Las opciones tal como las guardó el dueño (o las de fábrica si no editó nada). Tolerante: lo que no tiene la forma
 * correcta se descarta, nunca tira. La validación estricta de lo que el dueño manda es `validarMenu`.
 */
export function opcionesDelMenu(crudas: unknown): OpcionDeMenu[] {
  if (!Array.isArray(crudas) || crudas.length === 0) return OPCIONES_POR_DEFECTO.map((o) => ({ ...o }));
  const salida: OpcionDeMenu[] = [];
  for (const o of crudas) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const id = texto(r.id, 40);
    const titulo = texto(r.titulo, LIMITES_MENU.tituloLista);
    if (!id || !titulo) continue;
    salida.push({
      id,
      titulo,
      ...(texto(r.descripcion, LIMITES_MENU.descripcion) ? { descripcion: texto(r.descripcion, LIMITES_MENU.descripcion) } : {}),
      activa: r.activa !== false,
      ...(texto(r.respuesta, LIMITES_MENU.respuesta) ? { respuesta: texto(r.respuesta, LIMITES_MENU.respuesta) } : {}),
    });
  }
  return salida.length > 0 ? salida : OPCIONES_POR_DEFECTO.map((o) => ({ ...o }));
}

export const opcionesActivas = (crudas: unknown): OpcionDeMenu[] => opcionesDelMenu(crudas).filter((o) => o.activa);

const esDelDueno = (id: string) => id.startsWith('custom-');

/**
 * Valida el menú que manda el dueño. Devuelve el motivo (para mostrárselo tal cual) o null si está bien: títulos y
 * descripciones dentro de lo que WhatsApp deja, ids sin repetir, las propias con su respuesta, y con botones, hasta 3.
 */
export function validarMenu(opciones: unknown, estilo: MenuEstilo): string | null {
  if (!Array.isArray(opciones)) return 'El menú tiene que ser una lista de opciones.';
  if (opciones.length > LIMITES_MENU.opcionesLista) return `El menú puede tener hasta ${LIMITES_MENU.opcionesLista} opciones.`;
  const ids = new Set<string>();
  let activas = 0;
  for (const o of opciones) {
    if (!o || typeof o !== 'object') return 'Hay una opción del menú con un formato inválido.';
    const r = o as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    if (!id || ids.has(id)) return 'Hay opciones del menú repetidas o sin identificar.';
    if (!esDelDueno(id) && !(OPCIONES_DE_FABRICA as readonly string[]).includes(id)) return 'Hay una opción del menú que no existe.';
    ids.add(id);
    const titulo = typeof r.titulo === 'string' ? r.titulo.trim() : '';
    if (!titulo) return 'Todas las opciones del menú necesitan un título.';
    const tope = estilo === 'BOTONES' ? LIMITES_MENU.tituloBoton : LIMITES_MENU.tituloLista;
    if (titulo.length > tope) return `El título "${titulo}" es muy largo: ${estilo === 'BOTONES' ? 'en botones' : 'en lista'} puede tener hasta ${tope} caracteres.`;
    if (typeof r.descripcion === 'string' && r.descripcion.trim().length > LIMITES_MENU.descripcion) return `La descripción de "${titulo}" puede tener hasta ${LIMITES_MENU.descripcion} caracteres.`;
    if (esDelDueno(id)) {
      const respuesta = typeof r.respuesta === 'string' ? r.respuesta.trim() : '';
      if (!respuesta) return `La opción "${titulo}" necesita el texto con el que Orbi contesta.`;
      if (respuesta.length > LIMITES_MENU.respuesta) return `La respuesta de "${titulo}" puede tener hasta ${LIMITES_MENU.respuesta} caracteres.`;
    }
    if (r.activa !== false) activas++;
  }
  if (activas === 0) return 'Dejá al menos una opción activa en el menú.';
  if (estilo === 'BOTONES' && activas > LIMITES_MENU.opcionesBotones) return `Con botones el menú puede tener hasta ${LIMITES_MENU.opcionesBotones} opciones activas: desactivá alguna o elegí la lista.`;
  return null;
}

/** El mensaje interactivo de WhatsApp (lista o botones) con el saludo y las opciones activas. */
export function armarMenuInteractivo(bienvenida: string, opciones: OpcionDeMenu[], estilo: MenuEstilo): Record<string, unknown> {
  const cuerpo = { text: bienvenida.slice(0, LIMITES_MENU.bienvenida) };
  if (estilo === 'BOTONES' && opciones.length <= LIMITES_MENU.opcionesBotones) {
    return {
      type: 'button',
      body: cuerpo,
      action: { buttons: opciones.map((o) => ({ type: 'reply', reply: { id: o.id, title: o.titulo.slice(0, LIMITES_MENU.tituloBoton) } })) },
    };
  }
  return {
    type: 'list',
    body: cuerpo,
    action: {
      button: 'Ver opciones',
      sections: [
        {
          title: 'Opciones',
          rows: opciones.slice(0, LIMITES_MENU.opcionesLista).map((o) => ({
            id: o.id,
            title: o.titulo.slice(0, LIMITES_MENU.tituloLista),
            ...(o.descripcion ? { description: o.descripcion.slice(0, LIMITES_MENU.descripcion) } : {}),
          })),
        },
      ],
    },
  };
}

/** El mismo menú como texto numerado: lo que se guarda en el chat y lo que se manda si WhatsApp no deja el interactivo. */
export function armarMenuTexto(bienvenida: string, opciones: OpcionDeMenu[], aviso?: string): string {
  const lineas = opciones.map((o, i) => `${i + 1}. ${o.titulo}`).join('\n');
  return `${aviso ? `${aviso}\n\n` : ''}${bienvenida}\n\n${lineas}\n\n${MARCA_MENU_TEXTO}.`;
}

/** "2" suelto, o "2." / "opción 2", como elección de la opción 2 del menú. */
export function opcionDeNumero(textoDelCliente: string, opciones: OpcionDeMenu[]): OpcionDeMenu | null {
  const m = /^\s*(?:opci[oó]n\s*)?(\d{1,2})\s*[.)]?\s*$/i.exec(textoDelCliente);
  if (!m) return null;
  return opciones[Number(m[1]) - 1] ?? null;
}

/** ¿Es un saludo o un pedido de ver las opciones? (para volver a mostrar el menú en "menú + conversación"). */
export function esSaludoOPedidoDeMenu(t: string): boolean {
  const limpio = t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,]/g, '').replace(/\s+/g, ' ');
  if (limpio.length > 25) return false;
  // Solo saludos y pedidos de menú sueltos: "hola, tienen zapatillas?" es una consulta y la atiende la IA.
  return /^((hola+|holis|hey|ey|buenas?|buen dia|buenos dias|buenas (tardes|noches|dias))( orbi)?|hola (buenas|que tal|orbi)( (tardes|noches|dias))?|menu|opciones|inicio|ayuda|empezar|start)$/.test(limpio);
}

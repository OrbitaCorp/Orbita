/**
 * La ficha de requisitos de cada acción de Orbi: qué datos son obligatorios,
 * cuáles opcionales, qué valores se aceptan y qué reglas cruzan campos.
 *
 * Es la fuente ÚNICA. De acá salen:
 * - los `parameters` y la `description` que ve el modelo (parametrosDe,
 *   descripcionDe): lo que se le promete al modelo es lo que se valida;
 * - el chequeo de faltantes de validarArgs (faltantes, fallaDeDatos): si
 *   faltan datos, el modelo recibe TODOS juntos, con el nombre con el que se
 *   le piden a la persona ("precio", no "basePrice"), para preguntar una vez.
 *
 * Antes cada tool tenía su schema escrito a mano y la validación devolvía el
 * primer error técnico del DTO ("basePrice must not be less than 0.01"): el
 * modelo reintentaba con otro valor inventado o se rendía.
 *
 * Las reglas que dependen de la base (que la categoría exista, que el nombre
 * no esté tomado) las validan las tools con el resolver de nombres y el
 * service; acá quedan escritas en `reglas` para que el modelo las conozca.
 */

import type { ArgsInvalidos, Invalido } from './validar-args';
import { presente } from './formato';

export type Opcion = { valor: string; dice: string };

export type CampoDeAccion = {
  tipo: 'string' | 'number' | 'boolean' | 'array';
  /** Cómo se le pide a la persona: "precio", "categoría". */
  etiqueta: string;
  /** Para el modelo: qué va y en qué formato. */
  descripcion: string;
  requerido?: true;
  /** Valores aceptados y cómo se le dicen a la persona. */
  opciones?: readonly Opcion[];
  /** Para listas: el tipo de cada elemento (y sus opciones, si las hay). */
  items?: { opciones?: readonly Opcion[] };
};

export type FichaDeAccion = {
  /** Qué hace la acción, en una línea. */
  descripcion: string;
  campos: Record<string, CampoDeAccion>;
  /** Reglas entre campos, en castellano. Las valida la tool; van a la descripción para que el modelo las sepa. */
  reglas?: readonly string[];
  /** Hace falta al menos uno de estos campos (las de configuración: "cambiá algo"). */
  alMenosUno?: { campos: readonly string[]; etiqueta: string };
};

// ─── Las fichas ──────────────────────────────────────────────────────────────

const NOMBRE_TAL_CUAL = 'tal como lo dijo la persona (sin importar tildes, mayúsculas ni plural): el sistema lo busca. Nunca un id inventado';

const TIPOS_DE_DESCUENTO: readonly Opcion[] = [
  { valor: 'PERCENT_PRODUCT', dice: 'porcentaje en productos o categorías elegidos' },
  { valor: 'AMOUNT_PRODUCT', dice: 'monto fijo por producto en productos o categorías elegidos' },
  { valor: 'PERCENT_TICKET', dice: 'porcentaje sobre el total de la compra' },
  { valor: 'AMOUNT_TICKET', dice: 'monto fijo sobre el total de la compra' },
];

const ALCANCES: readonly Opcion[] = [
  { valor: 'PRODUCT', dice: 'productos elegidos' },
  { valor: 'CATEGORY', dice: 'categorías elegidas' },
  { valor: 'TICKET', dice: 'toda la compra' },
];

export const DIAS_DE_LA_SEMANA: readonly Opcion[] = [
  { valor: 'domingo', dice: 'domingo' }, { valor: 'lunes', dice: 'lunes' }, { valor: 'martes', dice: 'martes' },
  { valor: 'miercoles', dice: 'miércoles' }, { valor: 'jueves', dice: 'jueves' }, { valor: 'viernes', dice: 'viernes' },
  { valor: 'sabado', dice: 'sábado' },
];

const REGLAS_DE_ALCANCE = [
  'Con un tipo "en productos o categorías" va productos O categorias (una de las dos, con nombres); con un tipo "sobre el total de la compra" no va ninguna.',
  'scope no hace falta: sale de eso.',
] as const;

/** Lo que comparten descuentos y cupones: valor, a qué aplica, vigencia y condiciones. */
const CAMPOS_DE_PROMO: Record<string, CampoDeAccion> = {
  type: { tipo: 'string', etiqueta: 'tipo (porcentaje o monto fijo, y si es sobre productos/categorías o sobre el total)', descripcion: 'Tipo', requerido: true, opciones: TIPOS_DE_DESCUENTO },
  value: { tipo: 'number', etiqueta: 'valor', descripcion: 'Porcentaje 1-99 o monto en pesos (número, sin signos)', requerido: true },
  productos: { tipo: 'array', etiqueta: 'productos', descripcion: `Nombres de productos, ${NOMBRE_TAL_CUAL}` },
  categorias: { tipo: 'array', etiqueta: 'categorías', descripcion: `Nombres de categorías, ${NOMBRE_TAL_CUAL}` },
  scope: { tipo: 'string', etiqueta: 'a qué aplica', descripcion: 'Opcional: se deduce del tipo y de productos/categorias', opciones: ALCANCES },
  startDate: { tipo: 'string', etiqueta: 'fecha de inicio', descripcion: 'Desde cuándo, YYYY-MM-DD (default: ahora)' },
  endDate: { tipo: 'string', etiqueta: 'fecha de fin', descripcion: 'Hasta cuándo, YYYY-MM-DD (opcional: sin fin)' },
  minAmount: { tipo: 'number', etiqueta: 'compra mínima', descripcion: 'Compra mínima en pesos para que aplique (opcional)' },
  maxUsesTotal: { tipo: 'number', etiqueta: 'usos en total', descripcion: 'Tope de usos en total (opcional, entero)' },
  maxUsesPerCustomer: { tipo: 'number', etiqueta: 'usos por cliente', descripcion: 'Tope de usos por cliente (opcional, entero)' },
};

export const FICHAS = {
  createProduct: {
    descripcion: 'Crear un producto en el catálogo. Queda como borrador salvo que la persona pida publicarlo.',
    campos: {
      name: { tipo: 'string', etiqueta: 'nombre', descripcion: 'Nombre del producto', requerido: true },
      basePrice: { tipo: 'number', etiqueta: 'precio', descripcion: 'Precio en pesos (número, sin signos ni puntos: 2500)', requerido: true },
      categoria: { tipo: 'string', etiqueta: 'categoría', descripcion: `Nombre de la categoría, ${NOMBRE_TAL_CUAL}. Las que hay: listCategories`, requerido: true },
      description: { tipo: 'string', etiqueta: 'descripción', descripcion: 'Descripción (opcional)' },
      etiquetas: { tipo: 'array', etiqueta: 'etiquetas', descripcion: 'Nombres de etiquetas que ya existan en el negocio (opcional)' },
      status: {
        tipo: 'string', etiqueta: 'estado', descripcion: 'Estado inicial (default DRAFT)',
        opciones: [{ valor: 'PUBLISHED', dice: 'publicado en la tienda' }, { valor: 'DRAFT', dice: 'borrador, no se ve en la tienda' }],
      },
    },
    reglas: ['Si la categoría no existe, el sistema te devuelve las que hay: preguntale a la persona cuál usar o si quiere crearla.'],
  },

  createCategory: {
    descripcion: 'Crear una categoría nueva en el catálogo (por ejemplo, para cargar un producto en una categoría que todavía no existe).',
    campos: {
      name: { tipo: 'string', etiqueta: 'nombre', descripcion: 'Nombre de la categoría, como lo dijo la persona', requerido: true },
    },
  },

  createDiscount: {
    descripcion: 'Crear un descuento automático (sin código): se aplica solo en la tienda.',
    campos: {
      name: { tipo: 'string', etiqueta: 'nombre', descripcion: 'Nombre del descuento (opcional: si no lo da, se arma uno con el valor y a qué aplica)' },
      ...CAMPOS_DE_PROMO,
      activeDays: { tipo: 'array', etiqueta: 'días', descripcion: 'Solo esos días de la semana (opcional)', items: { opciones: DIAS_DE_LA_SEMANA } },
      startTime: { tipo: 'string', etiqueta: 'hora de inicio', descripcion: 'Desde qué hora cada día, HH:MM 24 h (opcional)' },
      endTime: { tipo: 'string', etiqueta: 'hora de fin', descripcion: 'Hasta qué hora cada día, HH:MM 24 h (opcional)' },
    },
    reglas: REGLAS_DE_ALCANCE,
  },

  createCoupon: {
    descripcion: 'Crear un cupón con código que el cliente escribe en el checkout.',
    campos: {
      code: { tipo: 'string', etiqueta: 'código', descripcion: 'Código del cupón: letras, números, guion o guion bajo (ej. VERANO20)', requerido: true },
      name: { tipo: 'string', etiqueta: 'nombre', descripcion: 'Nombre descriptivo (opcional: si no lo da, va el código)' },
      ...CAMPOS_DE_PROMO,
    },
    reglas: REGLAS_DE_ALCANCE,
  },

  updateOrderStatus: {
    descripcion: 'Cambiar el estado de un pedido (confirmar, marcar como enviado o entregado, cancelar). Solo se permiten las transiciones válidas para el canal del pedido.',
    campos: {
      orderId: { tipo: 'string', etiqueta: 'qué pedido (número)', descripcion: 'ID del pedido (UUID) que te devolvió listOrders o getOrderDetail', requerido: true },
      status: {
        tipo: 'string', etiqueta: 'estado nuevo', descripcion: 'Nuevo estado', requerido: true,
        opciones: [
          { valor: 'PENDING', dice: 'pendiente' }, { valor: 'CONFIRMED', dice: 'confirmado' },
          { valor: 'PREPARING', dice: 'en preparación' }, { valor: 'SHIPPED', dice: 'enviado' },
          { valor: 'DELIVERED', dice: 'entregado' }, { valor: 'COMPLETED', dice: 'completado' },
          { valor: 'CANCELLED', dice: 'cancelado' },
        ],
      },
    },
  },

  updateBusinessInfo: {
    descripcion: 'Actualizar el nombre, rubro o descripción del negocio. NO permite cambiar el subdominio, el plan ni las credenciales — eso está fuera de mi alcance.',
    campos: {
      name: { tipo: 'string', etiqueta: 'nombre', descripcion: 'Nuevo nombre del negocio (opcional)' },
      industry: { tipo: 'string', etiqueta: 'rubro', descripcion: 'Nuevo rubro (opcional)' },
      description: { tipo: 'string', etiqueta: 'descripción', descripcion: 'Nueva descripción del negocio (opcional)' },
    },
    alMenosUno: { campos: ['name', 'industry', 'description'], etiqueta: 'qué dato del negocio cambiar (nombre, rubro o descripción)' },
  },

  updatePaymentMethods: {
    descripcion: 'Actualizar qué métodos de pago acepta el negocio (efectivo, transferencia, tarjeta, MercadoPago, coordinar por WhatsApp) y sus datos asociados. Mandá solo lo que cambia.',
    campos: {
      acceptsMercadopago: { tipo: 'boolean', etiqueta: 'Mercado Pago', descripcion: 'Mercado Pago' },
      acceptsCash: { tipo: 'boolean', etiqueta: 'efectivo', descripcion: 'Efectivo' },
      acceptsTransfer: { tipo: 'boolean', etiqueta: 'coordinar por WhatsApp', descripcion: 'Coordinar por WhatsApp' },
      acceptsCard: { tipo: 'boolean', etiqueta: 'tarjeta', descripcion: 'Tarjeta' },
      acceptsCoordinateLater: { tipo: 'boolean', etiqueta: 'pagar más tarde', descripcion: 'Pagar más tarde' },
      transferAlias: { tipo: 'string', etiqueta: 'alias de transferencia', descripcion: 'Alias de la cuenta para transferencias (opcional)' },
    },
    alMenosUno: {
      campos: ['acceptsMercadopago', 'acceptsCash', 'acceptsTransfer', 'acceptsCard', 'acceptsCoordinateLater', 'transferAlias'],
      etiqueta: 'qué medio de pago activar o desactivar',
    },
  },

  updateShipping: {
    descripcion: 'Actualizar la configuración de envíos: transportistas habilitados, envío gratis a partir de cierto monto, y política de envíos. Mandá solo lo que cambia.',
    campos: {
      freeShippingFrom: { tipo: 'number', etiqueta: 'monto para envío gratis', descripcion: 'Monto a partir del cual el envío es gratis (opcional)' },
      shippingPolicy: { tipo: 'string', etiqueta: 'política de envíos', descripcion: 'Texto de política de envíos (opcional)' },
      enabledCarriers: {
        tipo: 'array', etiqueta: 'transportistas', descripcion: 'Transportistas habilitados (opcional)',
        items: {
          opciones: [
            { valor: 'CORREO_ARGENTINO', dice: 'Correo Argentino' }, { valor: 'OCA', dice: 'OCA' },
            { valor: 'ANDREANI', dice: 'Andreani' }, { valor: 'VIA_CARGO', dice: 'Vía Cargo' },
            { valor: 'DELIVERY_APP', dice: 'app de delivery' }, { valor: 'OTRO', dice: 'otro' },
          ],
        },
      },
    },
    alMenosUno: { campos: ['freeShippingFrom', 'shippingPolicy', 'enabledCarriers'], etiqueta: 'qué cambiar de los envíos' },
  },
} satisfies Record<string, FichaDeAccion>;

export type AccionConFicha = keyof typeof FICHAS;

// ─── Lo que ve el modelo ─────────────────────────────────────────────────────

/** El texto de un campo para el modelo, con sus opciones en palabras de la persona. */
function descripcionDelCampo(c: CampoDeAccion): string {
  const opciones = c.opciones ?? c.items?.opciones;
  // Solo cuando el valor técnico y lo que se dice son distintos: "OCA = OCA" no suma nada.
  const traducidas = opciones?.filter((o) => o.valor !== o.dice);
  return traducidas?.length ? `${c.descripcion} (${traducidas.map((o) => `${o.valor}: ${o.dice}`).join('; ')})` : c.descripcion;
}

/** El JSON schema de la tool, armado desde la ficha. */
export function parametrosDe(ficha: FichaDeAccion): { type: 'object'; properties: Record<string, unknown>; required?: string[] } {
  const properties: Record<string, unknown> = {};
  for (const [nombre, c] of Object.entries(ficha.campos)) {
    const base: Record<string, unknown> = { type: c.tipo };
    if (c.tipo === 'array') base.items = c.items?.opciones ? { type: 'string', enum: c.items.opciones.map((o) => o.valor) } : { type: 'string' };
    if (c.opciones) base.enum = c.opciones.map((o) => o.valor);
    // Los booleanos de pagos se explican solos por el nombre: sin descripción, como antes.
    if (c.tipo !== 'boolean') base.description = descripcionDelCampo(c);
    properties[nombre] = base;
  }
  const required = Object.entries(ficha.campos).filter(([, c]) => c.requerido).map(([n]) => n);
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

/** La descripción de la tool: qué hace y las reglas entre campos. */
export function descripcionDe(ficha: FichaDeAccion): string {
  return [ficha.descripcion, ...(ficha.reglas ?? [])].join(' ');
}

// ─── Lo que se valida ────────────────────────────────────────────────────────

/** ¿Vino un valor? Ni null, ni texto vacío, ni lista vacía. */
export function tieneValor(v: unknown): boolean {
  if (!presente(v)) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Las etiquetas de los campos obligatorios que no vinieron (y la de "al menos uno", si no vino ninguno). */
export function faltantes(ficha: FichaDeAccion, args: Record<string, unknown>): string[] {
  const faltan = Object.entries(ficha.campos).filter(([n, c]) => c.requerido && !tieneValor(args[n])).map(([, c]) => c.etiqueta);
  if (ficha.alMenosUno && !ficha.alMenosUno.campos.some((n) => presente(args[n]))) faltan.push(ficha.alMenosUno.etiqueta);
  return faltan;
}

/** Lo que se le pide al modelo cada vez que una acción no se puede proponer por los datos. */
export const PEDIR_TODO_JUNTO = 'No inventes valores: pedile a la persona todo lo que falta o no sirve en UN solo mensaje, con las opciones si las hay.';

/**
 * El resultado de una validación que no pasó, con el mensaje en castellano
 * armado de lo que falta y lo que no sirve, y la instrucción de preguntar
 * todo junto. Es lo que lee el modelo.
 */
export function fallaDeDatos(faltan: string[], invalidos: Invalido[] = []): ArgsInvalidos {
  const partes: string[] = [];
  if (faltan.length) partes.push(`Faltan datos: ${faltan.join(', ')}.`);
  for (const i of invalidos) {
    partes.push(`${i.campo}: ${i.motivo}${i.opciones?.length ? ` (opciones: ${i.opciones.join(', ')})` : ''}.`);
  }
  partes.push(PEDIR_TODO_JUNTO);
  return {
    ok: false,
    error: partes.join(' '),
    ...(faltan.length ? { faltan } : {}),
    ...(invalidos.length ? { invalidos } : {}),
  };
}

/** Si faltan obligatorios, la falla; si no, null. */
export function chequearFaltantes(ficha: FichaDeAccion, args: Record<string, unknown>): ArgsInvalidos | null {
  const faltan = faltantes(ficha, args);
  return faltan.length ? fallaDeDatos(faltan) : null;
}

/**
 * Un rechazo del DTO, con el campo traducido al parámetro de la tool y su
 * etiqueta. `aParametro` mapea las propiedades del DTO que se llaman distinto
 * (categoryId → categoria).
 */
export function invalidoDelDto(
  ficha: FichaDeAccion,
  falla: { error: string; campo?: string; motivo?: string },
  aParametro: Record<string, string> = {},
): ArgsInvalidos {
  if (!falla.campo) return { ok: false, error: falla.error };
  const parametro = aParametro[falla.campo] ?? falla.campo;
  const campo = ficha.campos[parametro];
  const opciones = (campo?.opciones ?? campo?.items?.opciones)?.map((o) => o.valor);
  return {
    ok: false,
    // El texto de antes ("Argumento inválido (basePrice): …") nombra el parámetro: sigue al frente.
    error: `${falla.error}. ${PEDIR_TODO_JUNTO}`,
    invalidos: [{ campo: campo?.etiqueta ?? parametro, motivo: falla.motivo ?? falla.error, ...(opciones ? { opciones } : {}) }],
  };
}

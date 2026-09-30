import type { ToolResult } from '../tool.interface';

// La nota que queda en la conversación cuando la persona confirma o cancela una
// acción de Orbi (spec §3.4).
//
// Queda en el historial que el modelo relee en los próximos 30 mensajes, así
// que se arma SOLO con datos que controla el servidor. El `summary` de la
// tarjeta y el `label` del resultado salen de argumentos que armó el modelo, y
// esos argumentos pueden venir de texto de terceros (el nombre de un cliente,
// una reseña): copiarlos acá dejaría una inyección que la persona NO aprobó
// metida en el contexto del próximo turno. Por la misma razón el error va como
// categoría fija y nunca el mensaje crudo, que además puede traer valores e
// internos de Prisma.

/** El confirm no pudo ni correr la tool (una excepción, la base caída). */
export const ERROR_INTERNO = 'interno';
/**
 * La tarjeta que la persona aprobó ya no describe lo que pasaría: el pedido
 * cambió de estado entre la propuesta y el clic (ver ToolRegistryService#sigueVigente).
 */
export const ERROR_DESACTUALIZADA = 'desactualizada';

/** Etiqueta fija de cada tool que escribe, y la pantalla donde se revisa. */
const ACCIONES: Record<string, { etiqueta: string; pantalla: string }> = {
  createProduct: { etiqueta: 'Crear producto', pantalla: 'Productos' },
  createDiscount: { etiqueta: 'Crear descuento', pantalla: 'Descuentos' },
  createCoupon: { etiqueta: 'Crear cupón', pantalla: 'Cupones' },
  updateOrderStatus: { etiqueta: 'Cambiar estado del pedido', pantalla: 'Pedidos' },
  updateBusinessInfo: { etiqueta: 'Actualizar los datos del negocio', pantalla: 'Configuración' },
  updatePaymentMethods: { etiqueta: 'Actualizar los medios de pago', pantalla: 'Configuración' },
  updateShipping: { etiqueta: 'Actualizar los envíos', pantalla: 'Configuración' },
};

// Una tool que no está en la lista no se nombra: el nombre guardado vino de la
// llamada del modelo.
const GENERICA = { etiqueta: 'Acción de Orbi', pantalla: 'el panel' };

type Categoria = 'permiso' | 'validación' | 'conflicto' | 'interno';

/** Dónde revisar si una acción se aplicó ("No sé si se aplicó; revisalo en <pantalla>"). */
export function pantallaDe(tool: string): string {
  return (Object.prototype.hasOwnProperty.call(ACCIONES, tool) ? ACCIONES[tool] : GENERICA).pantalla;
}

function etiquetaDe(tool: string): string {
  return (Object.prototype.hasOwnProperty.call(ACCIONES, tool) ? ACCIONES[tool] : GENERICA).etiqueta;
}

/**
 * El código del cupón, solo si tiene el formato que exige UpsertCouponDto
 * (letras, números, guion y guion bajo, hasta 40). Cualquier otra cosa no
 * aparece en la nota.
 */
export function codigoDeCupon(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const codigo = valor.trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(codigo) ? codigo : undefined;
}

function sujeto(tool: string, ctx: { pedido?: number; codigo?: string }): string {
  const etiqueta = etiquetaDe(tool);
  if (Number.isSafeInteger(ctx.pedido) && (ctx.pedido as number) > 0) return `${etiqueta} #${ctx.pedido}`;
  const codigo = codigoDeCupon(ctx.codigo);
  if (codigo) return `${etiqueta} ${codigo}`;
  return etiqueta;
}

/**
 * El error de un ToolResult, reducido a una categoría fija. Se reconocen los
 * mensajes que arma el propio servidor (ToolRegistryService y el confirm); un
 * error que viene de adentro de la tool (el service tiró) no se puede
 * clasificar sin leer su texto, así que cuenta como interno.
 */
// La forma exacta de ToolRegistryService#execute: `"<tool>" no disponible en
// <surface>` o `en este paso`. Un "no disponible" cualquiera ("Producto no
// disponible", que puede tirar el service de adentro de la tool) no es un
// permiso.
const TOOL_NO_DISPONIBLE = /^"[^"]+" no disponible en /;

function categoria(error: string | undefined): Categoria {
  if (!error) return 'interno';
  if (error === ERROR_DESACTUALIZADA) return 'conflicto';
  if (error.startsWith('Permisos insuficientes') || error.startsWith('En la demo') || TOOL_NO_DISPONIBLE.test(error)) return 'permiso';
  if (error.startsWith('Argumento inválido')) return 'validación';
  return 'interno';
}

export function notaDeConfirmacion(tool: string, r: ToolResult, ctx: { pedido?: number; codigo?: string }): string {
  if (r.success) return `Listo: ${sujeto(tool, ctx)}.`;
  return `No se pudo: ${sujeto(tool, ctx)}. Motivo: ${categoria(r.error)}.`;
}

export function notaDeCancelacion(tool: string, ctx: { pedido?: number; codigo?: string }): string {
  return `Cancelado por la persona: ${sujeto(tool, ctx)}. No se hizo nada.`;
}

// (RBT-613) Motor de evaluación de descuentos — funciones PURAS: sin Prisma, sin
// NestJS, sin efectos secundarios (RNF-07: idempotente, misma entrada → misma
// salida; el canje real ocurre al confirmar la venta, no acá).
//
// Cubre solo los 4 tipos "triviales" de V1, como fija el ticket RBT-613
// ("Solo los 4 tipos triviales en V1"). BUY_X_PAY_Y / BUY_X_GET_Z / VOLUME están
// marcados `// (V2)` en el schema y quedan afuera: `UpsertDiscountDto` ya los
// rechaza con 400, y acá se filtran defensivamente por si llegan de la DB.
//
// El caller (DiscountsService.evaluate) decide QUÉ descuentos entran: filtra por
// negocio, vigencia (fechas/días/horario), activos, automáticos, no-cupón y con
// usos disponibles. Este módulo no sabe nada de eso — solo matchea y calcula.

export type CartItemForEngine = {
  variantId: string;
  productId: string | null; // producto padre; null si la variante no se resolvió
  categoryId: string | null; // Product.categoryId es nullable en el schema
  quantity: number;
  unitPrice: number;
};

export type EligibleDiscount = {
  id: string;
  name: string;
  type: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET';
  value: number;
  scope: 'PRODUCT' | 'CATEGORY' | 'TICKET';
  productLevel: 'padre' | 'variante' | null;
  minAmount: number | null;
  priority: number;
  productIds: string[]; // IDs de producto padre O de variante, según productLevel
  categoryIds: string[];
};

export type ItemDiscountResult = {
  variantId: string;
  discountId: string;
  discountName: string;
  amount: number; // total descontado en ese renglón (ya por la cantidad)
};

export type TicketDiscountResult = {
  discountId: string;
  discountName: string;
  amount: number;
  // La TASA que produjo `amount` — no alcanza con mostrar el monto final: un
  // cliente que ve "-$120" no sabe si eso es un 1% o un fijo de $120 (pedido
  // explícito: "necesito que se vea el porcentaje de descuento que se está
  // aplicando"). `type` viene tal cual del Discount (PERCENT_TICKET/
  // AMOUNT_TICKET) para que cada pantalla lo formatee a su gusto.
  type: 'PERCENT_TICKET' | 'AMOUNT_TICKET';
  value: number;
};

export type EvaluationResult = {
  itemDiscounts: ItemDiscountResult[];
  ticketDiscount: TicketDiscountResult | null;
  subtotal: number; // bruto, antes de cualquier descuento
  discountTotal: number;
  total: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function esTipoSoportado(t: EligibleDiscount['type']): boolean {
  return t === 'PERCENT_PRODUCT' || t === 'AMOUNT_PRODUCT' || t === 'PERCENT_TICKET' || t === 'AMOUNT_TICKET';
}

// RF-13/RF-14: producto padre aplica a todas sus variantes; variante específica
// solo a esa; categoría es una regla dinámica (todos los productos de la
// categoría, presentes y futuros — se resuelve al evaluar, no se materializa).
function itemMatchesDiscount(item: CartItemForEngine, d: EligibleDiscount): boolean {
  if (d.scope === 'PRODUCT') {
    const key = d.productLevel === 'padre' ? item.productId : item.variantId;
    return key != null && d.productIds.includes(key);
  }
  if (d.scope === 'CATEGORY') {
    return item.categoryId != null && d.categoryIds.includes(item.categoryId);
  }
  return false; // TICKET no matchea a nivel ítem
}

function computeItemDiscountAmount(item: CartItemForEngine, d: EligibleDiscount): number {
  const bruto = item.unitPrice * item.quantity;
  if (d.type === 'PERCENT_PRODUCT') {
    return round2((bruto * d.value) / 100);
  }
  if (d.type === 'AMOUNT_PRODUCT') {
    // "el monto no puede superar el precio del producto" (spec, tipo 2): se topea
    // por unidad, así N unidades nunca descuentan más de lo que valen.
    return round2(Math.min(d.value, item.unitPrice) * item.quantity);
  }
  return 0;
}

function computeTicketDiscountAmount(base: number, d: EligibleDiscount): number {
  if (d.type === 'PERCENT_TICKET') return round2((base * d.value) / 100);
  // "el descuento no puede dejar el total en negativo" (spec, tipo 4).
  if (d.type === 'AMOUNT_TICKET') return round2(Math.min(d.value, base));
  return 0;
}

// RF-02 + RBT-613: "best-discount-wins (mayor ahorro gana, priority desempata)".
// Si empatan monto Y priority, gana el primero de la lista — el caller entrega
// los descuentos ordenados por createdAt asc, así que el más viejo gana y el
// resultado es determinístico (RNF-07).
function pickBest<T extends { amount: number; discount: EligibleDiscount }>(candidatos: T[]): T | null {
  if (candidatos.length === 0) return null;
  return candidatos.reduce((mejor, c) => {
    if (c.amount > mejor.amount) return c;
    if (c.amount === mejor.amount && c.discount.priority > mejor.discount.priority) return c;
    return mejor;
  });
}

export function evaluateCart(items: CartItemForEngine[], discounts: EligibleDiscount[]): EvaluationResult {
  const soportados = discounts.filter((d) => esTipoSoportado(d.type));
  const subtotal = round2(items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0));

  const aNivelItem = soportados.filter((d) => d.scope === 'PRODUCT' || d.scope === 'CATEGORY');
  const aNivelTicket = soportados.filter((d) => d.scope === 'TICKET');

  // Un descuento por renglón: el de mayor ahorro entre los que matcheen.
  const itemDiscounts: ItemDiscountResult[] = [];
  for (const item of items) {
    const candidatos = aNivelItem
      .filter((d) => itemMatchesDiscount(item, d))
      .map((d) => ({ amount: computeItemDiscountAmount(item, d), discount: d }))
      .filter((c) => c.amount > 0);
    const mejor = pickBest(candidatos);
    if (mejor) {
      itemDiscounts.push({
        variantId: item.variantId,
        discountId: mejor.discount.id,
        discountName: mejor.discount.name,
        amount: mejor.amount,
      });
    }
  }

  const totalItemDiscounts = round2(itemDiscounts.reduce((acc, d) => acc + d.amount, 0));

  // Decisión (no especificada en el spec — ver PENDIENTES): el umbral `minAmount`
  // ("compras mayores a $X") se mide sobre el subtotal BRUTO, que es lo que el
  // cliente efectivamente gastó; pero el porcentaje/monto del descuento de ticket
  // se calcula sobre el NETO (después de los descuentos de ítem), para no
  // descontar dos veces la misma plata ni empujar el total a negativo.
  const baseTicket = round2(Math.max(0, subtotal - totalItemDiscounts));

  const candidatosTicket = aNivelTicket
    .filter((d) => d.minAmount == null || subtotal >= d.minAmount)
    .map((d) => ({ amount: computeTicketDiscountAmount(baseTicket, d), discount: d }))
    .filter((c) => c.amount > 0);
  const mejorTicket = pickBest(candidatosTicket);
  const ticketDiscount: TicketDiscountResult | null = mejorTicket
    ? {
        discountId: mejorTicket.discount.id,
        discountName: mejorTicket.discount.name,
        amount: mejorTicket.amount,
        type: mejorTicket.discount.type as 'PERCENT_TICKET' | 'AMOUNT_TICKET',
        value: mejorTicket.discount.value,
      }
    : null;

  const discountTotal = round2(totalItemDiscounts + (ticketDiscount?.amount ?? 0));

  return {
    itemDiscounts,
    ticketDiscount,
    subtotal,
    discountTotal,
    total: round2(Math.max(0, subtotal - discountTotal)),
  };
}

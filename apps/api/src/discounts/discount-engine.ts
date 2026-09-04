// (RBT-613) Motor de evaluación de descuentos — funciones PURAS: sin Prisma, sin
// NestJS, sin efectos secundarios (RNF-07: idempotente, misma entrada → misma
// salida; el canje real ocurre al confirmar la venta, no acá).
//
// Cubre los 4 tipos "triviales" de V1 (RBT-613) más BUY_X_PAY_Y ("llevá X pagá
// Y" — 2x1, 3x2, etc., RBT-675). BUY_X_GET_Z / VOLUME siguen marcados `// (V2)`
// en el schema y quedan afuera: `UpsertDiscountDto` ya los rechaza con 400, y
// acá se filtran defensivamente por si llegan de la DB.
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
  type: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET' | 'BUY_X_PAY_Y';
  value: number;
  scope: 'PRODUCT' | 'CATEGORY' | 'TICKET';
  productLevel: 'padre' | 'variante' | null;
  minAmount: number | null;
  // Solo lo usa BUY_X_PAY_Y — la "X" de "llevá X" (la "Y", "pagá Y", reusa `value`).
  minQuantity: number | null;
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
  return (
    t === 'PERCENT_PRODUCT' ||
    t === 'AMOUNT_PRODUCT' ||
    t === 'PERCENT_TICKET' ||
    t === 'AMOUNT_TICKET' ||
    t === 'BUY_X_PAY_Y'
  );
}

// RF-13/RF-14: producto padre aplica a todas sus variantes; variante específica
// solo a esa; categoría es una regla dinámica (todos los productos de la
// categoría, presentes y futuros — se resuelve al evaluar, no se materializa).
export function itemMatchesDiscount(item: CartItemForEngine, d: EligibleDiscount): boolean {
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

// BUY_X_PAY_Y ("llevá X pagá Y", RBT-675): a diferencia de los 4 tipos V1 (que
// compiten por-ítem, cada uno independiente de los demás renglones), este
// descuento AGRUPA unidades entre TODAS las líneas del carrito que matcheen
// su alcance — ej. "3x2 en la categoría Bebidas": 2 unidades de una bebida +
// 1 de otra cuentan juntas para el grupo. Las unidades más BARATAS del pool
// son las que salen gratis (decisión confirmada: con precios distintos, el
// ítem más barato es el que se descuenta).
function computeBuyXPayYDiscounts(
  items: CartItemForEngine[],
  discounts: EligibleDiscount[],
): { resultados: ItemDiscountResult[]; variantIdsCubiertas: Set<string> } {
  const resultados: ItemDiscountResult[] = [];
  const variantIdsCubiertas = new Set<string>();

  const tipoBuyXPayY = discounts.filter((d) => d.type === 'BUY_X_PAY_Y' && (d.minQuantity ?? 0) >= 2);

  for (const d of tipoBuyXPayY) {
    const X = d.minQuantity as number;
    const Y = d.value;

    // Pool de unidades individuales que matchean el alcance (una entrada por
    // unidad, no por línea — una variante con cantidad 3 aporta 3 entradas).
    const pool: { variantId: string; unitPrice: number }[] = [];
    for (const item of items) {
      if (!itemMatchesDiscount(item, d)) continue;
      for (let i = 0; i < item.quantity; i++) {
        pool.push({ variantId: item.variantId, unitPrice: item.unitPrice });
      }
    }

    const gruposCompletos = Math.floor(pool.length / X);
    const unidadesGratis = gruposCompletos * (X - Y);
    if (unidadesGratis <= 0) continue;

    const masBaratasPrimero = [...pool].sort((a, b) => a.unitPrice - b.unitPrice);
    const gratis = masBaratasPrimero.slice(0, unidadesGratis);

    const porVariante = new Map<string, number>(); // variantId -> monto descontado
    for (const u of gratis) {
      porVariante.set(u.variantId, round2((porVariante.get(u.variantId) ?? 0) + u.unitPrice));
    }

    for (const [variantId, amount] of porVariante) {
      resultados.push({ variantId, discountId: d.id, discountName: d.name, amount });
      variantIdsCubiertas.add(variantId);
    }
  }

  return { resultados, variantIdsCubiertas };
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

  // BUY_X_PAY_Y corre primero y agrupa entre líneas — las variantes que ya
  // recibieron descuento acá quedan afuera de la competencia "mejor descuento
  // por ítem" de los 4 tipos V1 (una unidad no recibe dos descuentos a la vez).
  const { resultados: itemDiscountsBuyXPayY, variantIdsCubiertas } = computeBuyXPayYDiscounts(items, soportados);

  const aNivelItem = soportados.filter(
    (d) => (d.scope === 'PRODUCT' || d.scope === 'CATEGORY') && d.type !== 'BUY_X_PAY_Y',
  );
  const aNivelTicket = soportados.filter((d) => d.scope === 'TICKET');

  // Un descuento por renglón: el de mayor ahorro entre los que matcheen.
  const itemDiscounts: ItemDiscountResult[] = [...itemDiscountsBuyXPayY];
  for (const item of items) {
    if (variantIdsCubiertas.has(item.variantId)) continue;
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

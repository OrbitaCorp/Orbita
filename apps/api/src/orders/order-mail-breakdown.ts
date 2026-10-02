import { PrismaService } from '../prisma/prisma.service';
import { fmtPesos } from '../common/utils/pesos';

// Lo que la tabla de un mail de pedido muestra entre los productos y el total
// cuando el total NO es la suma de los renglones: subtotal, un renglón por cada
// descuento (con su nombre y, si es porcentual, la tasa) y el envío.
//
// Reportado con el pedido #50: el producto figuraba a $15.000 y el total decía
// $13.500, sin una sola línea que explicara la diferencia (un 10% automático
// sobre el total de la compra). Los montos van ya formateados, igual que el
// resto de lo que reciben los templates.
export type DesglosePedidoMail = {
  subtotal?: string;
  discounts?: { label: string; amount: string }[];
  shipping?: string;
};

// Sale de lo que quedó GUARDADO en el pedido (redenciones + discountTotal), no
// de volver a evaluar el motor: un mail que se manda días después (al
// confirmar, o al reenviar el comprobante) tiene que explicar lo que se cobró
// ese día, aunque el descuento ya haya vencido o cambiado.
//
// Nunca rompe el envío: si algo falla devuelve {} y el mail sale como antes.
export async function desgloseDePedido(prisma: PrismaService, orderId: string): Promise<DesglosePedidoMail> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        subtotal: true,
        discountTotal: true,
        onlineOrderDetails: { select: { shippingCost: true } },
        redemptions: { select: { amount: true, discount: { select: { id: true, name: true, type: true, value: true } } } },
      },
    });
    if (!order) return {};

    const descuentoTotal = Number(order.discountTotal);
    const envio = Number(order.onlineOrderDetails?.shippingCost ?? 0);
    if (descuentoTotal <= 0 && envio <= 0) return {};

    // Un descuento de producto deja una redención por renglón: se suman para
    // que cada descuento aparezca una sola vez.
    const porDescuento = new Map<string, { label: string; amount: number }>();
    for (const r of order.redemptions) {
      const esPorcentaje = r.discount.type === 'PERCENT_PRODUCT' || r.discount.type === 'PERCENT_TICKET';
      const label = esPorcentaje ? `${r.discount.name} (${Number(r.discount.value)}%)` : r.discount.name;
      const previo = porDescuento.get(r.discount.id);
      porDescuento.set(r.discount.id, { label, amount: (previo?.amount ?? 0) + Number(r.amount) });
    }
    const discounts = [...porDescuento.values()].filter((d) => d.amount > 0);

    // Lo que no viene de un Discount (el descuento por forma de pago, que se
    // guarda en discountTotal sin redención) va en un renglón genérico.
    const resto = Math.round((descuentoTotal - discounts.reduce((acc, d) => acc + d.amount, 0)) * 100) / 100;
    if (resto > 0) discounts.push({ label: 'Descuento', amount: resto });

    return {
      subtotal: fmtPesos(Number(order.subtotal)),
      discounts: discounts.map((d) => ({ label: d.label, amount: fmtPesos(d.amount) })),
      ...(envio > 0 ? { shipping: fmtPesos(envio) } : {}),
    };
  } catch {
    return {};
  }
}

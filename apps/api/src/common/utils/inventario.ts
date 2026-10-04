// Valorización del inventario: cuánta plata hay metida en el stock y cuánto se
// ganaría si se vendiera todo. La usan las métricas de Productos y el dashboard
// avanzado, así los dos muestran el mismo número.
//
// Reglas (las mismas que ya tenía el "Valor de inventario" del encabezado):
// - El costo es UNO por producto y vale para todas sus variantes; el precio de
//   venta, en cambio, es de cada variante.
// - Un producto con stock pero sin costo cargado NO entra en ningún total (no se
//   estima con el precio de venta: mezclaría plata invertida con plata a cobrar)
//   y se cuenta aparte en `sinCosto` para avisarle al dueño.
// - El stock negativo (sobreventa) no resta valor: cuenta como cero.

type Numerico = number | { toString(): string } | null | undefined;

export interface ProductoValorizable {
  cost: Numerico;
  variants: { price?: Numerico; stock: { quantity: number }[] }[];
}

export interface ValorInventario {
  /** Plata invertida: costo × unidades, de los productos con costo. */
  valorCosto: number;
  /** Lo que se cobraría vendiendo ese mismo stock a los precios de hoy. */
  valorVenta: number;
  /** valorVenta − valorCosto. Es una estimación: no descuenta envíos, comisiones ni descuentos. */
  gananciaPotencial: number;
  /** Margen sobre el precio de venta, en %. Null si no hay nada que valorizar. */
  margenPct: number | null;
  /** Productos con stock pero sin costo cargado (quedan afuera de los totales). */
  sinCosto: number;
}

const aNumero = (v: Numerico): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const redondear2 = (n: number) => Math.round(n * 100) / 100;

export function valorizarInventario(productos: ProductoValorizable[]): ValorInventario {
  let valorCosto = 0;
  let valorVenta = 0;
  let sinCosto = 0;

  for (const p of productos) {
    const unidadesPorVariante = p.variants.map((v) => Math.max(0, v.stock.reduce((s, st) => s + st.quantity, 0)));
    if (unidadesPorVariante.every((u) => u === 0)) continue;
    if (p.cost === null || p.cost === undefined) {
      sinCosto++;
      continue;
    }
    const costo = aNumero(p.cost);
    p.variants.forEach((v, i) => {
      valorCosto += unidadesPorVariante[i] * costo;
      valorVenta += unidadesPorVariante[i] * aNumero(v.price);
    });
  }

  return {
    valorCosto: redondear2(valorCosto),
    valorVenta: redondear2(valorVenta),
    gananciaPotencial: redondear2(valorVenta - valorCosto),
    margenPct: valorVenta > 0 ? Math.round(((valorVenta - valorCosto) / valorVenta) * 1000) / 10 : null,
    sinCosto,
  };
}

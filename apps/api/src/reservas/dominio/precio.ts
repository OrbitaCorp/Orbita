// Plata de una reserva, siempre calculada en el servidor: lo que mande el
// cliente se ignora. Todo redondeado al peso, porque 45.000 × 1,15 en coma
// flotante da 51.699,99 y en un ticket eso se nota.

export const redondear = (n: number): number => Math.round(n);

export interface ExtraElegido {
  id: string;
  nombre: string;
  precio: number;
}

/**
 * Precio total: la base por las unidades (franjas seguidas de una cancha,
 * noches de un alojamiento, lugares de una clase) más los extras elegidos.
 */
export function precioTotal(base: number, unidades: number, extras: ExtraElegido[] = []): number {
  const extrasTotal = extras.reduce((s, e) => s + Math.max(0, e.precio), 0);
  return redondear(Math.max(0, base) * Math.max(1, unidades) + extrasTotal);
}

/** La seña: un porcentaje del total, al peso. 0 % = sin seña. */
export function sena(total: number, porcentaje: number): number {
  if (porcentaje <= 0 || total <= 0) return 0;
  return redondear((total * Math.min(100, porcentaje)) / 100);
}

/**
 * Qué extras del catálogo del recurso eligió la persona, por id. Un id que no
 * existe se ignora (el catálogo pudo cambiar entre que lo vio y reservó): el
 * precio sale SIEMPRE del catálogo, nunca del pedido.
 */
export function extrasElegidos(catalogo: unknown, ids: string[] | undefined): ExtraElegido[] {
  if (!ids?.length || !Array.isArray(catalogo)) return [];
  const porId = new Map<string, ExtraElegido>();
  for (const x of catalogo) {
    if (x && typeof x === 'object' && typeof (x as ExtraElegido).id === 'string' && typeof (x as ExtraElegido).nombre === 'string' && typeof (x as ExtraElegido).precio === 'number') {
      const e = x as ExtraElegido;
      porId.set(e.id, { id: e.id, nombre: e.nombre, precio: e.precio });
    }
  }
  return [...new Set(ids)].map((id) => porId.get(id)).filter((e): e is ExtraElegido => e !== undefined);
}

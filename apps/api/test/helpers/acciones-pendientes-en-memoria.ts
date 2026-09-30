// Un `prisma.orbiPendingAction` en memoria para los tests de Orbi (servicio y
// controller). Respeta el `where` como Prisma, incluido lo peligroso: una clave
// con valor `undefined` SACA el filtro en vez de exigir que sea undefined. Así
// los tests ven lo mismo que vería la base si un memberId llegara vacío.
//
// Las garantías atómicas de verdad (dos confirmar a la vez) no se pueden probar
// acá: van en el e2e contra Postgres (T14).

export interface FilaDePrueba {
  id: string;
  businessId: string;
  memberId: string;
  conversationId: string | null;
  tool: string;
  args: unknown;
  summary: string;
  status: string;
  result: unknown;
  expiresAt: Date;
  startedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

function coincide(fila: FilaDePrueba, where: Record<string, unknown>): boolean {
  for (const [clave, valor] of Object.entries(where)) {
    if (valor === undefined) continue;
    if (clave === 'expiresAt') {
      const { gt } = valor as { gt: Date };
      if (!(fila.expiresAt.getTime() > gt.getTime())) return false;
      continue;
    }
    if ((fila as unknown as Record<string, unknown>)[clave] !== valor) return false;
  }
  return true;
}

export function prismaDeAcciones<T extends object>(extra?: T) {
  const filas = new Map<string, FilaDePrueba>();

  const orbiPendingAction = {
    create: jest.fn(async ({ data }: { data: Partial<FilaDePrueba> & { id: string } }) => {
      const fila = {
        conversationId: null,
        status: 'pending',
        result: null,
        startedAt: null,
        resolvedAt: null,
        createdAt: new Date(),
        ...(data as Partial<FilaDePrueba>),
      } as FilaDePrueba;
      filas.set(fila.id, fila);
      return { ...fila };
    }),
    updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<FilaDePrueba> }) => {
      let count = 0;
      for (const fila of filas.values()) {
        if (coincide(fila, where)) {
          Object.assign(fila, data);
          count += 1;
        }
      }
      return { count };
    }),
    findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      for (const fila of filas.values()) if (coincide(fila, where)) return { ...fila };
      return null;
    }),
  };

  return { orbiPendingAction, filas, ...(extra ?? ({} as T)) };
}

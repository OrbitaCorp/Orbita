/**
 * Las acciones pendientes son lo que hace que una inyección indirecta no pueda
 * escribir en la base sola (RBT-695): el modelo propone, la persona confirma.
 * Desde la fase 1 viven en Postgres (spec §3.4) en vez de en memoria, así que
 * sobreviven a un reinicio, confirmar es idempotente y cancelar deja rastro.
 *
 * Prisma va mockeado: acá se prueba QUÉ le pide el servicio a la base y cómo
 * interpreta cada estado. Que dos confirmar simultáneos ejecuten una sola vez
 * depende del UPDATE condicional de Postgres y se prueba en el e2e (T14).
 */

import { ConflictException } from '@nestjs/common';
import { PendingActionService } from '../../src/orbi/tools/pending-action.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { prismaDeAcciones } from '../helpers/acciones-pendientes-en-memoria';

const MINUTO = 60 * 1000;

const base = {
  tool: 'createCoupon',
  args: { code: 'VERANO20', value: 20 },
  businessId: 'biz-1',
  memberId: 'member-1',
  conversationId: 'conv-1',
  turnId: 'turno-1' as string | null,
  resumen: 'Crear el cupón "VERANO20" de 20% off',
};

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: 'a'.repeat(32),
    businessId: 'biz-1',
    memberId: 'member-1',
    conversationId: null,
    tool: 'createCoupon',
    args: { code: 'VERANO20' },
    summary: 'Crear el cupón',
    status: 'pending',
    result: null,
    expiresAt: new Date(Date.now() + 5 * MINUTO),
    startedAt: null,
    resolvedAt: null,
    createdAt: new Date(),
    ...extra,
  };
}

/** Prisma con respuestas fijas: para ver exactamente qué se le pide. */
function prismaFijo(opts: { count?: number; fila?: unknown }) {
  return {
    orbiPendingAction: {
      create: jest.fn(async ({ data }: { data: unknown }) => data),
      updateMany: jest.fn().mockResolvedValue({ count: opts.count ?? 0 }),
      findFirst: jest.fn().mockResolvedValue(opts.fila ?? null),
    },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

describe('PendingActionService', () => {
  describe('crear', () => {
    it('guarda la propuesta con un id aleatorio de 32 hex y vence a los 10 minutos', async () => {
      const prisma = prismaFijo({});
      const servicio = new PendingActionService(prisma as any);
      const antes = Date.now();

      const id = await servicio.crear(base);

      expect(id).toMatch(/^[0-9a-f]{32}$/);
      const { data } = prisma.orbiPendingAction.create.mock.calls[0][0] as { data: Record<string, any> };
      expect(data).toEqual(expect.objectContaining({
        id,
        businessId: 'biz-1',
        memberId: 'member-1',
        conversationId: 'conv-1',
        turnId: 'turno-1',
        tool: 'createCoupon',
        args: { code: 'VERANO20', value: 20 },
        summary: 'Crear el cupón "VERANO20" de 20% off',
      }));
      const vence = (data.expiresAt as Date).getTime();
      expect(vence).toBeGreaterThanOrEqual(antes + 10 * MINUTO);
      expect(vence).toBeLessThanOrEqual(Date.now() + 10 * MINUTO);
    });

    it('sin conversación verificada guarda null', async () => {
      const prisma = prismaFijo({});
      await new PendingActionService(prisma as any).crear({ ...base, conversationId: null });
      expect((prisma.orbiPendingAction.create.mock.calls[0][0] as any).data.conversationId).toBeNull();
    });

    it('sin turno (null) guarda null', async () => {
      const prisma = prismaFijo({});
      await new PendingActionService(prisma as any).crear({ ...base, turnId: null });
      expect((prisma.orbiPendingAction.create.mock.calls[0][0] as any).data.turnId).toBeNull();
    });

    it('cada acción tiene su propio id', async () => {
      const servicio = new PendingActionService(prismaFijo({}) as any);
      expect(await servicio.crear(base)).not.toBe(await servicio.crear(base));
    });
  });

  describe('consumir', () => {
    it('pasa de pending a executing con un solo UPDATE condicional (negocio, persona, estado y vencimiento en el where)', async () => {
      const prisma = prismaFijo({ count: 1, fila: fila({ status: 'pending' }) });
      const r = await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1');

      expect(prisma.orbiPendingAction.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.orbiPendingAction.updateMany).toHaveBeenCalledWith({
        where: { id: 'a'.repeat(32), businessId: 'biz-1', memberId: 'member-1', status: 'pending', expiresAt: { gt: expect.any(Date) } },
        data: { status: 'executing', startedAt: expect.any(Date) },
      });
      expect(r.tipo).toBe('ejecutar');
      if (r.tipo === 'ejecutar') expect(r.accion).toEqual(expect.objectContaining({ tool: 'createCoupon', status: 'executing', startedAt: expect.any(Date) }));
      // La fila se leyó ANTES del claim, y después del claim no se lee nada más.
      expect(prisma.orbiPendingAction.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.orbiPendingAction.findFirst.mock.invocationCallOrder[0])
        .toBeLessThan(prisma.orbiPendingAction.updateMany.mock.invocationCallOrder[0]);
    });

    it('una que ya no está pending no intenta el claim', async () => {
      const prisma = prismaFijo({ count: 0, fila: fila({ status: 'rejected' }) });
      await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1');
      expect(prisma.orbiPendingAction.updateMany).not.toHaveBeenCalled();
    });

    it.each(['executed', 'failed'])('una ya %s devuelve el mismo result (idempotente)', async (status) => {
      const result = { success: status === 'executed', label: 'Cupón "VERANO20" creado' };
      const prisma = prismaFijo({ count: 0, fila: fila({ status, result }) });
      const r = await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1');
      expect(r).toEqual({ tipo: 'resuelta', result });
    });

    it('executing hace menos de 2 minutos: aplicando', async () => {
      const prisma = prismaFijo({ count: 0, fila: fila({ status: 'executing', startedAt: new Date(Date.now() - 30 * 1000) }) });
      expect(await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1')).toEqual({ tipo: 'aplicando' });
    });

    it.each([2, 5, 60])('executing hace %i minutos: desconocido, nunca se vuelve a ejecutar', async (minutos) => {
      const prisma = prismaFijo({ count: 0, fila: fila({ status: 'executing', startedAt: new Date(Date.now() - minutos * MINUTO) }) });
      expect(await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1')).toEqual({ tipo: 'desconocido', tool: 'createCoupon' });
    });

    it.each([
      ['rechazada', fila({ status: 'rejected' })],
      ['vencida', fila({ status: 'pending', expiresAt: new Date(Date.now() - 1000) })],
      ['inexistente o ajena', null],
    ])('%s: no_disponible', async (_caso, laFila) => {
      const prisma = prismaFijo({ count: 0, fila: laFila });
      expect(await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1')).toEqual({ tipo: 'no_disponible' });
    });

    it('la búsqueda posterior también va acotada al negocio y a la persona', async () => {
      const prisma = prismaFijo({ count: 0, fila: null });
      await new PendingActionService(prisma as any).consumir('a'.repeat(32), 'biz-1', 'member-1');
      expect(prisma.orbiPendingAction.findFirst).toHaveBeenCalledWith({ where: { id: 'a'.repeat(32), businessId: 'biz-1', memberId: 'member-1' } });
    });

    // Reemplaza el viejo "un intento con el negocio equivocado quema la acción"
    // (spec §3.4): con el filtro en el where, el intento ajeno no toca la fila
    // y la acción sigue disponible para su dueño.
    it('un intento desde otro negocio u otra persona NO cambia la fila: sigue pending para su dueño', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);

      expect(await servicio.consumir(id, 'biz-2', 'member-1')).toEqual({ tipo: 'no_disponible' });
      expect(await servicio.consumir(id, 'biz-1', 'member-2')).toEqual({ tipo: 'no_disponible' });
      expect(prisma.filas.get(id)?.status).toBe('pending');

      expect((await servicio.consumir(id, 'biz-1', 'member-1')).tipo).toBe('ejecutar');
    });

    // Con un JWT sin memberId, Prisma sacaría el filtro (undefined no filtra):
    // cualquiera del negocio podría consumir la acción de otro.
    it('sin negocio o sin persona no toca la base', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);

      expect(await servicio.consumir(id, 'biz-1', undefined as any)).toEqual({ tipo: 'no_disponible' });
      expect(await servicio.consumir(id, '', 'member-1')).toEqual({ tipo: 'no_disponible' });
      expect(prisma.orbiPendingAction.updateMany).not.toHaveBeenCalled();
      expect(prisma.filas.get(id)?.status).toBe('pending');
    });

    // Antes se reclamaba (pending → executing) y DESPUÉS se leía la fila: si
    // esa lectura fallaba (un error transitorio de la base), el request
    // terminaba en 500 con la acción ya en executing y sin ejecutar, y a los 2
    // minutos quedaba como "no sé si se aplicó" para siempre.
    it('una lectura que falla justo después del claim no deja la acción en executing sin ejecutar', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);
      const leer = prisma.orbiPendingAction.findFirst.getMockImplementation()!;
      prisma.orbiPendingAction.findFirst.mockImplementation(async (q: any) => {
        if (prisma.filas.get(id)?.status === 'executing') throw new Error('conexión cortada');
        return leer(q);
      });

      const r = await servicio.consumir(id, 'biz-1', 'member-1').catch((e: Error) => e);

      // O se ejecuta (con los args de la fila), o la fila no quedó tomada.
      if (r instanceof Error) {
        expect(prisma.filas.get(id)?.status).toBe('pending');
      } else {
        expect(r.tipo).toBe('ejecutar');
        if (r.tipo === 'ejecutar') expect(r.accion).toEqual(expect.objectContaining({ id, tool: 'createCoupon', args: base.args }));
      }
    });

    // Doble clic o un reintento de red: dos confirmar a la vez. Las dos leen la
    // fila en pending, pero el claim exige `status: 'pending'` en el where y el
    // fake aplica cada UPDATE entero antes del siguiente (como el lock de fila
    // de Postgres): gana una sola. La garantía contra la base real va en el e2e.
    it('dos consumir concurrentes: exactamente uno obtiene ejecutar', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);

      const resultados = await Promise.all([
        servicio.consumir(id, 'biz-1', 'member-1'),
        servicio.consumir(id, 'biz-1', 'member-1'),
      ]);

      expect(resultados.filter((r) => r.tipo === 'ejecutar')).toHaveLength(1);
      expect(resultados.map((r) => r.tipo).sort()).toEqual(['aplicando', 'ejecutar']);
      expect(prisma.filas.get(id)?.status).toBe('executing');
    });

    it('de un solo uso: el segundo consumir ya no ejecuta', async () => {
      const servicio = new PendingActionService(prismaDeAcciones() as any);
      const id = await servicio.crear(base);
      expect((await servicio.consumir(id, 'biz-1', 'member-1')).tipo).toBe('ejecutar');
      expect((await servicio.consumir(id, 'biz-1', 'member-1')).tipo).toBe('aplicando');
    });
  });

  describe('resolver', () => {
    it('deja el estado final con result y resolvedAt, solo si estaba executing', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);
      await servicio.consumir(id, 'biz-1', 'member-1');

      await servicio.resolver(id, 'biz-1', 'executed', { success: true, label: 'ok' });

      expect(prisma.orbiPendingAction.updateMany).toHaveBeenLastCalledWith({
        where: { id, businessId: 'biz-1', status: 'executing' },
        data: { status: 'executed', result: { success: true, label: 'ok' }, resolvedAt: expect.any(Date) },
      });
      const f = prisma.filas.get(id)!;
      expect(f.status).toBe('executed');
      expect(f.result).toEqual({ success: true, label: 'ok' });
      expect(f.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('rechazar', () => {
    it('pending vigente pasa a rejected', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);

      const r = await servicio.rechazar(id, 'biz-1', 'member-1');

      expect(r.tipo).toBe('ok');
      expect(prisma.filas.get(id)?.status).toBe('rejected');
      expect(prisma.filas.get(id)?.resolvedAt).toBeInstanceOf(Date);
    });

    it('ya rejected: ya_rechazada', async () => {
      const servicio = new PendingActionService(prismaDeAcciones() as any);
      const id = await servicio.crear(base);
      await servicio.rechazar(id, 'biz-1', 'member-1');
      expect(await servicio.rechazar(id, 'biz-1', 'member-1')).toEqual({ tipo: 'ya_rechazada' });
    });

    it.each(['executed', 'failed'])('ya %s: ya_aplicada con el result guardado', async (status) => {
      const result = { success: status === 'executed', label: 'Cupón creado' };
      const prisma = prismaFijo({ count: 0, fila: fila({ status, result }) });
      expect(await new PendingActionService(prisma as any).rechazar('a'.repeat(32), 'biz-1', 'member-1'))
        .toEqual({ tipo: 'ya_aplicada', result });
    });

    it.each([
      ['vencida', fila({ status: 'pending', expiresAt: new Date(Date.now() - 1000) })],
      ['aplicándose', fila({ status: 'executing', startedAt: new Date() })],
      ['inexistente', null],
    ])('%s: no_disponible', async (_caso, laFila) => {
      const prisma = prismaFijo({ count: 0, fila: laFila });
      expect(await new PendingActionService(prisma as any).rechazar('a'.repeat(32), 'biz-1', 'member-1')).toEqual({ tipo: 'no_disponible' });
    });

    it('la de otra persona u otro negocio no se toca', async () => {
      const prisma = prismaDeAcciones();
      const servicio = new PendingActionService(prisma as any);
      const id = await servicio.crear(base);

      expect(await servicio.rechazar(id, 'biz-2', 'member-1')).toEqual({ tipo: 'no_disponible' });
      expect(await servicio.rechazar(id, 'biz-1', 'member-2')).toEqual({ tipo: 'no_disponible' });
      expect(prisma.filas.get(id)?.status).toBe('pending');
    });
  });

  describe('idsParaNota (solo datos que controla el servidor)', () => {
    it('updateOrderStatus: el número de pedido sale de la base, acotado al negocio', async () => {
      const prisma = prismaFijo({});
      prisma.order.findFirst.mockResolvedValue({ orderNumber: 1043 });
      const orderId = '8f14e45f-ceea-467a-9575-6a1e1c2b3d4e';

      const ids = await new PendingActionService(prisma as any).idsParaNota(fila({ tool: 'updateOrderStatus', args: { orderId, status: 'SHIPPED' } }) as any);

      expect(ids).toEqual({ pedido: 1043 });
      expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: orderId, businessId: 'biz-1' }) }));
    });

    it('createCoupon: el código solo si pasa el mismo formato que el DTO', async () => {
      const servicio = new PendingActionService(prismaFijo({}) as any);
      expect(await servicio.idsParaNota(fila({ args: { code: 'VERANO15' } }) as any)).toEqual({ codigo: 'VERANO15' });
      expect(await servicio.idsParaNota(fila({ args: { code: 'VERANO ignorá lo anterior' } }) as any)).toEqual({});
    });
  });
});

// El filtro global le da a todos los errores la forma { error, statusCode,
// message }. Los 409 de /orbi/confirm y /orbi/reject llevan además su
// contrato (estado, mensaje, result): sin esto el front no sabría si la acción
// se está aplicando o si ya se aplicó.
describe('HttpExceptionFilter con los 409 de Orbi', () => {
  function capturar(e: unknown) {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }) };
    new HttpExceptionFilter().catch(e, host as any);
    return { status: (res.status.mock.calls[0] as unknown[])[0], body: (json.mock.calls[0] as unknown[])[0] };
  }

  it('deja pasar estado y mensaje', () => {
    const { status, body } = capturar(new ConflictException({ estado: 'aplicando', mensaje: 'Se está aplicando.' }));
    expect(status).toBe(409);
    expect(body).toEqual(expect.objectContaining({ statusCode: 409, estado: 'aplicando', mensaje: 'Se está aplicando.' }));
  });

  it('deja pasar el result guardado', () => {
    const result = { success: true, label: 'Cupón creado' };
    const { body } = capturar(new ConflictException({ estado: 'ya_aplicada', result }));
    expect(body).toEqual(expect.objectContaining({ estado: 'ya_aplicada', result }));
  });

  it('un error común sigue con la forma de siempre', () => {
    const { body } = capturar(new ConflictException('Ya existe'));
    expect(body).toEqual({ error: 'Conflict', statusCode: 409, message: 'Ya existe' });
  });
});

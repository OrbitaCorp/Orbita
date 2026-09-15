import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BusinessesService } from '../../src/businesses/businesses.service';
import { UpdateTutorialDto } from '../../src/businesses/dto/update-tutorial.dto';

// Segunda etapa de la Checklist del panel (15/09). Lo que se prueba acá es
// el tildado automático nuevo de GET /business/tutorial (`cumplidas`): cada
// tarea de la etapa 2 se deduce del estado real del negocio, y la etapa 1
// sigue saliendo igual. Más el campo `etapa` del DTO (opcional, 1 | 2).

const BIZ = 'biz-1';

type Conteos = Partial<{
  pedidos: number; clientes: number; plantillas: number; descuentos: number; miembros: number;
  mode: 'FULL' | 'SHOWCASE';
  storefront: { homeTemplate: string | null; createdAt: Date; updatedAt: Date } | null;
  notificaciones: { createdAt: Date; updatedAt: Date } | null;
  tutorial: unknown;
}>;

const T0 = new Date('2026-09-01T10:00:00Z');
const T0_MAS_5MIN = new Date('2026-09-01T10:05:00Z');
const T0_MAS_200MS = new Date('2026-09-01T10:00:00.200Z');

// Negocio "vacío" de la etapa 2: recién onboardeado, con las filas de config
// que crea el onboarding (defaults, sin tocar) y solo el dueño como member.
function prismaDe(c: Conteos = {}) {
  const count = (n: number | undefined) => jest.fn().mockResolvedValue(n ?? 0);
  return {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        tutorial: c.tutorial ?? null, name: 'Zapatos', industry: 'Calzado', isActive: false, isPaused: false,
        mode: c.mode ?? 'FULL',
      }),
    },
    businessConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    mpCredentials: { findUnique: jest.fn().mockResolvedValue(null) },
    category: { count: count(0) },
    product: { count: count(0) },
    branch: { findFirst: jest.fn().mockResolvedValue(null) },
    order: { count: count(c.pedidos) },
    customer: { count: count(c.clientes) },
    messageTemplate: { count: count(c.plantillas) },
    discount: { count: count(c.descuentos) },
    member: { count: count(c.miembros ?? 1) },
    storefrontConfig: {
      findUnique: jest.fn().mockResolvedValue(
        c.storefront === undefined ? { homeTemplate: null, createdAt: T0, updatedAt: T0 } : c.storefront,
      ),
    },
    notificationConfig: {
      findUnique: jest.fn().mockResolvedValue(c.notificaciones === undefined ? { createdAt: T0, updatedAt: T0 } : c.notificaciones),
    },
  };
}

const servicio = (prisma: unknown) => new BusinessesService(prisma as any, {} as any, {} as any);
const cumplidasDe = async (c: Conteos = {}) => (await servicio(prismaDe(c)).getTutorial(BIZ)).cumplidas;

describe('GET /business/tutorial: cumplidas de la segunda etapa', () => {
  it('negocio recién onboardeado: ninguna tarea de la etapa 2 cumplida', async () => {
    expect(await cumplidasDe()).toEqual([]);
  });

  it('pedidos: con algún pedido vivo', async () => {
    expect(await cumplidasDe({ pedidos: 1 })).toEqual(['pedidos']);
    const prisma = prismaDe({ pedidos: 1 });
    await servicio(prisma).getTutorial(BIZ);
    // Soft-delete: los borrados no cuentan (si borró todo, vuelve a pendiente).
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { businessId: BIZ, deletedAt: null } });
  });

  it('clientes: con algún cliente vivo', async () => {
    expect(await cumplidasDe({ clientes: 3 })).toEqual(['clientes']);
    const prisma = prismaDe({ clientes: 3 });
    await servicio(prisma).getTutorial(BIZ);
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { businessId: BIZ, deletedAt: null } });
  });

  it('plantillas: con alguna plantilla de mensaje', async () => {
    expect(await cumplidasDe({ plantillas: 1 })).toEqual(['plantillas']);
  });

  it('plantillas: una vidriera (SHOWCASE) la tiene cumplida aunque no tenga ninguna — Mensajes le da 403', async () => {
    expect(await cumplidasDe({ mode: 'SHOWCASE' })).toEqual(['plantillas']);
  });

  it('descuentos: con algún descuento o cupón vivo (los dos viven en discounts)', async () => {
    expect(await cumplidasDe({ descuentos: 1 })).toEqual(['descuentos']);
    const prisma = prismaDe({ descuentos: 1 });
    await servicio(prisma).getTutorial(BIZ);
    expect(prisma.discount.count).toHaveBeenCalledWith({ where: { businessId: BIZ, deletedAt: null } });
  });

  it('equipo: el dueño solo no cuenta; con un invitado (aunque esté PENDING) sí', async () => {
    expect(await cumplidasDe({ miembros: 1 })).toEqual([]);
    expect(await cumplidasDe({ miembros: 2 })).toEqual(['equipo']);
    const prisma = prismaDe({ miembros: 2 });
    await servicio(prisma).getTutorial(BIZ);
    // Sin filtro por status: la tarea es "invitá", no "que acepte".
    expect(prisma.member.count).toHaveBeenCalledWith({ where: { businessId: BIZ } });
  });

  it('apariencia: guardada después de crearse, o con plantilla de Home puesta', async () => {
    expect(await cumplidasDe({ storefront: { homeTemplate: null, createdAt: T0, updatedAt: T0_MAS_5MIN } })).toEqual(['apariencia']);
    expect(await cumplidasDe({ storefront: { homeTemplate: 'vidriera', createdAt: T0, updatedAt: T0 } })).toEqual(['apariencia']);
  });

  it('apariencia: los defaults del onboarding no cuentan (ni un update en la misma transacción)', async () => {
    expect(await cumplidasDe({ storefront: { homeTemplate: null, createdAt: T0, updatedAt: T0 } })).toEqual([]);
    expect(await cumplidasDe({ storefront: { homeTemplate: null, createdAt: T0, updatedAt: T0_MAS_200MS } })).toEqual([]);
    expect(await cumplidasDe({ storefront: null })).toEqual([]);
  });

  it('notificaciones: la grilla guardada después de crearse', async () => {
    expect(await cumplidasDe({ notificaciones: { createdAt: T0, updatedAt: T0_MAS_5MIN } })).toEqual(['notificaciones']);
    expect(await cumplidasDe({ notificaciones: { createdAt: T0, updatedAt: T0 } })).toEqual([]);
    expect(await cumplidasDe({ notificaciones: null })).toEqual([]);
  });

  it('todo junto: las siete, en el orden de la lista del panel, después de las de la etapa 1', async () => {
    const prisma = prismaDe({
      pedidos: 1, clientes: 1, plantillas: 1, descuentos: 1, miembros: 2,
      storefront: { homeTemplate: 'vidriera', createdAt: T0, updatedAt: T0 },
      notificaciones: { createdAt: T0, updatedAt: T0_MAS_5MIN },
    });
    prisma.mpCredentials.findUnique.mockResolvedValue({ id: 'mp' });
    const { cumplidas } = await servicio(prisma).getTutorial(BIZ);
    expect(cumplidas).toEqual(['mp', 'pedidos', 'clientes', 'plantillas', 'descuentos', 'equipo', 'apariencia', 'notificaciones']);
  });

  it('el estado guardado vuelve tal cual, con o sin etapa', async () => {
    const viejo = { variante: 'checklist', fase: 'terminado', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] };
    expect((await servicio(prismaDe({ tutorial: viejo })).getTutorial(BIZ)).tutorial).toEqual(viejo);
    const nuevo = { ...viejo, fase: 'activo', etapa: 2 };
    expect((await servicio(prismaDe({ tutorial: nuevo })).getTutorial(BIZ)).tutorial).toEqual(nuevo);
  });
});

describe('PUT /business/tutorial: campo etapa', () => {
  const base = { variante: 'checklist', fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] };
  const validar = (tutorial: unknown) => validate(plainToInstance(UpdateTutorialDto, { tutorial }));

  it('acepta sin etapa (estados viejos), con 1 y con 2', async () => {
    expect(await validar(base)).toHaveLength(0);
    expect(await validar({ ...base, etapa: 1 })).toHaveLength(0);
    expect(await validar({ ...base, etapa: 2 })).toHaveLength(0);
  });

  it('rechaza cualquier otra etapa', async () => {
    expect(await validar({ ...base, etapa: 3 })).not.toHaveLength(0);
    expect(await validar({ ...base, etapa: '2' })).not.toHaveLength(0);
  });

  it('updateTutorial guarda etapa solo si vino (no escribe `etapa: undefined` en el JSONB)', async () => {
    const prisma = { business: { update: jest.fn().mockResolvedValue({}) } };
    const svc = servicio(prisma);
    await svc.updateTutorial(BIZ, { tutorial: { ...base, etapa: 2 } as any });
    expect(prisma.business.update.mock.calls[0][0].data.tutorial).toEqual({ ...base, etapa: 2 });
    await svc.updateTutorial(BIZ, { tutorial: base as any });
    const guardado = prisma.business.update.mock.calls[1][0].data.tutorial;
    expect(guardado).toEqual(base);
    expect('etapa' in guardado).toBe(false);
  });
});

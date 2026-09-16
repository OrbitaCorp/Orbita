import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BusinessesService } from '../../src/businesses/businesses.service';
import { UpdateTutorialDto } from '../../src/businesses/dto/update-tutorial.dto';

// Segunda etapa de la Checklist del panel (15/09). Lo que se prueba acá es
// el tildado automático nuevo de GET /business/tutorial (`cumplidas`): cada
// tarea de la etapa 2 se deduce del estado real del negocio, y la etapa 1
// sigue saliendo igual. Más el campo `etapa` del DTO (opcional, 1 | 2).
//
// La etapa 2 pasó a quince tareas (pedido de Ale: que cubra casi todo el
// panel). Doce se detectan solas; `herramientas`, `reportes` y `plan` no
// (mirar una pantalla no deja rastro en la base) y se tildan a mano.

const BIZ = 'biz-1';

type Conteos = Partial<{
  pedidos: number; clientes: number; plantillas: number; descuentos: number; miembros: number;
  /** Pedidos en PREPARING/SHIPPED/DELIVERED: los que se movieron a mano. */
  pedidosMovidos: number;
  dominios: number;
  /** Campos de business_config que pisan los defaults (contacto/redes/postventa). */
  config: Record<string, unknown> | null;
  mode: 'FULL' | 'SHOWCASE';
  storefront: { homeTemplate: string | null; createdAt: Date; updatedAt: Date } | null;
  notificaciones: { createdAt: Date; updatedAt: Date } | null;
  tutorial: unknown;
}>;

// La fila que el onboarding crea con defaults: sin contacto ni redes
// cargados y con los seis toggles de postventa como los pone el schema.
const CONFIG_DEFAULTS = {
  enabledCarriers: [], carrierShippingCosts: null, freeShippingFrom: null, shippingPolicy: null,
  whatsapp: null, email: null, scheduleText: null,
  instagram: null, tiktok: null, facebook: null,
  returnsEnabled: true, returnsCreditNoteEnabled: true, returnsMpRefundEnabled: false,
  cancellationsEnabled: true, cancellationsCreditNoteEnabled: false, cancellationsMpRefundEnabled: true,
};

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
    businessConfig: {
      findUnique: jest.fn().mockResolvedValue(
        c.config === null ? null : { ...CONFIG_DEFAULTS, ...(c.config ?? {}) },
      ),
    },
    mpCredentials: { findUnique: jest.fn().mockResolvedValue(null) },
    category: { count: count(0) },
    product: { count: count(0) },
    branch: { findFirst: jest.fn().mockResolvedValue(null) },
    // Dos consultas distintas sobre la misma tabla: todos los pedidos vivos
    // (tarea `pedidos`) y solo los que se movieron de estado (`estados`).
    order: {
      count: jest.fn().mockImplementation(({ where }: { where: { status?: unknown } }) =>
        Promise.resolve(where.status ? (c.pedidosMovidos ?? 0) : (c.pedidos ?? 0)),
      ),
    },
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
    customDomain: { count: count(c.dominios) },
  };
}

const servicio = (prisma: unknown) => new BusinessesService(prisma as any, {} as any, {} as any, {} as any);
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

  it('estados: solo cuenta un pedido movido a mano (PREPARING/SHIPPED/DELIVERED)', async () => {
    // Cargar un pedido de mostrador (nace COMPLETED) cumple `pedidos`, no
    // `estados`: si no, la segunda tarea se tildaría sola con la primera.
    expect(await cumplidasDe({ pedidos: 1 })).toEqual(['pedidos']);
    expect(await cumplidasDe({ pedidos: 1, pedidosMovidos: 1 })).toEqual(['pedidos', 'estados']);
    const prisma = prismaDe({ pedidos: 1, pedidosMovidos: 1 });
    await servicio(prisma).getTutorial(BIZ);
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { businessId: BIZ, deletedAt: null, status: { in: ['PREPARING', 'SHIPPED', 'DELIVERED'] } },
    });
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
    // `postventa` también viene de arriba en SHOWCASE (ver su propio test).
    expect(await cumplidasDe({ mode: 'SHOWCASE' })).toEqual(['plantillas', 'postventa']);
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

  it('contacto: con WhatsApp, email u horarios cargados', async () => {
    expect(await cumplidasDe({ config: { whatsapp: '+5491133334444' } })).toEqual(['contacto']);
    expect(await cumplidasDe({ config: { email: 'hola@zapatos.com' } })).toEqual(['contacto']);
    expect(await cumplidasDe({ config: { scheduleText: 'Lun a Vie 9-18' } })).toEqual(['contacto']);
    // Un campo en blanco no es un dato cargado.
    expect(await cumplidasDe({ config: { whatsapp: '   ' } })).toEqual([]);
  });

  it('redes: con Instagram, TikTok o Facebook', async () => {
    expect(await cumplidasDe({ config: { instagram: '@zapatos' } })).toEqual(['redes']);
    expect(await cumplidasDe({ config: { tiktok: '@zapatos' } })).toEqual(['redes']);
    expect(await cumplidasDe({ config: { facebook: 'zapatos' } })).toEqual(['redes']);
    expect(await cumplidasDe({ config: { instagram: '' } })).toEqual([]);
  });

  it('dominio: con un dominio propio comprado o conectado, en cualquier estado', async () => {
    expect(await cumplidasDe({ dominios: 1 })).toEqual(['dominio']);
    const prisma = prismaDe({ dominios: 1 });
    await servicio(prisma).getTutorial(BIZ);
    // Sin filtro por status: la tarea es "ponete tu dirección", no "esperá
    // a que propague el DNS".
    expect(prisma.customDomain.count).toHaveBeenCalledWith({ where: { businessId: BIZ } });
  });

  it('postventa: los defaults del schema no cuentan; cualquier toggle cambiado sí', async () => {
    expect(await cumplidasDe()).toEqual([]);
    expect(await cumplidasDe({ config: { returnsEnabled: false } })).toEqual(['postventa']);
    expect(await cumplidasDe({ config: { returnsMpRefundEnabled: true } })).toEqual(['postventa']);
    expect(await cumplidasDe({ config: { cancellationsCreditNoteEnabled: true } })).toEqual(['postventa']);
    expect(await cumplidasDe({ config: { cancellationsMpRefundEnabled: false } })).toEqual(['postventa']);
    // Sin fila de config todavía: no se puede afirmar que la tocó.
    expect(await cumplidasDe({ config: null })).toEqual([]);
  });

  it('postventa: una vidriera (SHOWCASE) la tiene cumplida — no vende, no tiene devoluciones', async () => {
    expect(await cumplidasDe({ mode: 'SHOWCASE' })).toEqual(['plantillas', 'postventa']);
  });

  it('herramientas, reportes y plan no se detectan nunca: se tildan a mano', async () => {
    const todo = await cumplidasDe({
      pedidos: 1, pedidosMovidos: 1, clientes: 1, plantillas: 1, descuentos: 1, miembros: 2, dominios: 1,
      config: { whatsapp: '+5491133334444', instagram: '@zapatos', returnsEnabled: false },
      storefront: { homeTemplate: 'vidriera', createdAt: T0, updatedAt: T0 },
      notificaciones: { createdAt: T0, updatedAt: T0_MAS_5MIN },
    });
    expect(todo).not.toContain('herramientas');
    expect(todo).not.toContain('reportes');
    expect(todo).not.toContain('plan');
  });

  it('todo junto: las doce detectables, en el orden de la lista del panel, después de las de la etapa 1', async () => {
    const prisma = prismaDe({
      pedidos: 1, pedidosMovidos: 1, clientes: 1, plantillas: 1, descuentos: 1, miembros: 2, dominios: 1,
      config: { whatsapp: '+5491133334444', instagram: '@zapatos', returnsEnabled: false },
      storefront: { homeTemplate: 'vidriera', createdAt: T0, updatedAt: T0 },
      notificaciones: { createdAt: T0, updatedAt: T0_MAS_5MIN },
    });
    prisma.mpCredentials.findUnique.mockResolvedValue({ id: 'mp' });
    const { cumplidas } = await servicio(prisma).getTutorial(BIZ);
    expect(cumplidas).toEqual([
      'mp',
      'pedidos', 'estados', 'clientes', 'plantillas', 'apariencia', 'contacto', 'redes',
      'descuentos', 'dominio', 'equipo', 'notificaciones', 'postventa',
    ]);
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

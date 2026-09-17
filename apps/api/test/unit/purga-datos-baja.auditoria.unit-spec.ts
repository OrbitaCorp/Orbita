import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

// Auditoría interna, hallazgo `businesses-sin-baja` (RBT-699) — check c1.
//
// La baja ya funcionaba y ya cortaba el débito de Mercado Pago (eso lo cubre
// baja-negocio.auditoria.unit-spec.ts). Lo que faltaba era definir qué pasa
// con los datos cuando la baja se hace DEFINITIVA a los 60 días: hasta ahora
// el barrido nocturno solo ponía `deletedAt` y dejaba absolutamente todo en la
// base — el mail, el teléfono, el DNI y la dirección de cada cliente de una
// tienda que ya no existe.
//
// Criterio decidido por el CEO (2026-09-16): se borra, NO se anonimiza, y se
// conserva únicamente lo que la AFIP obliga a guardar 10 años. Traducido:
// se borra la PERSONA, se conserva el COMPROBANTE.

const BIZ = 'biz-1';

// Delegates de Prisma que toca (o que NO tiene que tocar) el borrado
// definitivo. Se mockean todos por igual para poder afirmar tanto lo que se
// llamó como lo que no.
const MODELOS = [
  'business',
  'order',
  'orderItem',
  'onlineOrderDetails',
  'payment',
  'return',
  'creditNote',
  'cancellationRequest',
  'discountRedemption',
  'stockMovement',
  'discount',
  'gameSession',
  'message',
  'conversation',
  'review',
  'emailLog',
  'auditLog',
  'notification',
  'orbiConversation',
  'refreshToken',
  'passwordResetToken',
  'emailVerificationToken',
  'mpCredentials',
  'address',
  'customer',
  'member',
  'subscription',
  'subscriptionPayment',
] as const;

const METODOS = ['update', 'updateMany', 'delete', 'deleteMany', 'create', 'findMany', 'findUnique', 'findFirst'] as const;

type Prisma = Record<string, Record<string, jest.Mock>>;

function armar(opts: { vencido?: boolean } = {}) {
  const vencido = opts.vencido ?? true;
  // Orden real de las llamadas: varias afirmaciones dependen de que los
  // punteros se suelten ANTES de borrar a la persona, y de que el mail salga
  // antes de la purga.
  const secuencia: string[] = [];
  let yaBorrado = false;

  const prisma: Prisma = {};
  for (const modelo of MODELOS) {
    prisma[modelo] = {} as Record<string, jest.Mock>;
    for (const metodo of METODOS) {
      prisma[modelo][metodo] = jest.fn((..._args: unknown[]) => {
        secuencia.push(`${modelo}.${metodo}`);
        return { count: 0 };
      });
    }
  }

  // Primer findMany = los que hay que avisar (7 días antes); segundo = los que
  // hay que borrar. Se distinguen por `cancellationWarningEmailSentAt`.
  prisma.business.findMany = jest.fn((args: { where: Record<string, unknown> }) => {
    secuencia.push('business.findMany');
    if ('cancellationWarningEmailSentAt' in args.where) return [];
    // Una vez seteado `deletedAt` el negocio deja de aparecer en el barrido:
    // así se comporta la consulta real (filtra por `deletedAt: null`).
    return vencido && !yaBorrado ? [{ id: BIZ, name: 'Tienda' }] : [];
  }) as unknown as jest.Mock;
  prisma.business.findUnique = jest.fn(() => ({ name: 'Tienda', subdomain: 'tienda' })) as unknown as jest.Mock;
  prisma.business.update = jest.fn((args: { data: Record<string, unknown> }) => {
    secuencia.push('business.update');
    if (args.data.deletedAt) yaBorrado = true;
    return {};
  }) as unknown as jest.Mock;
  prisma.member.findMany = jest.fn(() => [{ email: 'ana@x.com' }]) as unknown as jest.Mock;

  const transacciones: unknown[][] = [];
  (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn((ops: unknown[]) => {
    secuencia.push('$transaction');
    transacciones.push(ops);
    return ops;
  });

  const config = { get: () => undefined };
  const mail = {
    sendBusinessDeletionWarning: jest.fn().mockResolvedValue(undefined),
    sendBusinessDeleted: jest.fn(() => {
      secuencia.push('mail.sendBusinessDeleted');
      return Promise.resolve(undefined);
    }),
  };

  const svc = new SubscriptionsService(prisma as any, config as any, {} as any, {} as any, {} as any, {} as any, mail as any, undefined);
  return { svc, prisma, mail, secuencia, transacciones };
}

/** Índice de la primera llamada a `nombre` dentro de la secuencia real. */
function cuando(secuencia: string[], nombre: string): number {
  const i = secuencia.indexOf(nombre);
  expect(i).toBeGreaterThanOrEqual(0); // si no se llamó, el test tiene que fallar acá
  return i;
}

describe('Baja definitiva de un negocio: se borran los datos de las personas', () => {
  it('borra las cuentas: clientes, miembros, direcciones guardadas y sus tokens', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    expect(prisma.customer.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.member.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.address.deleteMany).toHaveBeenCalledWith({ where: { customer: { businessId: BIZ } } });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { member: { businessId: BIZ } } });
  });

  it('borra el rastro de la persona que no respalda ninguna factura', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    // Conversaciones y sus mensajes, reseñas, el registro de mails enviados
    // (guarda el destinatario) y los audit_logs (guardan member_name).
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({ where: { conversation: { businessId: BIZ } } });
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.emailLog.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
    expect(prisma.orbiConversation.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
  });

  it('borra las credenciales de Mercado Pago: son un secreto de alguien que ya se fue', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();
    expect(prisma.mpCredentials.deleteMany).toHaveBeenCalledWith({ where: { businessId: BIZ } });
  });
});

describe('Baja definitiva de un negocio: se conserva lo que exige la AFIP', () => {
  it('no borra pedidos, ítems, pagos, devoluciones ni notas de crédito', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    for (const modelo of ['order', 'orderItem', 'payment', 'return', 'creditNote', 'cancellationRequest']) {
      expect(prisma[modelo].deleteMany).not.toHaveBeenCalled();
      expect(prisma[modelo].delete).not.toHaveBeenCalled();
    }
  });

  it('no borra el historial de lo que Órbita le facturó al negocio', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();
    expect(prisma.subscriptionPayment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.subscription.deleteMany).not.toHaveBeenCalled();
  });

  it('conserva la fila del negocio: es el ancla de los pedidos que quedan', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();
    expect(prisma.business.deleteMany).not.toHaveBeenCalled();
    expect(prisma.business.delete).not.toHaveBeenCalled();
    expect(prisma.business.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: BIZ } }));
    expect(prisma.business.update.mock.calls.at(-1)![0].data).toHaveProperty('deletedAt');
  });

  it('del pedido online solo suelta el puntero a la dirección: el snapshot del comprador queda', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    // Nombre, mail, teléfono, DNI y la dirección en texto plano del comprador
    // viven acá adentro y son parte del comprobante: no se tocan.
    expect(prisma.onlineOrderDetails.updateMany).toHaveBeenCalledWith({
      where: { order: { businessId: BIZ } },
      data: { shippingAddressId: null },
    });
    expect(prisma.onlineOrderDetails.deleteMany).not.toHaveBeenCalled();
  });
});

describe('Baja definitiva de un negocio: los punteros se sueltan antes de borrar a la persona', () => {
  it('desvincula el pedido del cliente en vez de borrar el pedido', async () => {
    const { svc, prisma, secuencia } = armar();
    await svc.processCancellationWindow();

    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { customerId: null } });
    expect(cuando(secuencia, 'order.updateMany')).toBeLessThan(cuando(secuencia, 'customer.deleteMany'));
  });

  it('desvincula al cajero que verificó una transferencia antes de borrar los miembros', async () => {
    const { svc, prisma, secuencia } = armar();
    await svc.processCancellationWindow();

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { verifiedBy: null } });
    expect(prisma.stockMovement.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { createdBy: null } });
    expect(cuando(secuencia, 'payment.updateMany')).toBeLessThan(cuando(secuencia, 'member.deleteMany'));
    expect(cuando(secuencia, 'stockMovement.updateMany')).toBeLessThan(cuando(secuencia, 'member.deleteMany'));
  });

  it('nulea también las tres columnas customer_id que nunca tuvieron FK', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    // credit_notes, cancellation_requests y discount_redemptions tienen la
    // columna pero no la foreign key: sin esto quedarían apuntando a un
    // cliente que ya no existe (no hay ON DELETE SET NULL que las salve).
    for (const modelo of ['creditNote', 'cancellationRequest', 'discountRedemption']) {
      expect(prisma[modelo].updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { customerId: null } });
    }
  });

  it('un descuento personal (premio de un juego) deja de ser de nadie', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();
    expect(prisma.discount.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { customerId: null } });
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ }, data: { customerId: null } });
  });
});

describe('Baja definitiva de un negocio: atomicidad, orden e idempotencia', () => {
  it('el deletedAt y la purga van en una sola transacción', async () => {
    const { svc, transacciones, secuencia } = armar();
    await svc.processCancellationWindow();

    expect(transacciones).toHaveLength(1);
    // Todo lo que borra/nulea entra en esa única transacción, el deletedAt
    // incluido: o el negocio queda borrado y sin datos personales, o nada.
    expect(secuencia.filter((s) => s === '$transaction')).toHaveLength(1);
    expect(cuando(secuencia, 'business.update')).toBeLessThan(cuando(secuencia, 'customer.deleteMany'));
  });

  it('la purga es toda updateMany/deleteMany: no hay un solo borrado por id', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    // Es lo que la hace idempotente por construcción: un segundo pase afecta
    // 0 filas en vez de explotar con "registro no encontrado".
    for (const modelo of MODELOS) {
      expect(prisma[modelo].delete).not.toHaveBeenCalled();
    }
  });

  it('correrlo dos veces no vuelve a purgar ni rompe', async () => {
    const { svc, prisma, transacciones } = armar();
    await svc.processCancellationWindow();
    await expect(svc.processCancellationWindow()).resolves.toBeUndefined();

    // La segunda noche el negocio ya tiene deletedAt, así que ni aparece.
    expect(transacciones).toHaveLength(1);
    expect(prisma.customer.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.member.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('el borrado de audit_logs que este archivo se permite es uno solo, y va por negocio', () => {
    // audit.auditoria.unit-spec.ts vigila que audit_logs sea de solo agregado
    // y tuvo que sumar a subscriptions.service.ts como segunda excepción. Para
    // que esa excepción no se ensanche sola, acá se fija su forma exacta: un
    // único deleteMany acotado al negocio que se está borrando. Nunca por
    // entidad, acción ni actor — eso sí sería hacer desaparecer un rastro.
    const src = readFileSync(join(__dirname, '../../src/subscriptions/subscriptions.service.ts'), 'utf8');
    const mutaciones = src.match(/auditLog\.(?:update|updateMany|upsert|delete|deleteMany)\([^)]*\)/g) ?? [];
    expect(mutaciones).toEqual(['auditLog.deleteMany(delNegocio)']);
  });

  it('el aviso de borrado sale ANTES de la purga, para que su propio email_log también se borre', async () => {
    const { svc, mail, secuencia } = armar();
    await svc.processCancellationWindow();

    expect(mail.sendBusinessDeleted).toHaveBeenCalledWith('ana@x.com', { businessName: 'Tienda' }, { businessId: BIZ });
    expect(cuando(secuencia, 'mail.sendBusinessDeleted')).toBeLessThan(cuando(secuencia, '$transaction'));
  });
});

describe('Baja definitiva de un negocio: no toca a quien todavía está en la ventana', () => {
  it('no purga nada si ningún negocio cumplió los 60 días', async () => {
    const { svc, prisma, mail, transacciones } = armar({ vencido: false });
    await svc.processCancellationWindow();

    expect(transacciones).toHaveLength(0);
    expect(prisma.customer.deleteMany).not.toHaveBeenCalled();
    expect(prisma.member.deleteMany).not.toHaveBeenCalled();
    expect(prisma.business.update).not.toHaveBeenCalled();
    expect(mail.sendBusinessDeleted).not.toHaveBeenCalled();
  });

  it('solo levanta negocios dados de baja, no borrados, y con la fecha ya vencida', async () => {
    const { svc, prisma } = armar();
    await svc.processCancellationWindow();

    const where = prisma.business.findMany.mock.calls.at(-1)![0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.cancelledAt).toEqual({ not: null });
    expect(where.scheduledDeletionAt.lt).toBeInstanceOf(Date);
  });
});

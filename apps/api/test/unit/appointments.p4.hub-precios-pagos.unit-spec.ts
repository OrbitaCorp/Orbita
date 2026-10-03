import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HubAvanzadoService } from '../../src/appointments/avanzado/hub/hub.service';
import { PreciosHorarioService } from '../../src/appointments/avanzado/precios-horario/precios-horario.service';
import { AvanzadoPagosService } from '../../src/appointments/avanzado/pagos/pagos.service';
import { CONFIG_DE_FABRICA } from '../../src/appointments/avanzado/comun/funciones';
import { instanteDe } from '../../src/appointments/horarios/horarios';
import { BIZ, auditor, avanzado, conTransaccion, contexto } from './appointments.p4.helpers';

// El hub de Avanzado (GET/PUT appointments/advanced), Precios por horario y lo
// que hace un pago aprobado de algo vendido en el sitio.

describe('Contexto: el negocio tiene que ser de Turnos', () => {
  it('una tienda (STORE) o un negocio sin appointment_settings: 404 "Este negocio no usa Turnos"', async () => {
    await expect(contexto({ negocio: { vertical: 'STORE' } }).svc.delNegocio(BIZ)).rejects.toThrow('Este negocio no usa Turnos');
    await expect(contexto({ negocio: { appointmentSettings: null } }).svc.delNegocio(BIZ)).rejects.toThrow('Este negocio no usa Turnos');
    await expect(contexto({ negocio: null }).svc.delNegocio(BIZ)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('busca el negocio por id y sin borrar', async () => {
    const { svc, business } = contexto();
    await svc.delNegocio(BIZ);
    expect(business.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: BIZ, deletedAt: null } }));
  });

  it('activa = add-on Y interruptor; con el interruptor apagado ni consulta el add-on', async () => {
    const apagada = contexto({ settings: { advanced: null } });
    await expect(apagada.svc.activa(BIZ, 'paquetes')).resolves.toMatchObject({ on: false });
    expect(apagada.businesses.hasActiveAddon).not.toHaveBeenCalled();
    await expect(contexto({ addon: false, settings: { advanced: avanzado({ paquetes: true }) } }).svc.activa(BIZ, 'paquetes')).resolves.toMatchObject({ on: false });
    await expect(contexto({ settings: { advanced: avanzado({ paquetes: true }) } }).svc.activa(BIZ, 'paquetes')).resolves.toMatchObject({ on: true });
  });
});

describe('Hub de Avanzado', () => {
  function armar(opts: { advanced?: Record<string, unknown> | null; addon?: boolean; servicios?: number } = {}) {
    const ctx = contexto({ addon: opts.addon ?? false, settings: { advanced: opts.advanced ?? null } });
    const prisma = {
      business: ctx.business,
      appointmentSettings: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      appointmentService: { count: jest.fn().mockResolvedValue(opts.servicios ?? 1) },
    };
    const audit = auditor();
    return { svc: new HubAvanzadoService(prisma as never, ctx.svc, audit as never), prisma, audit };
  }

  it('GET: todas las funciones con su interruptor y config de fábrica, si tiene el add-on y las recomendadas del rubro', async () => {
    const r = await armar({ advanced: avanzado({ 'gift-cards': { mesesValidez: 12 } }) }).svc.obtener(BIZ);
    expect(r.hasAdvanced).toBe(false);
    expect(Object.keys(r.functions).sort()).toEqual(['fidelidad', 'gift-cards', 'membresias', 'paquetes', 'plantillas', 'precios-horario', 'recuperar', 'turno-fijo']);
    expect(r.functions['gift-cards']).toEqual({ on: true, config: { ...CONFIG_DE_FABRICA['gift-cards'], mesesValidez: 12 } });
    expect(r.functions.paquetes).toEqual({ on: false, config: CONFIG_DE_FABRICA.paquetes });
    expect(r.recommended).toEqual(expect.arrayContaining(['fidelidad', 'recuperar', 'gift-cards']));
  });

  it('PUT: guarda el interruptor y MEZCLA la config con lo que había (lo que no viene, no se pisa)', async () => {
    const { svc, prisma, audit } = armar({ advanced: avanzado({ membresias: { diasPausa: 20, matricula: 5_000 } }) });
    const r = await svc.guardar(BIZ, 'm', 'membresias', { on: false, config: { diaCobro: 10 } });
    const guardado = prisma.appointmentSettings.updateMany.mock.calls[0][0];
    expect(guardado.where).toEqual({ businessId: BIZ });
    expect(guardado.data.advanced.membresias).toEqual({ on: false, config: { diasPausa: 20, matricula: 5_000, diaCobro: 10 } });
    expect(r.membresias).toMatchObject({ on: false, config: { diasPausa: 20, matricula: 5_000, diaCobro: 10, pausa: true } });
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ businessId: BIZ, entityType: 'appointment_settings', action: 'DEACTIVATE' }));
  });

  it('PUT: valida la config con el DTO de cada función (campos desconocidos y fuera de rango → 400)', async () => {
    const { svc, prisma } = armar();
    await expect(svc.guardar(BIZ, 'm', 'membresias', { on: true, config: { diaCobro: 31 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.guardar(BIZ, 'm', 'gift-cards', { on: true, config: { montos: [500] } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.guardar(BIZ, 'm', 'paquetes', { on: true, config: { hackeo: true } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.guardar(BIZ, 'm', 'turno-fijo', { on: true, config: { frecuencias: [] } })).rejects.toThrow('Dejá al menos una frecuencia.');
    expect(prisma.appointmentSettings.updateMany).not.toHaveBeenCalled();
  });

  it('PUT: los servicios que nombra la config tienen que ser de ESTE negocio', async () => {
    const { svc, prisma } = armar({ servicios: 1 });
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    await expect(svc.guardar(BIZ, 'm', 'turno-fijo', { on: true, config: { serviceIds: ids } })).rejects.toThrow('Uno de los servicios elegidos no existe.');
    expect(prisma.appointmentService.count).toHaveBeenCalledWith({ where: { businessId: BIZ, id: { in: ids }, deletedAt: null } });
  });

  it('PUT de una función que no existe: 404', async () => {
    await expect(armar().svc.guardar(BIZ, 'm', 'formularios', { on: true })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Precios por horario', () => {
  const regla = { id: 'r-1', businessId: BIZ, weekdays: [0], fromMin: 540, toMin: 720, adjustPercent: -15, isActive: true, createdAt: new Date(), updatedAt: new Date() };

  function armar(opts: { addon?: boolean; on?: boolean } = {}) {
    const ctx = contexto({ addon: opts.addon ?? true, settings: { advanced: opts.on === false ? null : avanzado({ 'precios-horario': true }) } });
    const prisma = {
      business: ctx.business,
      appointmentPriceRule: {
        findMany: jest.fn().mockResolvedValue([regla]), findFirst: jest.fn().mockResolvedValue(regla), count: jest.fn().mockResolvedValue(0),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...regla, ...data, id: 'r-2' })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { svc: new PreciosHorarioService(prisma as never, ctx.svc, auditor() as never), prisma };
  }

  it('ajustarPrecio aplica la franja; sin add-on o apagada devuelve el precio base sin leer reglas', async () => {
    const LUNES_10 = instanteDe('2026-10-05', 600);
    await expect(armar().svc.ajustarPrecio(BIZ, 10_000, LUNES_10)).resolves.toEqual({ precio: 8_500, adjustPercent: -15, reglaId: 'r-1' });
    for (const o of [{ addon: false }, { on: false }]) {
      const { svc, prisma } = armar(o);
      await expect(svc.ajustarPrecio(BIZ, 10_000, LUNES_10)).resolves.toEqual({ precio: 10_000, adjustPercent: 0, reglaId: null });
      expect(prisma.appointmentPriceRule.findMany).not.toHaveBeenCalled();
    }
  });

  it('reglasVigentes lee solo las activas del negocio', async () => {
    const { svc, prisma } = armar();
    await svc.reglasVigentes(BIZ);
    expect(prisma.appointmentPriceRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, isActive: true } }));
  });

  it('la franja tiene que terminar después de empezar; editar/borrar una de otro negocio da 404', async () => {
    const { svc, prisma } = armar();
    await expect(svc.crear(BIZ, 'm', { weekdays: [0], fromMin: 720, toMin: 720, adjustPercent: -10 })).rejects.toThrow('La franja tiene que terminar después de empezar.');
    prisma.appointmentPriceRule.findFirst.mockResolvedValueOnce(null);
    await expect(svc.editar(BIZ, 'm', 'r-x', { weekdays: [0], fromMin: 540, toMin: 600, adjustPercent: 10 })).rejects.toBeInstanceOf(NotFoundException);
    prisma.appointmentPriceRule.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.borrar(BIZ, 'm', 'r-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointmentPriceRule.deleteMany).toHaveBeenCalledWith({ where: { id: 'r-x', businessId: BIZ } });
  });
});

describe('Pago aprobado de algo vendido en el sitio (lo llama el webhook de P2)', () => {
  function armar(pago: Record<string, unknown> | null) {
    const ctx = contexto({ settings: { advanced: avanzado({ 'gift-cards': { mesesValidez: 3 } }) } });
    const prisma = conTransaccion({
      business: ctx.business,
      appointmentPayment: { findFirst: jest.fn().mockResolvedValue(pago) },
      appointmentPackagePurchase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pp-1', businessId: BIZ, package: { validDays: 30 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appointmentGiftCard: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      appointmentMembership: { findFirst: jest.fn(), updateMany: jest.fn() },
    });
    return { svc: new AvanzadoPagosService(prisma as never, ctx.svc), prisma };
  }
  const PAGADO = new Date('2026-10-05T15:00:00Z');

  it('PACKAGE: pone paidAt solo si no estaba (idempotente) y el vencimiento corre desde el pago', async () => {
    const { svc, prisma } = armar({ id: 'pay-1', businessId: BIZ, kind: 'PACKAGE', packagePurchaseId: 'pp-1', paidAt: PAGADO });
    await expect(svc.aplicarPagoAprobado(BIZ, 'pay-1')).resolves.toEqual({ kind: 'PACKAGE', aplicado: true });
    expect(prisma.appointmentPayment.findFirst).toHaveBeenCalledWith({ where: { id: 'pay-1', businessId: BIZ } });
    expect(prisma.appointmentPackagePurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 'pp-1', businessId: BIZ, paidAt: null },
      data: { paidAt: PAGADO, expiresAt: new Date(PAGADO.getTime() + 30 * 86_400_000) },
    });
    prisma.appointmentPackagePurchase.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.aplicarPagoAprobado(BIZ, 'pay-1')).resolves.toEqual({ kind: 'PACKAGE', aplicado: false });
  });

  it('GIFT_CARD: paga y vence a los meses de la config', async () => {
    const { svc, prisma } = armar({ id: 'pay-2', businessId: BIZ, kind: 'GIFT_CARD', giftCardId: 'gc-1', paidAt: PAGADO });
    await svc.aplicarPagoAprobado(BIZ, 'pay-2');
    expect(prisma.appointmentGiftCard.updateMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', businessId: BIZ, paidAt: null },
      data: { paidAt: PAGADO, expiresAt: new Date('2027-01-05T15:00:00.000Z') },
    });
  });

  it('un pago de otro negocio (o de un turno) no hace nada', async () => {
    await expect(armar(null).svc.aplicarPagoAprobado(BIZ, 'pay-x')).resolves.toEqual({ kind: null, aplicado: false });
    await expect(armar({ id: 'p', businessId: BIZ, kind: 'DEPOSIT' }).svc.aplicarPagoAprobado(BIZ, 'p')).resolves.toEqual({ kind: 'DEPOSIT', aplicado: false });
  });
});

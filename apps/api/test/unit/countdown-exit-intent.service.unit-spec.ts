import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CountdownService } from '../../src/countdown/countdown.service';
import { DiscountCountdownService } from '../../src/discounts/discount-countdown.service';
import { ExitIntentService } from '../../src/exit-intent/exit-intent.service';

// Unit tests de la cuenta regresiva (opción de un descuento, paquete Avanzado)
// y del aviso de salida. Mockean Prisma — no tocan la base.
//
// Lo que se cubre es lo que se puede romper sin que nadie se dé cuenta:
//  - el gate del add-on: en el endpoint PÚBLICO (no pasa por AddonGuard) y al
//    prender la opción desde el formulario del descuento,
//  - que el reloj viva y muera con su descuento (desactivado, borrado, vencido),
//  - que solo un descuento por negocio pueda tenerla,
//  - que reactivar el aviso de salida cuente como campaña nueva.

const EN_UNA_SEMANA = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const HACE_UN_DIA = new Date(Date.now() - 24 * 3600 * 1000);

function descuento(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'disc-1', name: 'Cyber Week', isActive: true, deletedAt: null,
    type: 'PERCENT_PRODUCT', value: 40, scope: 'CATEGORY',
    endDate: EN_UNA_SEMANA, products: [], categories: [{ categoryId: 'cat-1' }],
    ...over,
  };
}

function filaCountdown(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cd-1', businessId: 'biz-1', isActive: true,
    title: 'Cyber Week', subtitle: null,
    endDate: EN_UNA_SEMANA, finishedMessage: null,
    ctaText: null, ctaLink: null, placement: 'HOME',
    showProductsOnHome: true,
    discountId: 'disc-1', discount: descuento(),
    ...over,
  };
}

function filaSalida(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ei-1', businessId: 'biz-1', isActive: true,
    title: '¿Te vas?', message: null, badge: null, code: null,
    ctaText: null, ctaLink: null,
    frequency: 'ONCE_PER_DAY', minSeconds: 15, onMobile: true, campaignVersion: 1,
    ...over,
  };
}

function servicios(opts: { addon?: boolean; countdown?: any; salida?: any } = {}) {
  const prisma: any = {
    countdownConfig: {
      findUnique: jest.fn().mockResolvedValue(opts.countdown ?? null),
      upsert: jest.fn().mockImplementation(({ create, update }: any) =>
        Promise.resolve(filaCountdown({ ...(opts.countdown ? update : create) }))),
      update: jest.fn().mockResolvedValue(filaCountdown({ isActive: false })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    exitIntentConfig: {
      findUnique: jest.fn().mockResolvedValue(opts.salida ?? null),
      upsert: jest.fn().mockImplementation(({ create, update }: any) =>
        Promise.resolve(filaSalida({ ...(opts.salida ? update : create), campaignVersion: 1 }))),
      update: jest.fn().mockResolvedValue(filaSalida({ campaignVersion: 2 })),
    },
  };
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(opts.addon ?? true) };
  return {
    prisma,
    businesses,
    publico: new CountdownService(prisma as any, businesses as any),
    panel: new DiscountCountdownService(prisma as any, businesses as any),
    salida: new ExitIntentService(prisma as any, businesses as any),
  };
}

describe('CountdownService — endpoint público (unit)', () => {
  it('no devuelve nada si el negocio no tiene el add-on Avanzado', async () => {
    const { publico, prisma } = servicios({ addon: false, countdown: filaCountdown() });
    await expect(publico.getActiveCountdown('biz-1')).resolves.toBeNull();
    // Ni siquiera llega a consultar la config: el gate corta antes.
    expect(prisma.countdownConfig.findUnique).not.toHaveBeenCalled();
  });

  it('no devuelve nada si está apagado', async () => {
    const { publico } = servicios({ countdown: filaCountdown({ isActive: false }) });
    await expect(publico.getActiveCountdown('biz-1')).resolves.toBeNull();
  });

  it('no devuelve nada si el descuento está desactivado o borrado', async () => {
    // Es el caso de "lo apagué desde el listado": el reloj se esconde solo,
    // sin que la fila cambie, y vuelve al reactivar el descuento.
    const apagado = servicios({ countdown: filaCountdown({ discount: descuento({ isActive: false }) }) });
    await expect(apagado.publico.getActiveCountdown('biz-1')).resolves.toBeNull();
    const borrado = servicios({ countdown: filaCountdown({ discount: descuento({ deletedAt: new Date() }) }) });
    await expect(borrado.publico.getActiveCountdown('biz-1')).resolves.toBeNull();
  });

  it('un countdown vencido no se muestra', async () => {
    const { publico } = servicios({ countdown: filaCountdown({ endDate: HACE_UN_DIA }) });
    await expect(publico.getActiveCountdown('biz-1')).resolves.toBeNull();
  });

  it('devuelve el descuento entero: es lo que dibuja la sección de la portada', async () => {
    const { publico } = servicios({ countdown: filaCountdown() });
    const r = await publico.getActiveCountdown('biz-1');
    expect(r?.title).toBe('Cyber Week');
    expect(r?.discountId).toBe('disc-1');
    expect(r?.showProductsOnHome).toBe(true);
    expect(r?.descuentoTipo).toBe('PERCENT');
    expect(r?.descuentoValor).toBe(40);
    expect(r?.categoryIds).toEqual(['cat-1']);
  });
});

describe('DiscountCountdownService — opción del descuento (unit)', () => {
  const DTO = { name: 'Cyber Week', scope: 'CATEGORY', endDate: EN_UNA_SEMANA.toISOString(), countdown: true };

  it('sin el add-on Avanzado no se puede prender', async () => {
    const { panel } = servicios({ addon: false });
    await expect(panel.validarAntesDeGuardar('biz-1', DTO as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sin el add-on, un descuento SIN la opción se guarda igual', async () => {
    const { panel } = servicios({ addon: false });
    await expect(panel.validarAntesDeGuardar('biz-1', { ...DTO, countdown: undefined } as any)).resolves.toBeUndefined();
    await expect(panel.validarAntesDeGuardar('biz-1', { ...DTO, countdown: false } as any)).resolves.toBeUndefined();
  });

  it('exige fecha de fin: sin vencimiento no hay nada que contar', async () => {
    const { panel } = servicios();
    await expect(panel.validarAntesDeGuardar('biz-1', { ...DTO, endDate: undefined } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una fecha de fin ya pasada', async () => {
    const { panel } = servicios();
    await expect(panel.validarAntesDeGuardar('biz-1', { ...DTO, endDate: HACE_UN_DIA.toISOString() } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un descuento de ticket: no tiene productos que mostrar en la portada', async () => {
    const { panel } = servicios();
    await expect(panel.validarAntesDeGuardar('biz-1', { ...DTO, scope: 'TICKET' } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('prenderla escribe la fila con el nombre y la fecha DEL DESCUENTO', async () => {
    const { panel, prisma } = servicios();
    await panel.aplicar('biz-1', { id: 'disc-1', name: 'Cyber Week', endDate: EN_UNA_SEMANA }, true);
    const { create } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(create.discountId).toBe('disc-1');
    expect(create.title).toBe('Cyber Week');
    // Lo que sostiene el "termina en X" de las cards.
    expect(create.endDate.toISOString()).toBe(EN_UNA_SEMANA.toISOString());
    expect(create.isActive).toBe(true);
    expect(create.showProductsOnHome).toBe(true);
  });

  it('prenderla en otro descuento se la saca al que la tenía (una sola por negocio)', async () => {
    const { panel, prisma } = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await panel.aplicar('biz-1', { id: 'disc-2', name: 'Hot Sale', endDate: EN_UNA_SEMANA }, true);
    const { update } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(update.discountId).toBe('disc-2');
    expect(update.title).toBe('Hot Sale');
  });

  it('apagarla solo afecta si era de ESTE descuento', async () => {
    const ajeno = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await ajeno.panel.aplicar('biz-1', { id: 'disc-2', name: 'Otro', endDate: EN_UNA_SEMANA }, false);
    expect(ajeno.prisma.countdownConfig.update).not.toHaveBeenCalled();

    const propio = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await propio.panel.aplicar('biz-1', { id: 'disc-1', name: 'Cyber Week', endDate: EN_UNA_SEMANA }, false);
    expect(propio.prisma.countdownConfig.update).toHaveBeenCalledWith({ where: { businessId: 'biz-1' }, data: { isActive: false } });
  });

  it('borrar el descuento apaga su reloj', async () => {
    const { panel, prisma } = servicios();
    await panel.apagarSiEsDe('biz-1', 'disc-1');
    expect(prisma.countdownConfig.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', discountId: 'disc-1' },
      data: { isActive: false },
    });
  });

  it('reporta qué descuento la tiene, y ninguno si está apagada', async () => {
    const prendida = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await expect(prendida.panel.discountIdConCountdown('biz-1')).resolves.toBe('disc-1');
    const apagada = servicios({ countdown: filaCountdown({ discountId: 'disc-1', isActive: false }) });
    await expect(apagada.panel.discountIdConCountdown('biz-1')).resolves.toBeNull();
    const nunca = servicios();
    await expect(nunca.panel.discountIdConCountdown('biz-1')).resolves.toBeNull();
  });
});

describe('ExitIntentService (unit)', () => {
  it('el endpoint público no devuelve nada sin el add-on Avanzado', async () => {
    const { salida, prisma } = servicios({ addon: false, salida: filaSalida() });
    await expect(salida.getActiveExitIntent('biz-1')).resolves.toBeNull();
    expect(prisma.exitIntentConfig.findUnique).not.toHaveBeenCalled();
  });

  it('el endpoint público no devuelve nada si está apagado', async () => {
    const { salida } = servicios({ salida: filaSalida({ isActive: false }) });
    await expect(salida.getActiveExitIntent('biz-1')).resolves.toBeNull();
  });

  it('prender uno que estaba apagado cuenta como campaña nueva', async () => {
    const { salida, prisma } = servicios({ salida: filaSalida({ isActive: false }) });
    await salida.upsert('biz-1', {
      title: '¿Te vas?', frequency: 'ONCE_PER_DAY', minSeconds: 15, onMobile: true, isActive: true,
    } as any);
    const { update } = prisma.exitIntentConfig.upsert.mock.calls[0][0];
    expect(update.campaignVersion).toEqual({ increment: 1 });
  });

  it('editar uno que YA estaba prendido no relanza la campaña', async () => {
    const { salida, prisma } = servicios({ salida: filaSalida({ isActive: true }) });
    await salida.upsert('biz-1', {
      title: 'Otro título', frequency: 'ALWAYS', minSeconds: 30, onMobile: false, isActive: true,
    } as any);
    const { update } = prisma.exitIntentConfig.upsert.mock.calls[0][0];
    expect(update.campaignVersion).toBeUndefined();
  });

  it('"Mostrar de nuevo" sobre algo nunca configurado da 404', async () => {
    const { salida } = servicios({ salida: null });
    await expect(salida.relanzar('biz-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('"Mostrar de nuevo" sube SOLO campaignVersion', async () => {
    const { salida, prisma } = servicios({ salida: filaSalida() });
    const r = await salida.relanzar('biz-1');
    expect(prisma.exitIntentConfig.update).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      data: { campaignVersion: { increment: 1 } },
    });
    expect(r.campaignVersion).toBe(2);
  });

  it('rechaza un link fuera de la tienda', async () => {
    const { salida } = servicios();
    await expect(salida.upsert('biz-1', {
      title: 'X', frequency: 'ALWAYS', minSeconds: 0, onMobile: true, isActive: true,
      ctaText: 'Ver', ctaLink: 'https://otro.com',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});

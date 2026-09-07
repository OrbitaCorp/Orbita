import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CountdownService } from '../../src/countdown/countdown.service';
import { ExitIntentService } from '../../src/exit-intent/exit-intent.service';

// Unit tests del módulo "Countdown y exit-intent" (paquete Avanzado). Mockean
// Prisma — no tocan la base.
//
// Lo que se cubre es lo que se puede romper sin que nadie se dé cuenta:
//  - el gate del add-on en los endpoints PÚBLICOS (que no pasan por
//    AddonGuard, porque no hay sesión de la que leer),
//  - que un countdown vencido no se muestre salvo que haya mensaje de cierre,
//  - la validación de links (solo rutas de la propia tienda),
//  - que reactivar el aviso de salida cuente como campaña nueva.

const EN_UNA_SEMANA = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const HACE_UN_DIA = new Date(Date.now() - 24 * 3600 * 1000);

function filaCountdown(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cd-1', businessId: 'biz-1', isActive: true,
    title: 'Cyber Week', subtitle: null,
    endDate: EN_UNA_SEMANA, finishedMessage: null,
    ctaText: null, ctaLink: null, placement: 'HOME',
    showProductsOnHome: true,
    discountId: null, discount: null,
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
    },
    // El módulo crea/actualiza un Discount real cuando `conDescuento` está en
    // true — mismo patrón que TwoForOneService.
    discount: {
      create: jest.fn().mockResolvedValue({ id: 'disc-nuevo' }),
      update: jest.fn().mockResolvedValue({ id: 'disc-1' }),
    },
    product: { count: jest.fn().mockResolvedValue(1) },
    category: { count: jest.fn().mockResolvedValue(1) },
    $transaction: jest.fn().mockImplementation((fn: any) => fn(prisma)),
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
    countdown: new CountdownService(prisma as any, businesses as any),
    salida: new ExitIntentService(prisma as any, businesses as any),
  };
}

describe('CountdownService (unit)', () => {
  it('el endpoint público no devuelve nada si el negocio no tiene el add-on Avanzado', async () => {
    const { countdown, prisma } = servicios({ addon: false, countdown: filaCountdown() });
    await expect(countdown.getActiveCountdown('biz-1')).resolves.toBeNull();
    // Ni siquiera llega a consultar la config: el gate corta antes.
    expect(prisma.countdownConfig.findUnique).not.toHaveBeenCalled();
  });

  it('el endpoint público no devuelve nada si está apagado', async () => {
    const { countdown } = servicios({ countdown: filaCountdown({ isActive: false }) });
    await expect(countdown.getActiveCountdown('biz-1')).resolves.toBeNull();
  });

  it('un countdown vencido SIN mensaje de cierre no se muestra', async () => {
    const { countdown } = servicios({ countdown: filaCountdown({ endDate: HACE_UN_DIA }) });
    await expect(countdown.getActiveCountdown('biz-1')).resolves.toBeNull();
  });

  it('un countdown vencido CON mensaje de cierre sí se muestra', async () => {
    const { countdown } = servicios({
      countdown: filaCountdown({ endDate: HACE_UN_DIA, finishedMessage: '¡Se terminó!' }),
    });
    const r = await countdown.getActiveCountdown('biz-1');
    expect(r?.finishedMessage).toBe('¡Se terminó!');
  });

  it('activarlo con una fecha ya pasada se rechaza', async () => {
    const { countdown } = servicios();
    await expect(countdown.upsert('biz-1', 'member-1', {
      title: 'Cyber Week', endDate: HACE_UN_DIA.toISOString(), placement: 'HOME', isActive: true,
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guardarlo APAGADO con una fecha pasada se permite (borrador / campaña vieja)', async () => {
    const { countdown } = servicios();
    await expect(countdown.upsert('biz-1', 'member-1', {
      title: 'Cyber Week', endDate: HACE_UN_DIA.toISOString(), placement: 'HOME', isActive: false,
    } as any)).resolves.toBeTruthy();
  });

  it('rechaza un link que se va del dominio de la tienda', async () => {
    const { countdown } = servicios();
    for (const ctaLink of ['https://otro.com', '//otro.com', 'catalogo']) {
      await expect(countdown.upsert('biz-1', 'member-1', {
        title: 'X', endDate: EN_UNA_SEMANA.toISOString(), placement: 'HOME', isActive: true,
        ctaText: 'Ver', ctaLink,
      } as any)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza un link sin texto de botón (sería una config que no hace nada)', async () => {
    const { countdown } = servicios();
    await expect(countdown.upsert('biz-1', 'member-1', {
      title: 'X', endDate: EN_UNA_SEMANA.toISOString(), placement: 'HOME', isActive: true,
      ctaLink: '/catalogo',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta una ruta de la tienda y normaliza los vacíos a null', async () => {
    const { countdown, prisma } = servicios();
    await countdown.upsert('biz-1', 'member-1', {
      title: '  Cyber Week  ', subtitle: '   ', endDate: EN_UNA_SEMANA.toISOString(),
      placement: 'ALL_PAGES', isActive: true, ctaText: 'Ver ofertas', ctaLink: '/catalogo',
    } as any);
    const { create } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(create.title).toBe('Cyber Week');
    expect(create.subtitle).toBeNull();
    expect(create.ctaLink).toBe('/catalogo');
    expect(create.placement).toBe('ALL_PAGES');
  });

  // ── Descuento gestionado ───────────────────────────────────────────────────
  // Es la mitad que puede mentirle al cliente si se rompe: el cartel dice "40%
  // hasta el viernes" y el carrito no descuenta nada, o descuenta después de
  // que venció.

  const CON_DESCUENTO = {
    title: 'Cyber Week', endDate: EN_UNA_SEMANA.toISOString(), placement: 'HOME', isActive: true,
    conDescuento: true, descuentoTipo: 'PERCENT', descuentoValor: 40,
    descuentoAlcance: 'CATEGORY', categoryIds: ['cat-1'],
  };

  it('crea un Discount real con la MISMA fecha de fin que el cartel', async () => {
    const { countdown, prisma } = servicios();
    await countdown.upsert('biz-1', 'member-1', CON_DESCUENTO as any);
    const { data } = prisma.discount.create.mock.calls[0][0];
    expect(data.type).toBe('PERCENT_PRODUCT');
    expect(Number(data.value)).toBe(40);
    expect(data.scope).toBe('CATEGORY');
    expect(data.application).toBe('AUTOMATIC');
    expect(data.createdBy).toBe('member-1');
    // Lo que sostiene el "termina en X" de las cards.
    expect(data.endDate.toISOString()).toBe(EN_UNA_SEMANA.toISOString());
  });

  it('reusa el Discount que ya existía en vez de crear uno nuevo cada vez', async () => {
    const { countdown, prisma } = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await countdown.upsert('biz-1', 'member-1', CON_DESCUENTO as any);
    expect(prisma.discount.create).not.toHaveBeenCalled();
    expect(prisma.discount.update).toHaveBeenCalled();
  });

  it('apagar el descuento NO lo borra: lo desactiva y mantiene el vínculo', async () => {
    const { countdown, prisma } = servicios({ countdown: filaCountdown({ discountId: 'disc-1' }) });
    await countdown.upsert('biz-1', 'member-1', {
      title: 'Cyber Week', endDate: EN_UNA_SEMANA.toISOString(), placement: 'HOME', isActive: true,
      conDescuento: false,
    } as any);
    expect(prisma.discount.update).toHaveBeenCalledWith({ where: { id: 'disc-1' }, data: { isActive: false } });
    const { update } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(update.discountId).toBe('disc-1');
  });

  // ── Sección de la portada ────────────────────────────────────────────────
  // Es lo que dibuja CountdownOfertaSection.tsx. Sin descuento gestionado no
  // hay productos que listar, así que no puede quedar prendida.

  it('sin descuento, la sección de la portada se guarda apagada aunque la pidan', async () => {
    const { countdown, prisma } = servicios();
    await countdown.upsert('biz-1', 'member-1', {
      title: 'Cyber Week', endDate: EN_UNA_SEMANA.toISOString(), placement: 'HOME', isActive: true,
      conDescuento: false, showProductsOnHome: true,
    } as any);
    const { create } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(create.showProductsOnHome).toBe(false);
  });

  it('con descuento, la sección viene prendida si no la apagan explícitamente', async () => {
    const { countdown, prisma } = servicios();
    await countdown.upsert('biz-1', 'member-1', CON_DESCUENTO as any);
    const { create } = prisma.countdownConfig.upsert.mock.calls[0][0];
    expect(create.showProductsOnHome).toBe(true);
  });

  it('la respuesta pública no reporta la sección prendida si el descuento está apagado', async () => {
    // Config con la sección en true pero con el Discount desactivado: es el
    // estado que queda cuando el dueño apaga el descuento (no se borra, ver
    // sincronizarDescuento). Sin esto, el storefront pediría productos de un
    // descuento que ya no aplica.
    const { countdown } = servicios({
      countdown: filaCountdown({
        showProductsOnHome: true,
        discountId: 'disc-1',
        discount: { id: 'disc-1', isActive: false, type: 'PERCENT_PRODUCT', value: 40, scope: 'CATEGORY', products: [], categories: [] },
      }),
    });
    const r = await countdown.getActiveCountdown('biz-1');
    expect(r?.showProductsOnHome).toBe(false);
    expect(r?.conDescuento).toBe(false);
    // El id igual viaja: la sección no se dibuja, pero el panel lo usa para
    // linkear a la ficha del descuento.
    expect(r?.discountId).toBe('disc-1');
  });

  it('rechaza un porcentaje fuera de 1-100', async () => {
    const { countdown } = servicios();
    for (const descuentoValor of [0, 101, -5]) {
      await expect(countdown.upsert('biz-1', 'member-1', { ...CON_DESCUENTO, descuentoValor } as any))
        .rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza un descuento sin productos ni categorías elegidas', async () => {
    const { countdown } = servicios();
    await expect(countdown.upsert('biz-1', 'member-1', {
      ...CON_DESCUENTO, descuentoAlcance: 'PRODUCT', categoryIds: [], productIds: [],
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza productos que no son del negocio', async () => {
    const { countdown, prisma } = servicios();
    prisma.product.count.mockResolvedValue(1); // pidieron 2, existe 1
    await expect(countdown.upsert('biz-1', 'member-1', {
      ...CON_DESCUENTO, descuentoAlcance: 'PRODUCT', categoryIds: [],
      productIds: ['prod-1', 'prod-de-otro-negocio'],
    } as any)).rejects.toBeInstanceOf(BadRequestException);
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

  it('rechaza un link fuera de la tienda, igual que el countdown', async () => {
    const { salida } = servicios();
    await expect(salida.upsert('biz-1', {
      title: 'X', frequency: 'ALWAYS', minSeconds: 0, onMobile: true, isActive: true,
      ctaText: 'Ver', ctaLink: 'https://otro.com',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});

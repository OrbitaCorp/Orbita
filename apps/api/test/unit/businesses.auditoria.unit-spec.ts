import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, PayloadTooLargeException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import sharp from 'sharp';
import { BusinessesService } from '../../src/businesses/businesses.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { OnboardingService } from '../../src/onboarding/onboarding.service';
import { UpdateStorefrontConfigDto } from '../../src/businesses/dto/update-storefront-config.dto';
import { UpdateTutorialDto } from '../../src/businesses/dto/update-tutorial.dto';
import { UpdateBusinessConfigDto } from '../../src/businesses/dto/update-business-config.dto';
import { UpdateBusinessDto } from '../../src/businesses/dto/update-business.dto';
import { UpdateOnboardingBusinessDto } from '../../src/onboarding/dto/update-onboarding-business.dto';
import { PendingWizardDto } from '../../src/subscriptions/dto/start-pending-checkout.dto';
import { motivoSubdominioInvalido, SUBDOMINIOS_RESERVADOS } from '../../src/common/utils/subdominio';
import { MAX_IMAGEN_BYTES, MENSAJE_IMAGEN_GRANDE } from '../../src/common/utils/subida-imagen';
import { MAX_VIDEO_BYTES, MENSAJE_VIDEO_GRANDE } from '../../src/common/utils/subida-video';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

// Auditoría interna 2026-09-10, ítem `api.businesses`.
//
// Lo grave: la suspensión de una tienda (por mora, la pone el cron; o del
// super admin) usa el mismo `isPaused` que el dueño usa para pausarla, y
// POST /business/pause { paused: false } lo sacaba sin mirar nada: una tienda
// suspendida volvía a vender sin pagar. Además el cobro mensual despausaba
// siempre, reabriendo tiendas que el dueño había pausado a mano y levantando
// suspensiones de la plataforma.
//
// Lo demás: regla única de subdominio (DNS válido + reservados), topes de
// largo en todos los DTOs del módulo, límite de tamaño en las cuatro subidas
// de imagen y errores de Storage sin el detalle de Supabase.

const BIZ = 'biz-1';

function prismaPausa(opts: { ultimaAccion?: string; subStatus?: string }) {
  return {
    platformAdminLog: { findFirst: jest.fn().mockResolvedValue(opts.ultimaAccion ? { action: opts.ultimaAccion } : null) },
    subscription: { findUnique: jest.fn().mockResolvedValue(opts.subStatus ? { status: opts.subStatus } : null) },
    business: { update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ isPaused: data.isPaused })) },
  };
}

const negocios = (prisma: unknown, supabase: unknown = {}, r2: unknown = {}) => new BusinessesService(prisma as any, supabase as any, {} as any, r2 as any);

describe('POST /business/pause: levantar una suspensión no es del dueño', () => {
  it('suspendida por la plataforma: no se puede despausar', async () => {
    const prisma = prismaPausa({ ultimaAccion: 'suspend_business', subStatus: 'SUSPENDED' });
    await expect(negocios(prisma).pause(BIZ, false)).rejects.toThrow(/suspendida por Órbita/);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('suspendida por la plataforma SIN suscripción (negocio anterior al gate): tampoco', async () => {
    const prisma = prismaPausa({ ultimaAccion: 'suspend_business' });
    await expect(negocios(prisma).pause(BIZ, false)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it.each(['SUSPENDED', 'CANCELLED'])('suscripción %s (mora): no se puede despausar', async (status) => {
    const prisma = prismaPausa({ subStatus: status });
    await expect(negocios(prisma).pause(BIZ, false)).rejects.toThrow(/falta de pago/);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it('reactivada por el super admin después de suspender: se puede despausar', async () => {
    const prisma = prismaPausa({ ultimaAccion: 'reactivate_business', subStatus: 'ACTIVE' });
    await expect(negocios(prisma).pause(BIZ, false)).resolves.toEqual({ isPaused: false });
  });

  it('sin suscripción ni acciones de la plataforma (31 negocios así en prod): se puede despausar', async () => {
    const prisma = prismaPausa({});
    await expect(negocios(prisma).pause(BIZ, false)).resolves.toEqual({ isPaused: false });
  });

  it('pausar (paused: true) se permite siempre, aun suspendida, sin consultar nada', async () => {
    const prisma = prismaPausa({ ultimaAccion: 'suspend_business', subStatus: 'SUSPENDED' });
    await expect(negocios(prisma).pause(BIZ, true)).resolves.toEqual({ isPaused: true });
    expect(prisma.platformAdminLog.findFirst).not.toHaveBeenCalled();
  });

  it('la suspensión de la plataforma se lee de la ÚLTIMA acción suspend/reactivate de ese negocio', async () => {
    const prisma = prismaPausa({});
    await negocios(prisma).pause(BIZ, false);
    expect(prisma.platformAdminLog.findFirst).toHaveBeenCalledWith({
      where: { targetType: 'business', targetId: BIZ, action: { in: ['suspend_business', 'reactivate_business'] } },
      orderBy: { createdAt: 'desc' },
      select: { action: true },
    });
  });
});

describe('recordPayment: un cobro aprobado solo reabre una tienda suspendida por mora', () => {
  function armar(opts: { subStatus: string; ultimaAccion?: string; mpStatus?: string }) {
    const tx = {
      subscriptionPayment: { create: jest.fn() },
      subscription: { update: jest.fn() },
      business: { update: jest.fn() },
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sub-1',
          businessId: BIZ,
          plan: 'mensual',
          status: opts.subStatus,
          amount: 1000,
          currentPeriodEnd: new Date(Date.now() - 86_400_000),
        }),
      },
      subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null) },
      platformAdminLog: { findFirst: jest.fn().mockResolvedValue(opts.ultimaAccion ? { action: opts.ultimaAccion } : null) },
      $transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb(tx)),
    };
    const svc = new SubscriptionsService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    Object.defineProperty(svc, 'payment', {
      value: { get: jest.fn().mockResolvedValue({ external_reference: BIZ, status: opts.mpStatus ?? 'approved', transaction_amount: 1000 }) },
    });
    jest.spyOn(svc as any, 'syncAddonAvanzado').mockResolvedValue(undefined);
    return { svc, tx };
  }

  it('tienda pausada a mano por el dueño (suscripción al día): el cobro NO la reabre', async () => {
    const { svc, tx } = armar({ subStatus: 'ACTIVE' });
    await svc.recordPayment('mp-1');
    expect(tx.subscription.update).toHaveBeenCalled();
    expect(tx.business.update).not.toHaveBeenCalled();
  });

  it('suspendida por mora: el cobro la vuelve a poner en línea', async () => {
    const { svc, tx } = armar({ subStatus: 'SUSPENDED' });
    await svc.recordPayment('mp-1');
    expect(tx.business.update).toHaveBeenCalledWith({ where: { id: BIZ }, data: { isActive: true, isPaused: false } });
  });

  it('suspendida por la plataforma: el cobro automático NO levanta la suspensión', async () => {
    const { svc, tx } = armar({ subStatus: 'SUSPENDED', ultimaAccion: 'suspend_business' });
    await svc.recordPayment('mp-1');
    expect(tx.business.update).not.toHaveBeenCalled();
  });

  it('cobro rechazado: no toca nada del negocio', async () => {
    const { svc, tx } = armar({ subStatus: 'SUSPENDED', mpStatus: 'rejected' });
    await svc.recordPayment('mp-1');
    expect(tx.business.update).not.toHaveBeenCalled();
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });
});

describe('Subdominio: una sola regla para todos los caminos', () => {
  it.each(['mitienda', 'zapatos-lorena', 'asd', 'a1b', 'x'.repeat(63)])('acepta %s', (s) => {
    expect(motivoSubdominioInvalido(s)).toBeNull();
  });

  it.each(['ab', '-tienda', 'tienda-', 'mi--tienda', 'xn--80ak6aa92e', 'Tienda', 'mi_tienda', 'mi.tienda', 'x'.repeat(64), ''])('rechaza %j', (s) => {
    expect(motivoSubdominioInvalido(s)).not.toBeNull();
  });

  it('rechaza todos los reservados', () => {
    for (const r of SUBDOMINIOS_RESERVADOS) expect(motivoSubdominioInvalido(r)).toMatch(/reservado|caracteres/);
  });

  it('PUT /onboarding/business valida con la misma regla', async () => {
    const mal = await validate(plainToInstance(UpdateOnboardingBusinessDto, { subdomain: 'soporte' }));
    const bien = await validate(plainToInstance(UpdateOnboardingBusinessDto, { subdomain: 'zapatoslorena' }));
    expect(mal.map((e) => e.property)).toContain('subdomain');
    expect(bien).toHaveLength(0);
  });

  it('el alta con pago valida ANTES de cobrar; vacío = se queda con el auto-generado', async () => {
    const vacio = await validate(plainToInstance(PendingWizardDto, { subdominio: '' }));
    const reservado = await validate(plainToInstance(PendingWizardDto, { subdominio: 'pagos' }));
    expect(vacio).toHaveLength(0);
    expect(reservado.map((e) => e.property)).toContain('subdominio');
  });

  function onboarding() {
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    return { svc: new OnboardingService(prisma as any, {} as any), prisma };
  }

  it('check-subdomain dice que un reservado no está disponible, sin ir a la base', async () => {
    const { svc, prisma } = onboarding();
    await expect(svc.checkSubdomain('api')).resolves.toMatchObject({ available: false });
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it('updateDraft rechaza un reservado aunque lo llamen sin DTO (confirmAndCreate)', async () => {
    const { svc, prisma } = onboarding();
    await expect(svc.updateDraft(BIZ, { subdomain: 'orbita' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it.each([
    ['Soporte', 'soporte-tienda'],
    ['AB', 'ab-tienda'],
    ['Zapatos Lorena', 'zapatos-lorena'],
  ])('el subdominio auto-generado para %j es %j', async (nombre, esperado) => {
    const { svc } = onboarding();
    await expect((svc as any).generateUniqueSubdomain(nombre)).resolves.toBe(esperado);
  });

  it('un nombre larguísimo genera un subdominio válido', async () => {
    const { svc } = onboarding();
    const s: string = await (svc as any).generateUniqueSubdomain('La Gran Tienda de Ropa y Accesorios del Barrio de Palermo Soho Norte');
    expect(motivoSubdominioInvalido(s)).toBeNull();
  });
});

describe('DTOs del módulo: tipos, rangos y largos', () => {
  const slide = (extra: Record<string, unknown> = {}) => ({ id: 's1', titulo: 'Hola', subtitulo: '', img: null, cta: 'Ver', ...extra });
  const errores = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('una configuración como las de producción pasa entera', async () => {
    expect(
      await errores(UpdateStorefrontConfigDto, {
        storeName: 'Rama Indumentaria',
        tagline: 'Ropa para todos los días',
        logoUrl: 'https://hhaqlzrcskmwnvhgydon.supabase.co/storage/v1/object/public/business-logos/a/b.webp',
        faviconUrl: null,
        fontScale: 1,
        cardRadius: 12,
        headerLayout: 'centered',
        gridLayout: 'grid-3',
        heroSlides: [slide({ img: '/plantillas/vidriera-modelo.jpg', ctaLink: '/catalogo?onSale=1', bgColor: '' }), slide({ bgColor: '#12' })],
        statsBar: [{ id: 's1', value: '+1.200', label: 'ventas realizadas' }],
        headerLinks: [{ id: 'catalogo', label: 'Catálogo', on: true }],
        parallaxCtaLink: '/catalogo',
        brandsTitle: 'Trabajamos con las mejores marcas',
        // Las dos formas válidas de una marca: con logo y sin logo (esta
        // última se dibuja como texto en el home, ver brand-item.dto.ts).
        brands: [
          { id: 'mk1', name: 'Casio', logoUrl: 'https://hhaqlzrcskmwnvhgydon.supabase.co/storage/v1/object/public/business-logos/a/casio.webp' },
          { id: 'mk2', name: 'G-Shock' },
        ],
        videoTitle: 'Así trabajamos',
        videoSubtitle: 'Un vistazo detrás de escena.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoPosterUrl: 'https://hhaqlzrcskmwnvhgydon.supabase.co/storage/v1/object/public/business-logos/a/poster.webp',
      }),
    ).toEqual([]);
  });

  it('los campos que el panel limpia con "" siguen pasando', async () => {
    expect(await errores(UpdateStorefrontConfigDto, { logoUrl: '', faviconUrl: '', parallaxImageUrl: '', headerLayout: '', gridLayout: '', videoUrl: '', videoPosterUrl: '' })).toEqual([]);
  });

  it.each([
    ['logoUrl', 'javascript:alert(1)'],
    ['logoUrl', '//evil.com/x.png'],
    ['faviconUrl', 'data:image/svg+xml,<svg onload=alert(1)>'],
    ['parallaxImageUrl', 'http://sin-tls.com/x.png'],
    ['storeName', 'x'.repeat(81)],
    ['fontScale', 5],
    ['cardRadius', -1],
    ['headerLayout', 'x;}body{display:none'],
    // Mismos dos casos que parallaxImageUrl: sin https, y un scheme peligroso.
    ['videoUrl', 'http://sin-tls.com/video.mp4'],
    ['videoUrl', 'javascript:alert(1)'],
    ['videoPosterUrl', 'javascript:alert(1)'],
  ])('UpdateStorefrontConfigDto rechaza %s = %j', async (campo, valor) => {
    expect(await errores(UpdateStorefrontConfigDto, { [campo]: valor })).toContain(campo);
  });

  it('acota la tira de marcas: 21 marcas, un logo que no es https, y una sin nombre', async () => {
    const marca = (extra: Record<string, unknown> = {}) => ({ id: 'mk1', name: 'Casio', ...extra });
    expect(await errores(UpdateStorefrontConfigDto, { brands: Array.from({ length: 21 }, (_, i) => marca({ id: `mk${i}` })) })).toContain('brands');
    expect(await errores(UpdateStorefrontConfigDto, { brands: [marca({ logoUrl: 'javascript:alert(1)' })] })).toContain('brands');
    expect(await errores(UpdateStorefrontConfigDto, { brands: [{ id: 'mk1' }] })).toContain('brands');
    expect(await errores(UpdateStorefrontConfigDto, { brands: [marca({ name: 'x'.repeat(61) })] })).toContain('brands');
    // El logo vacío tiene que pasar: es como queda una marca a la que le
    // sacaron el logo desde el panel (URL_IMAGEN acepta '').
    expect(await errores(UpdateStorefrontConfigDto, { brands: [marca({ logoUrl: '' })] })).toEqual([]);
  });

  it('rechaza 13 slides y un color de slide que no es hex', async () => {
    expect(await errores(UpdateStorefrontConfigDto, { heroSlides: Array.from({ length: 13 }, (_, i) => slide({ id: `s${i}` })) })).toContain('heroSlides');
    expect(await errores(UpdateStorefrontConfigDto, { heroSlides: [slide({ bgColor: 'red;background:url(x)' })] })).toContain('heroSlides');
    expect(await errores(UpdateStorefrontConfigDto, { heroSlides: [slide({ img: 'javascript:alert(1)' })] })).toContain('heroSlides');
  });

  it('UpdateTutorialDto acota los arrays que van enteros al JSONB', async () => {
    const tutorial = { variante: 'checklist', fase: 'activo', paso: 0, hechas: [], minimizado: false, seccionesVistas: [] };
    expect(await errores(UpdateTutorialDto, { tutorial })).toEqual([]);
    expect(await errores(UpdateTutorialDto, { tutorial: { ...tutorial, hechas: Array.from({ length: 51 }, (_, i) => `t${i}`) } })).toContain('tutorial');
    expect(await errores(UpdateTutorialDto, { tutorial: { ...tutorial, paso: 1000 } })).toContain('tutorial');
  });

  it('UpdateBusinessConfigDto y UpdateBusinessDto tienen topes', async () => {
    expect(await errores(UpdateBusinessConfigDto, { scheduleText: 'x'.repeat(301) })).toContain('scheduleText');
    expect(await errores(UpdateBusinessConfigDto, { freeShippingFrom: 2e9 })).toContain('freeShippingFrom');
    expect(await errores(UpdateBusinessConfigDto, { shippingPolicy: 'Envíos a todo el país en 48 h.', instagram: 'https://instagram.com/rama' })).toEqual([]);
    expect(await errores(UpdateBusinessDto, { description: 'x'.repeat(1001) })).toContain('description');
  });

  it('el costo por transportista también tiene tope (se valida en el service)', async () => {
    const prisma = { businessConfig: { findUnique: jest.fn().mockResolvedValue({}), update: jest.fn() } };
    await expect(negocios(prisma).updateConfig(BIZ, { carrierShippingCosts: { OCA: 5e9 } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(negocios(prisma).updateConfig(BIZ, { carrierShippingCosts: { OCA: Infinity } })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.businessConfig.update).not.toHaveBeenCalled();
  });
});

describe('Subidas de imagen', () => {
  it('ningún FileInterceptor de src/ queda sin el tope de SUBIDA_IMAGEN', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) recorrer(p);
        else if (p.endsWith('.ts')) archivos.push(p);
      }
    };
    recorrer(join(__dirname, '../../src'));
    const sinTope = archivos.filter((f) => /File(s)?Interceptor\(\s*'[^']+'\s*\)/.test(readFileSync(f, 'utf8')));
    expect(sinTope).toEqual([]);
    const conTope = archivos.filter((f) => /FileInterceptor\('file', SUBIDA_IMAGEN\)/.test(readFileSync(f, 'utf8')));
    expect(conTope.length).toBeGreaterThanOrEqual(3);
    expect(MAX_IMAGEN_BYTES).toBe(10 * 1024 * 1024);
  });

  it('el 413 de multer sale en castellano', () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }) };
    new HttpExceptionFilter().catch(new PayloadTooLargeException('File too large'), host as any);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: MENSAJE_IMAGEN_GRANDE }));
  });

  it('un error de Storage no le muestra al panel el detalle de Supabase', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const upload = jest.fn().mockResolvedValue({ error: { message: 'new row violates row-level security policy for bucket business-logos' } });
    const supabase = { adminClient: { storage: { from: () => ({ upload }) } } };
    const err = await negocios({}, supabase)
      .uploadStorefrontImage(BIZ, { buffer: png, mimetype: 'image/png', originalname: 'a.png' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/row-level|bucket/);
  });
});

describe('Subida de video (sección de video de Apariencia)', () => {
  it('el endpoint tiene su propio tope, distinto del de imagen', () => {
    const src = readFileSync(join(__dirname, '../../src/businesses/businesses.controller.ts'), 'utf8');
    expect(src).toMatch(/FileInterceptor\('file', SUBIDA_VIDEO\)/);
    expect(MAX_VIDEO_BYTES).toBe(40 * 1024 * 1024);
  });

  it('el 413 de multer en /upload-video dice el tope de VIDEO, no el de imagen', () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/api/v1/business/storefront-config/upload-video' }) }) };
    new HttpExceptionFilter().catch(new PayloadTooLargeException('File too large'), host as any);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: MENSAJE_VIDEO_GRANDE }));
  });

  it('el 413 de multer en /upload-image sigue diciendo el tope de IMAGEN (no se rompió al agregar video)', () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/api/v1/business/storefront-config/upload-image' }) }) };
    new HttpExceptionFilter().catch(new PayloadTooLargeException('File too large'), host as any);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: MENSAJE_IMAGEN_GRANDE }));
  });

  it('rechaza un mimetype que no es de video, sin tocar Storage', async () => {
    const upload = jest.fn();
    const supabase = { adminClient: { storage: { from: () => ({ upload }) } } };
    const err = await negocios({}, supabase)
      .uploadStorefrontVideo(BIZ, { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'a.pdf' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(upload).not.toHaveBeenCalled();
  });

  // El error de Storage sin detalle del proveedor para el video ahora se
  // prueba contra R2Service directo (ver r2.unit-spec.ts) — acá lo que
  // importa es que uploadStorefrontVideo() prefija el path con el
  // businessId, para que un negocio nunca pueda pisar ni listar los
  // videos de otro (pedido explícito de Ale: "cada tienda tiene sus videos").
  it('sube el video a R2 con el path prefijado por negocio', async () => {
    const upload = jest.fn().mockResolvedValue('https://pub-test.r2.dev/biz-1/x.mp4');
    const { url } = await negocios({}, {}, { upload })
      .uploadStorefrontVideo(BIZ, { buffer: Buffer.from('x'), mimetype: 'video/mp4', originalname: 'a.mp4' });
    expect(url).toBe('https://pub-test.r2.dev/biz-1/x.mp4');
    const [path, , mimetype] = upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${BIZ}/.+\\.mp4$`));
    expect(mimetype).toBe('video/mp4');
  });

  // presignStorefrontVideo es el camino directo-a-R2 (ver R2Service.presignUpload):
  // comparte la misma validación de mimetype y el mismo prefijo por negocio que
  // uploadStorefrontVideo, solo que nunca toca el buffer del archivo.
  it('presignStorefrontVideo rechaza un mimetype que no es de video, sin pedir la firma', async () => {
    const presignUpload = jest.fn();
    const err = await negocios({}, {}, { presignUpload })
      .presignStorefrontVideo(BIZ, 'application/pdf')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(presignUpload).not.toHaveBeenCalled();
  });

  it('presignStorefrontVideo devuelve la URL firmada y la pública, con el path prefijado por negocio', async () => {
    const presignUpload = jest.fn().mockResolvedValue('https://acc-1.r2.cloudflarestorage.com/orbita/biz-1/x.mp4?signed');
    const publicUrlDe = jest.fn().mockReturnValue('https://pub-test.r2.dev/biz-1/x.mp4');
    const { uploadUrl, publicUrl } = await negocios({}, {}, { presignUpload, publicUrlDe }).presignStorefrontVideo(BIZ, 'video/mp4');
    expect(uploadUrl).toBe('https://acc-1.r2.cloudflarestorage.com/orbita/biz-1/x.mp4?signed');
    expect(publicUrl).toBe('https://pub-test.r2.dev/biz-1/x.mp4');
    const [pathFirmado, mimetype] = presignUpload.mock.calls[0];
    expect(pathFirmado).toMatch(new RegExp(`^${BIZ}/.+\\.mp4$`));
    expect(mimetype).toBe('video/mp4');
    expect(publicUrlDe).toHaveBeenCalledWith(pathFirmado);
  });
});

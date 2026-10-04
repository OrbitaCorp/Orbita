// Pruebas de IA de la demo pública (src/demo/demo-ia.ts): qué rutas se abren
// al visitante, cómo se cuenta la cuota semanal por IP y qué mensaje ve.
import { CallHandler, ExecutionContext, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { DEMO_CUPO_GLOBAL, DEMO_IA_KEY, DEMO_LIMITE_IA, mensajeLimiteDemo } from '../../src/demo/demo-ia';
import { DemoIaInterceptor } from '../../src/demo/demo-ia.interceptor';
import { DemoIaService, semanaIso } from '../../src/demo/demo-ia.service';
import { ProductsController } from '../../src/products/products.controller';
import { ImageStudioController } from '../../src/image-studio/image-studio.controller';
import { OrbiController, PROMPT_DEMO } from '../../src/orbi/orbi.controller';
import { ToolRegistryService } from '../../src/orbi/tools/tool-registry.service';

const reflector = new Reflector();
const marca = (proto: object, metodo: string) => reflector.get(DEMO_IA_KEY, (proto as Record<string, () => void>)[metodo]);

describe('rutas abiertas a la demo', () => {
  it('solo las pruebas elegidas llevan @DemoIa', () => {
    expect(marca(ProductsController.prototype, 'aiScan')).toBe('orbi-producto');
    expect(marca(ProductsController.prototype, 'aiAssist')).toBe('orbi-producto');
    expect(marca(ProductsController.prototype, 'aiVariants')).toBe('orbi-producto');
    expect(marca(OrbiController.prototype, 'chat')).toBe('orbi-chat');
    // Las fotos web que siguen al escaneo: buscarlas y bajar la elegida.
    expect(marca(ProductsController.prototype, 'suggestedImages')).toBe('fotos-web');
    expect(marca(ProductsController.prototype, 'proxyImage')).toBe('foto-web');
    // "Modelo con ropa puesta" queda cerrado: no aplica a tecnología y es la más cara.
    expect(marca(ImageStudioController.prototype, 'generateModel')).toBeUndefined();
    // Y nada que guarde: subir fotos al producto, confirmar acciones de Orbi.
    expect(marca(OrbiController.prototype, 'confirm')).toBeUndefined();
  });

  it('en el estudio de fotos, "sin fondo" cuenta como Quitar fondo y el resto como Fondo con IA', () => {
    const resolver = marca(ImageStudioController.prototype, 'generateBackground') as (r: unknown) => string;
    expect(resolver({ body: { estilo: 'sin_fondo' } })).toBe('quitar-fondo');
    expect(resolver({ body: { estilo: 'marmol' } })).toBe('fondo-ia');
  });

  it('el visitante no ve las herramientas de Orbi que escriben', () => {
    const lectura = { name: 'listOrders', surfaces: ['panel'], requiredPermissions: [], toLlmDefinition: () => ({ name: 'listOrders' }) };
    const escritura = { name: 'createCoupon', surfaces: ['panel'], requiredPermissions: [], requiresConfirmation: true, toLlmDefinition: () => ({ name: 'createCoupon' }) };
    const registro = Object.create(ToolRegistryService.prototype) as ToolRegistryService;
    (registro as unknown as { tools: Map<string, unknown> }).tools = new Map([['listOrders', lectura], ['createCoupon', escritura]]);
    const nombres = (o?: { soloLectura?: boolean }) => registro.getTools('panel' as never, [], undefined, o).map((t) => t.name);
    expect(nombres()).toEqual(['listOrders', 'createCoupon']);
    expect(nombres({ soloLectura: true })).toEqual(['listOrders']);
  });

  it('el prompt de la demo le dice a Orbi que es una demo y que no aplica cambios', () => {
    expect(PROMPT_DEMO).toMatch(/DEMO/);
    expect(PROMPT_DEMO).toMatch(/no podés crear, editar ni borrar/);
  });
});

describe('semana de la cuota', () => {
  it('usa semanas ISO (lunes a domingo, año del jueves)', () => {
    expect(semanaIso('2026-09-28')).toBe('2026-W40'); // lunes
    expect(semanaIso('2026-10-04')).toBe('2026-W40'); // domingo, misma semana
    expect(semanaIso('2026-10-05')).toBe('2026-W41');
    expect(semanaIso('2027-01-01')).toBe('2026-W53'); // viernes: todavía es la última semana de 2026
  });
});

describe('DemoIaService', () => {
  function servicio(filas: unknown[]) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(filas), $executeRaw: jest.fn().mockResolvedValue(1) };
    const svc = new DemoIaService(prisma as never, { getOrThrow: () => 'x'.repeat(32) } as never);
    return { svc, prisma };
  }
  const req = { headers: {}, socket: { remoteAddress: '203.0.113.7' } };

  it('con cupo, suma el uso y sigue', async () => {
    const { svc } = servicio([{ count: 1 }]);
    await expect(svc.consumir(req as never, 'fondo-ia')).resolves.toBeUndefined();
  });

  it('sin cupo, 429 con un mensaje que dice que el límite es de la demo', async () => {
    const { svc } = servicio([]);
    const err = await svc.consumir(req as never, 'fondo-ia').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect((err as HttpException).getResponse()).toMatchObject({ error: DEMO_LIMITE_IA });
    expect(mensajeLimiteDemo('fondo-ia')).toMatch(/demo/);
    expect(mensajeLimiteDemo('fondo-ia')).toMatch(/2 pruebas por semana/);
    expect(mensajeLimiteDemo('fondo-ia')).toMatch(/en tu propia tienda/);
  });

  it('no guarda la IP en texto plano', async () => {
    const { svc, prisma } = servicio([{ count: 1 }]);
    await svc.consumir(req as never, 'orbi-chat');
    const valores = (prisma.$queryRaw.mock.calls[0] as unknown[]).slice(1).map(String);
    expect(valores.some((v) => v.includes('203.0.113.7'))).toBe(false);
  });
});

describe('DemoIaInterceptor', () => {
  const visitante = { type: 'member', readOnly: true };
  function ctx(user: unknown, handler: () => void) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user, body: {}, headers: {}, socket: {} }) }),
      getHandler: () => handler,
    } as unknown as ExecutionContext;
  }
  const ruta = () => undefined;
  Reflect.defineMetadata(DEMO_IA_KEY, 'orbi-producto', ruta);
  const handler = (obs: ReturnType<CallHandler['handle']>): CallHandler => ({ handle: () => obs });

  function interceptor() {
    const demoIa = { consumir: jest.fn().mockResolvedValue(undefined), devolver: jest.fn().mockResolvedValue(undefined) };
    return { it: new DemoIaInterceptor(new Reflector(), demoIa as never), demoIa };
  }

  it('fuera de la demo no cuenta nada', async () => {
    const { it: i, demoIa } = interceptor();
    await firstValueFrom(i.intercept(ctx({ type: 'member', readOnly: false }, ruta), handler(of('ok'))));
    expect(demoIa.consumir).not.toHaveBeenCalled();
  });

  it('cuenta el uso del visitante y no lo devuelve si salió bien', async () => {
    const { it: i, demoIa } = interceptor();
    await expect(firstValueFrom(i.intercept(ctx(visitante, ruta), handler(of('ok'))))).resolves.toBe('ok');
    expect(demoIa.consumir).toHaveBeenCalledWith(expect.anything(), 'orbi-producto');
    expect(demoIa.devolver).not.toHaveBeenCalled();
  });

  it('si la función falla, devuelve el uso: una prueba fallida no cuenta', async () => {
    const { it: i, demoIa } = interceptor();
    await expect(firstValueFrom(i.intercept(ctx(visitante, ruta), handler(throwError(() => new Error('Workers AI caído')))))).rejects.toThrow('Workers AI caído');
    expect(demoIa.devolver).toHaveBeenCalledWith(expect.anything(), 'orbi-producto');
  });

  it('el tope diario del negocio, visto desde la demo, dice que es un cupo compartido de la demo', async () => {
    const { it: i } = interceptor();
    const topeNegocio = new HttpException('Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.', HttpStatus.TOO_MANY_REQUESTS);
    const err = await firstValueFrom(i.intercept(ctx(visitante, ruta), handler(throwError(() => topeNegocio)))).catch((e: unknown) => e);
    expect((err as HttpException).getResponse()).toMatchObject({ error: DEMO_CUPO_GLOBAL });
    const topeImagenes = new ForbiddenException('Límite diario de generación de imágenes alcanzado (30/día). Probá de nuevo mañana.');
    const err2 = await firstValueFrom(i.intercept(ctx(visitante, ruta), handler(throwError(() => topeImagenes)))).catch((e: unknown) => e);
    expect((err2 as HttpException).getResponse()).toMatchObject({ error: DEMO_CUPO_GLOBAL });
  });

  it('cualquier otro error pasa tal cual', async () => {
    const { it: i } = interceptor();
    const otro = new HttpException('Falta la imagen a escanear', HttpStatus.BAD_REQUEST);
    const err = await firstValueFrom(i.intercept(ctx(visitante, ruta), handler(throwError(() => otro)))).catch((e: unknown) => e);
    expect(err).toBe(otro);
  });
});

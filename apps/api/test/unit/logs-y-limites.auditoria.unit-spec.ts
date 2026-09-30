import { HttpException, HttpStatus } from '@nestjs/common';
import { rutaSinQuery } from '../../src/common/filters/http-exception.filter';
import { MailService } from '../../src/mail/mail.service';
import { saltosDeProxy } from '../../src/common/utils/proxy';
import { ProductsController, AI_ASSIST_DIA_NEGOCIO } from '../../src/products/products.controller';
import { AuthController } from '../../src/auth/auth.controller';
import { AppController } from '../../src/app.controller';

// Auditoría interna 10/09: ítems trans.logging, trans.rate-limit,
// trans.gasto-ia y trans.cors-headers.

describe('logs sin secretos', () => {
  it('el log de un 500 lleva la ruta sin el query', () => {
    expect(rutaSinQuery('/api/v1/auth/invitation-info?token=abc123')).toBe('/api/v1/auth/invitation-info');
    expect(rutaSinQuery(undefined)).toBe('?');
  });

  it('el STUB de mail en producción solo muestra las claves del contexto', () => {
    const ctx = { code: '123456', name: 'Ana' };
    expect(MailService.datosDelStub(ctx, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe('claves: code, name');
    expect(MailService.datosDelStub(ctx, { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(JSON.stringify(ctx));
  });

  it('invitation-info por POST lee el token del body', async () => {
    const svc = { invitationInfo: jest.fn().mockResolvedValue({ storeName: 'T' }) };
    await new AuthController(svc as any).invitationInfoPost({ token: 'tok' });
    expect(svc.invitationInfo).toHaveBeenCalledWith('tok');
  });
});

describe('trust proxy', () => {
  it('solo con un número exacto de saltos, nunca true', () => {
    expect(saltosDeProxy({} as NodeJS.ProcessEnv)).toBeNull();
    expect(saltosDeProxy({ TRUST_PROXY_HOPS: '2' } as NodeJS.ProcessEnv)).toBe(2);
    expect(saltosDeProxy({ TRUST_PROXY_HOPS: 'true' } as NodeJS.ProcessEnv)).toBeNull();
    expect(saltosDeProxy({ TRUST_PROXY_HOPS: '0' } as NodeJS.ProcessEnv)).toBeNull();
    expect(saltosDeProxy({ TRUST_PROXY_HOPS: '9' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('/health/ip devuelve la IP vista y la cadena X-Forwarded-For del pedido', () => {
    const r = new AppController({} as any).ip({ ip: '10.0.0.1', headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } } as any);
    // clientIp/viaBff: ver ip-del-cliente.auditoria.unit-spec.ts (hallazgo rate-limit-ip-proxy).
    expect(r).toEqual({ ip: '10.0.0.1', xForwardedFor: '1.2.3.4, 10.0.0.1', clientIp: '10.0.0.1', viaBff: false });
  });
});

describe('ai-assist: tope por negocio y por día', () => {
  // El contador (en Postgres) se prueba en cuota.service.unit-spec.ts; acá, que
  // las tres ayudas lo consulten con la clave y el límite de siempre.
  function controlador(hayCupo = true) {
    const ai = { assist: jest.fn().mockResolvedValue({}), suggestVariants: jest.fn().mockResolvedValue({}), scanProductImage: jest.fn().mockResolvedValue({}) };
    const cuota = { consumir: jest.fn().mockResolvedValue(hayCupo) };
    return { c: new ProductsController({} as any, ai as any, {} as any, cuota as any), ai, cuota };
  }
  const negocioA = { type: 'member', businessId: 'b-a' } as any;

  it(`las tres ayudas suman al mismo tope de ${AI_ASSIST_DIA_NEGOCIO} por negocio`, async () => {
    const { c, cuota } = controlador();
    await c.aiAssist(negocioA, {} as any);
    await c.aiVariants(negocioA, {} as any);
    await c.aiScan(negocioA, {} as Express.Multer.File);
    expect(cuota.consumir).toHaveBeenCalledTimes(3);
    for (const llamada of cuota.consumir.mock.calls) expect(llamada).toEqual(['ai-assist:b-a', AI_ASSIST_DIA_NEGOCIO]);
  });

  it('pasado el tope responde 429 con el mensaje de siempre y no llama al modelo', async () => {
    const { c, ai } = controlador(false);
    for (const llamar of [
      () => c.aiAssist(negocioA, {} as any),
      () => c.aiVariants(negocioA, {} as any),
      () => c.aiScan(negocioA, {} as Express.Multer.File),
    ]) {
      const err = await llamar().catch((e: HttpException) => e);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((err as HttpException).getResponse()).toBe('Llegaste al máximo de ayudas de IA por hoy. Mañana se renueva.');
    }
    expect(ai.assist).not.toHaveBeenCalled();
    expect(ai.suggestVariants).not.toHaveBeenCalled();
    expect(ai.scanProductImage).not.toHaveBeenCalled();
  });
});

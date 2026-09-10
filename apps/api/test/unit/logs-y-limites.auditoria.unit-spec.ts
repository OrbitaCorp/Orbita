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
    expect(r).toEqual({ ip: '10.0.0.1', xForwardedFor: '1.2.3.4, 10.0.0.1' });
  });
});

describe('ai-assist: tope por negocio y por día', () => {
  it(`después de ${AI_ASSIST_DIA_NEGOCIO} ayudas responde 429, y otro negocio sigue pudiendo`, () => {
    const ai = { assist: jest.fn().mockResolvedValue({}) };
    const c = new ProductsController({} as any, ai as any);
    const negocioA = { type: 'member', businessId: 'b-a' } as any;
    for (let i = 0; i < AI_ASSIST_DIA_NEGOCIO; i++) c.aiAssist(negocioA, {} as any);
    let status = 0;
    try {
      c.aiAssist(negocioA, {} as any);
    } catch (e) {
      status = (e as HttpException).getStatus();
    }
    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(ai.assist).toHaveBeenCalledTimes(AI_ASSIST_DIA_NEGOCIO);
    c.aiAssist({ type: 'member', businessId: 'b-b' } as any, {} as any);
    expect(ai.assist).toHaveBeenCalledTimes(AI_ASSIST_DIA_NEGOCIO + 1);
  });
});

import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';

// Unit test de resolverBaseDeRetorno() — a qué host vuelve el comprador
// después de pagar con Mercado Pago. Antes esto era un FRONTEND_URL fijo +
// '/tienda/{slug}' siempre, sin importar desde dónde se abrió el checkout:
// rompía en cualquier entorno que no fuera el de producción (un preview de
// Vercel volvía a producción) y siempre ignoraba el subdominio real de la
// tienda si se había entrado por ahí. Ahora se deriva del header Origin de
// la request que pidió la preferencia (no un campo del body: un browser lo
// manda solo, la página no lo puede pisar con JS).

function svcCon() {
  const prisma = {} as any;
  const config = {
    getOrThrow: (key: string) => {
      const valores: Record<string, string> = {
        MERCADOPAGO_CLIENT_ID: 'client-id',
        MERCADOPAGO_CLIENT_SECRET: 'client-secret',
        MERCADOPAGO_REDIRECT_URI: 'https://api.orbita.site/api/v1/mercadopago/oauth/callback',
        MERCADOPAGO_TOKEN_KEY: 'token-key',
        JWT_SECRET: 'test-secret-de-al-menos-32-caracteres',
      };
      return valores[key];
    },
    get: (key: string) => (key === 'FRONTEND_URL' ? 'https://orbita.site' : undefined),
  };
  const orders = {} as any;
  const eventEmitter = {} as any;
  return new MercadopagoService(prisma, config as any, orders, eventEmitter);
}

describe('MercadopagoService.resolverBaseDeRetorno (unit)', () => {
  const svc = svcCon() as any;

  it('Origin cuyo primer segmento coincide con el subdominio → vuelve a la raíz de ESE host (sin /tienda/)', () => {
    const base = svc.resolverBaseDeRetorno('rama-tienda', 'https://rama-tienda.orbita.site');
    expect(base).toBe('https://rama-tienda.orbita.site');
  });

  it('Origin que NO coincide con el subdominio (preview/apex) → vuelve al MISMO host, forma legacy /tienda/{slug}', () => {
    const base = svc.resolverBaseDeRetorno('rama-tienda', 'https://orbita-mili.vercel.app');
    expect(base).toBe('https://orbita-mili.vercel.app/tienda/rama-tienda');
  });

  it('sin Origin (llamada server-to-server) → cae al FRONTEND_URL configurado', () => {
    const base = svc.resolverBaseDeRetorno('rama-tienda', undefined);
    expect(base).toBe('https://orbita.site/tienda/rama-tienda');
  });

  it('Origin inválido/malformado → cae al FRONTEND_URL configurado, no revienta', () => {
    const base = svc.resolverBaseDeRetorno('rama-tienda', 'no-es-una-url');
    expect(base).toBe('https://orbita.site/tienda/rama-tienda');
  });

  it('respeta el puerto del Origin (dev local)', () => {
    const base = svc.resolverBaseDeRetorno('rama-tienda', 'http://rama-tienda.orbita.local:3001');
    expect(base).toBe('http://rama-tienda.orbita.local:3001');
  });
});

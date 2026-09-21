import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { CloudflareImageService } from '../../src/cloudflare/cloudflare-image.service';

// Cubre lo que se descubrió a mano probando contra la API real de Workers AI
// (no documentado con precisión por Cloudflare, ver resumen de la tarea):
// - generateImage(): JSON normal, campo "prompt".
// - editImage(): NECESITA multipart/form-data real — un body JSON, aunque
//   tenga los campos "correctos", tira 400 "required properties at '/' are
//   'multipart'". Si esto se rompe (Cloudflare cambia el contrato), el test
//   de forma del multipart de abajo lo detecta.
// - code 5035 ("no disponible en el plan Free") se traduce a 503, no 500 —
//   es información útil para quien lo esté probando, no un bug nuestro.

function makeService(config: Record<string, string | undefined>) {
  const configService = { get: (key: string) => config[key] };
  return new CloudflareImageService(configService as any);
}

const CONFIG_OK = { R2_ACCOUNT_ID: 'acc-1', CF_WORKERS_AI_API_TOKEN: 'token-1' };

describe('CloudflareImageService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('generateImage: sin credenciales, 503 sin llamar a fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const svc = makeService({});
    await expect(svc.generateImage('un gato')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generateImage: manda JSON con el prompt y decodifica el base64 de la respuesta', async () => {
    const base64 = Buffer.from('img-bytes').toString('base64');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { image: base64 } }),
    } as Response);

    const svc = makeService(CONFIG_OK);
    const result = await svc.generateImage('un gato con sombrero');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/ai/run/@cf/black-forest-labs/flux-1-schnell');
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'un gato con sombrero' });
    expect(result.buffer.toString()).toBe('img-bytes');
  });

  it('editImage: manda multipart/form-data real (no JSON) con los campos prompt e image', async () => {
    const base64 = Buffer.from('edited-bytes').toString('base64');
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { image: base64 } }),
    } as Response);

    const svc = makeService(CONFIG_OK);
    await svc.editImage('cambiale el fondo', Buffer.from('original'), 'image/png');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/ai/run/@cf/black-forest-labs/flux-2-klein-4b');
    expect(init.body).toBeInstanceOf(FormData);
    // Sin Content-Type manual: si se hubiera puesto "application/json" a
    // mano, Workers AI lo rechaza con el 400 de "multipart" (ver arriba).
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('code 5035 (modelo no disponible en el plan actual) se traduce a 503, no 500', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, errors: [{ message: 'not available on the Workers Free plan', code: 5035 }] }),
    } as Response);

    const svc = makeService(CONFIG_OK);
    await expect(svc.generateImage('algo')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('cualquier otro error de Workers AI es un 500 genérico (no expone detalles internos)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, errors: [{ message: 'Bad input: algo raro', code: 5006 }] }),
    } as Response);

    const svc = makeService(CONFIG_OK);
    await expect(svc.generateImage('algo')).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

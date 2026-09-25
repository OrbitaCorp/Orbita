import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { CloudflareImageService, CloudflareQuotaExhaustedException } from '../../src/cloudflare/cloudflare-image.service';

// Cubre lo que se descubrió a mano probando contra la API real de Workers AI
// (no documentado con precisión por Cloudflare, ver resumen de la tarea):
// - generateImage(): JSON normal, campo "prompt".
// - editImage(): NECESITA multipart/form-data real — un body JSON, aunque
//   tenga los campos "correctos", tira 400 "required properties at '/' are
//   'multipart'". Si esto se rompe (Cloudflare cambia el contrato), el test
//   de forma del multipart de abajo lo detecta.
// - editImage(): el campo de la imagen de referencia es "input_image_0", NO
//   "image" — con el nombre equivocado la API igual devuelve success:true
//   pero ignora la foto de entrada (bug real encontrado y corregido
//   22/09/2026, ver comentario en cloudflare-image.service.ts). El test de
//   abajo lo fija para que no se rompa de nuevo en silencio.
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

  it('editImage: manda multipart/form-data real (no JSON) con los campos prompt e input_image_0', async () => {
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
    // "image" a secas no es un campo real de la API — la foto de entrada
    // tiene que ir en "input_image_0" o la API la ignora en silencio.
    const form = init.body as FormData;
    expect(form.get('input_image_0')).not.toBeNull();
    expect(form.get('image')).toBeNull();
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

  // Se agotó (o se agotará mañana) — confirmado a mano el 21/09/2026: 12
  // llamadas seguidas de seed-backgrounds.ts contra la cuenta real tiraron
  // exactamente este texto de error. No es hipotético.
  it('cuota diaria de Neurons agotada: 503 con mensaje claro (no el texto crudo de Cloudflare), sin reintentar', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        errors: [{ message: 'AiError: AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare\'s Workers Paid plan if you would like to continue usage.', code: 3040 }],
      }),
    } as Response);
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const svc = makeService(CONFIG_OK);
    await expect(svc.generateImage('madera')).rejects.toBeInstanceOf(CloudflareQuotaExhaustedException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  // Confirmado a mano contra la API real (09/2026): el filtro de contenido
  // de Workers AI rechaza prompts totalmente inocuos ("papel kraft", "piedra
  // clara") como falso positivo de NSFW, y el mismo prompt exacto funciona
  // al reintentar. No es un caso hipotético — reintentar de verdad soluciona
  // el problema la mayoría de las veces.
  it('falso positivo NSFW: reintenta y devuelve la imagen si el segundo intento sale bien', async () => {
    const base64 = Buffer.from('img-bytes').toString('base64');
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: 'AiError: Input prompt contains NSFW content.', code: 3030 }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, result: { image: base64 } }) } as Response);
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const svc = makeService(CONFIG_OK);
    const result = await svc.generateImage('papel kraft');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.buffer.toString()).toBe('img-bytes');
  });

  it('falso positivo NSFW persistente: agota los reintentos y tira 500 (no un loop infinito)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, errors: [{ message: 'AiError: Input prompt contains NSFW content.', code: 3030 }] }),
    } as Response);
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const svc = makeService(CONFIG_OK);
    await expect(svc.generateImage('algo')).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('"output has been flagged" (Flux 2 klein) también se reintenta hasta que pasa', async () => {
    const flagged = { ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: 'AiError: Your output has been flagged. Please choose another prompt / input image combination', code: 3030 }] }) } as Response;
    const ok = { ok: true, status: 200, json: async () => ({ success: true, result: { image: Buffer.from('x').toString('base64') } }) } as Response;
    const fetchMock = jest.fn().mockResolvedValueOnce(flagged).mockResolvedValueOnce(flagged).mockResolvedValueOnce(ok);
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const svc = makeService(CONFIG_OK);
    await svc.editImage('algo', Buffer.from('img'), 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('un error que NO es NSFW no se reintenta (solo 1 llamada)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, errors: [{ message: 'not available on the Workers Free plan', code: 5035 }] }),
    } as Response);
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const svc = makeService(CONFIG_OK);
    await expect(svc.generateImage('algo')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2Service } from '../../src/r2/r2.service';

// getSignedUrl es una función suelta del paquete (no un método de
// S3Client.prototype como `send`), así que se mockea el módulo entero en vez
// de usar jest.spyOn sobre el cliente.
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

// Video de producto y de Apariencia (ver businesses.service.ts#uploadStorefrontVideo)
// se suben acá — Cloudflare R2, no Supabase Storage (pedido de Ale 16/09 para
// manejar mejor la capacidad de almacenamiento de video).

const CONFIG: Record<string, string> = {
  R2_ACCOUNT_ID: 'acc-1',
  R2_ACCESS_KEY_ID: 'key-1',
  R2_SECRET_ACCESS_KEY: 'secret-1',
  R2_BUCKET: 'orbita',
  R2_PUBLIC_URL: 'https://pub-test.r2.dev',
};
const config = { get: (k: string) => CONFIG[k] } as any;

describe('R2Service.upload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sube el archivo y arma la URL pública a partir de R2_PUBLIC_URL', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const url = await new R2Service(config).upload('biz-1/video.mp4', Buffer.from('x'), 'video/mp4');
    expect(url).toBe('https://pub-test.r2.dev/biz-1/video.mp4');
    expect(send).toHaveBeenCalledTimes(1);
  });

  // Mismo criterio que uploadToStorage() en businesses.service.ts para
  // Supabase: un error del proveedor no le muestra al panel el detalle
  // interno (nombre de bucket, credenciales, lo que sea que devuelva el SDK).
  it('un error de R2 no le muestra al panel el detalle del proveedor', async () => {
    (jest.spyOn(S3Client.prototype, 'send') as jest.Mock).mockRejectedValue(new Error('AccessDenied: la credencial no tiene permiso sobre orbita'));
    const err = await new R2Service(config)
      .upload('biz-1/video.mp4', Buffer.from('x'), 'video/mp4')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/AccessDenied|credencial/);
  });
});

describe('R2Service.publicUrlDe', () => {
  it('arma la URL pública a partir de R2_PUBLIC_URL, sin firmar nada', () => {
    const url = new R2Service(config).publicUrlDe('biz-1/video.mp4');
    expect(url).toBe('https://pub-test.r2.dev/biz-1/video.mp4');
  });
});

describe('R2Service.presignUpload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('devuelve la URL firmada para que el navegador suba directo a R2', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://acc-1.r2.cloudflarestorage.com/orbita/biz-1/video.mp4?signed');
    const url = await new R2Service(config).presignUpload('biz-1/video.mp4', 'video/mp4');
    expect(url).toBe('https://acc-1.r2.cloudflarestorage.com/orbita/biz-1/video.mp4?signed');
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  // Mismo criterio que upload(): un error del proveedor al firmar no le
  // muestra al panel el detalle interno.
  it('un error al firmar no le muestra al panel el detalle del proveedor', async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('AccessDenied: la credencial no tiene permiso sobre orbita'));
    const err = await new R2Service(config)
      .presignUpload('biz-1/video.mp4', 'video/mp4')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/AccessDenied|credencial/);
  });
});

describe('R2Service.tamanioDe / eliminar / presignDescarga (cola de videos de Marketing)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('tamanioDe devuelve el tamaño del archivo, y null si no existe', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    send.mockResolvedValueOnce({ ContentLength: 1234 });
    expect(await new R2Service(config).tamanioDe('marketing/videos/a.mp4')).toBe(1234);
    send.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }));
    expect(await new R2Service(config).tamanioDe('marketing/videos/b.mp4')).toBeNull();
  });

  it('tamanioDe propaga un error real del proveedor, sin su detalle', async () => {
    (jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock).mockRejectedValue(new Error('AccessDenied: credencial'));
    const err = await new R2Service(config).tamanioDe('marketing/videos/a.mp4').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/AccessDenied|credencial/);
  });

  it('eliminar borra el archivo y, si R2 falla, avisa sin mostrar el detalle', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    send.mockResolvedValueOnce({});
    await expect(new R2Service(config).eliminar('marketing/videos/a.mp4')).resolves.toBeUndefined();
    send.mockRejectedValueOnce(new Error('AccessDenied: credencial'));
    const err = await new R2Service(config).eliminar('marketing/videos/a.mp4').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).not.toMatch(/AccessDenied|credencial/);
  });

  it('presignDescarga firma con Content-Disposition: attachment y un nombre de archivo seguro', async () => {
    (getSignedUrl as jest.Mock).mockClear().mockResolvedValue('https://firmada');
    expect(await new R2Service(config).presignDescarga('marketing/videos/a.mp4', 'mi video "raro"/../x.mp4')).toBe('https://firmada');
    const comando = (getSignedUrl as jest.Mock).mock.calls[0][1];
    expect(comando.input.ResponseContentDisposition).toBe('attachment; filename="mi_video__raro__.._x.mp4"');
  });
});

import { ServiceUnavailableException } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { R2Service } from '../../src/r2/r2.service';

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

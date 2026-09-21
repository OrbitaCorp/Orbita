import { ForbiddenException } from '@nestjs/common';
import { ImageStudioService } from '../../src/image-studio/image-studio.service';

// ImageStudioService (fondos de producto + "prenda en modelo", paquete
// Avanzado, Cloudflare Workers AI). Cubre lo que la auditoría interna del
// 09/09 (ítem api.common) marcó como el error más común en módulos nuevos
// de Avanzado: no revalidar hasActiveAddon(). El resto (composición real con
// sharp, llamadas reales a Workers AI) se probó a mano — ver resumen de la
// tarea — porque mockear sharp/fetch acá no agrega cobertura real.

const FAKE_JPEG = Buffer.from('fake-image-bytes');

function makeService(hasActiveAddon: boolean) {
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(hasActiveAddon) };
  const backgroundRemoval = { removeBackground: jest.fn().mockResolvedValue(FAKE_JPEG) };
  const cloudflareImage = {
    generateImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
    editImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
  };
  const svc = new ImageStudioService(businesses as any, backgroundRemoval as any, cloudflareImage as any);
  return { svc, businesses, backgroundRemoval, cloudflareImage };
}

describe('ImageStudioService — gate de "Avanzado"', () => {
  it('generateBackground: sin el add-on, 403 y no llama a Workers AI ni al quita-fondos', async () => {
    const { svc, backgroundRemoval, cloudflareImage } = makeService(false);
    await expect(svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(backgroundRemoval.removeBackground).not.toHaveBeenCalled();
    expect(cloudflareImage.generateImage).not.toHaveBeenCalled();
  });

  it('generateModelWearing: sin el add-on, 403 y no llama a Workers AI', async () => {
    const { svc, cloudflareImage } = makeService(false);
    await expect(svc.generateModelWearing('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(cloudflareImage.editImage).not.toHaveBeenCalled();
  });

  it('generateModelWearing: con el add-on, devuelve advertencia de que hay que revisar el resultado', async () => {
    const { svc } = makeService(true);
    const result = await svc.generateModelWearing('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' });
    expect(result.advertencia).toMatch(/revisá/i);
    expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
  });

  it('generateModelWearing: la descripción del vendedor se suma al prompt default', async () => {
    const { svc, cloudflareImage } = makeService(true);
    await svc.generateModelWearing('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'modelo mujer, fondo urbano');
    const [prompt] = cloudflareImage.editImage.mock.calls[0];
    expect(prompt).toContain('modelo mujer, fondo urbano');
  });
});

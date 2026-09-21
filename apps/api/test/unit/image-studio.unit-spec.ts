import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ImageStudioService } from '../../src/image-studio/image-studio.service';

// ImageStudioService (fondos de producto + "prenda en modelo", paquete
// Avanzado, Cloudflare Workers AI). Cubre lo que la auditoría interna del
// 09/09 (ítem api.common) marcó como el error más común en módulos nuevos
// de Avanzado: no revalidar hasActiveAddon(). El resto (composición real con
// sharp, llamadas reales a Workers AI) se probó a mano — ver resumen de la
// tarea — porque mockear sharp/fetch acá no agrega cobertura real.

// PNG 1x1 real (no un buffer de texto cualquiera) — así sharp() no explota
// al leer metadata/componer, y se puede probar el camino de éxito completo
// de generateBackground() sin mockear sharp.
const FAKE_JPEG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function makeService(hasActiveAddon: boolean) {
  const businesses = { hasActiveAddon: jest.fn().mockResolvedValue(hasActiveAddon) };
  const backgroundRemoval = { removeBackground: jest.fn().mockResolvedValue(FAKE_JPEG) };
  const cloudflareImage = {
    generateImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
    editImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
  };
  // publicUrlDe() alcanza para estos tests: ninguno llega a bajar el fondo
  // cacheado de verdad (los de "sin add-on"/"estilo inválido" cortan antes).
  const r2 = { publicUrlDe: jest.fn((key: string) => `https://cdn.test/${key}`) };
  const config = { get: jest.fn((key: string) => (key === 'SUPABASE_URL' ? 'https://proj.supabase.co' : undefined)) };
  const svc = new ImageStudioService(businesses as any, backgroundRemoval as any, cloudflareImage as any, r2 as any, config as any);
  return { svc, businesses, backgroundRemoval, cloudflareImage, r2, config };
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

  it('generateBackground: "sin_fondo" devuelve el recorte directo, sin componer ni llamar a Flux', async () => {
    const { svc, backgroundRemoval, cloudflareImage } = makeService(true);
    const result = await svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'sin_fondo');
    expect(backgroundRemoval.removeBackground).toHaveBeenCalledTimes(1);
    expect(cloudflareImage.generateImage).not.toHaveBeenCalled();
    expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
    expect(result.mimeType).toBe('image/png');
  });

  it('generateBackground: imageUrl de nuestro propio storage se baja y procesa igual que un file', async () => {
    const { svc } = makeService(true);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => FAKE_JPEG,
    } as unknown as Response);

    const result = await svc.generateBackground('biz-1', undefined, 'sin_fondo', undefined, 'https://proj.supabase.co/storage/v1/object/public/orbita/foto.jpg');

    expect(fetchMock).toHaveBeenCalledWith('https://proj.supabase.co/storage/v1/object/public/orbita/foto.jpg');
    expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
    fetchMock.mockRestore();
  });

  it('generateBackground: imageUrl que NO es de nuestro storage se rechaza (SSRF)', async () => {
    const { svc } = makeService(true);
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      svc.generateBackground('biz-1', undefined, 'sin_fondo', undefined, 'https://evil.example.com/foto.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('generateBackground: sin file ni imageUrl, 400', async () => {
    const { svc } = makeService(true);
    await expect(svc.generateBackground('biz-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generateBackground: estilo que no existe en el catálogo, 400 y no llama al quita-fondos', async () => {
    const { svc, backgroundRemoval } = makeService(true);
    await expect(
      svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'estilo-inventado'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(backgroundRemoval.removeBackground).not.toHaveBeenCalled();
  });

  describe('generateBackground — fondo cacheado vs. en vivo', () => {
    afterEach(() => jest.restoreAllMocks());

    it('sin descripción: baja una de las variantes cacheadas de R2, no llama a Flux', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => FAKE_JPEG } as unknown as Response);
      jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
      const { svc, cloudflareImage, r2 } = makeService(true);

      const result = await svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');

      expect(cloudflareImage.generateImage).not.toHaveBeenCalled();
      expect(r2.publicUrlDe).toHaveBeenCalledWith(expect.stringContaining('image-studio/backgrounds/madera/'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.mimeType).toBe('image/png');
    });

    it('con descripción: genera en vivo con Flux (no usa la caché de R2)', async () => {
      const fetchMock = jest.fn();
      jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
      const { svc, cloudflareImage, r2 } = makeService(true);

      await svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera', 'tonos más fríos');

      expect(cloudflareImage.generateImage).toHaveBeenCalledTimes(1);
      expect(cloudflareImage.generateImage.mock.calls[0][0]).toContain('tonos más fríos');
      expect(r2.publicUrlDe).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('si R2 falla al bajar el fondo cacheado, cae a generar en vivo en vez de romper el pedido', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('R2 no responde'));
      const { svc, cloudflareImage } = makeService(true);

      const result = await svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');

      expect(cloudflareImage.generateImage).toHaveBeenCalledTimes(1);
      expect(result.mimeType).toBe('image/png');
    });
  });
});

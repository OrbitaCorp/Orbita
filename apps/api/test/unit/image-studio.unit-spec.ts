import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
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
  const backgroundRemoval = {
    removeBackground: jest.fn().mockResolvedValue(FAKE_JPEG),
    removeBackgroundConAnalisis: jest.fn().mockResolvedValue({ png: FAKE_JPEG, dificil: false, senales: {} }),
  };
  const cloudflareImage = {
    generateImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
    editImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/jpeg' }),
  };
  const geminiImage = { editImage: jest.fn().mockResolvedValue({ buffer: FAKE_JPEG, mimeType: 'image/png' }) };
  // publicUrlDe() alcanza para estos tests: ninguno llega a bajar el fondo
  // cacheado de verdad (los de "sin add-on"/"estilo inválido" cortan antes).
  const r2 = { publicUrlDe: jest.fn((key: string) => `https://cdn.test/${key}`) };
  const config = { get: jest.fn((key: string) => (key === 'SUPABASE_URL' ? 'https://proj.supabase.co' : undefined)) };
  const svc = new ImageStudioService(businesses as any, backgroundRemoval as any, cloudflareImage as any, geminiImage as any, r2 as any, config as any);
  return { svc, businesses, backgroundRemoval, cloudflareImage, geminiImage, r2, config };
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

  // "Fondo con IA" (generateBackground) está en mantenimiento (24/09/2026,
  // ver el plan "Fondo con IA: pipeline 2D/3D") — con el add-on activo, corta
  // con 503 antes de llegar a esta lógica. Los tests de abajo (marcados
  // .skip) quedan tal cual para reactivar cuando se saque ese throw.
  it('generateBackground: con el add-on, en mantenimiento (503), no llama a nada', async () => {
    delete process.env.FONDO_IA_MANTENIMIENTO; // no depender del .env local (ver fondo-ia-mantenimiento.ts)
    const { svc, backgroundRemoval, cloudflareImage } = makeService(true);
    await expect(svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(backgroundRemoval.removeBackground).not.toHaveBeenCalled();
    expect(cloudflareImage.generateImage).not.toHaveBeenCalled();
  });

  it.skip('generateBackground: "sin_fondo" devuelve el recorte directo, sin componer ni llamar a Flux', async () => {
    const { svc, backgroundRemoval, cloudflareImage } = makeService(true);
    const result = await svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'sin_fondo');
    expect(backgroundRemoval.removeBackground).toHaveBeenCalledTimes(1);
    expect(cloudflareImage.generateImage).not.toHaveBeenCalled();
    expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
    expect(result.mimeType).toBe('image/png');
  });

  it.skip('generateBackground: imageUrl de nuestro propio storage se baja y procesa igual que un file', async () => {
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

  it.skip('generateBackground: imageUrl que NO es de nuestro storage se rechaza (SSRF)', async () => {
    const { svc } = makeService(true);
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      svc.generateBackground('biz-1', undefined, 'sin_fondo', undefined, 'https://evil.example.com/foto.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it.skip('generateBackground: sin file ni imageUrl, 400', async () => {
    const { svc } = makeService(true);
    await expect(svc.generateBackground('biz-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.skip('generateBackground: estilo que no existe en el catálogo, 400 y no llama al quita-fondos', async () => {
    const { svc, backgroundRemoval } = makeService(true);
    await expect(
      svc.generateBackground('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'estilo-inventado'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(backgroundRemoval.removeBackground).not.toHaveBeenCalled();
  });

  describe('generatePremiumBackground — Gemini para 2D, Workers AI para 3D', () => {
    // Fuera de mantenimiento (FONDO_IA_MANTENIMIENTO=false, ver fondo-ia-mantenimiento.ts).
    beforeEach(() => { process.env.FONDO_IA_MANTENIMIENTO = 'false'; delete process.env.FONDO_IA_MOTOR; });
    afterEach(() => { delete process.env.FONDO_IA_MANTENIMIENTO; });

    it('photoType "flat" (o sin especificar): le pega a Gemini, no a Workers AI', async () => {
      const { svc, geminiImage, cloudflareImage } = makeService(true);
      const result = await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');
      expect(geminiImage.editImage).toHaveBeenCalledTimes(1);
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
      expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
    });

    it('FONDO_IA_MOTOR=workers: un producto plano también va por Workers AI, sin llamar a Gemini', async () => {
      process.env.FONDO_IA_MOTOR = 'workers';
      try {
        const { svc, geminiImage, cloudflareImage } = makeService(true);
        await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');
        expect(cloudflareImage.editImage).toHaveBeenCalledTimes(1);
        expect(geminiImage.editImage).not.toHaveBeenCalled();
      } finally {
        delete process.env.FONDO_IA_MOTOR;
      }
    });

    it('photoType "volume": le pega a Workers AI, no a Gemini', async () => {
      const { svc, geminiImage, cloudflareImage } = makeService(true);
      await svc.generatePremiumBackground('biz-1', 'volume', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'cuero_negro');
      expect(cloudflareImage.editImage).toHaveBeenCalledTimes(1);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
    });

    it('el prompt final incluye la preservación del producto y la descripción del estilo', async () => {
      const { svc, geminiImage } = makeService(true);
      await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');
      const [prompt] = geminiImage.editImage.mock.calls[0];
      expect(prompt).toMatch(/pixel-perfect/i);
      expect(prompt).toContain('wood plank');
    });

    it('"sin_fondo" sigue siendo el recorte local (ONNX), no le pega a ningún motor de IA', async () => {
      const { svc, backgroundRemoval, geminiImage, cloudflareImage } = makeService(true);
      const result = await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'sin_fondo');
      expect(backgroundRemoval.removeBackgroundConAnalisis).toHaveBeenCalledTimes(1);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
      expect(result.mimeType).toBe('image/png');
    });

    it('"sin_fondo" avisa recorteDificil cuando el análisis del recorte local lo marca', async () => {
      const { svc, backgroundRemoval } = makeService(true);
      backgroundRemoval.removeBackgroundConAnalisis.mockResolvedValueOnce({ png: FAKE_JPEG, dificil: true, senales: {} });
      const result = await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'sin_fondo');
      expect(result.recorteDificil).toBe(true);
    });

    it('en mantenimiento (sin FONDO_IA_MANTENIMIENTO=false): 503 y no llama a ningún motor', async () => {
      delete process.env.FONDO_IA_MANTENIMIENTO;
      const { svc, geminiImage, cloudflareImage } = makeService(true);
      await expect(svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
    });

    it('sin el add-on, 403 y no llama a ningún motor', async () => {
      const { svc, geminiImage, cloudflareImage } = makeService(false);
      await expect(svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
    });

    it('estilo inválido, 400', async () => {
      const { svc } = makeService(true);
      await expect(
        svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'estilo-inventado'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('mejorarRecorte — Gemini pone fondo blanco, después recorte local', () => {
    // Fuera de mantenimiento (FONDO_IA_MANTENIMIENTO=false, ver fondo-ia-mantenimiento.ts).
    beforeEach(() => { process.env.FONDO_IA_MANTENIMIENTO = 'false'; delete process.env.FONDO_IA_MOTOR; });
    afterEach(() => { delete process.env.FONDO_IA_MANTENIMIENTO; });

    it('le pide a Gemini fondo blanco liso y corre el recorte local sobre SU resultado', async () => {
      const { svc, geminiImage, backgroundRemoval, cloudflareImage } = makeService(true);
      const gemini = Buffer.from('gemini-result');
      geminiImage.editImage.mockResolvedValueOnce({ buffer: gemini, mimeType: 'image/png' });
      const result = await svc.mejorarRecorte('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' });
      const [prompt] = geminiImage.editImage.mock.calls[0];
      expect(prompt).toMatch(/pure white/i);
      expect(prompt).toMatch(/EXACT original colors/i);
      expect(backgroundRemoval.removeBackground).toHaveBeenCalledWith(gemini, 'biz-1');
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
      expect(result.mimeType).toBe('image/png');
    });

    it('FONDO_IA_MOTOR=workers: el fondo blanco lo pide a Workers AI, no a Gemini', async () => {
      process.env.FONDO_IA_MOTOR = 'workers';
      try {
        const { svc, geminiImage, cloudflareImage } = makeService(true);
        await svc.mejorarRecorte('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' });
        const [prompt] = cloudflareImage.editImage.mock.calls[0];
        expect(prompt).toMatch(/pure white/i);
        expect(geminiImage.editImage).not.toHaveBeenCalled();
      } finally {
        delete process.env.FONDO_IA_MOTOR;
      }
    });

    it('sin el add-on, 403 y no gasta Gemini', async () => {
      const { svc, geminiImage } = makeService(false);
      await expect(svc.mejorarRecorte('biz-1', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
    });

    it('sin file ni imageUrl, 400 y no gasta Gemini', async () => {
      const { svc, geminiImage } = makeService(true);
      await expect(svc.mejorarRecorte('biz-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
    });
  });

  // Fase 2 (24/09/2026): catálogo exclusivo del modo premium — texturas sin
  // backgroundKeys (alfombra_pelo, etc.) y familia "podio" reservada a
  // productos con volumen. Ver background-styles.ts § PREMIUM_ONLY_STYLES.
  describe('generatePremiumBackground — catálogo premium (Fase 2)', () => {
    // Fuera de mantenimiento (FONDO_IA_MANTENIMIENTO=false, ver fondo-ia-mantenimiento.ts).
    beforeEach(() => { process.env.FONDO_IA_MANTENIMIENTO = 'false'; delete process.env.FONDO_IA_MOTOR; });
    afterEach(() => { delete process.env.FONDO_IA_MANTENIMIENTO; });

    it('estilo premium-only sin volumen (ej. alfombra_pelo): funciona igual con photoType "flat"', async () => {
      const { svc, geminiImage, cloudflareImage } = makeService(true);
      const result = await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'alfombra_pelo');
      expect(geminiImage.editImage).toHaveBeenCalledTimes(1);
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
      const [prompt] = geminiImage.editImage.mock.calls[0];
      expect(prompt).toMatch(/shag rug/i);
      expect(result.base64).toBe(FAKE_JPEG.toString('base64'));
    });

    it('estilo "podio_estudio" con photoType "volume": le pega a Workers AI', async () => {
      const { svc, cloudflareImage, geminiImage } = makeService(true);
      await svc.generatePremiumBackground('biz-1', 'volume', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'podio_estudio');
      expect(cloudflareImage.editImage).toHaveBeenCalledTimes(1);
      expect(geminiImage.editImage).not.toHaveBeenCalled();
      const [prompt] = cloudflareImage.editImage.mock.calls[0];
      expect(prompt).toMatch(/podium/i);
    });

    it('estilo "podio_*" con photoType "flat" (o sin especificar): 400, es solo para productos con volumen', async () => {
      const { svc, cloudflareImage, geminiImage } = makeService(true);
      await expect(
        svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'podio_dramatico'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cloudflareImage.editImage).not.toHaveBeenCalled();
      expect(geminiImage.editImage).not.toHaveBeenCalled();
    });

    it('el prompt premium refuerza la preservación de color, no solo forma/texto', async () => {
      const { svc, geminiImage } = makeService(true);
      await svc.generatePremiumBackground('biz-1', 'flat', { buffer: FAKE_JPEG, mimetype: 'image/jpeg' }, 'madera');
      const [prompt] = geminiImage.editImage.mock.calls[0];
      expect(prompt).toMatch(/exact original color/i);
    });
  });

  describe.skip('generateBackground — fondo cacheado vs. en vivo', () => {
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

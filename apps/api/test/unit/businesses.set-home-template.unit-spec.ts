import { BusinessesService } from '../../src/businesses/businesses.service';

// Reportado con captura: un slide del hero editado en Apariencia clásica con
// "imagen centrada" (imageStyle/imagePosition/bgPattern/bgColor) quedaba con
// ese diseño pegado al activar una plantilla de Home (paquete Avanzado) — un
// editor que ni siquiera deja tocar esos campos (soloTexto en Apariencia.tsx),
// porque el hero de esas plantillas SIEMPRE se muestra a pantalla completa.
// setHomeTemplate ahora reinicia el estilo de los sliders existentes al
// activar cualquier plantilla; título/subtítulo/CTA/imagen no se tocan, y
// desactivar (template: null) no toca nada.

const BIZ = 'biz-1';

const SLIDE_CENTRADO = {
  id: 's1', titulo: 'Camperas que abrigan', subtitulo: 'Hasta 25% off', img: 'https://cdn/slide.jpg',
  cta: 'Ver camperas', ctaLink: '/catalogo',
  imageStyle: 'centered', imagePosition: 'left', imageOverlay: 'blanco',
  bgPattern: 'rings', bgPatternScope: 'full', bgColor: '#FF00AA',
};

function prismaDe(heroSlides: unknown, homeTemplate: string | null = null) {
  return {
    storefrontConfig: {
      findUnique: jest.fn().mockResolvedValue({ businessId: BIZ, homeTemplate, heroSlides }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ businessId: BIZ, showRating: true, homeTemplate, heroSlides, ...data }),
      ),
    },
  };
}

const servicio = (prisma: unknown) => new BusinessesService(prisma as any, {} as any, {} as any, {} as any);

describe('setHomeTemplate — reinicio de estilo de los sliders', () => {
  it('activar una plantilla resetea el estilo del slide a imagen completa, sin tocar el contenido', async () => {
    const prisma = prismaDe([SLIDE_CENTRADO]);
    await servicio(prisma).setHomeTemplate(BIZ, { template: 'vidriera' } as any);

    const guardado = prisma.storefrontConfig.update.mock.calls[0][0].data;
    expect(guardado.homeTemplate).toBe('vidriera');
    expect(guardado.heroSlides).toEqual([{
      ...SLIDE_CENTRADO,
      imageStyle: 'full', imagePosition: 'right', bgPattern: 'none', bgPatternScope: 'image', bgColor: '',
    }]);
    // Contenido intacto.
    expect(guardado.heroSlides[0].titulo).toBe('Camperas que abrigan');
    expect(guardado.heroSlides[0].img).toBe('https://cdn/slide.jpg');
    expect(guardado.heroSlides[0].ctaLink).toBe('/catalogo');
    // No exclusivo de "centrada": se deja como estaba.
    expect(guardado.heroSlides[0].imageOverlay).toBe('blanco');
  });

  it('cambiar de una plantilla a otra también resetea (no solo la primera activación)', async () => {
    const prisma = prismaDe([SLIDE_CENTRADO], 'vidriera');
    await servicio(prisma).setHomeTemplate(BIZ, { template: 'escaparate' } as any);
    const guardado = prisma.storefrontConfig.update.mock.calls[0][0].data;
    expect(guardado.heroSlides[0].imageStyle).toBe('full');
  });

  it('desactivar (template: null) no toca los sliders', async () => {
    const prisma = prismaDe([SLIDE_CENTRADO], 'vidriera');
    await servicio(prisma).setHomeTemplate(BIZ, { template: null } as any);
    const guardado = prisma.storefrontConfig.update.mock.calls[0][0].data;
    expect(guardado.homeTemplate).toBeNull();
    expect('heroSlides' in guardado).toBe(false);
  });

  it('sin sliders todavía, activar una plantilla no rompe', async () => {
    const prisma = prismaDe([]);
    await servicio(prisma).setHomeTemplate(BIZ, { template: 'vidriera' } as any);
    const guardado = prisma.storefrontConfig.update.mock.calls[0][0].data;
    expect(guardado.heroSlides).toEqual([]);
  });

  it('plantilla desconocida: rechaza sin llegar a tocar la base', async () => {
    const prisma = prismaDe([SLIDE_CENTRADO]);
    await expect(servicio(prisma).setHomeTemplate(BIZ, { template: 'no-existe' } as any)).rejects.toThrow();
    expect(prisma.storefrontConfig.update).not.toHaveBeenCalled();
  });
});

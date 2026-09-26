import { ProductImageSearchService } from '../../src/products/product-image-search.service';
import { ConfigService } from '@nestjs/config';
import { UsageMeteringService } from '../../src/platform/costs/usage-metering.service';
import { CostsService } from '../../src/platform/costs/costs.service';

describe('ProductImageSearchService', () => {
  let service: ProductImageSearchService;
  let configService: jest.Mocked<ConfigService>;
  let usageMetering: jest.Mocked<UsageMeteringService>;
  let costsService: jest.Mocked<CostsService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    usageMetering = {
      track: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsageMeteringService>;

    costsService = {
      reportQuotaExceeded: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CostsService>;

    service = new ProductImageSearchService(configService, usageMetering, costsService);
  });

  it('omite búsqueda si no hay SKU o modelo detectable', async () => {
    const results = await service.searchSuggestedImages({
      query: 'Remera de algodón lisa negra',
    });
    expect(results).toEqual([]);
  });

  it('prioriza fotos que coincidan con el color y acabado sobre fotos genéricas', () => {
    const candidates = [
      {
        url: 'https://cdn.example.com/casio-a1000-black-dial.jpg',
        title: 'Casio Vintage A1000 Negro',
        sourceUrl: 'https://example.com/casio-a1000-black',
        domain: 'example.com',
        provider: 'serper' as const,
      },
      {
        url: 'https://www.casio.com/content/dam/A1000D-7/assets/A1000D-7EF_OR01_web.png',
        title: 'A1000D-7 Mother of Pearl Dial Nacar',
        sourceUrl: 'https://casio.com/es/a1000d-7',
        domain: 'casio.com',
        provider: 'serper' as const,
      },
    ];

    // Accedemos al método privado filterStrict para verificar la lógica de scoring
    const filterStrict = (service as any).filterStrict.bind(service);
    const filtered = filterStrict(candidates, 'a1000d7', 'Plateado con dial nácar blanco mother of pearl');

    expect(filtered.length).toBeGreaterThan(0);
    // La imagen con dial de nácar de casio.com debe ser la primera debido al mayor puntaje
    expect(filtered[0].title).toContain('Mother of Pearl');
    expect(filtered[0].url).toContain('A1000D-7');
  });
});

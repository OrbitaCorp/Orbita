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

  describe('aviso a soporte cuando un proveedor falla', () => {
    let mail: { sendCustomEmail: jest.Mock };
    let prisma: { emailLog: { findFirst: jest.Mock } };
    let conAviso: ProductImageSearchService;
    const fetchOriginal = global.fetch;

    beforeEach(() => {
      mail = { sendCustomEmail: jest.fn().mockResolvedValue(true) };
      prisma = { emailLog: { findFirst: jest.fn().mockResolvedValue(null) } };
      configService.get.mockImplementation((k: string) => (k === 'SERPER_API_KEY' ? 'clave-serper' : undefined));
      conAviso = new ProductImageSearchService(configService, usageMetering, costsService, mail as any, prisma as any);
      // Serper responde 401 y DuckDuckGo también falla: alcanza para ejercitar el catch.
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid key' }) as any;
    });

    afterEach(() => {
      global.fetch = fetchOriginal;
    });

    it('manda un mail a soporte@orbita.site cuando Serper falla', async () => {
      await conAviso.searchSuggestedImages({ query: 'Casio A1000D-7' });
      await new Promise((r) => setImmediate(r));
      expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
      const [to, subject] = mail.sendCustomEmail.mock.calls[0];
      expect(to).toBe('soporte@orbita.site');
      expect(subject).toContain('Serper');
    });

    it('no repite el aviso dentro de las 12 horas', async () => {
      await conAviso.searchSuggestedImages({ query: 'Casio A1000D-7' });
      await conAviso.searchSuggestedImages({ query: 'Casio A1000D-7' });
      await new Promise((r) => setImmediate(r));
      expect(mail.sendCustomEmail).toHaveBeenCalledTimes(1);
    });

    it('no manda mail si ya salió uno registrado en email_logs', async () => {
      prisma.emailLog.findFirst.mockResolvedValue({ id: 'x' });
      await conAviso.searchSuggestedImages({ query: 'Casio A1000D-7' });
      await new Promise((r) => setImmediate(r));
      expect(mail.sendCustomEmail).not.toHaveBeenCalled();
    });

    it('sin claves configuradas no avisa (el fallback gratuito es lo esperado)', async () => {
      configService.get.mockReturnValue(undefined);
      await conAviso.searchSuggestedImages({ query: 'Casio A1000D-7' });
      await new Promise((r) => setImmediate(r));
      expect(mail.sendCustomEmail).not.toHaveBeenCalled();
    });
  });
});

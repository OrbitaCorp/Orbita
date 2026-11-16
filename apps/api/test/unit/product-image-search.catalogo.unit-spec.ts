import 'reflect-metadata';
import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProductImageSearchService,
  esIpPrivada,
  fraseParaCatalogo,
  ordenarParaCatalogo,
  type SuggestedImage,
} from '../../src/products/product-image-search.service';
import { ProductsController } from '../../src/products/products.controller';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { FOTOS_WEB_DIA_NEGOCIO } from '../../src/common/cuota/limites';

// Fotos sugeridas de la web en Importar Excel → paso Fotos (12/11): búsqueda
// por nombre (sin el filtro de modelo del escaneo), descarga del lado del
// servidor y alta como foto del producto en nuestro storage.

const foto = (o: Partial<SuggestedImage> & { url: string }): SuggestedImage => ({
  title: '',
  provider: 'serper',
  ...o,
});

describe('fraseParaCatalogo', () => {
  it('suma la categoría cuando el nombre es corto', () => {
    expect(fraseParaCatalogo({ name: 'Bandolera Milán', category: 'Carteras' })).toBe('Bandolera Milán Carteras');
  });

  it('no repite la categoría si ya está en el nombre, ni suma categorías que no dicen nada', () => {
    expect(fraseParaCatalogo({ name: 'Remera oversize', category: 'Remeras' })).toBe('Remera oversize Remeras');
    expect(fraseParaCatalogo({ name: 'Remera oversize', category: 'remera' })).toBe('Remera oversize');
    expect(fraseParaCatalogo({ name: 'Remera oversize', category: 'General' })).toBe('Remera oversize');
  });

  it('con un nombre largo la categoría sobra', () => {
    expect(fraseParaCatalogo({ name: 'Yerba mate Playadito suave 1 kg', category: 'Almacén' })).toBe(
      'Yerba mate Playadito suave 1 kg',
    );
  });

  it('suma el rubro solo con un nombre muy corto y sin una categoría que sirva', () => {
    expect(fraseParaCatalogo({ name: 'Milán', industry: 'Indumentaria' })).toBe('Milán Indumentaria');
    expect(fraseParaCatalogo({ name: 'Milán', category: 'Otros', industry: 'Indumentaria' })).toBe('Milán Indumentaria');
    expect(fraseParaCatalogo({ name: 'Bandolera', category: 'Carteras', industry: 'Indumentaria' })).toBe(
      'Bandolera Carteras',
    );
  });

  it('agrega el color de la variante si el nombre no lo dice', () => {
    expect(fraseParaCatalogo({ name: 'Zapatilla urbana Nova', variant: 'Negro' })).toBe('Zapatilla urbana Nova Negro');
    expect(fraseParaCatalogo({ name: 'Zapatilla Nova negra', variant: 'negra' })).toContain('Zapatilla Nova negra');
    expect(fraseParaCatalogo({ name: 'Zapatilla Nova negra', variant: 'negra' }).match(/negra/gi)).toHaveLength(1);
  });

  it('sin nombre no hay búsqueda', () => {
    expect(fraseParaCatalogo({ name: '   ' })).toBe('');
  });
});

describe('ordenarParaCatalogo', () => {
  it('no exige modelo: devuelve fotos para un producto genérico', () => {
    const r = ordenarParaCatalogo(
      [foto({ url: 'https://a.com/1.jpg', title: 'Remera oversize negra algodón', domain: 'a.com' })],
      { name: 'Remera oversize negra' },
    );
    expect(r).toHaveLength(1);
  });

  it('descarta fotos chicas, apaisadas, SVG y repetidas', () => {
    const r = ordenarParaCatalogo(
      [
        foto({ url: 'https://a.com/chica.jpg', width: 120, height: 120 }),
        foto({ url: 'https://b.com/banner.jpg', width: 1600, height: 400 }),
        foto({ url: 'https://c.com/logo.svg' }),
        foto({ url: 'https://d.com/ok.jpg', width: 800, height: 800 }),
        foto({ url: 'https://d.com/ok.jpg', width: 800, height: 800 }),
      ],
      { name: 'Taza' },
    );
    expect(r.map((x) => x.url)).toEqual(['https://d.com/ok.jpg']);
  });

  it('sube las que nombran el producto y el color, y a igual puntaje respeta el orden de Google', () => {
    const r = ordenarParaCatalogo(
      [
        foto({ url: 'https://a.com/1.jpg', title: 'Otra cosa', domain: 'a.com' }),
        foto({ url: 'https://b.com/2.jpg', title: 'Mochila urbana', domain: 'b.com' }),
        foto({ url: 'https://c.com/3.jpg', title: 'Mochila urbana roja', domain: 'c.com' }),
        foto({ url: 'https://e.com/4.jpg', title: 'Otra más', domain: 'e.com' }),
      ],
      { name: 'Mochila urbana', variant: 'Roja' },
    );
    expect(r.map((x) => x.url)).toEqual([
      'https://c.com/3.jpg',
      'https://b.com/2.jpg',
      'https://a.com/1.jpg',
      'https://e.com/4.jpg',
    ]);
  });

  it('como mucho dos por sitio y seis en total', () => {
    const muchas = Array.from({ length: 12 }, (_, i) =>
      foto({ url: `https://${i < 5 ? 'mismo' : `s${i}`}.com/${i}.jpg`, domain: i < 5 ? 'mismo.com' : `s${i}.com` }),
    );
    const r = ordenarParaCatalogo(muchas, { name: 'Lámpara' });
    expect(r).toHaveLength(6);
    expect(r.filter((x) => x.domain === 'mismo.com')).toHaveLength(2);
  });
});

describe('esIpPrivada', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.0.10', '169.254.169.254', '100.100.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
    '%s es privada',
    (ip) => expect(esIpPrivada(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '151.101.1.1', '2606:4700::1111'])('%s es pública', (ip) => expect(esIpPrivada(ip)).toBe(false));
});

describe('ProductImageSearchService — catálogo y descarga', () => {
  let config: { get: jest.Mock };
  let usage: { track: jest.Mock };
  let costs: { reportQuotaExceeded: jest.Mock };
  let service: ProductImageSearchService;
  const fetchOriginal = global.fetch;

  const respuesta = (status: number, headers: Record<string, string>, cuerpo: unknown = '') => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => cuerpo,
    text: async () => String(cuerpo),
    arrayBuffer: async () => (Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(String(cuerpo))),
  });

  beforeEach(() => {
    config = { get: jest.fn() };
    usage = { track: jest.fn().mockResolvedValue(undefined) };
    costs = { reportQuotaExceeded: jest.fn().mockResolvedValue(undefined) };
    service = new ProductImageSearchService(config as unknown as ConfigService, usage as any, costs as any);
    // Sin DNS en los tests: todo resuelve a una IP pública salvo que el test diga otra cosa.
    jest.spyOn(service as any, 'resolverHost').mockResolvedValue(['151.101.1.1']);
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('busca en Serper por nombre, con miniatura y tamaño, y registra el consumo', async () => {
    config.get.mockImplementation((k: string) => (k === 'SERPER_API_KEY' ? 'clave' : undefined));
    global.fetch = jest.fn().mockResolvedValue(
      respuesta(200, {}, {
        images: [
          { imageUrl: 'https://tienda.com/remera.jpg', title: 'Remera oversize negra', link: 'https://tienda.com/p', domain: 'tienda.com', thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/x', imageWidth: 900, imageHeight: 900 },
        ],
      }),
    ) as any;

    const r = await service.searchCatalogImages({ name: 'Remera oversize negra', category: 'Remeras', businessId: 'b1' });

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ url: 'https://tienda.com/remera.jpg', thumbnailUrl: 'https://encrypted-tbn0.gstatic.com/x', width: 900 });
    const cuerpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(cuerpo.q).toBe('Remera oversize negra Remeras');
    expect(usage.track).toHaveBeenCalledWith(expect.objectContaining({ providerSlug: 'serper', businessId: 'b1', category: 'search_query' }));
  });

  it('descarga una foto y devuelve el buffer', async () => {
    global.fetch = jest.fn().mockResolvedValue(respuesta(200, { 'content-type': 'image/jpeg' }, Buffer.from([1, 2, 3]))) as any;
    const r = await service.descargarImagen('https://tienda.com/remera.jpg');
    expect(r.mimeType).toBe('image/jpeg');
    expect(r.buffer.length).toBe(3);
    expect((global.fetch as jest.Mock).mock.calls[0][1].redirect).toBe('manual');
  });

  it('rechaza un nombre que resuelve a una IP interna', async () => {
    (service as any).resolverHost.mockResolvedValue(['169.254.169.254']);
    global.fetch = jest.fn() as any;
    await expect(service.descargarImagen('https://trampa.example.com/x.jpg')).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('revalida cada redirección y corta si lleva a la red interna', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(respuesta(302, { location: 'http://169.254.169.254/computeMetadata/v1/' })) as any;
    await expect(service.descargarImagen('https://tienda.com/x.jpg')).rejects.toThrow(/redes privadas/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sigue una redirección pública', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respuesta(301, { location: '/cdn/x.webp' }))
      .mockResolvedValueOnce(respuesta(200, { 'content-type': 'image/webp' }, Buffer.from([9]))) as any;
    const r = await service.descargarImagen('https://tienda.com/x.jpg');
    expect(r.mimeType).toBe('image/webp');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://tienda.com/cdn/x.webp');
  });

  it('rechaza lo que no es una foto (HTML, SVG)', async () => {
    global.fetch = jest.fn().mockResolvedValue(respuesta(200, { 'content-type': 'text/html' }, '<html>')) as any;
    await expect(service.descargarImagen('https://tienda.com/p')).rejects.toThrow(/no es una foto/);
    global.fetch = jest.fn().mockResolvedValue(respuesta(200, { 'content-type': 'image/svg+xml' }, '<svg/>')) as any;
    await expect(service.descargarImagen('https://tienda.com/x.svg')).rejects.toThrow(/no es una foto/);
  });

  it('rechaza fotos de más de 10 MB por el content-length, sin bajarlas', async () => {
    const arrayBuffer = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ...respuesta(200, { 'content-type': 'image/png', 'content-length': String(11 * 1024 * 1024) }),
      arrayBuffer,
    }) as any;
    await expect(service.descargarImagen('https://tienda.com/x.png')).rejects.toThrow(/10MB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});

describe('ProductsController — fotos de la web en Importar Excel', () => {
  const ctx = { type: 'member', businessId: 'b1', memberId: 'm1', role: 'owner' } as any;
  let productsService: { datosParaFotoWeb: jest.Mock; addImage: jest.Mock };
  let search: { searchCatalogImages: jest.Mock; descargarImagen: jest.Mock };
  let cuota: { consumir: jest.Mock };
  let controller: ProductsController;

  beforeEach(() => {
    productsService = {
      datosParaFotoWeb: jest.fn().mockResolvedValue({ name: 'Taza', category: 'Cocina', industry: 'Bazar', variant: null }),
      addImage: jest.fn().mockResolvedValue({ id: 'img1', url: 'https://storage/x.webp' }),
    };
    search = {
      searchCatalogImages: jest.fn().mockResolvedValue([{ url: 'https://a.com/1.jpg' }]),
      descargarImagen: jest.fn().mockResolvedValue({ buffer: Buffer.from([1]), mimeType: 'image/png' }),
    };
    cuota = { consumir: jest.fn().mockResolvedValue(true) };
    controller = new ProductsController(
      productsService as any,
      {} as any,
      {} as any,
      cuota as any,
      search as any,
    );
  });

  it('no exige el paquete Avanzado (decisión del 12/11)', () => {
    const addon = (m: keyof ProductsController) =>
      Reflect.getMetadata(REQUIRES_ADDON_KEY, ProductsController.prototype[m] as object);
    expect(addon('webImageSuggestions')).toBeUndefined();
    expect(addon('addImageFromWeb')).toBeUndefined();
  });

  it('busca con los datos del producto guardado y consume el tope diario del negocio', async () => {
    const r = await controller.webImageSuggestions(ctx, 'p1', { optionValueId: undefined });
    expect(productsService.datosParaFotoWeb).toHaveBeenCalledWith('b1', 'p1', undefined);
    expect(cuota.consumir).toHaveBeenCalledWith('fotos-web:b1', FOTOS_WEB_DIA_NEGOCIO);
    expect(search.searchCatalogImages).toHaveBeenCalledWith(expect.objectContaining({ name: 'Taza', businessId: 'b1' }));
    expect(r).toHaveLength(1);
  });

  it('con el tope agotado responde 429 y no busca', async () => {
    cuota.consumir.mockResolvedValue(false);
    await expect(controller.webImageSuggestions(ctx, 'p1', {})).rejects.toBeInstanceOf(HttpException);
    expect(search.searchCatalogImages).not.toHaveBeenCalled();
  });

  it('guardar una sugerida baja la foto en el servidor y la sube como una foto más', async () => {
    await controller.addImageFromWeb(ctx, 'p1', { url: 'https://a.com/1.jpg', isPrimary: true, optionValueId: undefined });
    expect(search.descargarImagen).toHaveBeenCalledWith('https://a.com/1.jpg');
    expect(productsService.addImage).toHaveBeenCalledWith(
      'b1',
      'p1',
      { isPrimary: true, optionValueId: undefined },
      expect.objectContaining({ mimetype: 'image/png', originalname: 'foto-web.png' }),
    );
  });
});

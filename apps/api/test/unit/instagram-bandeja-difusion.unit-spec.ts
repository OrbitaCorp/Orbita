import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InstagramBandejaService } from '../../src/instagram/instagram-bandeja.service';
import { InstagramService } from '../../src/instagram/instagram.service';

// Bandeja de mensajes directos de Instagram (Difusión → Mensajes): solo las charlas de clientes de Instagram,
// con sus fotos, el plazo de 24 horas para contestar, y un envío que no deja en la charla algo que no salió.

const BIZ = 'biz-1';
const hace = (horas: number) => new Date(Date.now() - horas * 3600_000);

function build() {
  const prisma: any = {
    conversation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', isUnread: true, customerId: 'cli-ig', customer: { instagramId: 'IGSID1' } }),
      count: jest.fn().mockResolvedValue(3),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    product: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    order: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { total: '15000.50' } }),
      findMany: jest.fn().mockResolvedValue([{ id: 'o1', orderNumber: 41, status: 'DELIVERED', total: '9000', createdAt: new Date('2026-10-01T12:00:00Z') }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
    message: {
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `m-${data.text}`,
          sender: data.sender,
          text: data.text,
          attachments: data.attachments ?? null,
          deliveryStatus: data.deliveryStatus,
          createdAt: new Date('2026-10-12T10:00:00Z'),
        }),
      ),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const instagram = {
    enviarTexto: jest.fn().mockResolvedValue('mid.T'),
    enviarImagen: jest.fn().mockResolvedValue('mid.I'),
  } as unknown as jest.Mocked<InstagramService>;
  const medios: any = { subirFotoDeMensaje: jest.fn().mockResolvedValue('https://almacen/mensajes/f.jpg'), fotoDeProductoParaMensaje: jest.fn().mockResolvedValue('https://almacen/mensajes/p.jpg') };
  return { svc: new InstagramBandejaService(prisma, instagram, medios), prisma, instagram, medios };
}

describe('InstagramBandejaService', () => {
  it('lista solo charlas de clientes de Instagram de ESTE negocio', async () => {
    const { svc, prisma } = build();
    await svc.listar(BIZ);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ businessId: BIZ, customer: expect.objectContaining({ instagramId: { not: null } }) }) }),
    );
  });

  it('resume la última foto como "Foto" y marca hasta cuándo se puede contestar', async () => {
    const { svc, prisma } = build();
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'cv-1', isUnread: true, updatedAt: hace(1), customer: { firstName: 'Ana', lastName: null },
        messages: [{ sender: 'CUSTOMER', text: '[Imagen]', attachments: [{ tipo: 'image', url: 'https://x/a.jpg' }], createdAt: hace(1) }],
      },
      {
        id: 'cv-2', isUnread: false, updatedAt: hace(30), customer: { firstName: 'Beto', lastName: 'Paz' },
        messages: [{ sender: 'STORE', text: 'Gracias!', attachments: null, createdAt: hace(30) }],
      },
    ]);
    prisma.message.groupBy.mockResolvedValue([
      { conversationId: 'cv-1', _max: { createdAt: hace(1) } },
      { conversationId: 'cv-2', _max: { createdAt: hace(31) } },
    ]);
    const [a, b] = await svc.listar(BIZ);
    expect(a).toMatchObject({ nombre: 'Ana', ultimo: 'Foto', ultimoDe: 'cliente', noLeida: true });
    expect(a.puedeResponderHasta).not.toBeNull();
    expect(b).toMatchObject({ nombre: 'Beto Paz', ultimo: 'Gracias!', ultimoDe: 'negocio', puedeResponderHasta: null });
  });

  it('abrir una charla la marca leída sin tocar updatedAt, y esconde la etiqueta "[Imagen]"', async () => {
    const { svc, prisma } = build();
    prisma.message.findMany.mockResolvedValue([
      { id: 'm2', sender: 'STORE', text: 'Sí, hay', attachments: null, deliveryStatus: 'sent', createdAt: hace(1) },
      { id: 'm1', sender: 'CUSTOMER', text: '[Imagen]', attachments: [{ tipo: 'image', url: 'https://x/a.jpg' }], deliveryStatus: null, createdAt: hace(2) },
    ]);
    const r = await svc.mensajes(BIZ, 'cv-1');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(r.mensajes.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(r.mensajes[0]).toMatchObject({ de: 'cliente', texto: '', adjuntos: [{ tipo: 'image', url: 'https://x/a.jpg' }] });
    expect(r.puedeResponderHasta).not.toBeNull();
  });

  it('una charla de otro negocio (o que no es de Instagram) no se abre ni se responde', async () => {
    const { svc, prisma } = build();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(svc.mensajes(BIZ, 'ajena')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.responder(BIZ, 'ajena', 'hola', undefined)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'ajena', businessId: BIZ }) }),
    );
  });

  it('sin texto ni foto no manda nada', async () => {
    const { svc, instagram } = build();
    await expect(svc.responder(BIZ, 'cv-1', '   ', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(instagram.enviarTexto).not.toHaveBeenCalled();
  });

  it('con foto y texto manda dos mensajes (la foto primero) y guarda cada uno con su id', async () => {
    const { svc, prisma, instagram } = build();
    const salida = await svc.responder(BIZ, 'cv-1', ' Hola ', { buffer: Buffer.from('x') } as any);
    expect(instagram.enviarImagen).toHaveBeenCalledWith(BIZ, 'cv-1', 'IGSID1', 'https://almacen/mensajes/f.jpg');
    expect(instagram.enviarTexto).toHaveBeenCalledWith(BIZ, 'cv-1', 'IGSID1', 'Hola');
    expect(salida).toHaveLength(2);
    expect(salida[0].adjuntos).toEqual([{ tipo: 'image', url: 'https://almacen/mensajes/f.jpg' }]);
    expect(salida[1].texto).toBe('Hola');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ channel: 'INSTAGRAM', externalId: 'mid.I', sender: 'STORE' }),
      select: expect.anything(),
    });
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cv-1', businessId: BIZ } }));
  });

  it('si Instagram rechaza el envío (plazo vencido) no queda nada guardado', async () => {
    const { svc, prisma, instagram } = build();
    (instagram.enviarTexto as jest.Mock).mockRejectedValue(new Error('Pasaron más de 24 horas'));
    await expect(svc.responder(BIZ, 'cv-1', 'hola', undefined)).rejects.toThrow('24 horas');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('cuenta las no leídas solo de Instagram', async () => {
    const { svc, prisma } = build();
    await expect(svc.noLeidas(BIZ)).resolves.toEqual({ count: 3 });
    expect(prisma.conversation.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ businessId: BIZ, isUnread: true, customer: expect.objectContaining({ instagramId: { not: null } }) }),
    });
  });
});

describe('InstagramBandejaService: de la charla a la venta', () => {
  const PRODUCTO = {
    id: '39b2a1a3-462a-4c1c-a1b2-8dd6c0bf5ca3', name: 'Remera lino', basePrice: '12500.00',
    business: { subdomain: 'rama' }, images: [{ url: 'https://cdn.test/remera.webp' }],
  };

  it('enviarProducto manda la foto y, aparte, el nombre, el precio y el enlace corto de la tienda', async () => {
    const { svc, prisma, instagram, medios } = build();
    prisma.product.findFirst.mockResolvedValue(PRODUCTO);
    const salida = await svc.enviarProducto(BIZ, 'cv-1', PRODUCTO.id);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PRODUCTO.id, businessId: BIZ, status: 'PUBLISHED' } }));
    expect(medios.fotoDeProductoParaMensaje).toHaveBeenCalledWith(BIZ, 'https://cdn.test/remera.webp');
    expect(instagram.enviarImagen).toHaveBeenCalledWith(BIZ, 'cv-1', 'IGSID1', 'https://almacen/mensajes/p.jpg');
    const texto = (instagram.enviarTexto as jest.Mock).mock.calls[0][3] as string;
    expect(texto).toBe(`Remera lino\n$12.500\nhttps://rama.orbita.site/p/39b2a1a3`);
    expect(salida).toHaveLength(2);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cv-1', businessId: BIZ } }));
  });

  it('sin foto manda solo el texto; un producto de otro negocio o sin publicar no se manda', async () => {
    const { svc, prisma, instagram } = build();
    prisma.product.findFirst.mockResolvedValue({ ...PRODUCTO, images: [] });
    await svc.enviarProducto(BIZ, 'cv-1', PRODUCTO.id);
    expect(instagram.enviarImagen).not.toHaveBeenCalled();
    expect(instagram.enviarTexto).toHaveBeenCalledTimes(1);
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(svc.enviarProducto(BIZ, 'cv-1', 'ajeno')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cliente devuelve los datos de la persona y el resumen de sus pedidos (sin contar los cancelados)', async () => {
    const { svc, prisma } = build();
    prisma.customer.findFirst.mockResolvedValue({ id: 'cli-ig', firstName: 'Ana', lastName: 'Paz', email: null, phone: '1155', createdAt: new Date('2026-09-01T00:00:00Z') });
    const f = await svc.cliente(BIZ, 'cv-1');
    expect(f).toMatchObject({ id: 'cli-ig', nombre: 'Ana Paz', telefono: '1155', pedidos: { cantidad: 2, total: 15000.5 } });
    expect(f.pedidos.ultimos[0]).toMatchObject({ numero: 41, estado: 'DELIVERED', total: 9000 });
    expect(prisma.order.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BIZ, customerId: 'cli-ig', status: { not: 'CANCELLED' } } }));
  });

  describe('vincular', () => {
    const conTransaccion = (prisma: any) => {
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn(prisma));
    };

    it('el cliente existente se queda con el Instagram, la charla pasa a ser suya y el automático se da de baja', async () => {
      const { svc, prisma } = build();
      conTransaccion(prisma);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cli-real', instagramId: null });
      prisma.conversation.findFirst.mockResolvedValueOnce({ id: 'cv-1', isUnread: true, customerId: 'cli-ig', customer: { instagramId: 'IGSID1' } }).mockResolvedValueOnce(null);
      await expect(svc.vincular(BIZ, 'cv-1', 'cli-real')).resolves.toEqual({ conversationId: 'cv-1' });
      // Primero se libera el id (es único por negocio) y recién después se asigna.
      const llamadas = prisma.customer.updateMany.mock.calls.map((c: any[]) => c[0]);
      expect(llamadas[0]).toEqual({ where: { id: 'cli-ig', businessId: BIZ }, data: { instagramId: null, deletedAt: expect.any(Date) } });
      expect(llamadas[1]).toEqual({ where: { id: 'cli-real', businessId: BIZ }, data: { instagramId: 'IGSID1' } });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { businessId: BIZ, customerId: 'cli-ig' }, data: { customerId: 'cli-real' } });
      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({ where: { id: 'cv-1', businessId: BIZ }, data: { customerId: 'cli-real' } });
    });

    it('si el cliente ya tenía una charla (la de la tienda), los mensajes se pasan a esa y la de Instagram se borra', async () => {
      const { svc, prisma } = build();
      conTransaccion(prisma);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cli-real', instagramId: null });
      prisma.conversation.findFirst.mockResolvedValueOnce({ id: 'cv-1', isUnread: true, customerId: 'cli-ig', customer: { instagramId: 'IGSID1' } }).mockResolvedValueOnce({ id: 'cv-tienda' });
      await expect(svc.vincular(BIZ, 'cv-1', 'cli-real')).resolves.toEqual({ conversationId: 'cv-tienda' });
      expect(prisma.message.updateMany).toHaveBeenCalledWith({ where: { conversationId: 'cv-1' }, data: { conversationId: 'cv-tienda' } });
      expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({ where: { id: 'cv-1', businessId: BIZ } });
    });

    it('no se vincula con uno mismo, con un cliente de otro negocio ni con uno que ya tiene otro Instagram', async () => {
      const { svc, prisma } = build();
      conTransaccion(prisma);
      await expect(svc.vincular(BIZ, 'cv-1', 'cli-ig')).rejects.toBeInstanceOf(BadRequestException);
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(svc.vincular(BIZ, 'cv-1', 'ajeno')).rejects.toBeInstanceOf(NotFoundException);
      prisma.customer.findFirst.mockResolvedValue({ id: 'cli-real', instagramId: 'OTRO' });
      await expect(svc.vincular(BIZ, 'cv-1', 'cli-real')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

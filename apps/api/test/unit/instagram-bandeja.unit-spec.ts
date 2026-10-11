import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      findFirst: jest.fn().mockResolvedValue({ id: 'cv-1', isUnread: true, customer: { instagramId: 'IGSID1' } }),
      count: jest.fn().mockResolvedValue(3),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    message: {
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
  const medios: any = { subirFotoDeMensaje: jest.fn().mockResolvedValue('https://almacen/mensajes/f.jpg') };
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

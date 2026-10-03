import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LecturaConversacionesService } from './lectura-conversaciones.service';
import { AbrirConversacionDto } from './dto/abrir-conversacion.dto';

const dto = { motivo: 'soporte', detalle: 'El cliente reportó un error al cargar stock', ticket: ' T-123 ' } as const;

function armar(flag: string | undefined, conv: unknown, mensajesV2: unknown[] = []) {
  const prisma = {
    orbiConversation: { findUnique: jest.fn().mockResolvedValue(conv) },
    orbiConversationAccess: { create: jest.fn().mockResolvedValue({}) },
    orbiMessage: { findMany: jest.fn().mockResolvedValue(mensajesV2) },
  };
  const config = { get: jest.fn((k: string) => (k === 'ORBI_LECTURA_CONVERSACIONES' ? flag : undefined)) };
  const adminLog = { orbiConversacionAbierta: jest.fn().mockResolvedValue(undefined) };
  const svc = new LecturaConversacionesService(prisma as never, config as never, adminLog as never);
  return { svc, prisma, adminLog };
}

const v1 = {
  id: 'c1',
  title: 'Stock',
  businessId: 'b1',
  userId: 'm1',
  version: 1,
  messages: [
    { role: 'user', content: 'Escribime a juan@mail.com', timestamp: '2026-10-01T10:00:00.000Z' },
    { role: 'assistant', content: '', timestamp: '2026-10-01T10:00:01.000Z', toolCalls: [{ id: 't', name: 'x', arguments: {} }] },
    { role: 'tool', content: '{"secreto":"dato interno"}', timestamp: '2026-10-01T10:00:02.000Z' },
    { role: 'assistant', content: 'Listo', timestamp: '2026-10-01T10:00:03.000Z' },
  ],
};

describe('LecturaConversacionesService', () => {
  it.each([undefined, '', 'off', 'ON', 'true', '1'])('con el flag %p es 403 y no lee ni escribe nada', async (flag) => {
    const { svc, prisma, adminLog } = armar(flag, v1);
    await expect(svc.abrir('c1', 'ad1', dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.orbiConversation.findUnique).not.toHaveBeenCalled();
    expect(prisma.orbiMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.orbiConversationAccess.create).not.toHaveBeenCalled();
    expect(adminLog.orbiConversacionAbierta).not.toHaveBeenCalled();
  });

  it('conversación inexistente: 404 sin registro', async () => {
    const { svc, prisma, adminLog } = armar('on', null);
    await expect(svc.abrir('nope', 'ad1', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.orbiConversationAccess.create).not.toHaveBeenCalled();
    expect(adminLog.orbiConversacionAbierta).not.toHaveBeenCalled();
  });

  it('con el flag on registra el acceso, lo deja en el log y devuelve el texto redactado (v1, sin mensajes de tool ni vacíos)', async () => {
    const { svc, prisma, adminLog } = armar('on', v1);
    const r = await svc.abrir('c1', 'ad1', dto);
    expect(prisma.orbiConversationAccess.create).toHaveBeenCalledWith({
      data: { adminId: 'ad1', conversationId: 'c1', businessId: 'b1', memberId: 'm1', motivo: 'soporte', detalle: dto.detalle, ticket: 'T-123' },
    });
    expect(adminLog.orbiConversacionAbierta).toHaveBeenCalledWith({ adminId: 'ad1', conversationId: 'c1', businessId: 'b1', motivo: 'soporte', ticket: 'T-123' });
    expect(r).toEqual({
      id: 'c1',
      titulo: 'Stock',
      businessId: 'b1',
      memberId: 'm1',
      mensajes: [
        { rol: 'user', texto: 'Escribime a [email]', fecha: '2026-10-01T10:00:00.000Z' },
        { rol: 'assistant', texto: 'Listo', fecha: '2026-10-01T10:00:03.000Z' },
      ],
    });
  });

  it('el registro se escribe ANTES de leer el texto de la v2', async () => {
    const orden: string[] = [];
    const { svc, prisma } = armar('on', { ...v1, version: 2, messages: [] });
    prisma.orbiConversationAccess.create.mockImplementation(async () => {
      orden.push('registro');
    });
    prisma.orbiMessage.findMany.mockImplementation(async () => {
      orden.push('texto');
      return [];
    });
    await svc.abrir('c1', 'ad1', dto);
    expect(orden).toEqual(['registro', 'texto']);
  });

  it('si el registro falla no devuelve el texto (ni lo lee)', async () => {
    const { svc, prisma, adminLog } = armar('on', { ...v1, version: 2 });
    prisma.orbiConversationAccess.create.mockRejectedValue(new Error('db caída'));
    await expect(svc.abrir('c1', 'ad1', dto)).rejects.toThrow('db caída');
    expect(prisma.orbiMessage.findMany).not.toHaveBeenCalled();
    expect(adminLog.orbiConversacionAbierta).not.toHaveBeenCalled();
  });

  it('la v2 lee solo las partes de texto de orbi_messages, redactadas', async () => {
    const fecha = new Date('2026-10-02T12:00:00.000Z');
    const { svc, prisma } = armar('on', { ...v1, version: 2, messages: [] }, [
      { role: 'user', parts: [{ tipo: 'texto', texto: 'Mi mail es ana@x.com' }], createdAt: fecha },
      {
        role: 'assistant',
        createdAt: fecha,
        parts: [
          { tipo: 'pensamiento', texto: 'razonando' },
          { tipo: 'actividad', id: 'a', tool: 't', etiqueta: 'Buscando', estado: 'ok' },
          { tipo: 'texto', texto: 'Hola' },
          { tipo: 'texto', texto: 'Chau' },
        ],
      },
      { role: 'assistant', parts: [{ tipo: 'aviso', codigo: 'error', texto: 'falló' }], createdAt: fecha },
      { role: 'assistant', parts: 'roto', createdAt: fecha },
    ]);
    const r = await svc.abrir('c1', 'ad1', dto);
    expect(prisma.orbiMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'c1', businessId: 'b1' }, orderBy: { createdAt: 'asc' } }));
    expect(r.mensajes).toEqual([
      { rol: 'user', texto: 'Mi mail es [email]', fecha: fecha.toISOString() },
      { rol: 'assistant', texto: 'Hola\nChau', fecha: fecha.toISOString() },
    ]);
  });
});

describe('AbrirConversacionDto', () => {
  const errores = async (o: object) => (await validate(plainToInstance(AbrirConversacionDto, o))).map((e) => e.property);

  it('acepta soporte/abuso/calidad con detalle y ticket opcional', async () => {
    expect(await errores({ motivo: 'abuso', detalle: 'Detalle suficiente' })).toEqual([]);
    expect(await errores({ motivo: 'calidad', detalle: 'Detalle suficiente', ticket: 'T-1' })).toEqual([]);
  });

  it('rechaza motivo desconocido, detalle corto o ticket larguísimo', async () => {
    expect(await errores({ motivo: 'curiosidad', detalle: 'Detalle suficiente' })).toEqual(['motivo']);
    expect(await errores({ motivo: 'soporte', detalle: 'corto' })).toEqual(['detalle']);
    expect(await errores({ motivo: 'soporte', detalle: 'Detalle suficiente', ticket: 'x'.repeat(101) })).toEqual(['ticket']);
  });
});

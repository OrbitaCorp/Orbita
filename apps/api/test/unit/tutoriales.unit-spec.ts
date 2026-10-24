import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TutorialesService } from '../../src/marketing/videos/tutoriales.service';

// La lista de tutoriales (qué hay y qué falta): se lee agrupada con un resumen y se actualiza por id o por título, con el
// estado EN_REVISION reservado para el sistema. Base simulada.

type Fila = Record<string, any>;
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function armar() {
  const filas: Fila[] = [
    { id: ID_A, grupo: 'Catálogo', grupoOrden: 2, orden: 1, titulo: 'Cargar un producto', estado: 'HECHO', opcional: false, prioridadAlta: false, notas: null, updatedAt: new Date() },
    { id: ID_B, grupo: 'Vender día a día', grupoOrden: 3, orden: 1, titulo: 'Atender un pedido', estado: 'FALTA', opcional: false, prioridadAlta: true, notas: null, updatedAt: new Date() },
    { id: '33333333-3333-4333-8333-333333333333', grupo: 'Vender día a día', grupoOrden: 3, orden: 2, titulo: 'Pedidos en lote', estado: 'EN_REVISION', opcional: false, prioridadAlta: false, notas: null, updatedAt: new Date() },
  ];
  const videos: Fila[] = [{ id: 'video-1', tutorialId: '33333333-3333-4333-8333-333333333333', estado: 'PENDIENTE' }];
  const prisma = {
    marketingTutorial: {
      findMany: jest.fn(async ({ where }: { where?: Fila } = {}) => filas.filter((f) => !where?.estado || f.estado === where.estado)),
      groupBy: jest.fn(async () => ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'].map((estado) => ({ estado, _count: { _all: filas.filter((f) => f.estado === estado).length } })).filter((g) => g._count._all > 0)),
      findUnique: jest.fn(async ({ where }: { where: Fila }) => filas.find((f) => f.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: { where: Fila }) => filas.find((f) => f.titulo.toLowerCase() === String(where.titulo.equals).toLowerCase()) ?? null),
      update: jest.fn(async ({ where, data }: { where: Fila; data: Fila }) => { const f = filas.find((x) => x.id === where.id)!; Object.assign(f, data); return f; }),
    },
    marketingVideo: { findMany: jest.fn(async () => videos) },
    platformAdminLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { svc: new TutorialesService(prisma as never), prisma, filas };
}

describe('lista de tutoriales', () => {
  it('se lee en orden de grupo, con el resumen de cuántos hay en cada estado y el video que espera revisión', async () => {
    const { svc } = armar();
    const r = await svc.listar();
    expect(r.resumen).toEqual({ total: 3, hechos: 1, enRevision: 1, enProceso: 0, faltan: 1 });
    expect(r.tutoriales.map((t) => [t.grupo, t.titulo, t.estado])).toEqual([
      ['Catálogo', 'Cargar un producto', 'HECHO'], ['Vender día a día', 'Atender un pedido', 'FALTA'], ['Vender día a día', 'Pedidos en lote', 'EN_REVISION'],
    ]);
    expect(r.tutoriales[2].videoId).toBe('video-1');
    expect(r.tutoriales[1]).toMatchObject({ prioridadAlta: true, videoId: null });
  });

  it('se puede filtrar por estado, y el resumen sigue contando todo', async () => {
    const { svc } = armar();
    const r = await svc.listar('FALTA');
    expect(r.tutoriales.map((t) => t.titulo)).toEqual(['Atender un pedido']);
    expect(r.resumen.total).toBe(3);
  });

  it('se actualiza por id o por título (sin importar mayúsculas) y queda anotado quién lo hizo', async () => {
    const { svc, filas, prisma } = armar();
    await svc.actualizar('admin-1', { tutorial: 'atender UN pedido', estado: 'EN_PROCESO', notas: ' arranca Alan ' });
    expect(filas[1]).toMatchObject({ estado: 'EN_PROCESO', notas: 'arranca Alan', actualizadoPor: 'admin-1' });
    await svc.actualizar('admin-2', { tutorial: ID_B, estado: 'FALTA' });
    expect(filas[1].estado).toBe('FALTA');
    expect(prisma.platformAdminLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'tutorial_actualizar', adminId: 'admin-2', targetId: ID_B }) });
  });

  it('solo notas también vale, y una nota vacía la borra', async () => {
    const { svc, filas } = armar();
    await svc.actualizar('admin-1', { tutorial: ID_B, notas: 'falta la demo' });
    expect(filas[1]).toMatchObject({ estado: 'FALTA', notas: 'falta la demo' });
    await svc.actualizar('admin-1', { tutorial: ID_B, notas: '' });
    expect(filas[1].notas).toBeNull();
  });

  it('EN_REVISION no se pone a mano (lo decide el sistema), ni un estado inventado, ni sin cambios', async () => {
    const { svc } = armar();
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, estado: 'EN_REVISION' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B, estado: 'LISTO' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.actualizar('admin-1', { tutorial: ID_B })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un tutorial que no existe, o sin indicar cuál, se rechaza', async () => {
    const { svc } = armar();
    await expect(svc.actualizar('admin-1', { tutorial: 'No está', estado: 'HECHO' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.actualizar('admin-1', { tutorial: '  ', estado: 'HECHO' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// La lista de tutoriales: qué hay y qué falta (tabla marketing_tutoriales, cargada con la lista que armó el equipo).
// La actualiza el Claude de cada persona por el conector (tutoriales_listar / tutoriales_actualizar) y también se puede
// corregir desde el panel (Marketing → Videos → Tutoriales).
//
//   FALTA       → todavía no se hizo.
//   EN_PROCESO  → alguien lo está haciendo (lo marca su Claude al empezar).
//   EN_REVISION → hay un video en la cola esperando que su creador lo apruebe (lo pone solo el registro del video).
//   HECHO       → está listo (lo pone solo la aprobación del video, o se marca a mano si se hizo por fuera de la cola).

export const ESTADOS_TUTORIAL = ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'] as const;
export type EstadoTutorial = (typeof ESTADOS_TUTORIAL)[number];
export const RESPONSABLES_TUTORIAL = ['ALAN', 'MATEO', 'ALE'] as const;
export type ResponsableTutorial = (typeof RESPONSABLES_TUTORIAL)[number];
/** Los que se pueden poner a mano: EN_REVISION lo decide el sistema según haya o no un video esperando. */
const ESTADOS_A_MANO = ['FALTA', 'EN_PROCESO', 'HECHO'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\u0000/g, '').slice(0, max) : '');

@Injectable()
export class TutorialesService {
  private readonly logger = new Logger(TutorialesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(estado?: string) {
    const where: Prisma.MarketingTutorialWhereInput = estado && (ESTADOS_TUTORIAL as readonly string[]).includes(estado) ? { estado } : {};
    const filas = await this.prisma.marketingTutorial.findMany({ where, orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }] });
    const todos = await this.prisma.marketingTutorial.groupBy({ by: ['estado'], _count: { _all: true } });
    const cuenta = (e: string) => todos.find((t) => t.estado === e)?._count._all ?? 0;
    const videos = filas.length
      ? await this.prisma.marketingVideo.findMany({ where: { tutorialId: { in: filas.map((f) => f.id) } }, orderBy: { createdAt: 'desc' }, select: { id: true, tutorialId: true, estado: true } })
      : [];
    return {
      resumen: { total: todos.reduce((s, t) => s + t._count._all, 0), hechos: cuenta('HECHO'), enRevision: cuenta('EN_REVISION'), enProceso: cuenta('EN_PROCESO'), faltan: cuenta('FALTA') },
      tutoriales: filas.map((f) => ({
        id: f.id,
        grupo: f.grupo,
        titulo: f.titulo,
        estado: f.estado as EstadoTutorial,
        opcional: f.opcional,
        prioridadAlta: f.prioridadAlta,
        notas: f.notas,
        asignadoA: f.asignadoA as ResponsableTutorial | null,
        videoId: videos.find((v) => v.tutorialId === f.id)?.id ?? null,
        updatedAt: f.updatedAt,
      })),
    };
  }

  /** Cambia el estado y/o las notas de un tutorial. Se acepta su id o su título exacto. */
  async actualizar(adminId: string, input: { tutorial: unknown; estado?: unknown; asignadoA?: unknown; notas?: unknown }) {
    const ref = String(input.tutorial ?? '').trim();
    if (!ref) throw new BadRequestException('Falta el tutorial (su id o su título)');
    const item = UUID.test(ref)
      ? await this.prisma.marketingTutorial.findUnique({ where: { id: ref } })
      : await this.prisma.marketingTutorial.findFirst({ where: { titulo: { equals: ref, mode: 'insensitive' } } });
    if (!item) throw new NotFoundException('No existe ese tutorial en la lista (usá tutoriales_listar para ver los ids)');

    const data: Prisma.MarketingTutorialUpdateInput = { actualizadoPor: adminId };
    if (input.estado !== undefined) {
      const estado = String(input.estado);
      if (estado === 'EN_REVISION') throw new BadRequestException('EN_REVISION lo pone solo el sistema cuando registrás el video del tutorial');
      if (!ESTADOS_A_MANO.includes(estado)) throw new BadRequestException(`estado tiene que ser uno de: ${ESTADOS_A_MANO.join(', ')}`);
      data.estado = estado;
    }
    if (input.notas !== undefined) data.notas = limpio(input.notas, 1000).trim() || null;
    if (input.asignadoA !== undefined) {
      const asignado = input.asignadoA ? String(input.asignadoA).trim().toUpperCase() : null;
      if (asignado && !RESPONSABLES_TUTORIAL.includes(asignado as ResponsableTutorial)) {
        throw new BadRequestException(`asignadoA tiene que ser uno de: ${RESPONSABLES_TUTORIAL.join(', ')} o vacío`);
      }
      data.asignadoA = asignado;
    }
    if (input.estado === undefined && input.notas === undefined && input.asignadoA === undefined) throw new BadRequestException('No hay nada para cambiar: mandá estado, asignadoA o notas');

    const r = await this.prisma.marketingTutorial.update({ where: { id: item.id }, data });
    await this.registrar(adminId, item.id, { titulo: item.titulo, antes: item.estado, estado: r.estado });
    return { id: r.id, titulo: r.titulo, estado: r.estado as EstadoTutorial, asignadoA: r.asignadoA as ResponsableTutorial | null, notas: r.notas };
  }

  private async registrar(adminId: string, targetId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.platformAdminLog.create({ data: { adminId, action: 'tutorial_actualizar', targetType: 'marketing_tutorial', targetId, details: details as Prisma.InputJsonValue } });
    } catch (e) {
      // El registro no puede tirar abajo la acción: ya se hizo.
      this.logger.warn(`No se pudo registrar tutorial_actualizar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

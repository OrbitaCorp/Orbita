import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { idDeYoutube } from './youtube';

// La lista de tutoriales: qué hay y qué falta (tabla marketing_tutoriales, cargada con la lista que armó el equipo).
// La actualiza el Claude de cada persona por el conector (tutoriales_listar / tutoriales_actualizar) y también se puede
// corregir desde el panel (Marketing → Videos → Tutoriales), que además muestra cada video para seguir el progreso.
//
// Los videos viven en YouTube (subidos como «No listado»): el Claude de cada persona carga el link con
// tutoriales_actualizar y el tutorial pasa a HECHO, sin cola, sin aprobación y sin correo. `pantallas` dice en qué
// pantallas del panel se ofrece (el botón «Ver tutorial» → Video lee videosDelPanel).
//
//   FALTA       → todavía no se hizo.
//   EN_PROCESO  → alguien lo está haciendo (lo marca su Claude al empezar).
//   EN_REVISION → de antes, cuando los tutoriales esperaban aprobación en la cola (ya no se usa).
//   HECHO       → está listo (al cargar su link de YouTube, al registrar su video en la cola, o a mano).

export const ESTADOS_TUTORIAL = ['FALTA', 'EN_PROCESO', 'EN_REVISION', 'HECHO'] as const;
export type EstadoTutorial = (typeof ESTADOS_TUTORIAL)[number];
export const RESPONSABLES_TUTORIAL = ['ALAN', 'MATEO', 'ALE'] as const;
export type ResponsableTutorial = (typeof RESPONSABLES_TUTORIAL)[number];
/** Los que se pueden poner a mano: EN_REVISION lo decide el sistema según haya o no un video esperando. */
const ESTADOS_A_MANO = ['FALTA', 'EN_PROCESO', 'HECHO'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\u0000/g, '').slice(0, max) : '');
/** Una clave de pantalla del panel: 'pedidos', 'catalogo/nuevo', 'configuracion/apariencia', 'configuracion/equipo/invitar'. */
const PANTALLA = /^[a-z]+(\/[a-z-]+){0,2}$/;
const MAX_PANTALLAS = 6;

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
        youtubeId: f.youtubeId,
        pantallas: f.pantallas,
        videoId: videos.find((v) => v.tutorialId === f.id)?.id ?? null,
        updatedAt: f.updatedAt,
      })),
    };
  }

  /** Lo que ofrece el panel en «Ver tutorial» → Video: los tutoriales con link, por pantalla y en el orden de la lista. */
  async videosDelPanel() {
    const filas = await this.prisma.marketingTutorial.findMany({
      where: { youtubeId: { not: null }, NOT: { pantallas: { isEmpty: true } } },
      orderBy: [{ grupoOrden: 'asc' }, { orden: 'asc' }],
      select: { titulo: true, youtubeId: true, pantallas: true },
    });
    return { videos: filas.map((f) => ({ titulo: f.titulo, youtubeId: f.youtubeId as string, pantallas: f.pantallas })) };
  }

  /**
   * Cambia el estado, el responsable, las notas, el link de YouTube y/o las pantallas de un tutorial. Se acepta su id o su
   * título exacto. Cargar el link lo deja HECHO (salvo que se mande otro estado); un link vacío lo quita.
   */
  async actualizar(adminId: string, input: { tutorial: unknown; estado?: unknown; asignadoA?: unknown; notas?: unknown; youtube?: unknown; pantallas?: unknown }) {
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
    if (input.youtube !== undefined) {
      const crudo = typeof input.youtube === 'string' ? input.youtube.trim() : '';
      if (!crudo) data.youtubeId = null;
      else {
        const id = idDeYoutube(crudo);
        if (!id) throw new BadRequestException('youtube tiene que ser un link de un video de YouTube (youtu.be/…, youtube.com/watch?v=…) o su id');
        data.youtubeId = id;
        if (input.estado === undefined) data.estado = 'HECHO';
      }
    }
    if (input.pantallas !== undefined) {
      if (!Array.isArray(input.pantallas)) throw new BadRequestException('pantallas tiene que ser una lista (por ejemplo ["pedidos", "pedidos/nuevo"])');
      const pantallas = [...new Set(input.pantallas.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
      const mala = pantallas.find((p) => !PANTALLA.test(p));
      if (mala) throw new BadRequestException(`«${mala}» no es una pantalla del panel (son como 'pedidos', 'catalogo/nuevo' o 'configuracion/apariencia')`);
      if (pantallas.length > MAX_PANTALLAS) throw new BadRequestException(`Como mucho ${MAX_PANTALLAS} pantallas por tutorial`);
      data.pantallas = pantallas;
    }
    if ([input.estado, input.notas, input.asignadoA, input.youtube, input.pantallas].every((x) => x === undefined)) {
      throw new BadRequestException('No hay nada para cambiar: mandá estado, asignadoA, notas, youtube o pantallas');
    }

    const r = await this.prisma.marketingTutorial.update({ where: { id: item.id }, data });
    await this.registrar(adminId, item.id, { titulo: item.titulo, antes: item.estado, estado: r.estado });
    return { id: r.id, titulo: r.titulo, estado: r.estado as EstadoTutorial, asignadoA: r.asignadoA as ResponsableTutorial | null, notas: r.notas, youtubeId: r.youtubeId, pantallas: r.pantallas };
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

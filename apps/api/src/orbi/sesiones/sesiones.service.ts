import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { tituloAutomatico, tituloLimpio } from './titulo';

// Las sesiones de Orbi (fase 3, spec 2026-10-01-orbi-fase-3-ui-panel §3.2 y
// §3.4): las conversaciones del panel de una persona, con título, fijadas y
// archivadas. Privadas: TODA consulta va acotada a negocio Y miembro, y una
// ajena se ve igual que una inexistente (404), como historialSiEsPropia.

const POR_PAGINA = 30;
const MAX_FIJADAS = 20;

/** Cómo se ve una parte de un mensaje (spec §3.3). Las v1 solo tienen texto. */
export type Parte =
  | { tipo: 'pensamiento'; texto: string }
  | { tipo: 'actividad'; id: string; tool: string; etiqueta: string; estado: 'en_curso' | 'ok' | 'error'; resumen?: string; ms?: number; destino?: { label: string; path: string } }
  | { tipo: 'aprobacion'; actionId: string; tool: string; resumen: string; estadoActual?: EstadoDeAprobacion }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'aviso'; codigo: 'detenido' | 'tope_de_vueltas' | 'error'; texto: string };

/** El estado de una tarjeta se lee de orbi_pending_actions al abrir: una vencida se ve vencida. */
export type EstadoDeAprobacion = 'pendiente' | 'aplicando' | 'aplicada' | 'fallida' | 'cancelada' | 'vencida' | 'desconocida';

export interface ResumenDeSesion {
  id: string;
  titulo: string | null;
  fijada: boolean;
  archivada: boolean;
  ultimaActividad: string;
  pantalla: string | null;
  esperandoAprobacion: boolean;
}

export interface MensajeDeSesion {
  id: string;
  rol: 'user' | 'assistant';
  partes: Parte[];
  creadoEl: string | null;
}

type Fila = Prisma.OrbiConversationGetPayload<{
  select: { id: true; title: true; pinnedAt: true; archivedAt: true; lastActivityAt: true; screen: true };
}>;

const SELECCION = { id: true, title: true, pinnedAt: true, archivedAt: true, lastActivityAt: true, screen: true } as const;

/** Cursor de la lista: la última actividad y el id de la última fila (desempata dos en el mismo milisegundo). */
function leerCursor(cursor?: string): { en: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = cursor.split('|');
  const en = new Date(iso);
  return id && !isNaN(en.getTime()) ? { en, id } : null;
}

function estadoDeAprobacion(fila: { status: string; expiresAt: Date } | undefined, ahora: Date): EstadoDeAprobacion {
  if (!fila) return 'desconocida';
  switch (fila.status) {
    case 'pending': return fila.expiresAt > ahora ? 'pendiente' : 'vencida';
    case 'executing': return 'aplicando';
    case 'executed': return 'aplicada';
    case 'failed': return 'fallida';
    case 'rejected': return 'cancelada';
    default: return 'desconocida';
  }
}

@Injectable()
export class SesionesService {
  private readonly logger = new Logger(SesionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Las sesiones del panel de esta persona, de la más reciente a la más vieja.
   * Las fijadas van aparte (solo en la primera página): así la paginación por
   * cursor no se rompe con filas que no siguen el orden por fecha.
   */
  async listar(
    businessId: string,
    memberId: string,
    opciones: { archivadas?: boolean; q?: string; cursor?: string } = {},
  ): Promise<{ fijadas: ResumenDeSesion[]; sesiones: ResumenDeSesion[]; siguiente: string | null }> {
    const base: Prisma.OrbiConversationWhereInput = {
      businessId,
      userId: memberId,
      surface: 'panel',
      archivedAt: opciones.archivadas ? { not: null } : null,
      ...(opciones.q?.trim() ? { title: { contains: opciones.q.trim(), mode: 'insensitive' } } : {}),
    };
    const cursor = leerCursor(opciones.cursor);
    const orden: Prisma.OrbiConversationOrderByWithRelationInput[] = [{ lastActivityAt: 'desc' }, { id: 'desc' }];

    const [fijadas, pagina] = await Promise.all([
      // Las archivadas no se muestran como fijadas: archivar gana.
      cursor || opciones.archivadas
        ? Promise.resolve([] as Fila[])
        : this.prisma.orbiConversation.findMany({ where: { ...base, pinnedAt: { not: null } }, orderBy: orden, take: MAX_FIJADAS, select: SELECCION }),
      this.prisma.orbiConversation.findMany({
        where: {
          ...base,
          ...(opciones.archivadas ? {} : { pinnedAt: null }),
          ...(cursor ? { OR: [{ lastActivityAt: { lt: cursor.en } }, { lastActivityAt: cursor.en, id: { lt: cursor.id } }] } : {}),
        },
        orderBy: orden,
        take: POR_PAGINA + 1,
        select: SELECCION,
      }),
    ]);

    const hayMas = pagina.length > POR_PAGINA;
    const visibles = hayMas ? pagina.slice(0, POR_PAGINA) : pagina;
    const todas = [...fijadas, ...visibles];
    const [titulos, esperando] = await Promise.all([this.titulosQueFaltan(businessId, memberId, todas), this.conAprobacionPendiente(businessId, todas.map((f) => f.id))]);

    const resumen = (f: Fila): ResumenDeSesion => ({
      id: f.id,
      titulo: f.title ?? titulos.get(f.id) ?? null,
      fijada: f.pinnedAt !== null,
      archivada: f.archivedAt !== null,
      ultimaActividad: f.lastActivityAt.toISOString(),
      pantalla: f.screen,
      esperandoAprobacion: esperando.has(f.id),
    });
    const ultima = visibles[visibles.length - 1];
    return {
      fijadas: fijadas.map(resumen),
      sesiones: visibles.map(resumen),
      siguiente: hayMas && ultima ? `${ultima.lastActivityAt.toISOString()}|${ultima.id}` : null,
    };
  }

  /** Una sesión vacía (el botón "Nueva sesión"). */
  async crear(businessId: string, memberId: string, pantalla?: string): Promise<ResumenDeSesion> {
    const f = await this.prisma.orbiConversation.create({
      data: { businessId, userId: memberId, surface: 'panel', messages: [], screen: pantalla ?? null },
      select: SELECCION,
    });
    return { id: f.id, titulo: null, fijada: false, archivada: false, ultimaActividad: f.lastActivityAt.toISOString(), pantalla: f.screen, esperandoAprobacion: false };
  }

  /** Los mensajes con sus partes, y el estado de hoy de cada tarjeta. */
  async abrir(businessId: string, memberId: string, id: string): Promise<ResumenDeSesion & { mensajes: MensajeDeSesion[] }> {
    const conv = await this.prisma.orbiConversation.findFirst({
      where: { id, businessId, userId: memberId, surface: 'panel' },
      select: { ...SELECCION, version: true, messages: true },
    });
    if (!conv) throw new NotFoundException('Sesión no encontrada');

    const mensajes = conv.version >= 2 ? await this.mensajesV2(businessId, id) : mensajesV1(conv.messages);
    const [titulos, esperando] = await Promise.all([this.titulosQueFaltan(businessId, memberId, [conv]), this.conAprobacionPendiente(businessId, [id])]);
    return {
      id: conv.id,
      titulo: conv.title ?? titulos.get(conv.id) ?? null,
      fijada: conv.pinnedAt !== null,
      archivada: conv.archivedAt !== null,
      ultimaActividad: conv.lastActivityAt.toISOString(),
      pantalla: conv.screen,
      esperandoAprobacion: esperando.has(id),
      mensajes,
    };
  }

  /** Renombrar (deja de ser automático), fijar y archivar. */
  async editar(
    businessId: string,
    memberId: string,
    id: string,
    cambios: { titulo?: string; fijada?: boolean; archivada?: boolean },
  ): Promise<ResumenDeSesion> {
    const ahora = new Date();
    const data: Prisma.OrbiConversationUpdateManyMutationInput = {};
    if (cambios.titulo !== undefined) {
      const titulo = tituloLimpio(cambios.titulo);
      // Vaciar el título es volver al automático.
      data.title = titulo || null;
      data.titleAuto = !titulo;
    }
    if (cambios.fijada !== undefined) data.pinnedAt = cambios.fijada ? ahora : null;
    if (cambios.archivada !== undefined) data.archivedAt = cambios.archivada ? ahora : null;

    const { count } = await this.prisma.orbiConversation.updateMany({ where: { id, businessId, userId: memberId, surface: 'panel' }, data });
    if (count === 0) throw new NotFoundException('Sesión no encontrada');
    const f = await this.prisma.orbiConversation.findFirstOrThrow({ where: { id, businessId, userId: memberId }, select: SELECCION });
    const [titulos, esperando] = await Promise.all([this.titulosQueFaltan(businessId, memberId, [f]), this.conAprobacionPendiente(businessId, [id])]);
    return {
      id: f.id,
      titulo: f.title ?? titulos.get(f.id) ?? null,
      fijada: f.pinnedAt !== null,
      archivada: f.archivedAt !== null,
      ultimaActividad: f.lastActivityAt.toISOString(),
      pantalla: f.screen,
      esperandoAprobacion: esperando.has(id),
    };
  }

  /**
   * Borra la sesión y sus mensajes. Sus acciones pendientes se cancelan en la
   * misma transacción: una tarjeta que ya no se ve no puede quedar confirmable.
   */
  async borrar(businessId: string, memberId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.orbiConversation.deleteMany({ where: { id, businessId, userId: memberId, surface: 'panel' } });
      if (count === 0) throw new NotFoundException('Sesión no encontrada');
      await tx.orbiPendingAction.updateMany({
        where: { conversationId: id, businessId, memberId, status: 'pending' },
        data: { status: 'rejected', resolvedAt: new Date() },
      });
    });
  }

  // ─── Piezas ───────────────────────────────────────────────────────────────

  private async mensajesV2(businessId: string, conversationId: string): Promise<MensajeDeSesion[]> {
    const filas = await this.prisma.orbiMessage.findMany({
      where: { conversationId, businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, parts: true, createdAt: true },
    });
    const partes = filas.map((f) => (Array.isArray(f.parts) ? (f.parts as unknown as Parte[]) : []));
    const ids = partes.flat().flatMap((p) => (p.tipo === 'aprobacion' ? [p.actionId] : []));
    const acciones = ids.length
      ? await this.prisma.orbiPendingAction.findMany({ where: { id: { in: ids }, businessId }, select: { id: true, status: true, expiresAt: true } })
      : [];
    const porId = new Map(acciones.map((a) => [a.id, a]));
    const ahora = new Date();
    return filas.map((f, i) => ({
      id: f.id,
      rol: f.role === 'user' ? 'user' : 'assistant',
      partes: partes[i].map((p) => (p.tipo === 'aprobacion' ? { ...p, estadoActual: estadoDeAprobacion(porId.get(p.actionId), ahora) } : p)),
      creadoEl: f.createdAt.toISOString(),
    }));
  }

  private async conAprobacionPendiente(businessId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const filas = await this.prisma.orbiPendingAction.findMany({
      where: { conversationId: { in: ids }, businessId, status: 'pending', expiresAt: { gt: new Date() } },
      select: { conversationId: true },
      distinct: ['conversationId'],
    });
    return new Set(filas.flatMap((f) => (f.conversationId ? [f.conversationId] : [])));
  }

  /**
   * Las conversaciones de antes de las sesiones no tienen título: se arma con
   * el primer mensaje de la persona (sin traer el Json entero) y se guarda, así
   * se calcula una sola vez. Best-effort: si falla, la fila sale sin título.
   */
  private async titulosQueFaltan(businessId: string, memberId: string, filas: Pick<Fila, 'id' | 'title'>[]): Promise<Map<string, string>> {
    const sinTitulo = filas.filter((f) => f.title === null).map((f) => f.id);
    const titulos = new Map<string, string>();
    if (!sinTitulo.length) return titulos;
    try {
      const primeros = await this.prisma.$queryRaw<{ id: string; primero: string | null }[]>`
        SELECT c.id,
          (SELECT m->>'content' FROM jsonb_array_elements(c.messages) WITH ORDINALITY AS t(m, i)
           WHERE m->>'role' = 'user' ORDER BY i LIMIT 1) AS primero
        FROM orbi_conversations c
        WHERE c.id IN (${Prisma.join(sinTitulo)}) AND c.business_id = ${businessId} AND c.user_id = ${memberId}`;
      for (const { id, primero } of primeros) {
        const titulo = primero ? tituloAutomatico(primero) : null;
        if (!titulo) continue;
        titulos.set(id, titulo);
        await this.prisma.orbiConversation.updateMany({ where: { id, businessId, userId: memberId, title: null, titleAuto: true }, data: { title: titulo } });
      }
    } catch (e) {
      this.logger.warn(`No se pudieron completar los títulos de las sesiones: ${(e as Error)?.name ?? 'error'}`);
    }
    return titulos;
  }
}

/** Una conversación v1: los mensajes del Json, como partes de texto. Las vacías (un turno cortado) no se muestran. */
export function mensajesV1(json: Prisma.JsonValue): MensajeDeSesion[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((m, i): MensajeDeSesion[] => {
    const msg = m as { role?: unknown; content?: unknown; timestamp?: unknown } | null;
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return [];
    if (typeof msg.content !== 'string' || !msg.content.trim()) return [];
    return [{
      id: `v1-${i}`,
      rol: msg.role,
      partes: [{ tipo: 'texto', texto: msg.content }],
      creadoEl: typeof msg.timestamp === 'string' ? msg.timestamp : null,
    }];
  });
}

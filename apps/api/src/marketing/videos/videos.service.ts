import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../r2/r2.service';
import { aprobacionCompleta, puedeAprobar, puedeRechazar, reglasDeConfig, type Persona } from './politica-aprobacion';
import { TIPOS_VIDEO, type TipoVideo } from './tipos-video';
import { VideosAvisoService } from './videos-aviso.service';

// Marketing → cola de videos.
//
// Cada persona del equipo le pide a SU Claude «generame 3 videos» (o un tutorial): Claude los hace en su computadora
// (HyperFrames) y, por el conector MCP (mcp/mcp-prospeccion.ts), pide una dirección firmada, sube el mp4 directo a R2 y
// lo registra. Acá solo se guarda la cola y el archivo: no hay ningún pedido en el panel ni se genera nada en la nube.
//
// Hay DOS tipos, que no se mezclan: MARKETING (se usa afuera y se puede pasar a borrador de TikTok o Instagram) y TUTORIAL
// (es interno y puede cubrir un ítem de la lista de tutoriales).
//
// Quién aprueba depende de QUIÉN LO SUBIÓ (politica-aprobacion.ts): un socio se aprueba a sí mismo (para verificar lo que hizo su
// Claude) y ningún socio aprueba el video de otro; lo que sube alguien que no es socio (Milagros) lo aprueba la dirección.
// Cualquiera del equipo puede COMENTAR cualquier video en todas sus fases y pedir que se MEJORE con Claude (queda como un
// video nuevo que apunta al original con mejoraDeId).
//
//   SUBIENDO  → se pidió la subida y todavía no se confirmó (vence en 1 hora y se borra).
//   PENDIENTE → listo para revisar. Si nadie lo revisa a tiempo se borra solo (7 días marketing, 30 tutoriales).
//   APROBADO  → queda como registro, con su archivo: se descarga y, si es de marketing, se pasa a borrador.
//   PUBLICADO → ya se pasó a un borrador de TikTok y/o Instagram (queda igual como registro).
//   (rechazado) → se borra el archivo y el registro.
// Nada se publica solo: pasar a TikTok o Instagram es siempre una acción de una persona (videos-publicar.service.ts).
// Quién aprobó es interno: nada de lo que sale de acá lo muestra.

export const ESTADOS_VIDEO = ['SUBIENDO', 'PENDIENTE', 'APROBADO', 'PUBLICADO'] as const;
export type EstadoVideo = (typeof ESTADOS_VIDEO)[number];

export const FORMATOS_VIDEO = ['REEL_9_16', 'CUADRADO', 'HORIZONTAL_16_9'] as const;

/** Sin tope de peso: ni marketing ni tutoriales. La columna `bytes` es un Int de Postgres y solo se muestra, así que se acota. */
const MAX_BYTES_REGISTRADOS = 2_147_483_647;
const maxSegundosDe = (tipo: TipoVideo) => (tipo === 'TUTORIAL' ? 3600 : 600);
/** Tope de videos esperando revisión de cada tipo: evita llenar el almacenamiento si algo se descontrola. */
export const MAX_EN_COLA = 20;
export const DIAS_PENDIENTE = 7;
export const DIAS_PENDIENTE_TUTORIAL = 30;
const MINUTOS_SUBIENDO = 60;
const MAX_CONTROLES = 20;

export interface ControlDeCalidad {
  nombre: string;
  ok: boolean;
  detalle: string;
}

export interface EntradaVideo {
  videoId: string;
  titulo: string;
  formato?: string;
  guion?: string;
  caption?: string;
  duracionSeg?: number;
  controles?: unknown;
  /** Solo tutoriales: el ítem de la lista de tutoriales que cubre este video. */
  tutorial?: string;
  /** Si es una versión mejorada de otro video de la cola: el id del original. */
  mejoraDe?: string;
}

const dias = (n: number) => new Date(Date.now() + n * 86_400_000);
const minutos = (n: number) => new Date(Date.now() + n * 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres (jsonb y text) rechaza el carácter nulo: lo que escribe Claude se limpia antes de guardarlo.
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\u0000/g, '').slice(0, max) : '');

type Fila = Prisma.MarketingVideoGetPayload<object>;

/** Quién está mirando la cola: lo usa el panel para saber qué botones mostrar. */
export interface Mirando {
  id: string;
  email: string;
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly aviso: VideosAvisoService,
    private readonly config: ConfigService,
  ) {}

  // ── Vencidos ──────────────────────────────────────────────────────────────────────────────────────────────────

  /** Borra los que vencieron (pendientes sin revisar y subidas que nunca se confirmaron). Mejor esfuerzo. */
  async purgarVencidos(): Promise<number> {
    const vencidos = await this.prisma.marketingVideo.findMany({
      where: { expiraAt: { lt: new Date() }, estado: { in: ['SUBIENDO', 'PENDIENTE'] } },
      select: { id: true, ruta: true, tutorialId: true },
      take: 50,
    });
    let borrados = 0;
    for (const v of vencidos) {
      try {
        await this.descartar(v.id, v.ruta, v.tutorialId);
        borrados++;
      } catch (e) {
        this.logger.warn(`No se pudo borrar el video vencido ${v.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return borrados;
  }

  // ── Subir y registrar (lo hace el Claude de cada persona) ───────────────────────────────────────────────────

  /** Paso 1 de Claude: reservar un lugar en la cola y recibir dónde subir el mp4 (PUT con Content-Type video/mp4). */
  async pedirSubida(adminId: string, bytes: unknown, tipoPedido: unknown = 'MARKETING'): Promise<{ videoId: string; uploadUrl: string; tipo: string; videoTipo: TipoVideo; venceEnMin: number }> {
    const tipo = this.tipoValido(tipoPedido);
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Falta el tamaño del video en bytes');
    await this.purgarVencidos();
    const enCola = await this.prisma.marketingVideo.count({ where: { tipo, estado: { in: ['SUBIENDO', 'PENDIENTE'] } } });
    if (enCola >= MAX_EN_COLA) {
      throw new ConflictException(`La cola de ${tipo === 'TUTORIAL' ? 'tutoriales' : 'marketing'} está llena: hay ${enCola} videos esperando revisión. Hay que aprobar o rechazar algunos antes de generar más`);
    }
    const ruta = `marketing/videos/${randomUUID()}.mp4`;
    const uploadUrl = await this.r2.presignUpload(ruta, 'video/mp4');
    const video = await this.prisma.marketingVideo.create({
      data: {
        creadoPor: adminId, titulo: 'Subiendo…', tipo, formato: tipo === 'TUTORIAL' ? 'HORIZONTAL_16_9' : 'REEL_9_16',
        ruta, bytes: Math.min(Math.trunc(n), MAX_BYTES_REGISTRADOS), estado: 'SUBIENDO', expiraAt: minutos(MINUTOS_SUBIENDO),
      },
      select: { id: true },
    });
    return { videoId: video.id, uploadUrl, tipo: 'video/mp4', videoTipo: tipo, venceEnMin: 10 };
  }

  private tipoValido(t: unknown): TipoVideo {
    if (t === undefined || t === null || t === '') return 'MARKETING';
    if (!(TIPOS_VIDEO as readonly string[]).includes(String(t))) throw new BadRequestException(`tipo tiene que ser uno de: ${TIPOS_VIDEO.join(', ')}`);
    return t as TipoVideo;
  }

  /** Paso 2 de Claude: confirmar la subida y dejar el video en la cola con su guion, su texto y sus controles. */
  async registrar(adminId: string, e: EntradaVideo) {
    const video = await this.prisma.marketingVideo.findUnique({ where: { id: String(e.videoId ?? '') } });
    if (!video || video.estado !== 'SUBIENDO' || video.creadoPor !== adminId) throw new NotFoundException('No hay una subida pendiente con ese id (¿ya la registraste o venció?)');
    const tipo = video.tipo as TipoVideo;
    const titulo = limpio(e.titulo, 120).trim();
    if (!titulo) throw new BadRequestException('Falta el título del video');
    const formato = e.formato === undefined ? video.formato : e.formato;
    if (!(FORMATOS_VIDEO as readonly string[]).includes(formato)) throw new BadRequestException(`formato tiene que ser uno de: ${FORMATOS_VIDEO.join(', ')}`);
    const duracion = e.duracionSeg === undefined ? null : Math.trunc(Number(e.duracionSeg));
    if (duracion !== null && (!Number.isFinite(duracion) || duracion < 1 || duracion > maxSegundosDe(tipo))) throw new BadRequestException(`duracionSeg tiene que estar entre 1 y ${maxSegundosDe(tipo)}`);

    let tutorialId: string | null = null;
    if (e.tutorial !== undefined && e.tutorial !== null && e.tutorial !== '') {
      if (tipo !== 'TUTORIAL') throw new BadRequestException('Solo un video de tipo TUTORIAL puede cubrir un tutorial de la lista');
      tutorialId = await this.tutorialDeLaLista(String(e.tutorial));
    }

    let mejoraDeId: string | null = null;
    if (e.mejoraDe !== undefined && e.mejoraDe !== null && e.mejoraDe !== '') {
      const original = UUID.test(String(e.mejoraDe)) ? await this.prisma.marketingVideo.findUnique({ where: { id: String(e.mejoraDe) }, select: { id: true, tipo: true, estado: true } }) : null;
      if (!original || original.estado === 'SUBIENDO') throw new BadRequestException('No existe el video que querés mejorar (usá videos_listar para ver los ids)');
      if (original.tipo !== tipo) throw new BadRequestException('Una mejora tiene que ser del mismo tipo que el video original');
      mejoraDeId = original.id;
    }

    const tam = await this.r2.tamanioDe(video.ruta);
    if (tam === null) throw new BadRequestException('El archivo todavía no está en el almacenamiento: subilo con la dirección que te di y volvé a registrar');
    if (tam === 0) {
      await this.descartar(video.id, video.ruta, null);
      throw new BadRequestException('El archivo subido está vacío');
    }

    const actualizado = await this.prisma.marketingVideo.update({
      where: { id: video.id },
      data: {
        titulo,
        formato,
        guion: limpio(e.guion, 8000),
        caption: limpio(e.caption, 2200),
        duracionSeg: duracion,
        bytes: Math.min(tam, MAX_BYTES_REGISTRADOS),
        tutorialId,
        mejoraDeId,
        controles: this.controles(e.controles) as unknown as Prisma.InputJsonValue,
        estado: 'PENDIENTE',
        expiraAt: dias(tipo === 'TUTORIAL' ? DIAS_PENDIENTE_TUTORIAL : DIAS_PENDIENTE),
      },
    });
    if (tutorialId) await this.prisma.marketingTutorial.update({ where: { id: tutorialId }, data: { estado: 'EN_REVISION', actualizadoPor: adminId } });
    await this.registrarLog(adminId, 'video_registrar', actualizado.id, { titulo, tipo, formato, bytes: tam, mejoraDe: mejoraDeId });
    // Un correo (mejor esfuerzo, uno por tanda): hay un video para revisar.
    await this.aviso.avisar(adminId, 'registro', tipo);
    return this.vista(actualizado);
  }

  /** El id del ítem de la lista de tutoriales: se acepta su id o su título exacto. */
  private async tutorialDeLaLista(ref: string): Promise<string> {
    const item = UUID.test(ref)
      ? await this.prisma.marketingTutorial.findUnique({ where: { id: ref }, select: { id: true } })
      : await this.prisma.marketingTutorial.findFirst({ where: { titulo: { equals: ref.trim(), mode: 'insensitive' } }, select: { id: true } });
    if (!item) throw new BadRequestException('No existe ese tutorial en la lista (usá tutoriales_listar para ver los ids)');
    return item.id;
  }

  /** Al terminar de subir una tanda: avisa por correo si quedó algún video pendiente sin anunciar. */
  avisarTanda(adminId: string, tipo: unknown = 'MARKETING') {
    return this.aviso.avisar(adminId, 'tanda', this.tipoValido(tipo));
  }

  private controles(crudo: unknown): ControlDeCalidad[] {
    if (!Array.isArray(crudo)) return [];
    return crudo.slice(0, MAX_CONTROLES).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return { nombre: limpio(o.nombre, 80), ok: o.ok === true, detalle: limpio(o.detalle, 300) };
    }).filter((c) => c.nombre);
  }

  // ── Lo que ve el panel ──────────────────────────────────────────────────────────────────────────────────────

  /** La cola y los registros, lo más nuevo primero (sin las subidas a medias). Con `mirando`, cada video trae qué puede hacer esa persona. */
  async listar(estado?: string, tipo?: string, mirando?: Mirando) {
    await this.purgarVencidos();
    const where: Prisma.MarketingVideoWhereInput = estado && (ESTADOS_VIDEO as readonly string[]).includes(estado) && estado !== 'SUBIENDO' ? { estado } : { estado: { not: 'SUBIENDO' } };
    if (tipo && (TIPOS_VIDEO as readonly string[]).includes(tipo)) where.tipo = tipo;
    const filas = await this.prisma.marketingVideo.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { _count: { select: { comentarios: true } } } });
    const personas = await this.personas(filas.flatMap((f) => [f.creadoPor, ...this.idsAprobaron(f)]));
    return filas.map((f) => this.vista(f, mirando ? this.permisos(f, mirando, personas) : undefined, f._count.comentarios));
  }

  async obtener(id: string) {
    const v = await this.prisma.marketingVideo.findUnique({ where: { id } });
    if (!v || v.estado === 'SUBIENDO') throw new NotFoundException('No existe ese video');
    return v;
  }

  private idsAprobaron(f: Fila): string[] {
    return (Array.isArray(f.aprobaciones) ? (f.aprobaciones as { adminId?: string }[]) : []).map((a) => a.adminId).filter((x): x is string => !!x);
  }

  private async personas(ids: (string | null)[]): Promise<Map<string, Persona>> {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    if (unicos.length === 0) return new Map();
    const admins = await this.prisma.platformAdmin.findMany({ where: { id: { in: unicos } }, select: { id: true, email: true } });
    return new Map(admins.map((a) => [a.id, { id: a.id, email: a.email }]));
  }

  private contexto(f: Fila, personas: Map<string, Persona>) {
    return {
      creador: f.creadoPor ? (personas.get(f.creadoPor) ?? null) : null,
      aprobaron: this.idsAprobaron(f).map((id) => personas.get(id)).filter((p): p is Persona => !!p),
      reglas: reglasDeConfig(this.config),
    };
  }

  /** Qué puede hacer `quien` con este video. Solo banderas: nunca dice quién aprobó ni qué falta. */
  private permisos(f: Fila, quien: Mirando, personas: Map<string, Persona>) {
    const ctx = this.contexto(f, personas);
    const pendiente = f.estado === 'PENDIENTE';
    return {
      puedeAprobar: pendiente && puedeAprobar(ctx, quien),
      puedeRechazar: pendiente && puedeRechazar(ctx, quien),
      yaAprobaste: pendiente && ctx.aprobaron.some((p) => p.id === quien.id),
      esTuyo: ctx.creador?.id === quien.id,
    };
  }

  private async persona(adminId: string): Promise<Mirando> {
    const a = await this.prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { id: true, email: true } });
    if (!a) throw new ForbiddenException('No se encontró tu cuenta');
    return a;
  }

  /** Para el controlador: quién está mirando. */
  mirando(adminId: string): Promise<Mirando> {
    return this.persona(adminId);
  }

  // ── Comentarios (cualquiera del equipo, en todas las fases) ───────────────────────────────────────────────────

  async comentarios(videoId: string, quien?: string) {
    await this.obtener(videoId);
    const filas = await this.prisma.marketingVideoComentario.findMany({ where: { videoId }, orderBy: { createdAt: 'asc' }, take: 200 });
    const nombres = await this.nombres(filas.map((f) => f.adminId));
    return filas.map((f) => ({ id: f.id, autor: nombres.get(f.adminId) ?? 'Alguien del equipo', texto: f.texto, fecha: f.createdAt, esTuyo: f.adminId === quien }));
  }

  async comentar(adminId: string, videoId: string, texto: unknown) {
    const v = await this.obtener(videoId);
    const t = limpio(texto, 1000).trim();
    if (!t) throw new BadRequestException('El comentario está vacío');
    const c = await this.prisma.marketingVideoComentario.create({ data: { videoId, adminId, texto: t } });
    await this.registrarLog(adminId, 'video_comentar', videoId, { titulo: v.titulo });
    const nombres = await this.nombres([adminId]);
    return { id: c.id, autor: nombres.get(adminId) ?? 'Alguien del equipo', texto: c.texto, fecha: c.createdAt, esTuyo: true };
  }

  /** Cada quien puede borrar sus propios comentarios. */
  async eliminarComentario(adminId: string, videoId: string, comentarioId: string) {
    const c = await this.prisma.marketingVideoComentario.findUnique({ where: { id: comentarioId } });
    if (!c || c.videoId !== videoId) throw new NotFoundException('No existe ese comentario');
    if (c.adminId !== adminId) throw new ForbiddenException('Solo podés borrar tus propios comentarios');
    await this.prisma.marketingVideoComentario.delete({ where: { id: comentarioId } });
    return { ok: true as const };
  }

  private async nombres(ids: string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();
    const admins = await this.prisma.platformAdmin.findMany({ where: { id: { in: unicos } }, select: { id: true, name: true, email: true } });
    return new Map(admins.map((a) => [a.id, a.name?.trim() || a.email.split('@')[0]]));
  }

  /**
   * Todo lo que Claude necesita para mejorar un video: su guion, el texto sugerido, los controles, de quién es y los
   * comentarios del equipo. (No incluye la dirección del archivo ni quién aprobó.)
   */
  async detalle(id: string) {
    const v = await this.obtener(id);
    const comentarios = await this.comentarios(id);
    const mejoras = await this.prisma.marketingVideo.findMany({ where: { mejoraDeId: id, estado: { not: 'SUBIENDO' } }, select: { id: true, titulo: true, estado: true } });
    return { ...this.vista(v, undefined, comentarios.length), comentariosDelEquipo: comentarios.map((c) => ({ autor: c.autor, texto: c.texto, fecha: c.fecha })), mejorasYaRegistradas: mejoras };
  }

  // ── Aprobar y rechazar ──────────────────────────────────────────────────────────────────────────────────────

  /**
   * Suma la aprobación de esta persona. El video pasa a APROBADO recién cuando la política (politica-aprobacion.ts) dice que
   * alcanza; hasta entonces sigue PENDIENTE. La respuesta no revela quién aprobó ni qué falta.
   */
  async aprobar(adminId: string, id: string) {
    const v = await this.obtener(id);
    if (v.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede aprobar un video pendiente');
    const quien = await this.persona(adminId);
    const personas = await this.personas([v.creadoPor, ...this.idsAprobaron(v), adminId]);
    const ctx = this.contexto(v, personas);
    if (!puedeAprobar(ctx, quien)) throw new ForbiddenException('No podés aprobar este video');

    const aprobaciones = [...(Array.isArray(v.aprobaciones) ? (v.aprobaciones as unknown[]) : []), { adminId, fecha: new Date().toISOString() }];
    const completa = aprobacionCompleta({ ...ctx, aprobaron: [...ctx.aprobaron, quien] });
    const r = await this.prisma.marketingVideo.update({
      where: { id },
      data: {
        aprobaciones: aprobaciones as unknown as Prisma.InputJsonValue,
        ...(completa ? { estado: 'APROBADO', aprobadoPor: adminId, aprobadoAt: new Date(), expiraAt: null } : {}),
      },
    });
    if (completa && v.tutorialId) await this.prisma.marketingTutorial.update({ where: { id: v.tutorialId }, data: { estado: 'HECHO', actualizadoPor: adminId } }).catch(() => undefined);
    await this.registrarLog(adminId, 'video_aprobar', id, { titulo: v.titulo, tipo: v.tipo, completa });
    const nuevas = await this.personas([r.creadoPor, ...this.idsAprobaron(r)]);
    return this.vista(r, this.permisos(r, quien, nuevas), await this.prisma.marketingVideoComentario.count({ where: { videoId: id } }));
  }

  /** Rechazar borra el archivo de R2 y el registro. Si el borrado del archivo falla, el registro se queda para reintentar. */
  async rechazar(adminId: string, id: string) {
    const v = await this.obtener(id);
    if (v.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede rechazar un video pendiente (lo aprobado queda como registro)');
    const quien = await this.persona(adminId);
    const personas = await this.personas([v.creadoPor, ...this.idsAprobaron(v)]);
    if (!puedeRechazar(this.contexto(v, personas), quien)) throw new ForbiddenException('No podés rechazar este video');
    await this.descartar(v.id, v.ruta, v.tutorialId);
    await this.registrarLog(adminId, 'video_rechazar', id, { titulo: v.titulo, tipo: v.tipo });
    return { ok: true as const };
  }

  /** Dirección para bajar el mp4 (vale 10 minutos). */
  async descarga(id: string) {
    const v = await this.obtener(id);
    const nombre = `${v.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video'}.mp4`;
    return { url: await this.r2.presignDescarga(v.ruta, nombre), nombre };
  }

  /** Dirección pública del archivo (la que usan TikTok e Instagram para bajarlo). */
  urlPublica(ruta: string) {
    return this.r2.publicUrlDe(ruta);
  }

  /** Anota dónde se pasó a borrador y pone el video en PUBLICADO. */
  async anotarPublicacion(adminId: string, id: string, destino: 'tiktok' | 'instagram', referencia: string) {
    const v = await this.obtener(id);
    const previas = Array.isArray(v.publicaciones) ? (v.publicaciones as unknown[]) : [];
    const r = await this.prisma.marketingVideo.update({
      where: { id },
      data: { estado: 'PUBLICADO', publicaciones: [...previas, { destino, id: referencia, fecha: new Date().toISOString() }] as unknown as Prisma.InputJsonValue },
    });
    await this.registrarLog(adminId, `video_publicar_${destino}`, id, { referencia });
    return this.vista(r);
  }

  /** Lo que ven el panel y Claude: sin la clave interna del archivo y sin quién aprobó. */
  vista(v: Fila, permisos?: { puedeAprobar: boolean; puedeRechazar: boolean; yaAprobaste: boolean; esTuyo: boolean }, comentarios = 0) {
    return {
      id: v.id,
      tipo: v.tipo as TipoVideo,
      titulo: v.titulo,
      formato: v.formato,
      guion: v.guion,
      caption: v.caption,
      duracionSeg: v.duracionSeg,
      bytes: v.bytes,
      estado: v.estado as EstadoVideo,
      controles: v.controles as unknown as ControlDeCalidad[],
      url: this.urlPublica(v.ruta),
      tutorialId: v.tutorialId,
      mejoraDeId: v.mejoraDeId,
      comentarios,
      aprobadoAt: v.aprobadoAt,
      publicaciones: v.publicaciones as unknown as { destino: string; id: string; fecha: string }[],
      expiraAt: v.expiraAt,
      createdAt: v.createdAt,
      ...(permisos ?? {}),
    };
  }

  private async descartar(id: string, ruta: string, tutorialId: string | null) {
    await this.r2.eliminar(ruta);
    await this.prisma.marketingVideo.delete({ where: { id } });
    // El tutorial de la lista vuelve a «falta» si estaba esperando justo este video.
    if (tutorialId) await this.prisma.marketingTutorial.updateMany({ where: { id: tutorialId, estado: 'EN_REVISION' }, data: { estado: 'FALTA' } }).catch(() => undefined);
  }

  private async registrarLog(adminId: string, action: string, targetId: string, details: Record<string, unknown>) {
    try {
      await this.prisma.platformAdminLog.create({ data: { adminId, action, targetType: 'marketing_video', targetId, details: details as Prisma.InputJsonValue } });
    } catch (e) {
      // El registro no puede tirar abajo la acción: ya se hizo.
      this.logger.warn(`No se pudo registrar ${action}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

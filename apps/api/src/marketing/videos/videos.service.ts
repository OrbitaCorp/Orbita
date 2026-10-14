import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { R2Service } from '../../r2/r2.service';
import { VideosAvisoService } from './videos-aviso.service';

// Marketing → cola de videos para aprobar.
//
// Cada persona del equipo le pide a SU Claude "generame 3 videos": Claude los hace en su computadora (HyperFrames),
// y por el conector MCP (mcp/mcp-prospeccion.ts) pide una dirección firmada, sube el mp4 directo a R2 y lo registra.
// Acá solo se guarda la cola y el archivo: no hay ningún pedido en el panel ni se genera nada en la nube.
//
//   SUBIENDO  → se pidió la subida y todavía no se confirmó (vence en 1 hora y se borra).
//   PENDIENTE → listo para revisar. Si nadie lo revisa en 7 días se borra solo.
//   APROBADO  → queda como registro, con su archivo: se descarga o se publica.
//   PUBLICADO → ya salió en TikTok y/o Instagram (queda igual como registro).
//   (rechazado) → se borra el archivo y el registro.
// Nada se publica solo: publicar es siempre una acción de una persona (videos-publicar.service.ts).

export const ESTADOS_VIDEO = ['SUBIENDO', 'PENDIENTE', 'APROBADO', 'PUBLICADO'] as const;
export type EstadoVideo = (typeof ESTADOS_VIDEO)[number];

export const FORMATOS_VIDEO = ['REEL_9_16', 'CUADRADO', 'HORIZONTAL_16_9'] as const;

/** Instagram acepta videos de hasta este tamaño por el camino que usa Órbita (ver instagram-medios.service.ts). */
export const MAX_BYTES_VIDEO = 50 * 1024 * 1024;
/** Tope de videos esperando revisión: evita llenar el almacenamiento si algo se descontrola. */
export const MAX_EN_COLA = 20;
export const DIAS_PENDIENTE = 7;
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
}

const dias = (n: number) => new Date(Date.now() + n * 86_400_000);
const minutos = (n: number) => new Date(Date.now() + n * 60_000);

// Postgres (jsonb y text) rechaza el carácter nulo: lo que escribe Claude se limpia antes de guardarlo.
const limpio = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\u0000/g, '').slice(0, max) : '');

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly aviso: VideosAvisoService,
  ) {}

  /** Borra los que vencieron (pendientes sin revisar y subidas que nunca se confirmaron). Mejor esfuerzo. */
  async purgarVencidos(): Promise<number> {
    const vencidos = await this.prisma.marketingVideo.findMany({
      where: { expiraAt: { lt: new Date() }, estado: { in: ['SUBIENDO', 'PENDIENTE'] } },
      select: { id: true, ruta: true },
      take: 50,
    });
    let borrados = 0;
    for (const v of vencidos) {
      try {
        await this.r2.eliminar(v.ruta);
        await this.prisma.marketingVideo.delete({ where: { id: v.id } });
        borrados++;
      } catch (e) {
        this.logger.warn(`No se pudo borrar el video vencido ${v.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return borrados;
  }

  /** Paso 1 de Claude: reservar un lugar en la cola y recibir dónde subir el mp4 (PUT con Content-Type video/mp4). */
  async pedirSubida(adminId: string, bytes: unknown): Promise<{ videoId: string; uploadUrl: string; tipo: string; venceEnMin: number }> {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Falta el tamaño del video en bytes');
    if (n > MAX_BYTES_VIDEO) throw new BadRequestException(`El video pesa más de ${MAX_BYTES_VIDEO / 1024 / 1024} MB: bajale el bitrate`);
    await this.purgarVencidos();
    const enCola = await this.prisma.marketingVideo.count({ where: { estado: { in: ['SUBIENDO', 'PENDIENTE'] } } });
    if (enCola >= MAX_EN_COLA) {
      throw new ConflictException(`La cola está llena: hay ${enCola} videos esperando revisión. Hay que aprobar o rechazar algunos antes de generar más`);
    }
    const ruta = `marketing/videos/${randomUUID()}.mp4`;
    const uploadUrl = await this.r2.presignUpload(ruta, 'video/mp4');
    const video = await this.prisma.marketingVideo.create({
      data: { creadoPor: adminId, titulo: 'Subiendo…', formato: 'REEL_9_16', ruta, bytes: Math.trunc(n), estado: 'SUBIENDO', expiraAt: minutos(MINUTOS_SUBIENDO) },
      select: { id: true },
    });
    return { videoId: video.id, uploadUrl, tipo: 'video/mp4', venceEnMin: 10 };
  }

  /** Paso 2 de Claude: confirmar la subida y dejar el video en la cola con su guion, su texto y sus controles. */
  async registrar(adminId: string, e: EntradaVideo) {
    const video = await this.prisma.marketingVideo.findUnique({ where: { id: String(e.videoId ?? '') } });
    if (!video || video.estado !== 'SUBIENDO' || video.creadoPor !== adminId) throw new NotFoundException('No hay una subida pendiente con ese id (¿ya la registraste o venció?)');
    const titulo = limpio(e.titulo, 120).trim();
    if (!titulo) throw new BadRequestException('Falta el título del video');
    const formato = e.formato === undefined ? 'REEL_9_16' : e.formato;
    if (!(FORMATOS_VIDEO as readonly string[]).includes(formato)) throw new BadRequestException(`formato tiene que ser uno de: ${FORMATOS_VIDEO.join(', ')}`);
    const duracion = e.duracionSeg === undefined ? null : Math.trunc(Number(e.duracionSeg));
    if (duracion !== null && (!Number.isFinite(duracion) || duracion < 1 || duracion > 600)) throw new BadRequestException('duracionSeg tiene que estar entre 1 y 600');

    const tam = await this.r2.tamanioDe(video.ruta);
    if (tam === null) throw new BadRequestException('El archivo todavía no está en el almacenamiento: subilo con la dirección que te di y volvé a registrar');
    if (tam === 0 || tam > MAX_BYTES_VIDEO) {
      await this.descartar(video.id, video.ruta);
      throw new BadRequestException(tam === 0 ? 'El archivo subido está vacío' : `El video pesa más de ${MAX_BYTES_VIDEO / 1024 / 1024} MB: se descartó, generalo de nuevo más liviano`);
    }

    const actualizado = await this.prisma.marketingVideo.update({
      where: { id: video.id },
      data: {
        titulo,
        formato,
        guion: limpio(e.guion, 8000),
        caption: limpio(e.caption, 2200),
        duracionSeg: duracion,
        bytes: tam,
        controles: this.controles(e.controles) as unknown as Prisma.InputJsonValue,
        estado: 'PENDIENTE',
        expiraAt: dias(DIAS_PENDIENTE),
      },
    });
    await this.registrarLog(adminId, 'video_registrar', actualizado.id, { titulo, formato, bytes: tam });
    // Un correo al equipo (mejor esfuerzo, uno por tanda): hay un video para aprobar.
    await this.aviso.avisar(adminId, 'registro');
    return this.vista(actualizado);
  }

  /** Al terminar de subir una tanda: avisa por correo si quedó algún video pendiente sin anunciar. */
  avisarTanda(adminId: string) {
    return this.aviso.avisar(adminId, 'tanda');
  }

  private controles(crudo: unknown): ControlDeCalidad[] {
    if (!Array.isArray(crudo)) return [];
    return crudo.slice(0, MAX_CONTROLES).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return { nombre: limpio(o.nombre, 80), ok: o.ok === true, detalle: limpio(o.detalle, 300) };
    }).filter((c) => c.nombre);
  }

  /** La cola y los registros, lo más nuevo primero (sin las subidas a medias). */
  async listar(estado?: string) {
    await this.purgarVencidos();
    const where: Prisma.MarketingVideoWhereInput = estado && (ESTADOS_VIDEO as readonly string[]).includes(estado) && estado !== 'SUBIENDO' ? { estado } : { estado: { not: 'SUBIENDO' } };
    const filas = await this.prisma.marketingVideo.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return filas.map((f) => this.vista(f));
  }

  async obtener(id: string) {
    const v = await this.prisma.marketingVideo.findUnique({ where: { id } });
    if (!v || v.estado === 'SUBIENDO') throw new NotFoundException('No existe ese video');
    return v;
  }

  async aprobar(adminId: string, id: string) {
    const v = await this.obtener(id);
    if (v.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede aprobar un video pendiente');
    const r = await this.prisma.marketingVideo.update({ where: { id }, data: { estado: 'APROBADO', aprobadoPor: adminId, aprobadoAt: new Date(), expiraAt: null } });
    await this.registrarLog(adminId, 'video_aprobar', id, { titulo: v.titulo });
    return this.vista(r);
  }

  /** Rechazar borra el archivo de R2 y el registro. Si el borrado del archivo falla, el registro se queda para reintentar. */
  async rechazar(adminId: string, id: string) {
    const v = await this.obtener(id);
    if (v.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede rechazar un video pendiente (lo aprobado queda como registro)');
    await this.descartar(v.id, v.ruta);
    await this.registrarLog(adminId, 'video_rechazar', id, { titulo: v.titulo });
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

  /** Anota dónde se publicó y pasa el video a PUBLICADO. */
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

  /** Lo que ve el panel y Claude (sin la clave interna del archivo). */
  vista(v: Prisma.MarketingVideoGetPayload<object>) {
    return {
      id: v.id,
      titulo: v.titulo,
      formato: v.formato,
      guion: v.guion,
      caption: v.caption,
      duracionSeg: v.duracionSeg,
      bytes: v.bytes,
      estado: v.estado as EstadoVideo,
      controles: v.controles as unknown as ControlDeCalidad[],
      url: this.urlPublica(v.ruta),
      aprobadoAt: v.aprobadoAt,
      publicaciones: v.publicaciones as unknown as { destino: string; id: string; fecha: string }[],
      expiraAt: v.expiraAt,
      createdAt: v.createdAt,
    };
  }

  private async descartar(id: string, ruta: string) {
    await this.r2.eliminar(ruta);
    await this.prisma.marketingVideo.delete({ where: { id } });
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

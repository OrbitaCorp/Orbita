import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { InstagramPost, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramMediosService, type FormatoDeFoto, type ItemDePublicacion, type ItemResuelto } from './instagram-medios.service';
import { InstagramService, SCOPE_PUBLICAR } from './instagram.service';

// Publicaciones del kit de difusión: sube a Instagram una foto, un carrusel (hasta 10 fotos y videos) o un video,
// de un producto o de archivos subidos desde la computadora, con el texto que escribe el dueño.
//
// Instagram publica en dos tiempos: primero se crea un "contenedor" con el archivo (que Instagram baja y
// procesa) y recién cuando está listo se publica. Un video tarda más de lo que aguanta una llamada HTTP, así que
// acá es un proceso en pasos que se guarda en la base:
//   crear      → resuelve los archivos, crea los contenedores y deja la publicación en PROCESSING
//   continuar  → mira si Instagram terminó de procesar y, si sí, publica (el panel lo llama hasta que termina)
// Una foto suele quedar lista enseguida, así que `crear` ya intenta avanzar unos segundos antes de contestar.

const MAX_ELEMENTOS = 10;
const MAX_PUBLICACIONES_RECIENTES = 30;
const INTENTOS_AL_CREAR = 5;
const PAUSA_AL_CREAR_MS = 2000;
// Pasado este tiempo sin terminar, se da por fallada (un contenedor de Instagram vence a las 24 h).
const VENCE_PROCESANDO_MS = 30 * 60 * 1000;
// Si quedó "publicando" y nadie lo confirmó, no se sabe si salió: se avisa en vez de reintentar a ciegas.
const VENCE_PUBLICANDO_MS = 2 * 60 * 1000;

export interface CrearPublicacion {
  productId?: string;
  caption: string;
  formato: FormatoDeFoto;
  items: ItemDePublicacion[];
}

const SELECCION = {
  id: true, status: true, kind: true, productId: true, productName: true, caption: true, media: true,
  imageUrl: true, permalink: true, error: true, createdAt: true,
} satisfies Prisma.InstagramPostSelect;
type FilaVista = Prisma.InstagramPostGetPayload<{ select: typeof SELECCION }>;

export interface PublicacionVista {
  id: string;
  estado: 'PROCESSING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  tipo: string;
  productId: string | null;
  productName: string | null;
  caption: string;
  /** Qué tiene: 'image' o 'video' por cada elemento, en orden. */
  elementos: ('image' | 'video')[];
  miniatura: string | null;
  permalink: string | null;
  error: string | null;
  createdAt: Date;
}

const aVista = (f: FilaVista): PublicacionVista => ({
  id: f.id,
  estado: f.status,
  tipo: f.kind,
  productId: f.productId,
  productName: f.productName,
  caption: f.caption,
  elementos: (Array.isArray(f.media) ? (f.media as { tipo?: string }[]) : []).map((m) => (m.tipo === 'video' ? 'video' : 'image')),
  miniatura: f.imageUrl,
  permalink: f.permalink,
  error: f.error,
  createdAt: f.createdAt,
});

@Injectable()
export class InstagramPublicacionesService {
  private readonly logger = new Logger(InstagramPublicacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly medios: InstagramMediosService,
    private readonly instagram: InstagramService,
  ) {}

  /** Lo último que se publicó (o se está publicando) desde Órbita, para el historial de la pantalla. */
  async listar(businessId: string): Promise<PublicacionVista[]> {
    const filas = await this.prisma.instagramPost.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PUBLICACIONES_RECIENTES,
      select: SELECCION,
    });
    return filas.map(aVista);
  }

  // ── Crear ───────────────────────────────────────────────────────────────────

  async crear(businessId: string, memberId: string | undefined, dto: CrearPublicacion): Promise<PublicacionVista> {
    await this.instagram.asegurarHabilitado(businessId);
    if (!(await this.instagram.puedePublicar(businessId))) {
      throw new ForbiddenException('Falta autorizar la publicación: volvé a conectar Instagram dándole ese permiso a Órbita.');
    }
    const { items } = dto;
    if (items.length < 1 || items.length > MAX_ELEMENTOS) throw new BadRequestException(`Una publicación lleva de 1 a ${MAX_ELEMENTOS} fotos o videos.`);

    let producto: { id: string; name: string } | null = null;
    if (dto.productId) {
      const p = await this.prisma.product.findFirst({ where: { id: dto.productId, businessId }, select: { id: true, name: true, status: true } });
      if (!p) throw new NotFoundException('Producto no encontrado');
      if (p.status !== 'PUBLISHED') throw new UnprocessableEntityException('Publicá el producto en tu tienda antes de promocionarlo en Instagram.');
      producto = { id: p.id, name: p.name };
    }

    const tipo = items.length > 1 ? 'CAROUSEL' : items[0].tipo === 'video' ? 'VIDEO' : 'IMAGE';
    const primeraFoto = items.findIndex((i) => i.tipo === 'image');

    // 1) Dejar cada archivo listo para Instagram. Si algo falla, no queda nada subido de más.
    const listos: ItemResuelto[] = [];
    try {
      for (const [i, item] of items.entries()) listos.push(await this.medios.resolver(businessId, item, dto.formato, i === primeraFoto));
    } catch (e) {
      await this.medios.limpiar(listos.flatMap((l) => l.temporales));
      throw e;
    }
    const temporales = listos.flatMap((l) => l.temporales);

    // 2) Crear los contenedores en Instagram.
    let hijos: string[] = [];
    let contenedor: string | null = null;
    try {
      if (tipo === 'CAROUSEL') {
        for (const l of listos) hijos.push(await this.crearContenedor(businessId, l.tipo === 'video' ? { media_type: 'VIDEO', video_url: l.url, is_carousel_item: true } : { image_url: l.url, is_carousel_item: true }));
      } else {
        const l = listos[0];
        contenedor = await this.crearContenedor(businessId, l.tipo === 'video'
          ? { media_type: 'REELS', video_url: l.url, share_to_feed: true, caption: dto.caption }
          : { image_url: l.url, caption: dto.caption });
        hijos = [];
      }
    } catch (e) {
      await this.medios.limpiar(temporales);
      throw e;
    }

    const post = await this.prisma.instagramPost.create({
      data: {
        businessId,
        productId: producto?.id ?? null,
        productName: producto?.name ?? null,
        memberId: memberId ?? null,
        caption: dto.caption,
        status: 'PROCESSING',
        kind: tipo,
        media: listos.map((l) => ({ tipo: l.tipo })),
        imageUrl: listos.find((l) => l.miniatura)?.miniatura ?? null,
        childContainerIds: hijos,
        containerId: contenedor,
        tempPaths: temporales,
      },
      select: { id: true },
    });
    return this.continuar(businessId, post.id, true);
  }

  // ── Continuar ───────────────────────────────────────────────────────────────

  /**
   * Avanza una publicación: si Instagram ya procesó los archivos, la publica. `esperar` hace unos reintentos
   * seguidos (al crear, para que una foto salga en una sola llamada); sin él, mira una vez (el panel vuelve a
   * llamar cada pocos segundos).
   */
  async continuar(businessId: string, postId: string, esperar = false): Promise<PublicacionVista> {
    let post = await this.prisma.instagramPost.findFirst({ where: { id: postId, businessId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    const intentos = esperar ? INTENTOS_AL_CREAR : 1;
    for (let i = 0; i < intentos; i++) {
      if (post.status !== 'PROCESSING' && post.status !== 'PUBLISHING') break;
      post = await this.avanzar(businessId, post);
      if (post.status !== 'PROCESSING') break;
      if (i < intentos - 1) await this.pausa(PAUSA_AL_CREAR_MS);
    }
    return aVista(post);
  }

  private pausa(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async avanzar(businessId: string, post: InstagramPost): Promise<InstagramPost> {
    const edad = Date.now() - post.createdAt.getTime();
    if (post.status === 'PUBLISHING') {
      // Otra llamada la está publicando. Si hace rato que quedó así, no se sabe cómo terminó.
      return Date.now() - post.updatedAt.getTime() > VENCE_PUBLICANDO_MS
        ? this.fallar(post, 'No pudimos confirmar si se publicó. Revisá tu Instagram antes de volver a intentarlo.')
        : post;
    }
    if (edad > VENCE_PROCESANDO_MS) return this.fallar(post, 'Instagram tardó demasiado en procesar los archivos. Probá de nuevo.');

    // true desde que se tomó el candado de publicar: a partir de ahí un error puede significar que SÍ salió.
    let publicando = false;
    try {
      let contenedor = post.containerId;

      // Carrusel: primero tienen que estar listos todos los elementos; recién ahí se arma el carrusel.
      if (!contenedor) {
        const hijos = (post.childContainerIds as string[]) ?? [];
        const estados = await Promise.all(hijos.map((h) => this.estadoContenedor(businessId, h)));
        const roto = estados.find((e) => e.codigo === 'ERROR' || e.codigo === 'EXPIRED');
        if (roto) return this.fallar(post, this.mensajeDeContenedor(roto.detalle));
        if (!estados.every((e) => e.codigo === 'FINISHED')) return post;
        contenedor = await this.crearContenedor(businessId, { media_type: 'CAROUSEL', children: hijos.join(','), caption: post.caption });
        post = await this.prisma.instagramPost.update({ where: { id: post.id }, data: { containerId: contenedor } });
      }

      const estado = await this.estadoContenedor(businessId, contenedor);
      if (estado.codigo === 'ERROR' || estado.codigo === 'EXPIRED') return this.fallar(post, this.mensajeDeContenedor(estado.detalle));
      if (estado.codigo !== 'FINISHED') return post;

      // Publicar, con candado: dos llamadas seguidas no la publican dos veces.
      const tomada = await this.prisma.instagramPost.updateMany({
        where: { id: post.id, businessId, status: 'PROCESSING' },
        data: { status: 'PUBLISHING' },
      });
      if (tomada.count === 0) return (await this.prisma.instagramPost.findFirst({ where: { id: post.id, businessId } })) ?? post;
      publicando = true;

      const publicado = await this.instagram.graph<{ id?: string }>(businessId, SCOPE_PUBLICAR, '{ig}/media_publish', {
        metodo: 'POST',
        cuerpo: { creation_id: contenedor },
      });
      if (!publicado.id) return this.fallar(post, 'Instagram no confirmó la publicación. Revisá tu Instagram antes de volver a intentarlo.');
      // El enlace es un extra: si falla, la publicación ya salió igual.
      const permalink = await this.instagram
        .graph<{ permalink?: string }>(businessId, SCOPE_PUBLICAR, publicado.id, { query: { fields: 'permalink' } })
        .then((r) => r.permalink ?? null)
        .catch(() => null);

      const listo = await this.prisma.instagramPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', igMediaId: publicado.id, permalink, error: null },
      });
      await this.medios.limpiar((post.tempPaths as string[]) ?? []);
      return listo;
    } catch (e) {
      // Un error de Instagram al crear o publicar corta la publicación; uno de red al mirar el estado se reintenta
      // en la próxima llamada (la publicación sigue en PROCESSING).
      if (e instanceof HttpException && e.getStatus() >= 400 && e.getStatus() < 500) {
        return this.fallar(post, e.message);
      }
      if (publicando) return this.fallar(post, 'No pudimos confirmar si se publicó. Revisá tu Instagram antes de volver a intentarlo.');
      this.logger.warn(`La publicación ${post.id} no pudo avanzar ahora, se reintenta: ${describeError(e)}`);
      return post;
    }
  }

  private async fallar(post: InstagramPost, mensaje: string): Promise<InstagramPost> {
    const fallada = await this.prisma.instagramPost.update({ where: { id: post.id }, data: { status: 'FAILED', error: mensaje } });
    await this.medios.limpiar((post.tempPaths as string[]) ?? []);
    return fallada;
  }

  private mensajeDeContenedor(detalle?: string): string {
    const base = 'Instagram no pudo procesar uno de los archivos.';
    return detalle ? `${base} (${detalle.slice(0, 160)})` : `${base} Probá con otros o revisá que el video sea MP4 o MOV.`;
  }

  // ── Llamadas a Instagram ────────────────────────────────────────────────────

  private async crearContenedor(businessId: string, cuerpo: Record<string, unknown>): Promise<string> {
    const r = await this.instagram.graph<{ id?: string }>(businessId, SCOPE_PUBLICAR, '{ig}/media', { metodo: 'POST', cuerpo });
    if (!r.id) throw new UnprocessableEntityException('Instagram no aceptó uno de los archivos.');
    return r.id;
  }

  private async estadoContenedor(businessId: string, id: string): Promise<{ codigo: string; detalle?: string }> {
    const r = await this.instagram.graph<{ status_code?: string; status?: string }>(businessId, SCOPE_PUBLICAR, id, {
      query: { fields: 'status_code,status' },
    });
    return { codigo: r.status_code ?? 'IN_PROGRESS', detalle: r.status };
  }
}

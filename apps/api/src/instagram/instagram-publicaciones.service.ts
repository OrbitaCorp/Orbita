import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { InstagramPost, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramMediosService, type FormatoDeFoto, type ItemDePublicacion, type ItemResuelto } from './instagram-medios.service';
import { InstagramService, SCOPE_PUBLICAR } from './instagram.service';

// Publicaciones del kit de difusión: sube a Instagram una foto, un carrusel (hasta 10 fotos y videos) o un video,
// de un producto o de archivos subidos desde la computadora, con el texto que escribe el dueño. Se puede publicar
// ya, programar para más tarde, o dejar a medias como borrador.
//
// Instagram publica en dos tiempos: primero se crea un "contenedor" con el archivo (que Instagram baja y
// procesa) y recién cuando está listo se publica. Un video tarda más de lo que aguanta una llamada HTTP, así que
// acá es un proceso en pasos que se guarda en la base:
//   crear      → resuelve los archivos, crea los contenedores y deja la publicación en PROCESSING
//   continuar  → mira si Instagram terminó de procesar y, si sí, publica (el panel lo llama hasta que termina)
// Una foto suele quedar lista enseguida, así que `crear` ya intenta avanzar unos segundos antes de contestar.
//
// Programada: se guarda el plan (qué archivos, formato, texto) con la hora, SIN crear contenedores (vencen a las
// 24 h). Un disparo externo cada pocos minutos (Cloud Scheduler → `procesarPendientes`) toma las que ya llegaron a
// su hora, las lanza como una publicación normal y sigue avanzando las que quedaron procesando: nadie tiene que
// tener el panel abierto.

const MAX_ELEMENTOS = 10;
const MAX_PUBLICACIONES_RECIENTES = 60;
const MAX_IDEAS = 4;
const INTENTOS_AL_CREAR = 5;
const PAUSA_AL_CREAR_MS = 2000;
// Pasado este tiempo sin terminar, se da por fallada (un contenedor de Instagram vence a las 24 h).
const VENCE_PROCESANDO_MS = 30 * 60 * 1000;
// Si quedó "publicando" y nadie lo confirmó, no se sabe si salió: se avisa en vez de reintentar a ciegas.
const VENCE_PUBLICANDO_MS = 2 * 60 * 1000;
// Programar: ni inminente (da tiempo a arrepentirse) ni lejísimos.
export const MIN_ANTICIPACION_MS = 5 * 60 * 1000;
export const MAX_ANTICIPACION_MS = 75 * 24 * 60 * 60 * 1000;
// Cuántas programadas se lanzan por disparo: las demás salen en el siguiente (5 minutos después).
const LOTE_PROGRAMADAS = 10;
// Una programada que no se pudo lanzar en este tiempo después de su hora ya no tiene sentido publicarla.
const TOLERANCIA_PROGRAMADA_MS = 6 * 60 * 60 * 1000;

export interface CrearPublicacion {
  productId?: string;
  caption: string;
  formato: FormatoDeFoto;
  items: ItemDePublicacion[];
}

export interface GuardarPublicacion extends CrearPublicacion {
  /** Si se pasa, se actualiza ese borrador o programada en vez de crear uno nuevo. */
  id?: string;
}

interface Plan {
  formato: FormatoDeFoto;
  items: ItemDePublicacion[];
}

const SELECCION = {
  id: true, status: true, kind: true, productId: true, productName: true, caption: true, media: true,
  imageUrl: true, permalink: true, error: true, createdAt: true, scheduledAt: true, plan: true,
} satisfies Prisma.InstagramPostSelect;
type FilaVista = Prisma.InstagramPostGetPayload<{ select: typeof SELECCION }>;

export interface ItemDeBorrador extends ItemDePublicacion {
  /** Dirección para mostrar el elemento en la vista previa. */
  vista: string;
}

export interface PublicacionVista {
  id: string;
  estado: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
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
  /** Programadas: cuándo salen. */
  programadaPara: Date | null;
  /** Borradores y programadas: lo necesario para retomarlas en el compositor. */
  formato: FormatoDeFoto | null;
  items: ItemDeBorrador[] | null;
}

export interface IdeaDePublicacion {
  productId: string;
  nombre: string;
  foto: string | null;
  fotos: number;
  motivo: string;
}

const esPlan = (v: unknown): v is Plan =>
  typeof v === 'object' && v !== null && Array.isArray((v as Plan).items) && ((v as Plan).formato === 'cuadrado' || (v as Plan).formato === 'vertical');

@Injectable()
export class InstagramPublicacionesService {
  private readonly logger = new Logger(InstagramPublicacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly medios: InstagramMediosService,
    private readonly instagram: InstagramService,
  ) {}

  private aVista(f: FilaVista, businessId: string): PublicacionVista {
    const plan = esPlan(f.plan) ? f.plan : null;
    return {
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
      programadaPara: f.scheduledAt,
      formato: plan?.formato ?? null,
      // Solo lo que falta publicar necesita sus elementos: se muestran para retomarlo.
      items: plan && (f.status === 'DRAFT' || f.status === 'SCHEDULED')
        ? plan.items.flatMap((i) => {
            try {
              return [{ ...i, vista: this.medios.vistaDe(businessId, i) }];
            } catch {
              return [];
            }
          })
        : null,
    };
  }

  /** Lo último que se publicó (o se está publicando, o quedó pendiente) desde Órbita, para las listas de la pantalla. */
  async listar(businessId: string): Promise<PublicacionVista[]> {
    const filas = await this.prisma.instagramPost.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PUBLICACIONES_RECIENTES,
      select: SELECCION,
    });
    return filas.map((f) => this.aVista(f, businessId));
  }

  /** Lo que sale o salió dentro de un rango de fechas (el calendario): las programadas por su hora, las publicadas por la suya. */
  async calendario(businessId: string, desde: Date, hasta: Date): Promise<PublicacionVista[]> {
    const filas = await this.prisma.instagramPost.findMany({
      where: {
        businessId,
        OR: [
          { status: 'SCHEDULED', scheduledAt: { gte: desde, lt: hasta } },
          { status: { in: ['PUBLISHED', 'PROCESSING', 'PUBLISHING'] }, createdAt: { gte: desde, lt: hasta } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: SELECCION,
    });
    return filas.map((f) => this.aVista(f, businessId));
  }

  /**
   * Productos de la tienda que todavía no se publicaron en Instagram desde Órbita, para sugerir qué subir: primero
   * los que más se vendieron este último mes, después los destacados y los más nuevos. Solo los publicados en la
   * tienda y con foto.
   */
  async ideas(businessId: string): Promise<IdeaDePublicacion[]> {
    const yaPublicados = await this.prisma.instagramPost.findMany({
      where: { businessId, status: { in: ['PUBLISHED', 'PUBLISHING', 'PROCESSING', 'SCHEDULED'] }, productId: { not: null } },
      select: { productId: true },
    });
    const excluidos = yaPublicados.flatMap((p) => (p.productId ? [p.productId] : []));
    const candidatos = await this.prisma.product.findMany({
      where: { businessId, status: 'PUBLISHED', id: { notIn: excluidos }, images: { some: {} } },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 40,
      select: {
        id: true, name: true, isFeatured: true, createdAt: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }], select: { url: true } },
      },
    });
    const vendidos = await this.vendidosPorProducto(businessId, candidatos.map((c) => c.id));
    const haceUnMes = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return candidatos
      .map((p) => ({ p, vendidos: vendidos.get(p.id) ?? 0 }))
      .sort((a, b) => b.vendidos - a.vendidos || Number(b.p.isFeatured) - Number(a.p.isFeatured) || b.p.createdAt.getTime() - a.p.createdAt.getTime())
      .slice(0, MAX_IDEAS)
      .map(({ p, vendidos: n }) => ({
        productId: p.id,
        nombre: p.name,
        foto: p.images[0]?.url ?? null,
        fotos: p.images.length,
        motivo: n > 0
          ? `Se vendió ${n} ${n === 1 ? 'vez' : 'veces'} este último mes y no lo mostraste`
          : p.isFeatured ? 'Es un producto destacado' : p.createdAt.getTime() > haceUnMes ? 'Es nuevo en tu tienda' : 'Todavía no lo mostraste en Instagram',
      }));
  }

  /** Unidades vendidas en los últimos 30 días de cada uno de estos productos (sin contar pedidos cancelados). */
  async vendidosPorProducto(businessId: string, productIds: string[]): Promise<Map<string, number>> {
    const salida = new Map<string, number>();
    if (productIds.length === 0) return salida;
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filas = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: { businessId, createdAt: { gte: desde }, status: { not: 'CANCELLED' } }, variant: { productId: { in: productIds } } },
      _sum: { quantity: true },
    });
    if (filas.length === 0) return salida;
    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: filas.map((f) => f.variantId) }, product: { businessId } },
      select: { id: true, productId: true },
    });
    const productoDe = new Map(variantes.map((v) => [v.id, v.productId]));
    for (const f of filas) {
      const productId = productoDe.get(f.variantId);
      if (productId) salida.set(productId, (salida.get(productId) ?? 0) + (f._sum.quantity ?? 0));
    }
    return salida;
  }

  // ── Armar ───────────────────────────────────────────────────────────────────

  private async producto(businessId: string, productId?: string): Promise<{ id: string; name: string } | null> {
    if (!productId) return null;
    const p = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true, name: true, status: true } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (p.status !== 'PUBLISHED') throw new UnprocessableEntityException('Publicá el producto en tu tienda antes de promocionarlo en Instagram.');
    return { id: p.id, name: p.name };
  }

  private async asegurarPuedePublicar(businessId: string): Promise<void> {
    await this.instagram.asegurarHabilitado(businessId);
    if (!(await this.instagram.puedePublicar(businessId))) {
      throw new ForbiddenException('Falta autorizar la publicación: volvé a conectar Instagram dándole ese permiso a Órbita.');
    }
  }

  private tipoDe(items: { tipo: 'image' | 'video' }[]): string {
    return items.length > 1 ? 'CAROUSEL' : items[0]?.tipo === 'video' ? 'VIDEO' : 'IMAGE';
  }

  /** Resuelve los archivos y crea los contenedores en Instagram. Si algo falla no queda nada subido de más. */
  private async lanzar(businessId: string, items: ItemDePublicacion[], formato: FormatoDeFoto, caption: string) {
    const tipo = this.tipoDe(items);
    const primeraFoto = items.findIndex((i) => i.tipo === 'image');

    const listos: ItemResuelto[] = [];
    try {
      for (const [i, item] of items.entries()) listos.push(await this.medios.resolver(businessId, item, formato, i === primeraFoto));
    } catch (e) {
      await this.medios.limpiar(listos.flatMap((l) => l.temporales));
      throw e;
    }
    const temporales = listos.flatMap((l) => l.temporales);

    let hijos: string[] = [];
    let contenedor: string | null = null;
    try {
      if (tipo === 'CAROUSEL') {
        for (const l of listos) hijos.push(await this.crearContenedor(businessId, l.tipo === 'video' ? { media_type: 'VIDEO', video_url: l.url, is_carousel_item: true } : { image_url: l.url, is_carousel_item: true }));
      } else {
        const l = listos[0];
        contenedor = await this.crearContenedor(businessId, l.tipo === 'video'
          ? { media_type: 'REELS', video_url: l.url, share_to_feed: true, caption }
          : { image_url: l.url, caption });
        hijos = [];
      }
    } catch (e) {
      await this.medios.limpiar(temporales);
      throw e;
    }
    return { tipo, listos, hijos, contenedor, temporales, miniatura: listos.find((l) => l.miniatura)?.miniatura ?? null };
  }

  private validarCantidad(items: ItemDePublicacion[], minimo = 1): void {
    if (items.length < minimo || items.length > MAX_ELEMENTOS) throw new BadRequestException(`Una publicación lleva de 1 a ${MAX_ELEMENTOS} fotos o videos.`);
  }

  /** Dirección de la primera foto, para mostrar la publicación en las listas sin procesar nada. */
  private miniaturaDe(businessId: string, items: ItemDePublicacion[]): string | null {
    const foto = items.find((i) => i.tipo === 'image');
    return foto ? this.medios.vistaDe(businessId, foto) : null;
  }

  // ── Crear ahora ─────────────────────────────────────────────────────────────

  async crear(businessId: string, memberId: string | undefined, dto: CrearPublicacion): Promise<PublicacionVista> {
    await this.asegurarPuedePublicar(businessId);
    this.validarCantidad(dto.items);
    const producto = await this.producto(businessId, dto.productId);

    const l = await this.lanzar(businessId, dto.items, dto.formato, dto.caption);

    const post = await this.prisma.instagramPost.create({
      data: {
        businessId,
        productId: producto?.id ?? null,
        productName: producto?.name ?? null,
        memberId: memberId ?? null,
        caption: dto.caption,
        status: 'PROCESSING',
        kind: l.tipo,
        media: l.listos.map((x) => ({ tipo: x.tipo })),
        imageUrl: l.miniatura,
        childContainerIds: l.hijos,
        containerId: l.contenedor,
        tempPaths: l.temporales,
      },
      select: { id: true },
    });
    return this.continuar(businessId, post.id, true);
  }

  // ── Programar y borradores ──────────────────────────────────────────────────

  /** Deja una publicación guardada para que salga sola a `fecha`. Si viene `id`, convierte ese borrador o reprograma esa. */
  async programar(businessId: string, memberId: string | undefined, dto: GuardarPublicacion, fecha: Date): Promise<PublicacionVista> {
    await this.asegurarPuedePublicar(businessId);
    this.validarCantidad(dto.items);
    const ahora = Date.now();
    if (!(fecha.getTime() >= ahora + MIN_ANTICIPACION_MS)) throw new BadRequestException('Elegí una hora que falte al menos 5 minutos.');
    if (fecha.getTime() > ahora + MAX_ANTICIPACION_MS) throw new BadRequestException('Solo se puede programar hasta con 75 días de anticipación.');
    return this.guardar(businessId, memberId, dto, 'SCHEDULED', fecha);
  }

  async guardarBorrador(businessId: string, memberId: string | undefined, dto: GuardarPublicacion): Promise<PublicacionVista> {
    await this.instagram.asegurarHabilitado(businessId);
    if (dto.items.length > MAX_ELEMENTOS) this.validarCantidad(dto.items);
    return this.guardar(businessId, memberId, dto, 'DRAFT', null);
  }

  private async guardar(businessId: string, memberId: string | undefined, dto: GuardarPublicacion, estado: 'DRAFT' | 'SCHEDULED', fecha: Date | null): Promise<PublicacionVista> {
    const producto = await this.producto(businessId, dto.productId);
    for (const item of dto.items) await this.medios.validar(businessId, item);
    const datos = {
      productId: producto?.id ?? null,
      productName: producto?.name ?? null,
      memberId: memberId ?? null,
      caption: dto.caption,
      status: estado,
      kind: dto.items.length > 0 ? this.tipoDe(dto.items) : 'IMAGE',
      media: dto.items.map((i) => ({ tipo: i.tipo })),
      imageUrl: this.miniaturaDe(businessId, dto.items),
      scheduledAt: fecha,
      plan: { formato: dto.formato, items: dto.items } as unknown as Prisma.InputJsonValue,
      error: null,
    };
    if (dto.id) {
      // Solo se puede cambiar lo que todavía no empezó a publicarse.
      const r = await this.prisma.instagramPost.updateMany({ where: { id: dto.id, businessId, status: { in: ['DRAFT', 'SCHEDULED'] } }, data: datos });
      if (r.count === 0) throw new ConflictException('Esa publicación ya no se puede cambiar: ya salió o se está publicando.');
      return this.vista(businessId, dto.id);
    }
    const creada = await this.prisma.instagramPost.create({ data: { businessId, ...datos }, select: { id: true } });
    return this.vista(businessId, creada.id);
  }

  private async vista(businessId: string, id: string): Promise<PublicacionVista> {
    const f = await this.prisma.instagramPost.findFirst({ where: { id, businessId }, select: SELECCION });
    if (!f) throw new NotFoundException('Publicación no encontrada');
    return this.aVista(f, businessId);
  }

  /** Una programada vuelve a borrador (no sale). */
  async pasarABorrador(businessId: string, id: string): Promise<PublicacionVista> {
    const r = await this.prisma.instagramPost.updateMany({ where: { id, businessId, status: 'SCHEDULED' }, data: { status: 'DRAFT', scheduledAt: null } });
    if (r.count === 0) throw new ConflictException('Esa publicación ya salió o no está programada.');
    return this.vista(businessId, id);
  }

  /** Borra un borrador o una programada, con los archivos que se habían subido para ella. */
  async descartar(businessId: string, id: string): Promise<{ ok: true }> {
    const f = await this.prisma.instagramPost.findFirst({ where: { id, businessId, status: { in: ['DRAFT', 'SCHEDULED'] } }, select: { plan: true } });
    if (!f) throw new NotFoundException('Publicación no encontrada');
    const r = await this.prisma.instagramPost.deleteMany({ where: { id, businessId, status: { in: ['DRAFT', 'SCHEDULED'] } } });
    if (r.count > 0 && esPlan(f.plan)) await this.medios.limpiarSubidas(businessId, f.plan.items);
    return { ok: true };
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
    return this.vista(businessId, post.id);
  }

  // ── Disparo periódico (Cloud Scheduler) ─────────────────────────────────────

  /**
   * Lo que hace el disparo de cada pocos minutos, para TODOS los negocios: lanza las programadas que ya llegaron a
   * su hora y sigue avanzando las que están procesándose. Una programada que falla queda FAILED con el motivo;
   * nunca tira abajo a las demás.
   */
  async procesarPendientes(ahora: Date = new Date()): Promise<{ lanzadas: number; falladas: number; avanzadas: number }> {
    const resultado = { lanzadas: 0, falladas: 0, avanzadas: 0 };

    const vencidas = await this.prisma.instagramPost.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: ahora } },
      orderBy: { scheduledAt: 'asc' },
      take: LOTE_PROGRAMADAS,
    });
    for (const post of vencidas) {
      try {
        // Candado: dos disparos a la vez no la lanzan dos veces.
        const tomada = await this.prisma.instagramPost.updateMany({
          where: { id: post.id, businessId: post.businessId, status: 'SCHEDULED' },
          data: { status: 'PROCESSING' },
        });
        if (tomada.count === 0) continue;
        if (await this.lanzarProgramada(post, ahora)) resultado.lanzadas++;
        else resultado.falladas++;
      } catch (e) {
        resultado.falladas++;
        this.logger.error(`No se pudo lanzar la publicación programada ${post.id}: ${describeError(e)}`);
      }
    }

    const enCurso = await this.prisma.instagramPost.findMany({
      where: { status: { in: ['PROCESSING', 'PUBLISHING'] } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
    for (const post of enCurso) {
      try {
        await this.avanzar(post.businessId, post);
        resultado.avanzadas++;
      } catch (e) {
        this.logger.error(`No se pudo avanzar la publicación ${post.id}: ${describeError(e)}`);
      }
    }
    return resultado;
  }

  /** Arma una programada que ya llegó a su hora. Devuelve false si no se pudo (queda FAILED con el motivo). */
  private async lanzarProgramada(post: InstagramPost, ahora: Date): Promise<boolean> {
    const plan = esPlan(post.plan) ? post.plan : null;
    if (!plan || plan.items.length === 0) {
      await this.fallar(post, 'La publicación programada no tiene fotos ni videos.');
      return false;
    }
    if (post.scheduledAt && ahora.getTime() - post.scheduledAt.getTime() > TOLERANCIA_PROGRAMADA_MS) {
      await this.fallar(post, 'No se pudo publicar a su hora y ya pasó demasiado tiempo. Revisá la conexión de Instagram y volvé a programarla.');
      return false;
    }
    try {
      if (!(await this.instagram.puedePublicar(post.businessId))) {
        await this.fallar(post, 'Instagram no está conectado con el permiso de publicar. Volvé a conectarlo y programala de nuevo.');
        return false;
      }
      const l = await this.lanzar(post.businessId, plan.items, plan.formato, post.caption);
      await this.prisma.instagramPost.update({
        where: { id: post.id, businessId: post.businessId },
        data: {
          kind: l.tipo,
          media: l.listos.map((x) => ({ tipo: x.tipo })),
          imageUrl: l.miniatura ?? post.imageUrl,
          childContainerIds: l.hijos,
          containerId: l.contenedor,
          tempPaths: l.temporales,
        },
      });
      return true;
    } catch (e) {
      await this.fallar(post, e instanceof HttpException ? e.message : 'No se pudo preparar la publicación programada.');
      return false;
    }
  }

  private pausa(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async avanzar(businessId: string, post: InstagramPost): Promise<InstagramPost> {
    if (post.status === 'PUBLISHING') {
      // Otra llamada la está publicando. Si hace rato que quedó así, no se sabe cómo terminó.
      return Date.now() - post.updatedAt.getTime() > VENCE_PUBLICANDO_MS
        ? this.fallar(post, 'No pudimos confirmar si se publicó. Revisá tu Instagram antes de volver a intentarlo.')
        : post;
    }
    // Una programada se crea mucho antes de lanzarse: la espera de procesamiento cuenta desde que se la tomó.
    const desde = post.scheduledAt ? post.updatedAt.getTime() : post.createdAt.getTime();
    if (Date.now() - desde > VENCE_PROCESANDO_MS) return this.fallar(post, 'Instagram tardó demasiado en procesar los archivos. Probá de nuevo.');

    // true desde que se tomó el candado de publicar: a partir de ahí un error puede significar que SÍ salió.
    let publicando = false;
    try {
      let contenedor = post.containerId;

      // Carrusel: primero tienen que estar listos todos los elementos; recién ahí se arma el carrusel.
      if (!contenedor) {
        const hijos = (post.childContainerIds as string[]) ?? [];
        // Sin contenedores todavía (se cortó el proceso al lanzarla): no hay nada que esperar.
        if (hijos.length === 0) return this.fallar(post, 'No se pudo iniciar la publicación. Probá de nuevo.');
        const estados = await Promise.all(hijos.map((h) => this.estadoContenedor(businessId, h)));
        const roto = estados.find((e) => e.codigo === 'ERROR' || e.codigo === 'EXPIRED');
        if (roto) return this.fallar(post, this.mensajeDeContenedor(roto.detalle));
        if (!estados.every((e) => e.codigo === 'FINISHED')) return post;
        contenedor = await this.crearContenedor(businessId, { media_type: 'CAROUSEL', children: hijos.join(','), caption: post.caption });
        post = await this.prisma.instagramPost.update({ where: { id: post.id, businessId: post.businessId }, data: { containerId: contenedor } });
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
        where: { id: post.id, businessId: post.businessId },
        // Una programada se publicó a su hora: queda con la fecha en que salió (el historial ordena por ella).
        data: { status: 'PUBLISHED', igMediaId: publicado.id, permalink, error: null, ...(post.scheduledAt ? { createdAt: new Date() } : {}) },
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
    const fallada = await this.prisma.instagramPost.update({ where: { id: post.id, businessId: post.businessId }, data: { status: 'FAILED', error: mensaje } });
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

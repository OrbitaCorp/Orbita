import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, SupportRequestStatus } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ENTRADA_IMAGEN } from '../common/utils/subida-imagen';
import { SendSupportRequestDto, type SupportCategory } from './dto/send-support-request.dto';
import { SendPublicSupportRequestDto } from './dto/send-public-support-request.dto';
import { ReplySupportRequestDto } from './dto/reply-support-request.dto';
import { SupportAttachmentDto } from './dto/support-attachment.dto';
import { ManualFeedbackDto } from './dto/manual-feedback.dto';
import { ListSupportQueryDto } from './dto/list-support-query.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import type {
  AdminSupportDetail,
  AdminSupportRow,
  SupportAttachment,
  SupportMessageDto,
  SupportRequestDetail,
  SupportRequestRow,
  SupportSummary,
} from './support.types';

// Mismo bucket que el logo y las imágenes de Apariencia (businesses.service),
// en una carpeta `soporte/` dentro del prefijo del negocio: así la URL pública
// de un adjunto dice de qué negocio es, y create()/addMessage() pueden
// rechazar una URL que no salió de acá (ver validarAdjuntos).
const BUCKET_ADJUNTOS = 'business-logos';
const MIME_ADJUNTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Primeros caracteres del último mensaje para la fila del listado.
const LARGO_EXTRACTO = 120;

// Nombre a mostrar cuando quien escribió ya no existe (SetNull en el schema):
// el hilo se sigue leyendo, solo cambia la firma.
const ADMIN_SIN_NOMBRE = 'Equipo de Órbita';
const MIEMBRO_SIN_NOMBRE = 'Alguien del negocio';

// Lo que necesita una FILA del listado: el último mensaje (para el extracto) y
// cuántos hay, sin traer el hilo entero.
const INCLUDE_FILA = {
  business: { select: { id: true, name: true, subdomain: true } },
  member: { select: { id: true, name: true, email: true } },
  _count: { select: { messages: true } },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { author: true, body: true, createdAt: true },
  },
} satisfies Prisma.SupportRequestInclude;

// El DETALLE trae el hilo completo con quién firmó cada mensaje.
const INCLUDE_DETALLE = {
  business: { select: { id: true, name: true, subdomain: true } },
  member: { select: { id: true, name: true, email: true } },
  _count: { select: { messages: true } },
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { member: { select: { name: true } }, admin: { select: { name: true } } },
  },
} satisfies Prisma.SupportRequestInclude;

type FilaDb = Prisma.SupportRequestGetPayload<{ include: typeof INCLUDE_FILA }>;
type DetalleDb = Prisma.SupportRequestGetPayload<{ include: typeof INCLUDE_DETALLE }>;

// Configuración → Soporte: cualquier miembro del panel puede escribir — sin
// permiso especial (mismo criterio que "cualquiera con sesión de panel puede
// pedir ayuda", no es una acción sensible como las que sí gatean
// @RequirePermission). Desde el 21/09 cada consulta se GUARDA (SupportRequest
// + hilo de SupportMessage) y el mail al buzón de soporte es un aviso: si el
// mail no sale, la consulta queda igual y se ve en el superadmin. El destino
// del aviso es SIEMPRE soporte@orbita.site, fijo acá — el frontend nunca
// elige a quién le llega.
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly SUPPORT_EMAIL = 'soporte@orbita.site';

  private readonly CATEGORY_LABEL: Record<SupportCategory, string> = {
    DOMINIO: 'Dominios',
    FACTURACION: 'Facturación / pagos',
    TECNICO: 'Problema técnico',
    CUENTA: 'Mi cuenta / plan',
    OTRO: 'Otra consulta',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── Panel del negocio ─────────────────────────────────────────────────────

  async create(businessId: string, memberId: string, dto: SendSupportRequestDto): Promise<SupportRequestDetail> {
    const { business, member } = await this.resolverQuienEscribe(businessId, memberId);
    const attachments = this.validarAdjuntos(businessId, dto.attachments);
    const ahora = new Date();

    const creada = await this.prisma.supportRequest.create({
      data: {
        businessId,
        memberId,
        category: dto.category,
        subject: dto.subject.trim(),
        contactPhone: dto.contactPhone?.trim() || null,
        lastMessageAt: ahora,
        messages: {
          create: {
            author: 'MEMBER',
            memberId,
            body: dto.message.trim(),
            attachments: attachments as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: INCLUDE_DETALLE,
    });

    await this.avisarASoporte(creada, member, business, dto.message.trim(), attachments, false);
    return this.detalle(creada);
  }

  async list(businessId: string): Promise<{ data: SupportRequestRow[] }> {
    const filas = await this.prisma.supportRequest.findMany({
      where: { businessId },
      orderBy: { lastMessageAt: 'desc' },
      include: INCLUDE_FILA,
    });
    return { data: filas.map((f) => this.fila(f)) };
  }

  async get(businessId: string, id: string): Promise<SupportRequestDetail> {
    const req = await this.prisma.supportRequest.findFirst({ where: { id, businessId }, include: INCLUDE_DETALLE });
    if (!req) throw new NotFoundException('Consulta no encontrada');
    return this.detalle(req);
  }

  // El negocio vuelve a escribir. Cualquier estado vuelve a OPEN: le toca a
  // Órbita de nuevo, aunque la hubiera cerrado un admin.
  async addMessage(businessId: string, memberId: string, id: string, dto: ReplySupportRequestDto): Promise<SupportRequestDetail> {
    const existente = await this.prisma.supportRequest.findFirst({
      where: { id, businessId },
      select: { id: true, number: true, subject: true, category: true, contactPhone: true },
    });
    if (!existente) throw new NotFoundException('Consulta no encontrada');
    const { business, member } = await this.resolverQuienEscribe(businessId, memberId);
    const attachments = this.validarAdjuntos(businessId, dto.attachments);
    const ahora = new Date();

    const [, actualizada] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          requestId: id,
          author: 'MEMBER',
          memberId,
          body: dto.message.trim(),
          attachments: attachments as unknown as Prisma.InputJsonValue,
        },
      }),
      this.prisma.supportRequest.update({
        where: { id },
        data: { lastMessageAt: ahora, status: 'OPEN', closedAt: null },
        include: INCLUDE_DETALLE,
      }),
    ]);

    await this.avisarASoporte(actualizada, member, business, dto.message.trim(), attachments, true);
    return this.detalle(actualizada);
  }

  // Captura de pantalla para un mensaje. Mismo camino que el logo
  // (businesses.service#uploadToStorage): sharp → webp, bucket business-logos,
  // pero en `${businessId}/soporte/` — ver validarAdjuntos para el porqué de
  // la carpeta.
  async uploadAttachment(businessId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<SupportAttachment> {
    if (!MIME_ADJUNTO_PERMITIDOS.includes(file.mimetype)) {
      throw new BadRequestException('El adjunto tiene que ser una imagen (jpg, png, webp o gif)');
    }
    let webp: Buffer;
    try {
      webp = await sharp(file.buffer, ENTRADA_IMAGEN).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('No se pudo subir el adjunto: el archivo no es una imagen válida, está corrupto o supera los 60 megapíxeles');
    }

    const path = `${businessId}/soporte/${randomUUID()}.webp`;
    const { error } = await this.supabase.adminClient.storage
      .from(BUCKET_ADJUNTOS)
      .upload(path, webp, { contentType: 'image/webp', upsert: false });
    if (error) {
      // El detalle de Supabase va al log, no a la respuesta (mismo criterio
      // que en businesses.service).
      this.logger.error(`Subida de adjunto de soporte a ${BUCKET_ADJUNTOS} falló para ${businessId}: ${error.message}`);
      throw new ServiceUnavailableException('No se pudo subir el adjunto: el almacenamiento no respondió, probá de nuevo en un rato');
    }
    const { data } = this.supabase.adminClient.storage.from(BUCKET_ADJUNTOS).getPublicUrl(path);
    return {
      url: data.publicUrl,
      name: file.originalname?.trim().slice(0, 200) || 'captura.webp',
      size: webp.length,
      type: 'image/webp',
    };
  }

  // Un voto por miembro y capítulo: cambiar de opinión pisa el anterior.
  async saveManualFeedback(businessId: string, memberId: string, dto: ManualFeedbackDto): Promise<{ ok: true }> {
    const comment = dto.comment?.trim() || null;
    await this.prisma.manualFeedback.upsert({
      where: { memberId_chapterId: { memberId, chapterId: dto.chapterId } },
      create: { businessId, memberId, chapterId: dto.chapterId, helpful: dto.helpful, comment },
      update: { helpful: dto.helpful, comment },
    });
    return { ok: true };
  }

  async listManualFeedback(businessId: string, memberId: string): Promise<{ data: { chapterId: string; helpful: boolean }[] }> {
    const votos = await this.prisma.manualFeedback.findMany({
      where: { memberId, businessId },
      select: { chapterId: true, helpful: true },
    });
    return { data: votos };
  }

  // ── Superadmin ────────────────────────────────────────────────────────────

  async adminList(q: ListSupportQueryDto): Promise<{ data: AdminSupportRow[]; total: number; page: number; limit: number; openCount: number }> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Prisma.SupportRequestWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    if (q.businessId) where.businessId = q.businessId;
    if (q.q) {
      where.OR = [
        { subject: { contains: q.q, mode: 'insensitive' } },
        { business: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }

    // openCount es GLOBAL (sin los filtros): es el contador de la pestaña, lo
    // que le toca al equipo, no cuántas abiertas hay en esta búsqueda.
    const [filas, total, openCount] = await this.prisma.$transaction([
      this.prisma.supportRequest.findMany({
        where,
        // El enum se declara OPEN, ANSWERED, CLOSED: ordenar por status asc
        // deja lo pendiente arriba, y dentro de cada estado lo más reciente.
        orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_FILA,
      }),
      this.prisma.supportRequest.count({ where }),
      this.prisma.supportRequest.count({ where: { status: 'OPEN' } }),
    ]);

    return { data: filas.map((f) => this.filaAdmin(f)), total, page, limit, openCount };
  }

  async adminSummary(): Promise<SupportSummary> {
    const [porEstado, votos] = await Promise.all([
      this.prisma.supportRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.manualFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        include: { business: { select: { name: true } } },
      }),
    ]);
    const contar = (estado: SupportRequestStatus) => porEstado.find((p) => p.status === estado)?._count._all ?? 0;

    // Agrupado acá y no en SQL: son pocos capítulos y hace falta la lista de
    // comentarios con el nombre del negocio al lado de cada uno.
    const porCapitulo = new Map<string, SupportSummary['manual'][number]>();
    for (const v of votos) {
      let cap = porCapitulo.get(v.chapterId);
      if (!cap) {
        cap = { chapterId: v.chapterId, helpful: 0, notHelpful: 0, comments: [] };
        porCapitulo.set(v.chapterId, cap);
      }
      if (v.helpful) cap.helpful += 1;
      else cap.notHelpful += 1;
      if (v.comment) {
        cap.comments.push({ businessName: v.business.name, comment: v.comment, helpful: v.helpful, createdAt: v.createdAt.toISOString() });
      }
    }

    return {
      open: contar('OPEN'),
      answered: contar('ANSWERED'),
      closed: contar('CLOSED'),
      manual: [...porCapitulo.values()],
    };
  }

  async adminGet(id: string): Promise<AdminSupportDetail> {
    const req = await this.prisma.supportRequest.findUnique({ where: { id }, include: INCLUDE_DETALLE });
    if (!req) throw new NotFoundException('Consulta no encontrada');
    return this.detalleAdmin(req);
  }

  // Respuesta del equipo. La firma el admin del token (nombre real en el hilo
  // y en el mail); un OPERATOR también puede: responder consultas es
  // justamente el trabajo de soporte.
  async adminReply(adminId: string, id: string, dto: AdminReplyDto): Promise<AdminSupportDetail> {
    const [admin, existente] = await Promise.all([
      this.prisma.platformAdmin.findUnique({ where: { id: adminId }, select: { name: true } }),
      this.prisma.supportRequest.findUnique({
        where: { id },
        select: { id: true, number: true, subject: true, businessId: true, member: { select: { id: true, name: true, email: true } }, business: { select: { subdomain: true } } },
      }),
    ]);
    if (!existente) throw new NotFoundException('Consulta no encontrada');
    const adminName = admin?.name ?? ADMIN_SIN_NOMBRE;
    const ahora = new Date();

    const [, actualizada] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: { requestId: id, author: 'ADMIN', adminId, body: dto.message.trim(), attachments: [] },
      }),
      this.prisma.supportRequest.update({
        where: { id },
        data: { status: 'ANSWERED', answeredAt: ahora, lastMessageAt: ahora },
        include: INCLUDE_DETALLE,
      }),
      this.prisma.platformAdminLog.create({
        data: {
          adminId,
          action: 'support_reply',
          targetType: 'support_request',
          targetId: id,
          details: { businessId: existente.businessId, number: existente.number },
        },
      }),
    ]);

    // El mail nunca hace fallar la respuesta: ya está guardada y el negocio la
    // ve en su panel aunque el aviso no salga.
    try {
      const ok = await this.mail.sendSupportReply(
        existente.member.email,
        {
          number: existente.number,
          subject: existente.subject,
          memberName: existente.member.name,
          adminName,
          message: dto.message.trim(),
          panelUrl: this.urlDelPanel(existente.business.subdomain, id),
          supportEmail: this.SUPPORT_EMAIL,
        },
        { businessId: existente.businessId, memberId: existente.member.id },
      );
      if (!ok) this.logger.warn(`El aviso de respuesta de la consulta #${existente.number} no salió (ver email_logs)`);
    } catch (e) {
      this.logger.error(`No se pudo mandar el aviso de respuesta de la consulta #${existente.number}: ${e instanceof Error ? e.message : e}`);
    }

    return this.detalleAdmin(actualizada);
  }

  async adminSetStatus(adminId: string, id: string, dto: UpdateSupportStatusDto): Promise<AdminSupportDetail> {
    const existente = await this.prisma.supportRequest.findUnique({ where: { id }, select: { id: true, number: true, businessId: true } });
    if (!existente) throw new NotFoundException('Consulta no encontrada');

    const [actualizada] = await this.prisma.$transaction([
      this.prisma.supportRequest.update({
        where: { id },
        data: dto.status === 'CLOSED' ? { status: 'CLOSED', closedAt: new Date() } : { status: 'OPEN', closedAt: null },
        include: INCLUDE_DETALLE,
      }),
      this.prisma.platformAdminLog.create({
        data: {
          adminId,
          action: 'support_status',
          targetType: 'support_request',
          targetId: id,
          details: { status: dto.status, businessId: existente.businessId, number: existente.number },
        },
      }),
    ]);
    return this.detalleAdmin(actualizada);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  // Con el negocio en el filtro del miembro, como el resto de las consultas
  // por miembro (auditoría interna 10/09, ítem api.support).
  private async resolverQuienEscribe(businessId: string, memberId: string) {
    const [business, member] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true, subdomain: true } }),
      this.prisma.member.findFirst({ where: { id: memberId, businessId }, select: { name: true, email: true } }),
    ]);
    if (!business || !member) throw new NotFoundException('No se pudo resolver quién está escribiendo');
    return { business, member };
  }

  // Prefijo público de la carpeta soporte/ del negocio en el bucket. Se arma
  // con el cliente de Storage y no con una constante: así vale en local y en
  // producción sin saber la URL del proyecto de Supabase.
  private prefijoAdjuntos(businessId: string): string {
    const { data } = this.supabase.adminClient.storage.from(BUCKET_ADJUNTOS).getPublicUrl(`${businessId}/soporte`);
    return `${data.publicUrl}/`;
  }

  // El frontend manda las URLs que le devolvió uploadAttachment(), pero no hay
  // por qué creerle: una URL de OTRO negocio (o de cualquier lado) quedaría
  // linkeada en el hilo y en el mail al equipo. Solo pasa lo que está en la
  // carpeta soporte/ de ESTE negocio.
  private validarAdjuntos(businessId: string, adjuntos?: SupportAttachmentDto[]): SupportAttachment[] {
    if (!adjuntos?.length) return [];
    const prefijo = this.prefijoAdjuntos(businessId);
    return adjuntos.map((a) => {
      if (!a.url.startsWith(prefijo) || a.url.length === prefijo.length || a.url.includes('..')) {
        throw new BadRequestException('Uno de los adjuntos no pertenece a esta cuenta');
      }
      return {
        url: a.url,
        name: a.name,
        ...(a.size !== undefined ? { size: a.size } : {}),
        ...(a.type ? { type: a.type } : {}),
      };
    });
  }

  // Aviso al buzón de soporte. Antes del 21/09 un mail que no salía era un
  // 422 y la consulta se perdía; ahora ya está guardada cuando llegamos acá,
  // así que el fallo se loguea y nada más.
  private async avisarASoporte(
    req: { id: string; number: number; subject: string; category: SupportCategory; contactPhone: string | null; businessId: string; memberId: string },
    member: { name: string; email: string },
    business: { name: string; subdomain: string },
    message: string,
    attachments: SupportAttachment[],
    isReply: boolean,
  ) {
    try {
      const ok = await this.mail.sendSupportRequest(
        this.SUPPORT_EMAIL,
        {
          number: req.number,
          businessName: business.name,
          businessSlug: business.subdomain,
          memberName: member.name,
          memberEmail: member.email,
          category: this.CATEGORY_LABEL[req.category],
          subject: req.subject,
          message,
          contactPhone: req.contactPhone ?? undefined,
          attachments: attachments.map((a) => ({ url: a.url, name: a.name })),
          isReply,
          adminUrl: this.urlDelSuperadmin(),
        },
        { businessId: req.businessId, memberId: req.memberId },
      );
      if (!ok) this.logger.warn(`El aviso de la consulta #${req.number} no salió (ver email_logs); la consulta quedó guardada`);
    } catch (e) {
      this.logger.error(`No se pudo mandar el aviso de la consulta #${req.number} (quedó guardada igual): ${e instanceof Error ? e.message : e}`);
    }
  }

  // Configuración → Soporte del panel del negocio, con la consulta abierta.
  // Misma forma de URL que domain-expiry.service (`<sub>.orbita.site/admin/...`).
  private urlDelPanel(subdomain: string, requestId: string): string {
    return `https://${subdomain}.orbita.site/admin/ventas/configuracion?vista=soporte&consulta=${encodeURIComponent(requestId)}`;
  }

  // Pestaña Soporte del superadmin (la sección vive en ?seccion=, ver
  // SuperAdminDashboard.tsx). FRONTEND_URL como en members.service.
  private urlDelSuperadmin(): string {
    return `${process.env.FRONTEND_URL ?? 'https://orbita.site'}/superadmin?seccion=soporte`;
  }

  private extracto(body: string): string {
    const plano = body.replace(/\s+/g, ' ').trim();
    return plano.length > LARGO_EXTRACTO ? `${plano.slice(0, LARGO_EXTRACTO - 1)}…` : plano;
  }

  // El JSON de la base ya se validó al entrar (validarAdjuntos), pero se
  // filtra igual al salir: si alguien tocó la columna a mano, el panel recibe
  // un array tipado y no cualquier cosa.
  private adjuntosDe(json: Prisma.JsonValue): SupportAttachment[] {
    if (!Array.isArray(json)) return [];
    const salida: SupportAttachment[] = [];
    for (const a of json) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
      const o = a as Record<string, unknown>;
      if (typeof o.url !== 'string' || typeof o.name !== 'string') continue;
      salida.push({
        url: o.url,
        name: o.name,
        ...(typeof o.size === 'number' ? { size: o.size } : {}),
        ...(typeof o.type === 'string' ? { type: o.type } : {}),
      });
    }
    return salida;
  }

  private fila(f: FilaDb | DetalleDb): SupportRequestRow {
    // En el detalle los mensajes vienen asc (hilo completo); en la fila, solo
    // el último. Se toma el más nuevo en los dos casos.
    const ultimo = f.messages.reduce<(typeof f.messages)[number] | null>(
      (acc, m) => (!acc || m.createdAt > acc.createdAt ? m : acc),
      null,
    );
    return {
      id: f.id,
      number: f.number,
      category: f.category,
      subject: f.subject,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      lastMessageAt: f.lastMessageAt.toISOString(),
      messagesCount: f._count.messages,
      member: { id: f.member.id, name: f.member.name },
      lastMessage: ultimo ? { author: ultimo.author, excerpt: this.extracto(ultimo.body), createdAt: ultimo.createdAt.toISOString() } : null,
    };
  }

  private filaAdmin(f: FilaDb | DetalleDb): AdminSupportRow {
    return {
      ...this.fila(f),
      business: { id: f.business.id, name: f.business.name, subdomain: f.business.subdomain },
      member: { id: f.member.id, name: f.member.name, email: f.member.email },
    };
  }

  private mensajes(d: DetalleDb): SupportMessageDto[] {
    return d.messages.map((m) => ({
      id: m.id,
      author: m.author,
      authorName: m.author === 'ADMIN' ? (m.admin?.name ?? ADMIN_SIN_NOMBRE) : (m.member?.name ?? d.member.name ?? MIEMBRO_SIN_NOMBRE),
      body: m.body,
      attachments: this.adjuntosDe(m.attachments),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  private detalle(d: DetalleDb): SupportRequestDetail {
    return { ...this.fila(d), contactPhone: d.contactPhone, messages: this.mensajes(d) };
  }

  private detalleAdmin(d: DetalleDb): AdminSupportDetail {
    return { ...this.filaAdmin(d), contactPhone: d.contactPhone, messages: this.mensajes(d) };
  }

  // ── Landing pública (sin auth) ────────────────────────────────────────────

  async sendPublic(dto: SendPublicSupportRequestDto): Promise<{ ok: true }> {
    if (dto.website?.trim()) return { ok: true };
    const ok = await this.mail.sendPublicSupportRequest(this.SUPPORT_EMAIL, {
      name: dto.name,
      email: dto.email,
      category: this.CATEGORY_LABEL[dto.category],
      subject: dto.subject,
      message: dto.message,
    });
    if (!ok) throw new UnprocessableEntityException('No se pudo enviar tu consulta — probá de nuevo en un momento');
    return { ok: true };
  }
}

import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EmailSendStatus, PlatformMailSender, Prisma } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ENTRADA_IMAGEN } from '../../common/utils/subida-imagen';
import { EnviarCorreoDto, UpsertCasillaDto, VistaPreviaCorreoDto } from './correo.dto';

// Mismo bucket público que los logos de los negocios, con prefijo propio.
const BUCKET = 'business-logos';
// Es una herramienta para escribir correos uno por uno, no para campañas: un
// tope diario entre todos los admins frena un error (o una sesión robada)
// antes de que queme la reputación de los dominios de Órbita.
const TOPE_DIARIO = 100;
// Un GIF se sube tal cual (recodificarlo pierde la animación), así que el tope
// de peso lo pone esto: es lo que descarga quien abre el correo.
const MAX_GIF_BYTES = 2 * 1024 * 1024;
const ACCION_LOG = 'send_direct_mail';

// Correo del super panel: casillas desde las que escribe el equipo (cada una
// con su firma), vista previa con la plantilla de Órbita, envío y enviados.
@Injectable()
export class CorreoPlataformaService {
  private readonly logger = new Logger(CorreoPlataformaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly supabase: SupabaseService,
  ) {}

  // `verified`: si el dominio de la casilla está verificado en Resend. null =
  // no se pudo consultar (el panel no afirma nada en ese caso).
  async casillas() {
    const [casillas, dominios] = await Promise.all([
      this.prisma.platformMailSender.findMany({ orderBy: { createdAt: 'asc' } }),
      this.mail.dominiosDeEnvio(),
    ]);
    return casillas.map((c) => {
      const dominio = c.email.split('@')[1]?.toLowerCase() ?? '';
      return { ...this.serializar(c), verified: dominios ? dominios.get(dominio) === true : null };
    });
  }

  async crearCasilla(dto: UpsertCasillaDto) {
    try {
      return this.serializar(await this.prisma.platformMailSender.create({ data: this.datos(dto) }));
    } catch (e) {
      throw this.traducir(e);
    }
  }

  async editarCasilla(id: string, dto: UpsertCasillaDto) {
    try {
      return this.serializar(await this.prisma.platformMailSender.update({ where: { id }, data: this.datos(dto) }));
    } catch (e) {
      throw this.traducir(e);
    }
  }

  async borrarCasilla(id: string) {
    try {
      await this.prisma.platformMailSender.delete({ where: { id } });
    } catch (e) {
      throw this.traducir(e);
    }
    return { ok: true };
  }

  // Imagen de la firma: un logo chico al lado del texto, o una tarjeta que es
  // la firma completa. PNG para conservar la transparencia y porque Outlook de
  // escritorio no muestra webp; hasta 1120 px de ancho, que es la tarjeta al
  // doble de los 460 px a los que se muestra. Un GIF va sin tocar: sharp lo
  // valida, pero recodificarlo se queda con el primer cuadro.
  async subirImagenFirma(file: { buffer: Buffer }) {
    let salida: Buffer;
    let esGif = false;
    try {
      const imagen = sharp(file.buffer, ENTRADA_IMAGEN);
      esGif = (await imagen.metadata()).format === 'gif';
      salida = esGif
        ? file.buffer
        : await imagen.rotate().resize({ width: 1120, height: 600, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    } catch {
      throw new BadRequestException('El archivo no es una imagen válida');
    }
    if (esGif && salida.length > MAX_GIF_BYTES) {
      throw new BadRequestException('El GIF pesa más de 2 MB: es mucho para una firma de correo');
    }
    const path = `plataforma/firmas/${randomUUID()}.${esGif ? 'gif' : 'png'}`;
    const { error } = await this.supabase.adminClient.storage
      .from(BUCKET)
      .upload(path, salida, { contentType: esGif ? 'image/gif' : 'image/png', upsert: false });
    if (error) {
      this.logger.error(`Subida de la imagen de firma a ${BUCKET} falló: ${error.message}`);
      throw new ServiceUnavailableException('No se pudo subir la imagen: el almacenamiento no respondió, probá de nuevo en un rato');
    }
    return { url: this.supabase.adminClient.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  }

  async vistaPrevia(dto: VistaPreviaCorreoDto) {
    const casilla = await this.casilla(dto.senderId);
    return { html: this.mail.directoHtml(dto.body, this.firma(casilla)) };
  }

  async enviar(adminId: string, dto: EnviarCorreoDto) {
    const casilla = await this.casilla(dto.senderId);
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const enviadosHoy = await this.prisma.platformOutboundMail.count({
      where: { createdAt: { gte: desde }, status: { not: EmailSendStatus.FAILED } },
    });
    if (enviadosHoy >= TOPE_DIARIO) {
      throw new HttpException(`Ya salieron ${TOPE_DIARIO} correos en las últimas 24 horas. Probá más tarde.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const to = dto.to.trim().toLowerCase();
    const subject = dto.subject.trim();
    const { status, error } = await this.mail.sendDirecto({ to, subject, cuerpo: dto.body, firma: this.firma(casilla) });

    const fila = await this.prisma.platformOutboundMail.create({
      data: { adminId, fromEmail: casilla.email, fromName: casilla.name, to, subject, body: dto.body, status, error: error ?? null },
    });
    // El registro de actividad nunca rompe un envío que ya salió.
    await this.prisma.platformAdminLog
      .create({ data: { adminId, action: ACCION_LOG, targetType: 'outbound_mail', targetId: fila.id, details: { from: casilla.email, to, subject, status } } })
      .catch((e) => this.logger.warn(`No se pudo registrar el correo ${fila.id} en platform_admin_logs: ${e}`));

    return { sent: status !== EmailSendStatus.FAILED, simulated: status === EmailSendStatus.SIMULATED, error: error ?? null };
  }

  async enviados() {
    const filas = await this.prisma.platformOutboundMail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { admin: { select: { name: true } } },
    });
    return filas.map((f) => ({
      id: f.id,
      fromEmail: f.fromEmail,
      fromName: f.fromName,
      to: f.to,
      subject: f.subject,
      body: f.body,
      status: f.status,
      error: f.error,
      adminName: f.admin.name,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  private async casilla(id: string): Promise<PlatformMailSender> {
    const casilla = await this.prisma.platformMailSender.findUnique({ where: { id } });
    if (!casilla) throw new NotFoundException('Esa casilla ya no existe');
    return casilla;
  }

  private firma(c: PlatformMailSender) {
    return { name: c.name, email: c.email, jobTitle: c.jobTitle, phone: c.phone, imageUrl: c.signatureImageUrl, banner: c.signatureBanner };
  }

  private datos(dto: UpsertCasillaDto) {
    return {
      email: dto.email.trim().toLowerCase(),
      name: dto.name.trim(),
      jobTitle: dto.jobTitle?.trim() || null,
      phone: dto.phone?.trim() || null,
      signatureImageUrl: dto.signatureImageUrl?.trim() || null,
      // Sin imagen no hay firma completa que mostrar.
      signatureBanner: !!dto.signatureBanner && !!dto.signatureImageUrl?.trim(),
    };
  }

  private serializar(c: PlatformMailSender) {
    return { id: c.id, email: c.email, name: c.name, jobTitle: c.jobTitle, phone: c.phone, signatureImageUrl: c.signatureImageUrl, signatureBanner: c.signatureBanner };
  }

  private traducir(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') return new ConflictException('Ya hay una casilla con ese email');
      if (e.code === 'P2025') return new NotFoundException('Esa casilla ya no existe');
    }
    return e;
  }
}

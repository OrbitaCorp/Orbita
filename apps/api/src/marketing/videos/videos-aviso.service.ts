import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { dominiosDelEquipo, esDelEquipo } from '../../common/utils/dominios-equipo';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

// Aviso por correo de que hay videos esperando aprobación (Marketing → Videos).
//
// Lo reciben los superadmins ACTIVOS con correo del equipo (@orbita.site y @orbita-corp.com por defecto: son quienes
// pueden aprobar). Para no llenar la bandeja de nadie, sale UN correo por tanda:
//   · 'registro': cuando entra un video, salvo que ya haya salido un aviso en los últimos 10 minutos.
//   · 'tanda': cuando Claude termina de subir todo (videos_avisar): solo si quedó algún pendiente sin anunciar.
// El correo siempre cuenta TODOS los pendientes, no solo el último. Es mejor esfuerzo: un fallo del correo nunca
// rompe el registro del video. El último aviso se lee del registro de acciones del panel (sin tabla nueva).

export const VENTANA_AVISO_MIN = 10;
const MAX_LISTADOS = 10;
const ACCION = 'video_aviso';

export type MotivoAviso = 'registro' | 'tanda';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class VideosAvisoService {
  private readonly logger = new Logger(VideosAvisoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private get panelUrl() {
    return `${(this.config.get<string>('FRONTEND_URL') ?? 'https://orbita.site').replace(/\/$/, '')}/superadmin?seccion=marketing`;
  }

  /** Cuántos correos salieron (0 si no correspondía avisar o no hay a quién). Nunca tira. */
  async avisar(adminId: string, motivo: MotivoAviso): Promise<{ enviados: number; pendientes: number }> {
    try {
      return await this.intentar(adminId, motivo);
    } catch (e) {
      this.logger.warn(`No se pudo avisar de los videos pendientes: ${e instanceof Error ? e.message : String(e)}`);
      return { enviados: 0, pendientes: 0 };
    }
  }

  private async intentar(adminId: string, motivo: MotivoAviso) {
    const pendientes = await this.prisma.marketingVideo.findMany({ where: { estado: 'PENDIENTE' }, orderBy: { createdAt: 'asc' }, select: { titulo: true, duracionSeg: true, updatedAt: true, expiraAt: true } });
    if (pendientes.length === 0) return { enviados: 0, pendientes: 0 };

    const ultimo = await this.prisma.platformAdminLog.findFirst({ where: { action: ACCION }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (ultimo) {
      if (motivo === 'registro' && Date.now() - ultimo.createdAt.getTime() < VENTANA_AVISO_MIN * 60_000) return { enviados: 0, pendientes: pendientes.length };
      // Fin de tanda: solo si hay algún video que entró después del último aviso.
      if (motivo === 'tanda' && !pendientes.some((p) => p.updatedAt > ultimo.createdAt)) return { enviados: 0, pendientes: pendientes.length };
    }

    const dominios = dominiosDelEquipo(this.config);
    const admins = await this.prisma.platformAdmin.findMany({ where: { isActive: true, role: 'SUPERADMIN' }, select: { email: true } });
    const destinatarios = [...new Set(admins.map((a) => a.email.toLowerCase()).filter((e) => esDelEquipo(e, dominios)))];
    if (destinatarios.length === 0) return { enviados: 0, pendientes: pendientes.length };

    // Se anota ANTES de mandar: si dos videos entran a la vez, el segundo ya ve el aviso y no repite.
    await this.prisma.platformAdminLog.create({
      data: { adminId, action: ACCION, targetType: 'marketing_video', targetId: 'cola', details: { motivo, pendientes: pendientes.length, destinatarios: destinatarios.length } as Prisma.InputJsonValue },
    });

    const n = pendientes.length;
    const asunto = n === 1 ? 'Hay 1 video para aprobar en Órbita' : `Hay ${n} videos para aprobar en Órbita`;
    const html = this.cuerpo(pendientes, n);
    let enviados = 0;
    for (const to of destinatarios) {
      try {
        if (await this.mail.sendCustomEmail(to, asunto, html)) enviados++;
      } catch (e) {
        this.logger.warn(`No se pudo avisar a ${to}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { enviados, pendientes: n };
  }

  private cuerpo(pendientes: { titulo: string; duracionSeg: number | null; expiraAt: Date | null }[], n: number): string {
    const lista = pendientes.slice(0, MAX_LISTADOS)
      .map((p) => `<li style="margin:4px 0;">${esc(p.titulo)}${p.duracionSeg ? ` <span style="color:#8792a2;">(${p.duracionSeg} s)</span>` : ''}</li>`)
      .join('');
    const mas = n > MAX_LISTADOS ? `<p style="margin:4px 0 0;">…y ${n - MAX_LISTADOS} más.</p>` : '';
    const vence = pendientes.map((p) => p.expiraAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    const venceTxt = vence ? `El más viejo se borra solo el ${vence.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} si nadie lo revisa.` : '';
    return (
      `<p style="margin:0 0 10px;">${n === 1 ? 'Un video generado por el equipo está esperando tu aprobación' : `${n} videos generados por el equipo están esperando aprobación`} en Marketing → Videos:</p>` +
      `<ul style="margin:0 0 12px; padding-left:20px;">${lista}</ul>${mas}` +
      `<p style="margin:12px 0 16px;">Mirá cada uno, aprobalo o rechazalo (rechazar lo borra) y, una vez aprobado, pasalo como borrador a TikTok o Instagram. Nada se publica solo. ${esc(venceTxt)}</p>` +
      `<p style="margin:0;"><a href="${esc(this.panelUrl)}" style="display:inline-block; padding:11px 20px; border-radius:10px; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:600;">Revisar los videos</a></p>`
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { dominiosDelEquipo, esDelEquipo } from '../../common/utils/dominios-equipo';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { TipoVideo } from './tipos-video';

// Aviso por correo de que hay videos nuevos en la cola (Marketing → Videos).
//
// Le llega a TODO el equipo: los superadmins activos con correo del equipo (@orbita.site y @orbita-corp.com por defecto) y,
// si lo cargó, también a su correo personal. El correo invita a ver el video, dejar su opinión y proponer mejoras; no habla de
// aprobaciones ni de quién tiene que aprobar (eso es interno).
//
// Para no llenar la bandeja de nadie, sale UN correo por tanda y por tipo (marketing / tutorial):
//   · 'registro': cuando entra un video, salvo que ya haya salido un aviso de ese tipo en los últimos 10 minutos.
//   · 'tanda': cuando Claude termina de subir todo (videos_avisar): solo si quedó algún pendiente sin anunciar.
// El correo cuenta TODOS los pendientes del tipo, no solo el último. Es mejor esfuerzo: un fallo del correo nunca rompe el
// registro del video. El último aviso se lee del registro de acciones del panel (sin tabla nueva).

export const VENTANA_AVISO_MIN = 10;
const MAX_LISTADOS = 10;
const ACCION = 'video_aviso';

export type MotivoAviso = 'registro' | 'tanda';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Pendiente {
  titulo: string;
  duracionSeg: number | null;
  updatedAt: Date;
  expiraAt: Date | null;
  creadoPor: string | null;
}

interface Destino {
  /** Correo de la cuenta y, si lo cargó, el personal. */
  correos: string[];
  pendientes: Pendiente[];
}

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
  async avisar(adminId: string, motivo: MotivoAviso, tipo: TipoVideo = 'MARKETING'): Promise<{ enviados: number; pendientes: number }> {
    try {
      return await this.intentar(adminId, motivo, tipo);
    } catch (e) {
      this.logger.warn(`No se pudo avisar de los videos pendientes: ${e instanceof Error ? e.message : String(e)}`);
      return { enviados: 0, pendientes: 0 };
    }
  }

  private async intentar(adminId: string, motivo: MotivoAviso, tipo: TipoVideo) {
    const pendientes: Pendiente[] = await this.prisma.marketingVideo.findMany({
      where: { estado: 'PENDIENTE', tipo },
      orderBy: { createdAt: 'asc' },
      select: { titulo: true, duracionSeg: true, updatedAt: true, expiraAt: true, creadoPor: true },
    });
    if (pendientes.length === 0) return { enviados: 0, pendientes: 0 };

    const ultimo = await this.prisma.platformAdminLog.findFirst({
      where: { action: ACCION, details: { path: ['tipo'], equals: tipo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (ultimo) {
      if (motivo === 'registro' && Date.now() - ultimo.createdAt.getTime() < VENTANA_AVISO_MIN * 60_000) return { enviados: 0, pendientes: pendientes.length };
      // Fin de tanda: solo si hay algún video que entró después del último aviso.
      if (motivo === 'tanda' && !pendientes.some((p) => p.updatedAt > ultimo.createdAt)) return { enviados: 0, pendientes: pendientes.length };
    }

    const destinos = await this.destinos(pendientes);
    if (destinos.length === 0) return { enviados: 0, pendientes: pendientes.length };

    // Se anota ANTES de mandar: si dos videos entran a la vez, el segundo ya ve el aviso y no repite.
    await this.prisma.platformAdminLog.create({
      data: { adminId, action: ACCION, targetType: 'marketing_video', targetId: 'cola', details: { tipo, motivo, pendientes: pendientes.length, destinatarios: destinos.length } as Prisma.InputJsonValue },
    });

    let enviados = 0;
    for (const d of destinos) {
      const n = d.pendientes.length;
      const asunto = this.asunto(tipo, n);
      const html = this.cuerpo(tipo, d.pendientes);
      for (const to of d.correos) {
        try {
          if (await this.mail.sendCustomEmail(to, asunto, html)) enviados++;
        } catch (e) {
          this.logger.warn(`No se pudo avisar a ${to}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    return { enviados, pendientes: pendientes.length };
  }

  /** Todo el equipo: superadmins activos con correo del equipo, en su correo de la cuenta y en el personal (si lo cargó). */
  private async destinos(pendientes: Pendiente[]): Promise<Destino[]> {
    const admins = await this.prisma.platformAdmin.findMany({
      where: { isActive: true, role: 'SUPERADMIN' },
      select: { email: true, personalEmail: true },
    });
    const dominios = dominiosDelEquipo(this.config);
    return admins
      .filter((a) => esDelEquipo(a.email, dominios))
      .map((a) => ({ correos: [...new Set([a.email, a.personalEmail].filter((c): c is string => !!c).map((c) => c.toLowerCase()))], pendientes }));
  }

  private asunto(tipo: TipoVideo, n: number): string {
    if (tipo === 'TUTORIAL') return n === 1 ? 'Hay 1 tutorial nuevo para ver y comentar en Órbita' : `Hay ${n} tutoriales nuevos para ver y comentar en Órbita`;
    return n === 1 ? 'Hay 1 video nuevo para ver y comentar en Órbita' : `Hay ${n} videos nuevos para ver y comentar en Órbita`;
  }

  private cuerpo(tipo: TipoVideo, pendientes: Pendiente[]): string {
    const n = pendientes.length;
    const lista = pendientes.slice(0, MAX_LISTADOS)
      .map((p) => `<li style="margin:4px 0;">${esc(p.titulo)}${p.duracionSeg ? ` <span style="color:#8792a2;">(${p.duracionSeg} s)</span>` : ''}</li>`)
      .join('');
    const mas = n > MAX_LISTADOS ? `<p style="margin:4px 0 0;">…y ${n - MAX_LISTADOS} más.</p>` : '';
    const vence = pendientes.map((p) => p.expiraAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    const venceTxt = vence ? `Los que nadie apruebe se borran solos: el más viejo, el ${vence.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}.` : '';
    const queSon = tipo === 'TUTORIAL' ? (n === 1 ? 'tutorial' : 'tutoriales') : (n === 1 ? 'video' : 'videos');
    const intro = `${n === 1 ? `Hay un ${queSon} nuevo` : `Hay ${n} ${queSon} nuevos`} en Marketing → Videos${tipo === 'TUTORIAL' ? ' → Tutoriales' : ''}, hechos con el Claude del equipo:`;
    return (
      `<p style="margin:0 0 10px;">${intro}</p>` +
      `<ul style="margin:0 0 12px; padding-left:20px;">${lista}</ul>${mas}` +
      `<p style="margin:12px 0 16px;">Miralos, dejá tu opinión en los comentarios y, si se puede mejorar algo, pedile a Claude que lo mejore desde el mismo panel. Nada se publica solo. ${esc(venceTxt)}</p>` +
      `<p style="margin:0;"><a href="${esc(this.panelUrl)}" style="display:inline-block; padding:11px 20px; border-radius:10px; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:600;">Ver ${queSon === 'video' || queSon === 'videos' ? 'los videos' : 'los tutoriales'}</a></p>`
    );
  }
}

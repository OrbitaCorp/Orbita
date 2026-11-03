import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramService, SCOPE_ESTADISTICAS } from '../instagram/instagram.service';

// Lo que se ve y se hace con el CONTENIDO de la cuenta de Instagram de la empresa desde el super panel: sus
// publicaciones (todas las de la cuenta, no solo las que se subieron desde Órbita) con sus números.
//
// Publicar, programar, los comentarios y las estadísticas usan los MISMOS servicios que el panel de un negocio
// (ver instagram-contenido.controller.ts): esto solo agrega la lista de lo que ya está publicado en la cuenta,
// que el panel de los negocios no tiene.

const NEGOCIO_POR_DEFECTO = 'negocio';
const MAX_PUBLICACIONES = 24;
// Los números por publicación (alcance, vistas, guardados…) son una llamada por publicación: solo las más nuevas.
const MAX_CON_NUMEROS = 12;

interface IgMedio {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface PublicacionDeLaCuenta {
  id: string;
  /** Foto, video o carrusel. Los reels vienen como video. */
  tipo: 'foto' | 'video' | 'carrusel';
  reel: boolean;
  texto: string;
  imagen: string | null;
  enlace: string | null;
  fecha: string | null;
  likes: number;
  comentarios: number;
  /** null = Instagram no los dio (publicación vieja, permiso, o una de las más viejas que no se consultan). */
  vistas: number | null;
  alcance: number | null;
  guardados: number | null;
  compartidos: number | null;
}

const tipoDe = (m: IgMedio): PublicacionDeLaCuenta['tipo'] =>
  m.media_type === 'VIDEO' ? 'video' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrusel' : 'foto';

@Injectable()
export class InstagramContenidoService {
  private readonly logger = new Logger(InstagramContenidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly instagram: InstagramService,
  ) {}

  /** El negocio al que está atada la cuenta de la empresa (ver canales.service.ts). */
  async negocioId(): Promise<string> {
    const subdominio = this.config.get<string>('MARKETING_NEGOCIO')?.trim().toLowerCase() || NEGOCIO_POR_DEFECTO;
    const negocio = await this.prisma.business.findFirst({ where: { subdomain: subdominio, deletedAt: null }, select: { id: true } });
    if (!negocio) throw new NotFoundException('No se encontró el negocio de la empresa');
    await this.instagram.asegurarHabilitado(negocio.id);
    return negocio.id;
  }

  /** Las últimas publicaciones de la cuenta, de la más nueva a la más vieja, con sus números. */
  async publicacionesDeLaCuenta(): Promise<PublicacionDeLaCuenta[]> {
    const businessId = await this.negocioId();
    const r = await this.instagram.graph<{ data?: IgMedio[] }>(businessId, SCOPE_ESTADISTICAS, '{ig}/media', {
      query: {
        fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit: String(MAX_PUBLICACIONES),
      },
    });
    const medios = r.data ?? [];
    const numeros = await Promise.all(medios.map((m, i) => (i < MAX_CON_NUMEROS ? this.numeros(businessId, m) : Promise.resolve(null))));
    return medios.map((m, i) => ({
      id: m.id,
      tipo: tipoDe(m),
      reel: m.media_product_type === 'REELS',
      texto: m.caption ?? '',
      imagen: m.thumbnail_url ?? m.media_url ?? null,
      enlace: m.permalink ?? null,
      fecha: m.timestamp ?? null,
      likes: m.like_count ?? 0,
      comentarios: m.comments_count ?? 0,
      vistas: numeros[i]?.views ?? null,
      alcance: numeros[i]?.reach ?? null,
      guardados: numeros[i]?.saved ?? null,
      compartidos: numeros[i]?.shares ?? null,
    }));
  }

  // Cada número por separado: uno que Instagram no da para ese tipo de publicación queda en null y no tira a los demás.
  private async numeros(businessId: string, m: IgMedio): Promise<Record<'views' | 'reach' | 'saved' | 'shares', number | null>> {
    const pedir = async (metrica: string): Promise<number | null> => {
      try {
        const r = await this.instagram.graph<{ data?: { values?: { value?: number }[]; total_value?: { value?: number } }[] }>(
          businessId,
          SCOPE_ESTADISTICAS,
          `${m.id}/insights`,
          { query: { metric: metrica } },
        );
        const d = r.data?.[0];
        return d?.total_value?.value ?? d?.values?.[0]?.value ?? null;
      } catch (e) {
        this.logger.debug(`Sin ${metrica} para la publicación ${m.id}: ${describeError(e)}`);
        return null;
      }
    };
    const [views, reach, saved, shares] = await Promise.all([pedir('views'), pedir('reach'), pedir('saved'), pedir('shares')]);
    return { views, reach, saved, shares };
  }

  /** Queda anotado quién publicó, programó, borró o contestó con la cuenta de la empresa. */
  async anotar(adminId: string, action: string, targetId: string, details?: Record<string, unknown>): Promise<void> {
    await this.prisma.platformAdminLog
      .create({ data: { adminId, action, targetType: 'marketing_instagram', targetId, ...(details ? { details: details as object } : {}) } })
      .catch(() => undefined); // es un registro: no puede deshacer lo que ya se hizo
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramService, SCOPE_ESTADISTICAS } from './instagram.service';

// Estadísticas del kit de difusión: cuánto alcanzó y se interactuó con la cuenta en los últimos 7 o 28 días,
// y qué publicaciones funcionaron mejor.
//
// Cada métrica se pide por separado: si una no está disponible (cuentas chicas, datos que Instagram todavía
// no procesó), esa queda en null y el resto se muestra igual. Instagram avisa que los datos pueden demorar
// hasta 48 horas. Se guarda el último resultado unos minutos para que abrir y cerrar la pantalla no gaste el
// límite de llamadas.

export type DiasDeEstadisticas = 7 | 28;

const CACHE_MS = 2 * 60 * 1000;
const DIA_S = 24 * 60 * 60;
const MAX_PUBLICACIONES_REVISADAS = 20;
const MAX_DESTACADAS = 5;

// Nombre en español → métrica de Instagram (API de cuenta, `metric_type=total_value`).
const METRICAS = {
  alcance: 'reach',
  visualizaciones: 'views',
  interacciones: 'total_interactions',
  cuentasInteractuaron: 'accounts_engaged',
  visitasAlPerfil: 'profile_views',
} as const;
type NombreMetrica = keyof typeof METRICAS;

interface IgMedia {
  id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface PublicacionDestacada {
  id: string;
  texto: string;
  imagen: string | null;
  enlace: string | null;
  fecha: string | null;
  likes: number;
  comentarios: number;
}
export interface ResumenDeEstadisticas {
  dias: DiasDeEstadisticas;
  desde: string;
  hasta: string;
  cuenta: { usuario: string | null; seguidores: number | null; siguiendo: number | null; publicaciones: number | null };
  metricas: Record<NombreMetrica, number | null>;
  destacadas: PublicacionDestacada[];
}

@Injectable()
export class InstagramEstadisticasService {
  private readonly logger = new Logger(InstagramEstadisticasService.name);
  private readonly cache = new Map<string, { vence: number; valor: ResumenDeEstadisticas }>();

  constructor(private readonly instagram: InstagramService) {}

  async resumen(businessId: string, dias: DiasDeEstadisticas): Promise<ResumenDeEstadisticas> {
    const clave = `${businessId}:${dias}`;
    const guardado = this.cache.get(clave);
    if (guardado && guardado.vence > Date.now()) return guardado.valor;

    const hastaS = Math.floor(Date.now() / 1000);
    const desdeS = hastaS - dias * DIA_S;

    // La cuenta va primero y sin atajo: si falla (permiso, token vencido) hay que informarlo.
    const cuenta = await this.instagram.graph<{ username?: string; followers_count?: number; follows_count?: number; media_count?: number }>(
      businessId,
      SCOPE_ESTADISTICAS,
      '{ig}',
      { query: { fields: 'username,followers_count,follows_count,media_count' } },
    );

    const nombres = Object.keys(METRICAS) as NombreMetrica[];
    const [metricas, medios] = await Promise.all([
      Promise.allSettled(
        nombres.map((n) =>
          this.instagram.graph<{ data?: { total_value?: { value?: number } }[] }>(businessId, SCOPE_ESTADISTICAS, '{ig}/insights', {
            query: { metric: METRICAS[n], period: 'day', metric_type: 'total_value', since: String(desdeS), until: String(hastaS) },
          }),
        ),
      ),
      this.instagram
        .graph<{ data?: IgMedia[] }>(businessId, SCOPE_ESTADISTICAS, '{ig}/media', {
          query: {
            fields: 'id,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
            limit: String(MAX_PUBLICACIONES_REVISADAS),
          },
        })
        .catch((e: unknown) => {
          this.logger.warn(`No se pudieron leer las publicaciones para las estadísticas: ${describeError(e)}`);
          return { data: [] as IgMedia[] };
        }),
    ]);

    const valores = {} as Record<NombreMetrica, number | null>;
    nombres.forEach((n, i) => {
      const r = metricas[i];
      // Instagram devuelve un conjunto vacío (no un cero) cuando todavía no hay datos: queda en null.
      valores[n] = r.status === 'fulfilled' ? (r.value.data?.[0]?.total_value?.value ?? null) : null;
      if (r.status === 'rejected') this.logger.warn(`Métrica ${METRICAS[n]} no disponible: ${describeError(r.reason)}`);
    });

    const destacadas = (medios.data ?? [])
      .filter((m) => m.timestamp && Date.parse(m.timestamp) / 1000 >= desdeS)
      .map<PublicacionDestacada>((m) => ({
        id: m.id,
        texto: m.caption ?? '',
        imagen: m.thumbnail_url ?? m.media_url ?? null,
        enlace: m.permalink ?? null,
        fecha: m.timestamp ?? null,
        likes: m.like_count ?? 0,
        comentarios: m.comments_count ?? 0,
      }))
      .sort((a, b) => b.likes + b.comentarios - (a.likes + a.comentarios))
      .slice(0, MAX_DESTACADAS);

    const valor: ResumenDeEstadisticas = {
      dias,
      desde: new Date(desdeS * 1000).toISOString(),
      hasta: new Date(hastaS * 1000).toISOString(),
      cuenta: {
        usuario: cuenta.username ?? null,
        seguidores: cuenta.followers_count ?? null,
        siguiendo: cuenta.follows_count ?? null,
        publicaciones: cuenta.media_count ?? null,
      },
      metricas: valores,
      destacadas,
    };
    this.cache.set(clave, { vence: Date.now() + CACHE_MS, valor });
    return valor;
  }
}

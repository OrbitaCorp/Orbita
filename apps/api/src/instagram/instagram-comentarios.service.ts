import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { describeError } from '../common/utils/describe-error.util';
import { InstagramAjustesService, tienePalabraProhibida } from './instagram-ajustes.service';
import { InstagramService, SCOPE_COMENTAR } from './instagram.service';

// Comentarios del kit de difusión: leer los comentarios de las últimas publicaciones del negocio,
// responderlos y ocultarlos (se puede deshacer). Borrar no se ofrece a propósito: no tiene vuelta atrás.
//
// Se leen al abrir la pantalla, no por aviso (webhook): Instagram recomienda los avisos para no pasarse del
// límite de llamadas, pero con pocas publicaciones y una pantalla que se abre a mano alcanza. Si el volumen
// crece, el siguiente paso es suscribir el campo `comments` del webhook.

const MAX_PUBLICACIONES = 8;
const MAX_COMENTARIOS_POR_PUBLICACION = 30;
// Tope de comentarios que se ocultan solos en una pasada: un negocio con una palabra mal elegida no vacía todo de golpe.
const MAX_OCULTOS_POR_PASADA = 25;
// Los ids de Instagram son numéricos: se comprueba antes de armar una ruta con ellos.
const ID_DE_INSTAGRAM = /^\d{5,30}$/;

interface IgRespuesta {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
}
interface IgComentario extends IgRespuesta {
  like_count?: number;
  hidden?: boolean;
  replies?: { data?: IgRespuesta[] };
}
interface IgMedia {
  id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  comments_count?: number;
}

export interface RespuestaDeComentario {
  id: string;
  usuario: string;
  texto: string;
  fecha: string | null;
}
export interface ComentarioDePublicacion extends RespuestaDeComentario {
  likes: number;
  oculto: boolean;
  respuestas: RespuestaDeComentario[];
}
export interface PublicacionConComentarios {
  id: string;
  texto: string;
  imagen: string | null;
  enlace: string | null;
  fecha: string | null;
  totalComentarios: number;
  comentarios: ComentarioDePublicacion[];
}

const aRespuesta = (r: IgRespuesta): RespuestaDeComentario => ({
  id: r.id,
  usuario: r.username ?? 'usuario',
  texto: r.text ?? '',
  fecha: r.timestamp ?? null,
});

@Injectable()
export class InstagramComentariosService {
  private readonly logger = new Logger(InstagramComentariosService.name);

  constructor(
    private readonly instagram: InstagramService,
    // Opcional: la moderación automática (las palabras a ocultar).
    @Optional() private readonly ajustes?: InstagramAjustesService,
  ) {}

  private idValido(id: string): string {
    if (!ID_DE_INSTAGRAM.test(id)) throw new BadRequestException('Comentario inválido');
    return id;
  }

  /**
   * Los comentarios de las últimas publicaciones que tienen alguno, de la más nueva a la más vieja. Si el negocio
   * prendió la moderación, los que tengan alguna de sus palabras se ocultan en el momento (se pueden volver a mostrar).
   */
  async listar(businessId: string): Promise<{ publicaciones: PublicacionConComentarios[]; ocultadosAutomaticamente: number }> {
    const medios = await this.instagram.graph<{ data?: IgMedia[] }>(businessId, SCOPE_COMENTAR, '{ig}/media', {
      query: { fields: 'id,caption,media_url,thumbnail_url,permalink,timestamp,comments_count', limit: String(MAX_PUBLICACIONES) },
    });
    const conComentarios = (medios.data ?? []).filter((m) => (m.comments_count ?? 0) > 0 && ID_DE_INSTAGRAM.test(m.id));

    const resultados = await Promise.allSettled(
      conComentarios.map((m) =>
        this.instagram.graph<{ data?: IgComentario[] }>(businessId, SCOPE_COMENTAR, `${m.id}/comments`, {
          query: {
            fields: 'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}',
            limit: String(MAX_COMENTARIOS_POR_PUBLICACION),
          },
        }),
      ),
    );
    // Si todas fallaron por lo mismo (permiso, token), se informa el error en vez de mostrar una lista vacía.
    if (resultados.length > 0 && resultados.every((r) => r.status === 'rejected')) {
      throw (resultados[0] as PromiseRejectedResult).reason;
    }

    const publicaciones: PublicacionConComentarios[] = [];
    conComentarios.forEach((m, i) => {
      const r = resultados[i];
      if (r.status !== 'fulfilled') return;
      const comentarios = (r.value.data ?? []).map<ComentarioDePublicacion>((c) => ({
        ...aRespuesta(c),
        likes: c.like_count ?? 0,
        oculto: c.hidden === true,
        // Instagram devuelve las respuestas de la más nueva a la más vieja: se leen en orden de conversación.
        respuestas: (c.replies?.data ?? []).map(aRespuesta).reverse(),
      }));
      if (comentarios.length === 0) return;
      publicaciones.push({
        id: m.id,
        texto: m.caption ?? '',
        imagen: m.thumbnail_url ?? m.media_url ?? null,
        enlace: m.permalink ?? null,
        fecha: m.timestamp ?? null,
        totalComentarios: m.comments_count ?? comentarios.length,
        comentarios,
      });
    });
    const ocultadosAutomaticamente = await this.moderar(businessId, publicaciones);
    return { publicaciones, ocultadosAutomaticamente };
  }

  /** Oculta los comentarios con palabras prohibidas que todavía están a la vista. Mejor esfuerzo: nunca rompe la lista. */
  private async moderar(businessId: string, publicaciones: PublicacionConComentarios[]): Promise<number> {
    if (!this.ajustes) return 0;
    try {
      const { moderacion } = await this.ajustes.obtener(businessId);
      if (!moderacion.activa || moderacion.palabras.length === 0) return 0;
      const aOcultar = publicaciones
        .flatMap((p) => p.comentarios)
        .filter((c) => !c.oculto && tienePalabraProhibida(c.texto, moderacion.palabras))
        .slice(0, MAX_OCULTOS_POR_PASADA);
      const resultados = await Promise.allSettled(aOcultar.map((c) => this.ocultar(businessId, c.id, true)));
      let ocultados = 0;
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          aOcultar[i].oculto = true;
          ocultados++;
        } else {
          this.logger.warn(`No se pudo ocultar el comentario ${aOcultar[i].id}: ${describeError(r.reason)}`);
        }
      });
      return ocultados;
    } catch (e) {
      this.logger.warn(`Moderación de comentarios (negocio ${businessId}): ${describeError(e)}`);
      return 0;
    }
  }

  /** Disparo periódico: modera los negocios que tienen la moderación prendida, sin que nadie abra la pantalla. */
  async moderarTodos(): Promise<{ negocios: number; ocultados: number }> {
    if (!this.ajustes) return { negocios: 0, ocultados: 0 };
    const negocios = await this.ajustes.negociosConModeracion();
    let ocultados = 0;
    for (const { businessId } of negocios) {
      try {
        ocultados += (await this.listar(businessId)).ocultadosAutomaticamente;
      } catch (e) {
        this.logger.warn(`No se pudo moderar los comentarios del negocio ${businessId}: ${describeError(e)}`);
      }
    }
    return { negocios: negocios.length, ocultados };
  }

  async responder(businessId: string, comentarioId: string, texto: string): Promise<{ id: string }> {
    const id = this.idValido(comentarioId);
    const r = await this.instagram.graph<{ id?: string }>(businessId, SCOPE_COMENTAR, `${id}/replies`, {
      metodo: 'POST',
      cuerpo: { message: texto },
    });
    return { id: r.id ?? '' };
  }

  /** Oculta (o vuelve a mostrar) un comentario: quien lo escribió lo sigue viendo, el resto no. */
  async ocultar(businessId: string, comentarioId: string, oculto: boolean): Promise<{ id: string; oculto: boolean }> {
    const id = this.idValido(comentarioId);
    await this.instagram.graph(businessId, SCOPE_COMENTAR, id, { metodo: 'POST', query: { hide: String(oculto) } });
    return { id, oculto };
  }
}

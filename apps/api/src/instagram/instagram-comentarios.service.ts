import { BadRequestException, Injectable } from '@nestjs/common';
import { InstagramService, SCOPE_COMENTAR } from './instagram.service';

// Comentarios del kit de difusión: leer los comentarios de las últimas publicaciones del negocio,
// responderlos y ocultarlos (se puede deshacer). Borrar no se ofrece a propósito: no tiene vuelta atrás.
//
// Se leen al abrir la pantalla, no por aviso (webhook): Instagram recomienda los avisos para no pasarse del
// límite de llamadas, pero con pocas publicaciones y una pantalla que se abre a mano alcanza. Si el volumen
// crece, el siguiente paso es suscribir el campo `comments` del webhook.

const MAX_PUBLICACIONES = 8;
const MAX_COMENTARIOS_POR_PUBLICACION = 30;
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
  constructor(private readonly instagram: InstagramService) {}

  private idValido(id: string): string {
    if (!ID_DE_INSTAGRAM.test(id)) throw new BadRequestException('Comentario inválido');
    return id;
  }

  /** Los comentarios de las últimas publicaciones que tienen alguno, de la más nueva a la más vieja. */
  async listar(businessId: string): Promise<{ publicaciones: PublicacionConComentarios[] }> {
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
    return { publicaciones };
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

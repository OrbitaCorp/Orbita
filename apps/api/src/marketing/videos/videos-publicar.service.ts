import { BadGatewayException, ConflictException, Injectable } from '@nestjs/common';
import { InstagramMediosService } from '../../instagram/instagram-medios.service';
import { InstagramPublicacionesService } from '../../instagram/instagram-publicaciones.service';
import { InstagramContenidoService } from '../instagram-contenido.service';
import { TiktokService } from '../tiktok/tiktok.service';
import { MAX_BYTES_VIDEO, VideosService } from './videos.service';

// Pasar un video APROBADO de la cola a TikTok o a Instagram, con las integraciones que ya tiene Marketing (tokens
// guardados en la API: esto no se puede hacer desde la computadora de nadie). Siempre como BORRADOR y siempre por una
// persona: nada sale solo.
//  · TikTok: llega a los borradores de la cuenta y se termina en la app (publicar directo exige el formulario con las
//    reglas de su auditoría, que ya existe en Marketing → TikTok).
//  · Instagram: queda como borrador en Marketing → Instagram → Publicaciones, donde se publica o se programa.

@Injectable()
export class VideosPublicarService {
  constructor(
    private readonly videos: VideosService,
    private readonly tiktok: TiktokService,
    private readonly medios: InstagramMediosService,
    private readonly publicaciones: InstagramPublicacionesService,
    private readonly contenido: InstagramContenidoService,
  ) {}

  private async aprobado(id: string) {
    const v = await this.videos.obtener(id);
    if (v.tipo !== 'MARKETING') throw new ConflictException('Los tutoriales son internos: no se pasan a TikTok ni a Instagram');
    if (v.estado !== 'APROBADO' && v.estado !== 'PUBLICADO') throw new ConflictException('Primero hay que aprobar el video');
    return v;
  }

  async enBorradoresDeTiktok(adminId: string, id: string) {
    const v = await this.aprobado(id);
    const r = await this.tiktok.enviarABorradores(this.videos.urlPublica(v.ruta), adminId);
    const video = await this.videos.anotarPublicacion(adminId, id, 'tiktok', r.publishId);
    return { video, publicacion: r };
  }

  async enBorradorDeInstagram(adminId: string, id: string, caption?: string) {
    const v = await this.aprobado(id);
    const res = await fetch(this.videos.urlPublica(v.ruta), { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (!res?.ok) throw new BadGatewayException('No se pudo leer el video del almacenamiento');
    const datos = Buffer.from(await res.arrayBuffer());
    if (datos.length > MAX_BYTES_VIDEO) throw new ConflictException(`El video pesa más de ${MAX_BYTES_VIDEO / 1024 / 1024} MB`);
    const negocioId = await this.contenido.negocioId();
    const archivo = await this.medios.subirVideoDelServidor(negocioId, datos);
    const borrador = await this.publicaciones.guardarBorrador(negocioId, undefined, {
      caption: (caption ?? v.caption).slice(0, 2200),
      formato: 'vertical',
      items: [{ origen: 'subida', ref: archivo.ref, tipo: 'video' }],
    });
    const video = await this.videos.anotarPublicacion(adminId, id, 'instagram', borrador.id);
    return { video, publicacion: borrador };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { MensajeDeCliente } from '../orbi/atencion/estado';
import { describeError } from '../common/utils/describe-error.util';

/** Un comentario nuevo en una publicación de la cuenta conectada (webhook `comments`). */
export interface ComentarioNuevo {
  businessId: string;
  commentId: string;
  texto: string;
  /** Quién comentó (su id en Instagram, el mismo que usan los mensajes directos). */
  autorId: string;
  autorUsuario: string | null;
  mediaId: string | null;
}

/**
 * Quien atiende una cuenta de Instagram en lugar de Orbi. Hoy es el bot de ventas de Órbita en la cuenta de la empresa
 * (marketing/instagram-ventas): vive en MarketingModule, que ya importa este módulo, así que se registra acá en vez de
 * inyectarse (sería una dependencia circular).
 */
export interface AtencionAlternativa {
  atiende(businessId: string): Promise<boolean>;
  atender(mensajes: MensajeDeCliente[]): Promise<void>;
  atenderComentarios(comentarios: ComentarioNuevo[]): Promise<void>;
  /** Escribió una persona del equipo (desde la app de Instagram): el bot se calla en esa charla. */
  pausarPorPersona(businessId: string, conversationId: string): Promise<void>;
}

@Injectable()
export class InstagramRuteoService {
  private readonly logger = new Logger(InstagramRuteoService.name);
  private alternativa?: AtencionAlternativa;

  registrar(a: AtencionAlternativa) {
    this.alternativa = a;
  }

  /** Nunca tira: ante la duda atiende Orbi, como siempre. */
  async atiende(businessId: string): Promise<boolean> {
    if (!this.alternativa) return false;
    try {
      return await this.alternativa.atiende(businessId);
    } catch (e) {
      this.logger.warn(`No se pudo saber quién atiende el negocio ${businessId}: ${describeError(e)}`);
      return false;
    }
  }

  async atender(mensajes: MensajeDeCliente[]): Promise<void> {
    if (!this.alternativa || mensajes.length === 0) return;
    try {
      await this.alternativa.atender(mensajes);
    } catch (e) {
      this.logger.error(`El bot de ventas falló al atender: ${describeError(e)}`);
    }
  }

  async atenderComentarios(comentarios: ComentarioNuevo[]): Promise<void> {
    if (!this.alternativa || comentarios.length === 0) return;
    try {
      await this.alternativa.atenderComentarios(comentarios);
    } catch (e) {
      this.logger.error(`El bot de ventas falló con los comentarios: ${describeError(e)}`);
    }
  }

  async pausarPorPersona(businessId: string, conversationId: string): Promise<void> {
    if (!this.alternativa) return;
    try {
      await this.alternativa.pausarPorPersona(businessId, conversationId);
    } catch (e) {
      this.logger.warn(`No se pudo pausar el bot de ventas en ${conversationId}: ${describeError(e)}`);
    }
  }
}

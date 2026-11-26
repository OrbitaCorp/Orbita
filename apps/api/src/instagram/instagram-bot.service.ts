import { ConflictException, Inject, Injectable, Logger, Optional, UnprocessableEntityException } from '@nestjs/common';
import type { InstagramBotConfig } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from '../storefront/storefront.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LLM_ADAPTER_BOT, type LlmAdapter } from '../orbi/llm/llm-adapter.interface';
import { describeError } from '../common/utils/describe-error.util';
import { AtencionDeOrbi, type CambiosComunes, type EstadoComun, type FotoEnviada } from '../orbi/atencion/atencion-de-orbi';
import type { MensajeDeCliente } from '../orbi/atencion/estado';
import { ID_CAMBIAR, ID_CONFIRMAR, PedidosPorChatService } from '../orbi/atencion/pedidos';
import { MAX_CARACTERES_INSTAGRAM } from '../orbi/atencion/prompt';
import { InstagramMediosService } from './instagram-medios.service';
import { InstagramService } from './instagram.service';

// Orbi atiende los mensajes directos de Instagram (paquete Avanzado): lo mismo que en WhatsApp — contesta con los datos
// reales de la tienda, toma pedidos si el dueño lo encendió, deriva a una persona ante la duda y avisa — con el flujo
// compartido de orbi/atencion/atencion-de-orbi.ts. Acá queda lo de Instagram:
// - Sin menú de opciones: atiende en modo conversación.
// - Mensajes de hasta 1000 bytes, sin *negrita* (Instagram muestra los asteriscos).
// - La foto de un producto sale sola (Instagram no lleva texto con la foto): Orbi nombra el producto en su respuesta.
// - Confirmar o cambiar el pedido con respuestas rápidas; si Instagram no las acepta, el mismo resumen en texto.
// - Instagram solo deja escribirle al cliente dentro de las 24 h de su último mensaje. Orbi contesta en el momento (dentro
//   del plazo); a la persona que sigue la charla se lo recuerda el aviso.
// - Usa el mismo permiso de mensajes que la bandeja (instagram_business_manage_messages): mientras la app no pase la
//   revisión de Meta, anda solo con las cuentas que tienen un rol en la app, igual que la bandeja.

export type EstadoDeOrbiEnInstagram = EstadoComun;

/** Corta un texto para que entre en `maxBytes` de UTF-8 sin partir un carácter (los acentos y emojis ocupan más de uno). */
export function recortarABytes(texto: string, maxBytes: number): string {
  if (Buffer.byteLength(texto, 'utf8') <= maxBytes) return texto;
  let salida = '';
  let bytes = 0;
  for (const c of texto) {
    const b = Buffer.byteLength(c, 'utf8');
    if (bytes + b > maxBytes - 3) break;
    salida += c;
    bytes += b;
  }
  return `${salida.trimEnd()}…`;
}

/** El tope de Instagram para un mensaje de texto. */
const MAX_BYTES = 1000;

@Injectable()
export class InstagramBotService extends AtencionDeOrbi<InstagramBotConfig> {
  protected readonly logger = new Logger(InstagramBotService.name);
  protected readonly canal = 'INSTAGRAM' as const;

  constructor(
    prisma: PrismaService,
    config: ConfigService,
    private readonly instagram: InstagramService,
    private readonly medios: InstagramMediosService,
    storefront: StorefrontService,
    @Inject(LLM_ADAPTER_BOT) llm: Pick<LlmAdapter, 'streamChat'>,
    @Optional() pedidos?: PedidosPorChatService,
    @Optional() notificaciones?: NotificationsService,
  ) {
    super(prisma, config, storefront, llm, pedidos, notificaciones);
  }

  // ── Configuración del negocio (panel) ──────────────────────────────────────

  async estado(businessId: string): Promise<EstadoDeOrbiEnInstagram> {
    const cfg = await this.leerConfig(businessId);
    return this.estadoComun(businessId, cfg);
  }

  async guardar(businessId: string, dto: CambiosComunes): Promise<EstadoDeOrbiEnInstagram> {
    const data = await this.datosComunes(businessId, dto);
    await this.prisma.instagramBotConfig.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
    return this.estado(businessId);
  }

  /** Llamado por el webhook con los mensajes de clientes que acaban de entrar. Nunca tira: el webhook tiene que contestar 200. */
  async atender(mensajes: MensajeDeCliente[]): Promise<void> {
    await this.atenderTodos(mensajes);
  }

  // ── Lo propio del canal ────────────────────────────────────────────────────

  protected leerConfig(businessId: string) {
    return this.prisma.instagramBotConfig.findUnique({ where: { businessId } });
  }

  protected async estaConectado(businessId: string): Promise<boolean> {
    const conexion = await this.prisma.instagramConnection.findUnique({ where: { businessId }, select: { status: true } });
    return conexion?.status === 'ACTIVE';
  }

  protected enviarTexto(m: MensajeDeCliente, texto: string): Promise<string> {
    return this.instagram.enviarTexto(m.businessId, m.conversationId, m.destinatario, texto);
  }

  protected async enviarFoto(m: MensajeDeCliente, url: string, _pie: string): Promise<FotoEnviada | null> {
    // La foto se pasa a una dirección que Instagram pueda bajar (la misma preparación que "mandar un producto" de la bandeja).
    const publica = await this.medios.fotoDeProductoParaMensaje(m.businessId, url);
    const externalId = await this.instagram.enviarImagen(m.businessId, m.conversationId, m.destinatario, publica);
    // Se guarda como las fotos de la bandeja: la etiqueta "[Imagen]" (no se muestra) y el adjunto.
    return { externalId, url: publica, texto: '[Imagen]' };
  }

  protected resumenDelPedido(m: MensajeDeCliente, resumen: string) {
    // La indicación va siempre en el texto: así sirve también si Instagram no muestra los botones.
    const texto = recortarABytes(`${resumen}\n\nTocá un botón o respondé "sí" para confirmar o "cambiar" para modificarlo.`, MAX_BYTES);
    const enviar = async () => {
      try {
        return await this.instagram.enviarConRespuestasRapidas(m.businessId, m.conversationId, m.destinatario, texto, [
          { titulo: 'Confirmar pedido', payload: ID_CONFIRMAR },
          { titulo: 'Cambiar', payload: ID_CAMBIAR },
        ]);
      } catch (e) {
        // Ni el plazo de 24 h vencido ni una conexión caída se arreglan con texto; cualquier otro rechazo de los botones sí.
        if (e instanceof UnprocessableEntityException || e instanceof ConflictException) throw e;
        this.logger.warn(`Instagram no aceptó las respuestas rápidas del pedido en ${m.conversationId}; va en texto: ${describeError(e)}`);
        return this.instagram.enviarTexto(m.businessId, m.conversationId, m.destinatario, texto);
      }
    };
    return { texto, enviar };
  }

  protected linkDelChat(businessId: string, conversationId: string): string {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return `${frontend}/admin/${businessId}/ventas/difusion?vista=mensajes&charla=${conversationId}`;
  }

  protected maxCaracteres(): number {
    return MAX_CARACTERES_INSTAGRAM;
  }

  protected ajustarTexto(texto: string): string {
    return recortarABytes(texto, MAX_BYTES);
  }

  protected notaParaElDueno(): string {
    return '\nOjo: Instagram solo te deja responderle dentro de las 24 horas de su último mensaje.';
  }

  protected mostrarEscribiendo(m: MensajeDeCliente): Promise<void> {
    return this.instagram.mostrarEscribiendo(m.businessId, m.destinatario);
  }
}

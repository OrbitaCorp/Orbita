import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MENSAJE_IMAGEN_GRANDE } from '../utils/subida-imagen';
import { MENSAJE_VIDEO_GRANDE } from '../utils/subida-video';

// Forma mínima de la respuesta HTTP (evita depender de @types/express).
interface HttpResponseLike {
  status(code: number): { json(body: unknown): unknown };
}
interface HttpRequestLike {
  method?: string;
  url?: string;
}

/** La ruta sin el query: ahí viajan tokens y emails que no tienen que ir al log. */
export function rutaSinQuery(url?: string): string {
  return url ? url.split('?')[0] : '?';
}

/**
 * Da forma estándar a los errores: { error, statusCode, message? }.
 * (Ver "Errores" en CONTRATO_API.md.)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = 'INTERNAL_ERROR';
    let message: string | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = (body.message as string) ?? undefined;
        error = (body.error as string) ?? exception.name;
      }
      // El 413 que llega acá es el de multer al pasarse del tope configurado
      // (SUBIDA_IMAGEN o SUBIDA_VIDEO, según la ruta), con su texto en inglés
      // ("File too large") — se reemplaza por el mensaje en castellano con el
      // tope QUE CORRESPONDE: los dos endpoints tienen límites distintos (10
      // MB imagen, 40 MB video), así que no alcanza un mensaje único.
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        const request = ctx.getRequest<HttpRequestLike>();
        message = rutaSinQuery(request?.url).includes('/upload-video') ? MENSAJE_VIDEO_GRANDE : MENSAJE_IMAGEN_GRANDE;
      }
    } else {
      // Excepción NO controlada (no es un HttpException nuestro) — antes se
      // formateaba en silencio como {error:'INTERNAL_ERROR'} sin dejar
      // ningún rastro en los logs, haciendo imposible diagnosticar un 500
      // real (pasó con la subida de imágenes — el log de Railway no tenía
      // nada). Se loguea acá el stack completo, una sola vez, antes de
      // responder.
      const request = ctx.getRequest<HttpRequestLike>();
      this.logger.error(
        `Excepción no controlada en ${request?.method ?? '?'} ${rutaSinQuery(request?.url)}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({ error, statusCode: status, message });
  }
}

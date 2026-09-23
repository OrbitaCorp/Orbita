import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface GeminiGeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

// gemini-3.1-flash-lite-image ("Nano Banana 2 Lite"): probado en esta misma
// tarea contra Flash (gemini-3.1-flash-image) sobre el mismo producto — igual
// fidelidad de texto/logos, la mitad del costo por imagen. Es el motor del
// modo premium para productos 2D (planos) — ver ImageStudioService y el plan
// "Fondo con IA: pipeline 2D/3D".
const MODEL = 'gemini-3.1-flash-lite-image';

/**
 * Cliente Gemini para el modo premium de "Fondo con IA" (productos 2D). Clave
 * PROPIA (GEMINI_IMAGE_API_KEY), distinta de GEMINI_API_KEY (texto, Orbi/
 * ProductAiService) — probado: la key de texto del proyecto de producción no
 * tiene cuota para modelos de imagen (RESOURCE_EXHAUSTED en el free tier).
 * Deliberadamente sin retry/reintentos: a diferencia de Workers AI, no se
 * observó ningún falso positivo de filtro de contenido en las pruebas reales
 * (jersey con logos, indumentaria femenina ajustada) — si aparece un patrón
 * real, documentarlo acá antes de agregar reintentos especulativos.
 */
@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);

  constructor(private readonly config: ConfigService) {}

  private getClient(): GoogleGenAI {
    const apiKey = this.config.get<string>('GEMINI_IMAGE_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('La generación de imágenes con Gemini no está configurada en el servidor');
    return new GoogleGenAI({ apiKey });
  }

  /** Edita una imagen completa según una instrucción en texto (mismo contrato que CloudflareImageService.editImage()). */
  async editImage(prompt: string, image: Buffer, mimeType: string): Promise<GeminiGeneratedImage> {
    const ai = this.getClient();

    let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType, data: image.toString('base64') } }, { text: prompt }],
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Gemini (${MODEL}) — error de red o de API: ${error}`);
      throw new InternalServerErrorException('No se pudo generar la imagen. Probá de nuevo.');
    }

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      this.logger.error(`Gemini (${MODEL}) no devolvió una imagen. Partes: ${parts.map((p) => Object.keys(p)).join(', ')}`);
      throw new InternalServerErrorException('No se pudo generar la imagen. Probá de nuevo.');
    }

    return {
      buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    };
  }
}

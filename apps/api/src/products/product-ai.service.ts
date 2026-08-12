import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GenerateDescriptionDto } from './dto/generate-description.dto';

@Injectable()
export class ProductAiService {
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazy: si ANTHROPIC_API_KEY nunca se configura, el resto de la API sigue
  // funcionando sin problema — solo este endpoint queda inhabilitado.
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException('La generación de descripciones con IA no está configurada en el servidor');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async generateDescription(dto: GenerateDescriptionDto): Promise<string> {
    const client = this.getClient();

    const contexto: string[] = [`Nombre del producto: ${dto.name}`];
    if (dto.categoryName) contexto.push(`Categoría: ${dto.categoryName}`);
    if (dto.tags?.length) contexto.push(`Etiquetas: ${dto.tags.join(', ')}`);
    if (dto.existingDescription) contexto.push(`Borrador actual del vendedor: ${dto.existingDescription}`);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 500,
        output_config: { effort: 'low' },
        system:
          'Escribís descripciones de producto para la tienda online de un comercio en Argentina. ' +
          'Español rioplatense, tono cercano y directo, sin exclamaciones ni emojis. ' +
          '2 a 4 oraciones. Mencioná material o características típicas del tipo de producto solo si son razonables de inferir; ' +
          'no inventes datos técnicos específicos (medidas exactas, porcentajes de composición) que no te dieron. ' +
          'Devolvé SOLO el texto de la descripción, sin comillas ni títulos.',
        messages: [{ role: 'user', content: contexto.join('\n') }],
      });
    } catch {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    if (response.stop_reason === 'refusal') {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }

    const texto = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text?.trim();
    if (!texto) {
      throw new InternalServerErrorException('No se pudo generar la descripción. Probá de nuevo.');
    }
    return texto;
  }
}

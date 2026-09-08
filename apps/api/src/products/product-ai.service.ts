import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, type GoogleGenAI } from '@google/genai';
import { createGeminiClient, DEFAULT_MODEL } from '../orbi/llm/gemini-client';
import { CategoriesService, type CategoryListItem } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { AiAssistDto } from './dto/ai-assist.dto';

export interface AiAssistResult {
  description: string;
  suggestedCategoryId: string | null;
  suggestedTags: string[];
  // Especificaciones técnicas sugeridas ("RAM" -> "16GB") — solo cuando el
  // producto es de un rubro donde eso tiene sentido (electrónica, indumentaria
  // técnica, etc.); vacío si no aplica. Va siempre en la misma respuesta que
  // descripción/categoría/tags para no duplicar el llamado a Gemini — el
  // wizard del panel decide qué campos aplicar según desde qué botón se
  // llamó ("Generar con Orbi" de la info general, o el de especificaciones).
  suggestedSpecs: { label: string; value: string }[];
}

const SYSTEM_PROMPT =
  'Asistís a un vendedor que está cargando un producto en la tienda online de un comercio en Argentina. ' +
  'Con el nombre del producto (y opcionalmente un borrador de descripción, las categorías del negocio y sus ' +
  'etiquetas ya usadas), generás cuatro cosas:\n' +
  '1) Una descripción de producto: español rioplatense, tono cercano y directo, sin exclamaciones ni emojis, ' +
  '2 a 4 oraciones. Si el producto es reconocible (electrónica, indumentaria de marca, etc.) podés mencionar ' +
  'especificaciones técnicas reales que conozcas (capacidad, materiales, medidas). No inventes precios ni datos ' +
  'exclusivos de este negocio en particular.\n' +
  '2) Una categoría sugerida ("suggestedCategoryId"): elegí el id que mejor matchee de la lista de categorías ' +
  'dada, o null si ninguna encaja razonablemente. Nunca inventes un id que no esté en la lista.\n' +
  '3) Etiquetas sugeridas ("suggestedTags"): entre 2 y 5, cortas, en minúscula. Preferí reusar las etiquetas ya ' +
  'usadas por el negocio si aplican; si hace falta, sugerí alguna nueva.\n' +
  '4) Especificaciones técnicas sugeridas ("suggestedSpecs"): SOLO si el producto es de un rubro donde tiene ' +
  'sentido mostrar una ficha técnica real (electrónica, electrodomésticos, indumentaria técnica/deportiva, ' +
  'herramientas, etc.). Cuando aplique, sé generoso: apuntá a 10-15 pares {"label": "...", "value": "..."} ' +
  'cortos (ej. {"label": "RAM", "value": "16GB"}) cubriendo TODO lo que puedas inferir con confianza del ' +
  'nombre/descripción (dimensiones, peso, conectividad, materiales, garantía, etc. además de lo obvio) — nunca ' +
  'menos de 8 si el producto da para eso, en el orden más relevante primero. Si el producto no es de ese tipo ' +
  '(ropa sin ficha técnica, alimentos, artículos genéricos) o no hay información suficiente para no inventar de ' +
  'más, devolvé un array vacío — mejor vacío que datos inventados.\n' +
  'Devolvé SOLO un JSON con esta forma exacta, sin texto adicional ni markdown: ' +
  '{"description": "...", "suggestedCategoryId": "<id o null>", "suggestedTags": ["...", "..."], ' +
  '"suggestedSpecs": [{"label": "...", "value": "..."}]}';

@Injectable()
export class ProductAiService {
  private readonly logger = new Logger(ProductAiService.name);
  private client: GoogleGenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
  ) {}

  // Lazy: si GEMINI_API_KEY nunca se configura, el resto de la API sigue
  // funcionando sin problema — solo este endpoint queda inhabilitado.
  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = createGeminiClient(this.config);
    }
    return this.client;
  }

  private get modelo(): string {
    return this.config.get<string>('PRODUCT_AI_MODEL') ?? DEFAULT_MODEL;
  }

  async assist(businessId: string, dto: AiAssistDto): Promise<AiAssistResult> {
    const client = this.getClient();

    let categorias: CategoryListItem[];
    let tagsUsados: Awaited<ReturnType<TagsService['findAll']>>;
    try {
      [categorias, tagsUsados] = await Promise.all([
        this.categoriesService.findAll(businessId, true) as Promise<CategoryListItem[]>,
        this.tagsService.findAll(businessId),
      ]);
    } catch (error) {
      this.logger.error(`No se pudieron resolver categorías/etiquetas del negocio ${businessId} para Orbi: ${error}`);
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }

    const contexto: string[] = [`Nombre del producto: ${dto.name}`];
    if (dto.existingDescription) contexto.push(`Borrador actual del vendedor: ${dto.existingDescription}`);
    contexto.push(
      'Categorías del negocio (elegí un id de esta lista, o null si ninguna encaja):\n' +
        (categorias.map((c) => `${c.id}: ${c.name}`).join('\n') || '(el negocio no tiene categorías cargadas)'),
    );
    if (tagsUsados.length) {
      contexto.push(`Etiquetas ya usadas por el negocio (preferí reusarlas si aplican): ${tagsUsados.map((t) => t.name).join(', ')}`);
    }

    let raw: string | undefined;
    let finishReason: string | undefined;
    try {
      const response = await client.models.generateContent({
        model: this.modelo,
        contents: [{ role: 'user', parts: [{ text: contexto.join('\n') }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          // Antes de pedirle specs técnicas (además de descripción/categoría/
          // etiquetas) 800 alcanzaba de sobra. Ahora el prompt apunta a
          // 10-15 pares label/value — un JSON con esa cantidad + la descripción
          // ya pasa esos tokens y el modelo corta la respuesta a la mitad de un
          // objeto: responseMimeType JSON exige el objeto completo y bien
          // cerrado, cortado a la mitad ya no parsea. Esto se manifestaba como
          // "no se pudo generar con Orbi" — no un problema de generación, sino
          // de presupuesto de tokens.
          maxOutputTokens: 3000,
          responseMimeType: 'application/json',
          // Sin thinking: es una tarea estructurada y el razonamiento se comía
          // el presupuesto antes de cerrar el JSON (mismo síntoma que arriba).
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      raw = response.text?.trim();
      // 'MAX_TOKENS' = cortó por tocar el techo de maxOutputTokens.
      finishReason = response.candidates?.[0]?.finishReason;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      this.logger.error(`Gemini rechazó la generación de descripción (status ${status ?? 'desconocido'}): ${error}`);
      if (status === 401 || status === 403) {
        throw new ServiceUnavailableException('La generación con IA (Orbi) no está configurada correctamente en el servidor');
      }
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }

    if (!raw) {
      this.logger.error(`Gemini no devolvió contenido para Orbi (finish_reason=${finishReason ?? 'desconocido'})`);
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }

    // Defensa: algunos modelos envuelven el JSON en fences de markdown pese a
    // la instrucción de no hacerlo (```json ... ```).
    const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(limpio);
    } catch (error) {
      // finishReason 'MAX_TOKENS' = Gemini cortó la respuesta por tocar el techo
      // de maxOutputTokens, no porque el JSON esté mal armado — el log lo
      // distingue así la próxima vez se sabe de entrada que hay que subir el
      // presupuesto de tokens, sin tener que adivinar mirando el contenido.
      if (finishReason === 'MAX_TOKENS') {
        this.logger.error(`Orbi devolvió una respuesta cortada por maxOutputTokens — contenido: ${raw.slice(0, 500)}`);
      } else {
        this.logger.error(
          `Gemini devolvió algo que no es JSON válido para Orbi (finish_reason=${finishReason ?? 'desconocido'}): ${error} — contenido: ${raw.slice(0, 500)}`,
        );
      }
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }

    const result = parsed as Partial<AiAssistResult>;
    const description = typeof result.description === 'string' ? result.description.trim() : '';
    if (!description) {
      this.logger.error(`La respuesta JSON de Gemini no trae "description" válida: ${raw.slice(0, 500)}`);
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }

    const categoryIds = new Set(categorias.map((c) => c.id));
    const suggestedCategoryId =
      typeof result.suggestedCategoryId === 'string' && categoryIds.has(result.suggestedCategoryId)
        ? result.suggestedCategoryId
        : null;

    const suggestedTags = Array.isArray(result.suggestedTags)
      ? Array.from(
          new Set(
            result.suggestedTags
              .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
              .map((t) => t.trim().toLowerCase()),
          ),
        ).slice(0, 5)
      : [];

    // Mismo criterio defensivo que el resto: un modelo que devuelve algo con
    // otra forma no tira abajo el resto de la respuesta, esa parte queda vacía.
    const suggestedSpecs = Array.isArray(result.suggestedSpecs)
      ? result.suggestedSpecs
          .filter(
            (s): s is { label: string; value: string } =>
              typeof s === 'object' && s !== null &&
              typeof (s as Record<string, unknown>).label === 'string' && (s as Record<string, unknown>).label !== '' &&
              typeof (s as Record<string, unknown>).value === 'string' && (s as Record<string, unknown>).value !== '',
          )
          .map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) }))
          // El vendedor pidió poder llegar a 10+ specs sin que el sistema
          // las recorte de entrada — este techo es solo para blindarse de
          // un modelo desbocado, no una meta (el prompt ya apunta a 10-15).
          .slice(0, 20)
      : [];

    return { description, suggestedCategoryId, suggestedTags, suggestedSpecs };
  }
}

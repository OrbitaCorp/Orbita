import { BadRequestException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '@google/genai';
import { DEFAULT_MODEL, createGeminiClient, THINKING_MINIMO } from '../orbi/llm/gemini-client';
import { generarTexto } from '../orbi/llm/text-generation';
import { CategoriesService, type CategoryListItem } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { AiAssistDto } from './dto/ai-assist.dto';

export interface AiScanProductResult {
  name: string;
  description: string;
  suggestedCategoryId: string | null;
  suggestedTags: string[];
  suggestedSpecs: { label: string; value: string }[];
  detectedBrand?: string;
  detectedModel?: string;
  detectedColor?: string;
  imageSearchQuery?: string;
}

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

  constructor(
    private readonly config: ConfigService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
  ) {}

  private get modelo(): string {
    return this.config.get<string>('PRODUCT_AI_MODEL') ?? DEFAULT_MODEL;
  }

  async assist(businessId: string, dto: AiAssistDto): Promise<AiAssistResult> {
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
      // El prompt apunta a 10-15 pares label/value + descripción: 800 tokens de
      // salida no alcanzan y el JSON queda cortado a la mitad (ya no parsea).
      // 3000 deja margen. Si Gemini no está disponible, generarTexto cae a Groq.
      const r = await generarTexto(this.config, {
        system: SYSTEM_PROMPT,
        user: contexto.join('\n'),
        maxTokens: 3000,
        json: true,
        geminiModel: this.modelo,
      });
      raw = r.text;
      finishReason = r.finishReason; // 'MAX_TOKENS' = cortó por tope de tokens
    } catch (error) {
      // "GEMINI_API_KEY / GROQ_API_KEY no configurada" ya viene como 503 con
      // mensaje claro — se propaga tal cual.
      if (error instanceof ServiceUnavailableException) throw error;
      const status = error instanceof ApiError ? error.status : undefined;
      this.logger.error(`La generación con IA rechazó la descripción (status ${status ?? 'desconocido'}): ${error}`);
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

  async scanProductImage(businessId: string, file: Express.Multer.File): Promise<AiScanProductResult> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Falta la imagen a escanear');
    }

    let categorias: CategoryListItem[];
    let tagsUsados: Awaited<ReturnType<TagsService['findAll']>>;
    try {
      [categorias, tagsUsados] = await Promise.all([
        this.categoriesService.findAll(businessId, true) as Promise<CategoryListItem[]>,
        this.tagsService.findAll(businessId),
      ]);
    } catch (error) {
      this.logger.error(`No se pudieron resolver categorías/etiquetas del negocio ${businessId} para Orbi: ${error}`);
      throw new InternalServerErrorException('No se pudo escanear el producto con Orbi. Probá de nuevo.');
    }

    const client = createGeminiClient(this.config);

    const contexto: string[] = [
      'Categorías del negocio (elegí un id de esta lista para "suggestedCategoryId", o null si ninguna encaja):\n' +
        (categorias.map((c) => `${c.id}: ${c.name}`).join('\n') || '(el negocio no tiene categorías cargadas)'),
    ];
    if (tagsUsados.length) {
      contexto.push(`Etiquetas ya usadas por el negocio (preferí reusarlas si aplican): ${tagsUsados.map((t) => t.name).join(', ')}`);
    }

    const modelsToTry = Array.from(new Set(['gemini-3.6-flash', this.modelo, 'gemini-3.7-flash', 'gemini-3.8-flash']));
    const imageBase64 = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    let raw: string | undefined;
    let finishReason: string | undefined;

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                {
                  text: contexto.join('\n'),
                },
              ],
            },
          ],
          config: {
            systemInstruction: SCAN_SYSTEM_PROMPT,
            maxOutputTokens: 3000,
            thinkingConfig: { thinkingLevel: THINKING_MINIMO },
            responseMimeType: 'application/json',
          },
        });
        raw = response.text?.trim();
        finishReason = response.candidates?.[0]?.finishReason;
        if (raw) break;
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        const status = error instanceof ApiError ? error.status : undefined;
        this.logger.warn(`Modelo ${model} no pudo procesar la imagen (status ${status ?? 'desconocido'}): ${error}`);
        if (status === 401 || status === 403) {
          throw new ServiceUnavailableException('La generación con IA (Orbi) no está configurada correctamente en el servidor');
        }
        if (modelsToTry.indexOf(model) === modelsToTry.length - 1) {
          throw new InternalServerErrorException('No se pudo escanear el producto con Orbi. Probá de nuevo.');
        }
      }
    }

    if (!raw) {
      this.logger.error(`Gemini no devolvió contenido para el escaneo de producto (finish_reason=${finishReason ?? 'desconocido'})`);
      throw new InternalServerErrorException('No se pudo escanear el producto con Orbi. Probá de nuevo.');
    }

    const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(limpio);
    } catch (error) {
      this.logger.error(
        `Gemini devolvió algo que no es JSON válido para escaneo (finish_reason=${finishReason ?? 'desconocido'}): ${error} — contenido: ${raw.slice(0, 500)}`,
      );
      throw new InternalServerErrorException('No se pudo escanear el producto con Orbi. Probá de nuevo.');
    }

    const result = parsed as Partial<AiScanProductResult>;
    const name = typeof result.name === 'string' && result.name.trim() ? result.name.trim().slice(0, 80) : 'Producto escaneado';
    const description = typeof result.description === 'string' ? result.description.trim().slice(0, 2000) : '';

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

    const suggestedSpecs = Array.isArray(result.suggestedSpecs)
      ? result.suggestedSpecs
          .filter(
            (s): s is { label: string; value: string } =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as Record<string, unknown>).label === 'string' &&
              (s as Record<string, unknown>).label !== '' &&
              typeof (s as Record<string, unknown>).value === 'string' &&
              (s as Record<string, unknown>).value !== '',
          )
          .map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) }))
          .slice(0, 20)
      : [];

    const detectedBrand =
      (typeof result.detectedBrand === 'string' && result.detectedBrand.trim()
        ? result.detectedBrand.trim().slice(0, 80)
        : undefined) ||
      suggestedSpecs.find((s) => /marca|brand|fabricante/i.test(s.label))?.value;

    const detectedModel =
      (typeof result.detectedModel === 'string' && result.detectedModel.trim()
        ? result.detectedModel.trim().slice(0, 80)
        : undefined) ||
      suggestedSpecs.find((s) => /modelo|model|código|codigo|sku|referencia|reference/i.test(s.label))?.value;

    const detectedColor =
      (typeof result.detectedColor === 'string' && result.detectedColor.trim()
        ? result.detectedColor.trim().slice(0, 100)
        : undefined) ||
      suggestedSpecs.find((s) => /color|dial|acabado|esfera/i.test(s.label))?.value;

    const imageSearchQuery =
      typeof result.imageSearchQuery === 'string' && result.imageSearchQuery.trim()
        ? result.imageSearchQuery.trim().slice(0, 200)
        : undefined;

    return {
      name,
      description,
      suggestedCategoryId,
      suggestedTags,
      suggestedSpecs,
      ...(detectedBrand ? { detectedBrand } : {}),
      ...(detectedModel ? { detectedModel } : {}),
      ...(detectedColor ? { detectedColor } : {}),
      ...(imageSearchQuery ? { imageSearchQuery } : {}),
    };
  }
}

const SCAN_SYSTEM_PROMPT =
  'Asistís a un vendedor que está cargando un producto en la tienda online de su comercio en Argentina. ' +
  'Analizás la fotografía de un producto físico para identificarlo con máxima precisión comercial y ayudarlo a completar la ficha.\n' +
  'REGLA DE PRECISIÓN VISUAL CRÍTICA: ' +
  'Examiná minuciosamente acabados, materiales reales, geometría y esfera/pantalla: ' +
  '1) Distinguí materiales y geometrías específicas (ej. en relojería: caja de acero macizo con biseles cepillados y bordes pulidos vs resina plástica cromada; tipo de eslabón o malla milanesa). ' +
  '2) Inspeccioná la textura y color exacto del dial/fondo (ej. nácar / madreperla / mother-of-pearl, rayos de sol, textura mate) y la ubicación exacta de inscripciones y pantalla (positivo vs invertido). ' +
  '3) En familias de productos con variantes similares (ej. Casio Vintage: serie premium A1000 de acero macizo con nácar vs series A168/A158 de resina; zapatillas con múltiples colorways; modelos de smartphones), ' +
  'identificá la serie y el código de modelo/color comercial exacto (ej. A1000D-7, no A168).\n' +
  'Generás un JSON con los siguientes campos:\n' +
  '1) "name": Título de venta optimizado, claro y atractivo (Marca + Tipo de producto + Modelo específico con código de color o atributo clave, ' +
  'máximo 70 caracteres). Si identificás el modelo comercial exacto o SKU (ej. A1000D-7), incluilo en el nombre.\n' +
  '2) "description": Descripción comercial en español rioplatense, tono profesional y directo, sin exclamaciones ni emojis, ' +
  '2 a 4 oraciones destacando los atributos reales visibles en la foto (materiales, acabado, estilo, dial).\n' +
  '3) "suggestedCategoryId": el id que mejor coincida de la lista de categorías del negocio provista, o null si ninguna encaja.\n' +
  '4) "suggestedTags": entre 2 y 5 etiquetas cortas en minúscula (marca, tipo de producto, estilo, material).\n' +
  '5) "detectedBrand": Marca detectada si es visible o identificable (ej. "Casio").\n' +
  '6) "detectedModel": Modelo comercial exacto o SKU con variante de color (ej. "A1000D-7").\n' +
  '7) "detectedColor": Color principal, acabado y tipo de dial visible (ej. "Plateado con dial nácar blanco / mother of pearl").\n' +
  '8) "imageSearchQuery": Frase de búsqueda ultra-específica para Google Imágenes que encuentre fotos oficiales idénticas de estudio de este modelo y color exacto (Marca + Modelo exacto/SKU + palabras clave de color/dial en inglés y español, ej. "Casio A1000D-7 mother of pearl silver stainless steel watch").\n' +
  '9) "suggestedSpecs": Array de objetos {"label": "...", "value": "..."}. ' +
  'REGLA CRÍTICA PARA ESPECIFICACIONES: ' +
  'SOLO si el producto es de un rubro que utiliza ficha técnica (relojes, electrónica, tecnología, herramientas, electrodomésticos, accesorios mecánicos, óptica), ' +
  'extraé entre 6 y 14 especificaciones técnicas reales (Marca, Modelo con SKU específico, Material de caja, Malla, Color del dial, Pantalla, Resistencia al agua, etc.). ' +
  'Si el producto es indumentaria / ropa común (remera, buzo, pollera, short básico, pantalón, campera básica) o artículos simples sin ficha técnica, ' +
  'devolvé un array vacío [] porque la ropa no suele llevar tabla de especificaciones técnicas.\n' +
  'Devolvé ÚNICAMENTE un JSON válido con la siguiente estructura: ' +
  '{"name": "...", "description": "...", "suggestedCategoryId": "<id o null>", "suggestedTags": ["..."], "detectedBrand": "...", "detectedModel": "...", "detectedColor": "...", "imageSearchQuery": "...", "suggestedSpecs": [{"label": "...", "value": "..."}]}';

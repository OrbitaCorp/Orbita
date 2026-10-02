import { BadRequestException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, ThinkingLevel } from '@google/genai';
import { DEFAULT_MODEL, createGeminiClient, THINKING_MINIMO } from '../orbi/llm/gemini-client';
import { generarTexto } from '../orbi/llm/text-generation';
import { createGroqClient, GROQ_MAX_IMAGE_BASE64, GROQ_VISION_MODEL } from '../orbi/llm/groq-client';
import { esErrorDeDisponibilidad } from '../orbi/llm/llm-errors';
import { CategoriesService, type CategoryListItem } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import { AiAssistDto } from './dto/ai-assist.dto';
import { AiVariantsDto } from './dto/ai-variants.dto';

// Una opción de variante sugerida para ESTE producto (ej. Almacenamiento con
// 128 GB / 256 GB / 512 GB). `values` son las que se ofrecen; `usual` las más
// habituales entre ellas. El panel las muestra como sugerencias, nunca las
// tilda solas.
export interface SuggestedVariantOption {
  name: string;
  values: string[];
  usual: string[];
}

export interface AiScanProductResult {
  name: string;
  description: string;
  suggestedCategoryId: string | null;
  suggestedTags: string[];
  suggestedSpecs: { label: string; value: string }[];
  suggestedVariants: SuggestedVariantOption[];
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
  // llamó ("Redactar con Orbi" de la info general, o el de especificaciones).
  suggestedSpecs: { label: string; value: string }[];
}

// Vocabulario común a los dos prompts (asistente por nombre y escaneo por foto):
// qué es una opción de variante y cómo se devuelve. El modelo del rubro que
// eligió el negocio NO entra acá a propósito — una tienda de ropa que vende un
// celular tiene que recibir Almacenamiento/Color, no Talle.
const VARIANTES_PROMPT =
  'Opciones de variante sugeridas ("suggestedVariants"): las opciones en las que ESTE producto realmente se vende ' +
  'en distintas versiones, pensando en el producto en sí y no en el rubro del negocio (celular: Almacenamiento y ' +
  'Color; zapatilla: Número y Color; remera: Talle y Color; perfume: Tamaño; sillón: Color). Máximo 3 opciones, ' +
  'cada una {"name": "...", "values": [...], "usual": [...]}: "values" con entre 2 y 12 valores típicos del ' +
  'mercado argentino, del más común al menos común, cortos y como se escriben ahí (ej. "128 GB", "S", "42", ' +
  '"Negro"); "usual" con los 2 a 5 más comunes de esa lista. Para colores, si conocés el modelo listá solo los ' +
  'que existen de verdad (ej. iPhone 16 Pro: Titanio negro, Titanio blanco, Titanio natural, Titanio desierto); si ' +
  'no los conocés, no inventes: dejá esa opción afuera. Si el producto no suele venir en versiones (un libro, ' +
  'una pieza única, un servicio), devolvé un array vacío.';

// Pedido propio de variantes (POST /products/ai-variants): corto y sin el resto
// de la ficha, para que se pueda mandar a un modelo más barato (ver
// generarTexto) sin arrastrar descripción, categorías ni etiquetas.
const VARIANTES_SYSTEM_PROMPT =
  'Asistís a un vendedor que está cargando un producto en la tienda online de un comercio en Argentina. ' +
  'Con el nombre del producto (y opcionalmente su descripción) sugerís las opciones de variante.\n' +
  VARIANTES_PROMPT + '\n' +
  'Devolvé SOLO un JSON con esta forma exacta, sin texto adicional ni markdown: ' +
  '{"suggestedVariants": [{"name": "...", "values": ["..."], "usual": ["..."]}]}';

// Un modelo que devuelve algo con otra forma no tira abajo el resto de la
// respuesta: esta parte queda vacía. Tope de 3 opciones y de 12 valores por
// opción; `usual` solo puede contener valores que estén en `values`.
export function sanitizarVariantesSugeridas(raw: unknown): SuggestedVariantOption[] {
  if (!Array.isArray(raw)) return [];
  const limpiar = (v: unknown): string[] =>
    Array.isArray(v)
      ? Array.from(
          new Set(
            v
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim().slice(0, 30))
              .filter((x) => x.length > 0),
          ),
        )
      : [];

  const out: SuggestedVariantOption[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, 30) : '';
    const values = limpiar(rec.values).slice(0, 12);
    if (!name || values.length < 2) continue;
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    const usual = limpiar(rec.usual).filter((x) => values.includes(x)).slice(0, 6);
    out.push({ name, values, usual });
    if (out.length === 3) break;
  }
  return out;
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
    private readonly usageMetering: UsageMeteringService,
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

    // El prompt apunta a 10-15 pares label/value + descripción: 800 tokens de
    // salida no alcanzan y el JSON queda cortado a la mitad (ya no parsea).
    // 3000 deja margen. Si Gemini no está disponible, generarTexto cae a Groq.
    const parsed = await this.pedirJson(businessId, 'ai-assist', {
      system: SYSTEM_PROMPT,
      user: contexto.join('\n'),
      maxTokens: 3000,
    });

    const result = parsed as Partial<AiAssistResult>;
    const description = typeof result.description === 'string' ? result.description.trim() : '';
    if (!description) {
      this.logger.error(`La respuesta JSON de Gemini no trae "description" válida: ${JSON.stringify(parsed).slice(0, 500)}`);
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

  // Opciones de variante para ESTE producto, pedidas por separado (botón
  // "Sugerir opciones con Orbi"). Corto a propósito: no genera descripción,
  // categoría ni ficha.
  async suggestVariants(businessId: string, dto: AiVariantsDto): Promise<{ suggestedVariants: SuggestedVariantOption[] }> {
    const contexto: string[] = [`Nombre del producto: ${dto.name}`];
    if (dto.description) contexto.push(`Descripción: ${dto.description}`);

    // 1500 y no 300: si cae a Groq (razonamiento "low") los tokens de razonamiento
    // cuentan contra el tope y un margen justo deja el JSON cortado.
    const parsed = await this.pedirJson(businessId, 'ai-variants', {
      system: VARIANTES_SYSTEM_PROMPT,
      user: contexto.join('\n'),
      maxTokens: 1500,
    });
    const bruto = typeof parsed === 'object' && parsed !== null ? (parsed as { suggestedVariants?: unknown }).suggestedVariants : undefined;
    return { suggestedVariants: sanitizarVariantesSugeridas(bruto) };
  }

  // Llama al modelo y devuelve el JSON ya parseado. Centraliza lo que toda ayuda de
  // IA de producto necesita: el mapeo de errores (503 si la IA no está bien
  // configurada, 500 el resto), el log según el motivo del corte y el registro del
  // consumo por función (ver registrarUso).
  private async pedirJson(
    businessId: string,
    feature: string,
    opts: { system: string; user: string; maxTokens: number },
  ): Promise<unknown> {
    let raw: string | undefined;
    let finishReason: string | undefined;
    try {
      const r = await generarTexto(this.config, { ...opts, json: true, geminiModel: this.modelo });
      raw = r.text;
      finishReason = r.finishReason; // 'MAX_TOKENS' = cortó por tope de tokens
      this.registrarUso(businessId, feature, r);
    } catch (error) {
      // "GEMINI_API_KEY / GROQ_API_KEY no configurada" ya viene como 503 con
      // mensaje claro — se propaga tal cual.
      if (error instanceof ServiceUnavailableException) throw error;
      const status = error instanceof ApiError ? error.status : undefined;
      this.logger.error(`La generación con IA rechazó el pedido "${feature}" (status ${status ?? 'desconocido'}): ${error}`);
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
    try {
      return JSON.parse(limpio);
    } catch (error) {
      // finishReason 'MAX_TOKENS' = el modelo cortó la respuesta por tocar el techo
      // de tokens, no porque el JSON esté mal armado — el log lo distingue así la
      // próxima vez se sabe de entrada que hay que subir el presupuesto.
      if (finishReason === 'MAX_TOKENS') {
        this.logger.error(`Orbi devolvió una respuesta cortada por maxOutputTokens — contenido: ${raw.slice(0, 500)}`);
      } else {
        this.logger.error(
          `Gemini devolvió algo que no es JSON válido para Orbi (finish_reason=${finishReason ?? 'desconocido'}): ${error} — contenido: ${raw.slice(0, 500)}`,
        );
      }
      throw new InternalServerErrorException('No se pudo generar con Orbi. Probá de nuevo.');
    }
  }

  // Registra el consumo de IA de esta llamada en usage_events (el panel de costos
  // del superadmin lo agrega por proveedor). `metadata.feature` dice QUÉ ayuda lo
  // gastó (ai-assist, ai-variants, ai-scan) y `metadata.model` con qué modelo
  // respondió de verdad — la categoría queda en prompt/completion_tokens para que
  // el cálculo de costo por token de InternalCostAdapter lo tome igual que el
  // chat de Orbi. Sin await: no demora la respuesta, y track() ya atrapa sus
  // propios errores.
  private registrarUso(
    businessId: string,
    feature: string,
    uso: { provider?: 'gemini' | 'groq'; model?: string; promptTokens?: number; completionTokens?: number; viaFallback?: boolean },
  ): void {
    // Sin consumo informado no se inventa un 0: se promediaría como llamada gratis.
    if (!uso.provider || !uso.promptTokens) return;
    const metadata = { feature, model: uso.model, ...(uso.viaFallback ? { viaFallback: true } : {}) };
    void this.usageMetering.track({
      providerSlug: uso.provider, businessId, category: 'prompt_tokens', quantity: uso.promptTokens, unit: 'tokens', metadata,
    });
    void this.usageMetering.track({
      providerSlug: uso.provider, businessId, category: 'completion_tokens', quantity: uso.completionTokens ?? 0, unit: 'tokens', metadata,
    });
  }

  // Escaneo de respaldo con el modelo de visión de Groq. Devuelve el JSON ya
  // parseado o null si no pudo (el llamador sigue con su manejo de error normal:
  // este camino nunca agrega un error nuevo).
  private async escanearConGroq(businessId: string, contexto: string, imageBase64: string, mimeType: string): Promise<unknown> {
    if (imageBase64.length > GROQ_MAX_IMAGE_BASE64) {
      this.logger.warn('El escaneo no puede caer a Groq: la imagen supera el máximo de 4 MB en base64');
      return null;
    }
    this.logger.warn('Todos los modelos Gemini del escaneo están no disponibles; escaneando con Groq');
    try {
      const response = await createGroqClient(this.config).chat.completions.create({
        model: GROQ_VISION_MODEL,
        // Groq rechaza el pedido entero (429 "request too large") si la salida esperada
        // supera los 1000 tokens/min de la cuenta; una ficha típica usa 300-600.
        max_completion_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SCAN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: contexto },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      });
      this.registrarUso(businessId, 'ai-scan', {
        provider: 'groq',
        model: GROQ_VISION_MODEL,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        viaFallback: true,
      });
      const candidato = intentarParsearJsonScan(response.choices[0]?.message?.content?.trim() ?? '');
      return candidato && typeof candidato === 'object' && ('name' in candidato || 'description' in candidato) ? candidato : null;
    } catch (error) {
      this.logger.error(`El escaneo con Groq (${GROQ_VISION_MODEL}) también falló: ${error}`);
      return null;
    }
  }

  async scanProductImage(businessId: string, file: Express.Multer.File): Promise<AiScanProductResult> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Falta la imagen a escanear');
    }

    let categorias: CategoryListItem[] = [];
    let tagsUsados: Awaited<ReturnType<TagsService['findAll']>> = [];
    try {
      [categorias, tagsUsados] = await Promise.all([
        this.categoriesService.findAll(businessId, true) as Promise<CategoryListItem[]>,
        this.tagsService.findAll(businessId),
      ]);
    } catch (error) {
      this.logger.warn(`No se pudieron resolver categorías/etiquetas del negocio ${businessId} para Orbi: ${error}`);
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
    let parsed: unknown = null;
    // Cuántos modelos Gemini fallaron por indisponibilidad (429/5xx/red): si fueron
    // todos, se prueba con Groq (ver abajo).
    let fallosDeDisponibilidad = 0;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
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
            // 8192 tokens para que el thinking de Gemini 3.x no consuma el presupuesto y corte el JSON
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingLevel: (model.includes('3.7') || model.includes('3.8')) ? ThinkingLevel.LOW : THINKING_MINIMO },
            responseMimeType: 'application/json',
          },
        });
        const uso = response.usageMetadata;
        this.registrarUso(businessId, 'ai-scan', {
          provider: 'gemini',
          model,
          promptTokens: uso?.promptTokenCount ?? undefined,
          completionTokens: uso ? (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0) : undefined,
        });
        raw = response.text?.trim();
        finishReason = response.candidates?.[0]?.finishReason;
        if (raw) {
          const candidato = intentarParsearJsonScan(raw);
          if (candidato && typeof candidato === 'object' && ('name' in candidato || 'description' in candidato)) {
            parsed = candidato;
            break;
          }
        }
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        const status = error instanceof ApiError ? error.status : undefined;
        this.logger.warn(`Modelo ${model} no pudo procesar la imagen (status ${status ?? 'desconocido'}): ${error}`);
        if (status === 401 || status === 403) {
          throw new ServiceUnavailableException('La generación con IA (Orbi) no está configurada correctamente en el servidor');
        }
        if (esErrorDeDisponibilidad(error)) fallosDeDisponibilidad++;
        // Si falló por límite de cuota o rate limit (429/503), esperar 600ms antes del siguiente modelo
        if (status === 429 || status === 503) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    // Último recurso: Gemini está caído en TODOS sus modelos (no si contestó algo
    // que no se pudo leer: eso no es indisponibilidad). Solo con GROQ_API_KEY.
    if (!parsed && fallosDeDisponibilidad === modelsToTry.length && this.config.get<string>('GROQ_API_KEY')) {
      parsed = await this.escanearConGroq(businessId, contexto.join('\n'), imageBase64, mimeType);
    }

    if (!parsed) {
      if (raw) {
        parsed = intentarParsearJsonScan(raw);
      }
      if (!parsed) {
        this.logger.error(
          `Gemini no devolvió JSON válido para el escaneo de producto (finish_reason=${finishReason ?? 'desconocido'}): contenido=${raw?.slice(0, 500) ?? 'vacío'}`,
        );
        throw new InternalServerErrorException('No se pudo escanear el producto con Orbi. Probá de nuevo.');
      }
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
      suggestedVariants: sanitizarVariantesSugeridas(result.suggestedVariants),
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
  '10) ' + VARIANTES_PROMPT + '\n' +
  'Devolvé ÚNICAMENTE un JSON válido con la siguiente estructura: ' +
  '{"name": "...", "description": "...", "suggestedCategoryId": "<id o null>", "suggestedTags": ["..."], "detectedBrand": "...", "detectedModel": "...", "detectedColor": "...", "imageSearchQuery": "...", "suggestedSpecs": [{"label": "...", "value": "..."}], "suggestedVariants": [{"name": "...", "values": ["..."], "usual": ["..."]}]}';

function intentarParsearJsonScan(raw: string): unknown {
  const limpio = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    return repararJsonIncompleto(limpio);
  }
}

function repararJsonIncompleto(str: string): unknown {
  let s = str.trim().replace(/,\s*$/, '');
  let inString = false;
  let escape = false;
  const stack: ('{' | '[')[] = [];

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' && stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      } else if (char === ']' && stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
  }

  if (inString) {
    s += '"';
  }

  s = s.replace(/,\s*$/, '');

  while (stack.length > 0) {
    const top = stack.pop();
    if (top === '{') s += '}';
    else if (top === '[') s += ']';
  }

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}


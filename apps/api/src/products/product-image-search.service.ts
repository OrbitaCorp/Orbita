import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import { CostsService } from '../platform/costs/costs.service';

export interface SuggestedImage {
  url: string;
  title: string;
  sourceUrl?: string;
  domain?: string;
  provider: 'serper' | 'tavily' | 'duckduckgo';
}

function normalizeAlphaNum(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractDomain(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isPrivateIpOrLocal(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return true;
    }
    // Rangos privados IPv4
    if (
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

@Injectable()
export class ProductImageSearchService {
  private readonly logger = new Logger(ProductImageSearchService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usageMetering: UsageMeteringService,
    private readonly costsService: CostsService,
  ) {}

  async searchSuggestedImages(params: {
    query: string;
    model?: string;
    brand?: string;
    color?: string;
    businessId?: string;
  }): Promise<SuggestedImage[]> {
    const cleanQuery = (params.query || '').trim();
    if (!cleanQuery) return [];

    // Determinar el modelo / SKU objetivo para el filtro estricto
    let targetModel = params.model ? normalizeAlphaNum(params.model) : '';
    if (!targetModel || targetModel.length < 3) {
      // Intentar extraer token alfanumérico específico del query (ej. KW89J205Y)
      const tokens = cleanQuery.split(/[\s,.-]+/);
      const skuToken = tokens.find(
        (t) => t.length >= 4 && /[a-z]/i.test(t) && /\d/.test(t),
      );
      if (skuToken) {
        targetModel = normalizeAlphaNum(skuToken);
      }
    }

    // Regla estricta: si no hay un modelo o SKU verificable, no sugerir imágenes
    // para evitar falsos positivos en indumentaria o productos genéricos.
    if (!targetModel || targetModel.length < 3) {
      this.logger.log(
        `Búsqueda de imágenes omitida: no se detectó modelo/SKU estricto en "${cleanQuery}"`,
      );
      return [];
    }

    // Construir consulta optimizada incluyendo marca y modelo exacto si no estaban presentes
    let searchQuery = cleanQuery;
    if (params.model && !cleanQuery.toLowerCase().includes(params.model.toLowerCase())) {
      searchQuery = `${params.brand || ''} ${params.model} ${cleanQuery}`.trim();
    }

    // ─── Prioridad 1: Serper.dev (Google Images) ──────────────────────────
    const serperKey = this.config.get<string>('SERPER_API_KEY');
    if (serperKey) {
      try {
        const serperResults = await this.searchSerper(searchQuery, serperKey, params.businessId);
        const filtered = this.filterStrict(serperResults, targetModel, params.color);
        if (filtered.length > 0) {
          this.logger.log(`Serper devolvió ${filtered.length} fotos con coincidencia estricta para "${targetModel}"`);
          return filtered.slice(0, 3);
        }
      } catch (err) {
        this.logger.warn(`Error en búsqueda Serper, continuando con siguiente proveedor: ${err}`);
      }
    }

    // ─── Prioridad 2: Tavily Search ───────────────────────────────────────
    const tavilyKey = this.config.get<string>('TAVILY_API_KEY');
    if (tavilyKey) {
      try {
        const tavilyResults = await this.searchTavily(searchQuery, tavilyKey, params.businessId);
        const filtered = this.filterStrict(tavilyResults, targetModel, params.color);
        if (filtered.length > 0) {
          this.logger.log(`Tavily devolvió ${filtered.length} fotos con coincidencia estricta para "${targetModel}"`);
          return filtered.slice(0, 3);
        }
      } catch (err) {
        this.logger.warn(`Error en búsqueda Tavily, continuando con fallback gratuito: ${err}`);
      }
    }

    // ─── Prioridad 3: DuckDuckGo Fallback ($0, sin key) ───────────────────
    try {
      const ddgResults = await this.searchDuckDuckGo(searchQuery);
      const filtered = this.filterStrict(ddgResults, targetModel, params.color);
      if (filtered.length > 0) {
        this.logger.log(`DuckDuckGo devolvió ${filtered.length} fotos con coincidencia estricta para "${targetModel}"`);
        return filtered.slice(0, 3);
      }
    } catch (err) {
      this.logger.warn(`Error en búsqueda DuckDuckGo fallback: ${err}`);
    }

    return [];
  }

  private filterStrict(
    candidates: SuggestedImage[],
    targetModel: string,
    color?: string,
  ): SuggestedImage[] {
    const seenUrls = new Set<string>();
    const seenDomains = new Set<string>();
    const matches: Array<{ item: SuggestedImage; score: number }> = [];

    // Tokens de color y acabado para priorizar variantes exactas (ej. nácar / pearl / blanco)
    const colorTokens = color
      ? color
          .toLowerCase()
          .replace(/[^a-z0-9áéíóúüñ]/g, ' ')
          .split(/\s+/)
          .filter(
            (t) =>
              t.length >= 3 &&
              !['con', 'del', 'los', 'las', 'una', 'dial', 'color', 'malla', 'fondo', 'reloj', 'watch'].includes(t),
          )
      : [];

    // Si el targetModel es muy específico (ej. a1000d7), también obtener el modelo base (ej. a1000)
    const baseModel = targetModel.length >= 6 ? targetModel.slice(0, 5) : '';

    for (const item of candidates) {
      if (!item.url || seenUrls.has(item.url)) continue;

      const normTitle = normalizeAlphaNum(item.title || '');
      const normSource = normalizeAlphaNum(item.sourceUrl || '');
      const normImgUrl = normalizeAlphaNum(item.url || '');
      const fullTextLower = `${item.title || ''} ${item.sourceUrl || ''} ${item.url || ''}`.toLowerCase();

      // El modelo / SKU debe coincidir en título, link de la página o link de la foto
      const isExactMatch =
        normTitle.includes(targetModel) ||
        normSource.includes(targetModel) ||
        normImgUrl.includes(targetModel);

      const isBaseMatch =
        baseModel &&
        (normTitle.includes(baseModel) ||
          normSource.includes(baseModel) ||
          normImgUrl.includes(baseModel));

      if (isExactMatch || isBaseMatch) {
        seenUrls.add(item.url);

        let score = isExactMatch ? 20 : 10;
        // Si coincide con el SKU completo en la URL de la imagen (suele ser foto oficial de fábrica)
        if (normImgUrl.includes(targetModel)) score += 10;
        // Si el dominio es oficial de la marca
        if (item.domain && (item.domain.includes('casio') || item.domain.includes('official'))) score += 5;

        // Bonificación por coincidencia de color/dial
        if (colorTokens.length > 0) {
          let colorHits = 0;
          for (const token of colorTokens) {
            if (fullTextLower.includes(token)) colorHits++;
          }
          score += colorHits * 5;
        }

        matches.push({ item, score });
      }
    }

    // Ordenar de mayor a menor relevancia
    matches.sort((a, b) => b.score - a.score);

    const result: SuggestedImage[] = [];
    for (const { item } of matches) {
      const domain = item.domain || extractDomain(item.url);
      if (domain && seenDomains.has(domain) && matches.length > 3) {
        // Diversificar tienda si ya tenemos una de este dominio
        continue;
      }
      if (domain) seenDomains.add(domain);
      result.push(item);
    }

    return result;
  }

  private async searchSerper(
    query: string,
    apiKey: string,
    businessId?: string,
  ): Promise<SuggestedImage[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      const res = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          gl: 'ar',
          hl: 'es',
          num: 15,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 402 || res.status === 429) {
          await this.costsService.reportQuotaExceeded(
            'serper',
            `Límite de créditos alcanzado o key inválida (HTTP ${res.status}): ${errorText.slice(0, 120)}`,
          );
          await this.usageMetering.track({
            providerSlug: 'serper',
            businessId,
            category: 'quota_exceeded',
            quantity: 1,
            unit: 'errors',
            metadata: { status: res.status, error: errorText.slice(0, 300) },
          });
        } else {
          await this.usageMetering.track({
            providerSlug: 'serper',
            businessId,
            category: 'search_error',
            quantity: 1,
            unit: 'errors',
            metadata: { status: res.status, error: errorText.slice(0, 300) },
          });
        }
        throw new Error(`Serper respondió con HTTP ${res.status}: ${errorText}`);
      }

      // Registro exitoso de consumo
      await this.usageMetering.track({
        providerSlug: 'serper',
        businessId,
        category: 'search_query',
        quantity: 1,
        unit: 'queries',
        estimatedCostUsd: 0.001,
      });

      const data = (await res.json()) as {
        images?: Array<{
          title?: string;
          imageUrl?: string;
          link?: string;
          domain?: string;
        }>;
      };

      if (!Array.isArray(data.images)) return [];

      return data.images
        .filter((img) => img.imageUrl && typeof img.imageUrl === 'string')
        .map((img) => ({
          url: img.imageUrl!,
          title: img.title || '',
          sourceUrl: img.link || '',
          domain: img.domain || extractDomain(img.link || img.imageUrl!),
          provider: 'serper' as const,
        }));
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private async searchTavily(
    query: string,
    apiKey: string,
    businessId?: string,
  ): Promise<SuggestedImage[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          include_images: true,
          search_depth: 'basic',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 402 || res.status === 429) {
          await this.costsService.reportQuotaExceeded(
            'tavily',
            `Límite de créditos alcanzado o key inválida (HTTP ${res.status}): ${errorText.slice(0, 120)}`,
          );
          await this.usageMetering.track({
            providerSlug: 'tavily',
            businessId,
            category: 'quota_exceeded',
            quantity: 1,
            unit: 'errors',
            metadata: { status: res.status, error: errorText.slice(0, 300) },
          });
        } else {
          await this.usageMetering.track({
            providerSlug: 'tavily',
            businessId,
            category: 'search_error',
            quantity: 1,
            unit: 'errors',
            metadata: { status: res.status, error: errorText.slice(0, 300) },
          });
        }
        throw new Error(`Tavily respondió con HTTP ${res.status}: ${errorText}`);
      }

      await this.usageMetering.track({
        providerSlug: 'tavily',
        businessId,
        category: 'search_query',
        quantity: 1,
        unit: 'queries',
        estimatedCostUsd: 0.008,
      });

      const data = (await res.json()) as {
        images?: string[];
        results?: Array<{
          title?: string;
          url?: string;
        }>;
      };

      const images = Array.isArray(data.images) ? data.images : [];
      const results = Array.isArray(data.results) ? data.results : [];

      return images.map((imgUrl) => {
        // Encontrar resultado que comparta dominio o coincida
        const imgDomain = extractDomain(imgUrl);
        const matchResult = results.find(
          (r) => r.url && (r.url.includes(imgUrl) || (imgDomain && r.url.includes(imgDomain))),
        );
        return {
          url: imgUrl,
          title: matchResult?.title || '',
          sourceUrl: matchResult?.url || imgUrl,
          domain: imgDomain || (matchResult?.url ? extractDomain(matchResult.url) : ''),
          provider: 'tavily' as const,
        };
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private async searchDuckDuckGo(query: string): Promise<SuggestedImage[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      // Paso 1: Obtener token VQD
      const pageRes = await fetch(
        `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        },
      );

      const html = await pageRes.text();
      const vqdMatch =
        html.match(/vqd=([0-9-]+)/) || html.match(/vqd=['"]?([0-9-]+)['"]?/);

      if (!vqdMatch || !vqdMatch[1]) {
        throw new Error('No se pudo obtener token VQD de DuckDuckGo');
      }

      const vqd = vqdMatch[1];

      // Paso 2: Consultar endpoint i.js de imágenes
      const imgRes = await fetch(
        `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://duckduckgo.com/',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!imgRes.ok) {
        throw new Error(`DuckDuckGo i.js respondió con HTTP ${imgRes.status}`);
      }

      const data = (await imgRes.json()) as {
        results?: Array<{
          title?: string;
          image?: string;
          url?: string;
        }>;
      };

      if (!Array.isArray(data.results)) return [];

      return data.results
        .filter((r) => r.image && typeof r.image === 'string')
        .map((r) => ({
          url: r.image!,
          title: r.title || '',
          sourceUrl: r.url || '',
          domain: extractDomain(r.url || r.image!),
          provider: 'duckduckgo' as const,
        }));
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async proxyImage(imageUrl: string): Promise<{
    dataUrl: string;
    mimeType: string;
    size: number;
    originalUrl: string;
  }> {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new BadRequestException('Falta la URL de la imagen');
    }

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      throw new BadRequestException('URL inválida, debe comenzar con http:// o https://');
    }

    if (isPrivateIpOrLocal(imageUrl)) {
      throw new BadRequestException('No se permite descargar imágenes de redes privadas o locales');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(imageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new BadRequestException(`No se pudo descargar la imagen (${res.status})`);
      }

      const contentType = res.headers.get('content-type')?.split(';')[0]?.toLowerCase() || '';
      if (!contentType.startsWith('image/')) {
        throw new BadRequestException(`El recurso descargado no es una imagen válida (${contentType || 'desconocido'})`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Límite de 10MB
      if (buffer.length > 10 * 1024 * 1024) {
        throw new BadRequestException('La imagen supera el límite permitido de 10MB');
      }

      const mimeType = contentType === 'image/*' ? 'image/jpeg' : contentType;
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        dataUrl,
        mimeType,
        size: buffer.length,
        originalUrl: imageUrl,
      };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Error al obtener la imagen externa: ${(err as Error).message}`);
    }
  }
}

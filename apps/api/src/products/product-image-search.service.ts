import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { UsageMeteringService } from '../platform/costs/usage-metering.service';
import { CostsService } from '../platform/costs/costs.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { escaparHtml } from '../common/utils/html';

export interface SuggestedImage {
  url: string;
  title: string;
  sourceUrl?: string;
  domain?: string;
  provider: 'serper' | 'tavily' | 'duckduckgo';
  /** Miniatura de Google (gstatic), para mostrar opciones en el panel sin pedirle la foto al sitio de origen. Solo Serper. */
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

/** Lo que se sabe de un producto cargado por nombre (Importar Excel → paso Fotos). */
export interface ProductoParaFotoWeb {
  name: string;
  category?: string | null;
  /** Rubro del negocio ("Indumentaria"). */
  industry?: string | null;
  /** Valor de la variante visual cuando se buscan las fotos de un color ("Negro"). */
  variant?: string | null;
}

// Opciones que se le muestran a la persona por producto: la sugerida y hasta 5
// más para "Ver otras". Salen de UNA búsqueda (Serper devuelve 15), así que
// mostrar más no cuesta más.
export const MAX_FOTOS_CATALOGO = 6;
const MIN_LADO_PX = 250;
const MAX_REDIRECCIONES = 3;
const MAX_BYTES_FOTO = 10 * 1024 * 1024;
// SVG no: no es una foto y sharp lo renderiza (otro intérprete más).
const TIPOS_FOTO = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const NAVEGADOR_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Palabras que no ayudan a encontrar ni a reconocer la foto.
const PALABRAS_VACIAS = new Set([
  'con', 'sin', 'para', 'por', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'que', 'and', 'the', 'for', 'with',
]);
// Categorías y rubros que no dicen qué es el producto.
const CATEGORIAS_VACIAS = new Set(['general', 'otros', 'otro', 'otra', 'varios', 'sin categoria', 'productos', 'producto', 'todo']);

/** Minúsculas, sin acentos y sin signos: "Remera Básica!" → "remera basica". */
export function textoPlano(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function palabrasClave(str: string): string[] {
  return [...new Set(textoPlano(str).split(' ').filter((t) => t.length >= 3 && !PALABRAS_VACIAS.has(t)))];
}

/**
 * La frase que se busca en Google Imágenes para un producto del que solo se
 * sabe el nombre. El nombre manda; la variante ("Negro") se suma si no está, y
 * la categoría y el rubro solo cuando el nombre es corto y puede ser ambiguo
 * ("Bandolera" sola trae de todo; "Bandolera Carteras" ya no).
 */
export function fraseParaCatalogo(p: ProductoParaFotoWeb): string {
  const nombre = (p.name || '').trim().replace(/\s+/g, ' ');
  if (!nombre) return '';
  const plano = ` ${textoPlano(nombre)} `;
  const sirve = (t?: string | null): t is string =>
    !!t && !!textoPlano(t) && !CATEGORIAS_VACIAS.has(textoPlano(t)) && !plano.includes(` ${textoPlano(t)} `);

  const partes = [nombre];
  if (sirve(p.variant)) partes.push(p.variant.trim());
  const palabras = nombre.split(' ').length;
  // El rubro es más vago que la categoría: entra solo si no hay una que sirva.
  if (palabras <= 4 && sirve(p.category)) partes.push(p.category.trim());
  else if (palabras < 3 && sirve(p.industry)) partes.push(p.industry.trim());
  return partes.join(' ').slice(0, 200);
}

/**
 * Ordena los resultados de una búsqueda por nombre. A diferencia del filtro
 * estricto del escaneo (que exige el modelo), acá no se descarta por falta de
 * coincidencia: la persona mira cada foto antes de guardarla. Se descartan las
 * que no sirven como foto de producto (chicas, muy apaisadas, SVG) y se suben
 * las que nombran el producto y la variante.
 */
export function ordenarParaCatalogo(candidatos: SuggestedImage[], p: ProductoParaFotoWeb): SuggestedImage[] {
  const claves = palabrasClave(p.name || '');
  const variante = p.variant ? palabrasClave(p.variant) : [];
  const vistas = new Set<string>();
  const puntuados: Array<{ item: SuggestedImage; puntaje: number; orden: number }> = [];

  candidatos.forEach((item, orden) => {
    if (!item.url || !/^https?:\/\//i.test(item.url) || vistas.has(item.url)) return;
    if (/\.svg(\?|$)/i.test(item.url)) return;
    if (item.width && item.height) {
      if (item.width < MIN_LADO_PX || item.height < MIN_LADO_PX) return;
      const proporcion = item.width / item.height;
      if (proporcion > 2.2 || proporcion < 0.45) return; // banners y tiras
    }
    vistas.add(item.url);
    const texto = ` ${textoPlano(`${item.title || ''} ${item.sourceUrl || ''} ${item.url}`)} `;
    let puntaje = 0;
    for (const t of claves) if (texto.includes(t)) puntaje += 2;
    for (const t of variante) if (texto.includes(t)) puntaje += 3;
    if (item.width && item.height && Math.min(item.width, item.height) >= 600) puntaje += 1;
    puntuados.push({ item, puntaje, orden });
  });

  // Mayor puntaje primero; a igual puntaje, el orden de Google.
  puntuados.sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden);

  // Como mucho dos por sitio, para que "Ver otras" muestre opciones distintas.
  const porDominio = new Map<string, number>();
  const resultado: SuggestedImage[] = [];
  for (const { item } of puntuados) {
    const dominio = item.domain || extractDomain(item.url);
    const n = porDominio.get(dominio) ?? 0;
    if (dominio && n >= 2) continue;
    porDominio.set(dominio, n + 1);
    resultado.push(item);
    if (resultado.length >= MAX_FOTOS_CATALOGO) break;
  }
  return resultado;
}

/** IP privada, de loopback, link-local, CGNAT o reservada (v4 o v6). Lo que no es una IP cuenta como privado. */
export function esIpPrivada(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapeada = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return esIpPrivada(mapeada[1]);
    return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true;
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

  // Aviso a soporte cuando un proveedor de pago deja de andar: como hay
  // fallback a DuckDuckGo, la búsqueda "sigue andando" y nadie se entera de que
  // la key venció o se acabaron los créditos. Un mail por proveedor cada 12 h.
  private static readonly SOPORTE_EMAIL = 'soporte@orbita.site';
  private static readonly AVISO_COOLDOWN_MS = 12 * 60 * 60 * 1000;
  private readonly ultimoAviso = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly usageMetering: UsageMeteringService,
    private readonly costsService: CostsService,
    private readonly mail?: MailService,
    private readonly prisma?: PrismaService,
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

    return this.buscarEnProveedores(
      searchQuery,
      params.businessId,
      (candidatos) => this.filterStrict(candidatos, targetModel, params.color),
      3,
    );
  }

  /**
   * Fotos para un producto del que solo se sabe el nombre (Importar Excel →
   * paso Fotos). Sin el filtro estricto del escaneo, que exige un modelo o
   * SKU: "Remera oversize negra" no tiene, y la persona confirma cada foto
   * antes de que se guarde. Una sola búsqueda por llamada.
   */
  async searchCatalogImages(p: ProductoParaFotoWeb & { businessId?: string }): Promise<SuggestedImage[]> {
    const frase = fraseParaCatalogo(p);
    if (!frase) return [];
    return this.buscarEnProveedores(frase, p.businessId, (candidatos) => ordenarParaCatalogo(candidatos, p), MAX_FOTOS_CATALOGO);
  }

  // Serper (Google Imágenes) → Tavily → DuckDuckGo ($0, sin key). Pasa al
  // siguiente si el proveedor falla o si `filtrar` no deja ninguna foto.
  private async buscarEnProveedores(
    query: string,
    businessId: string | undefined,
    filtrar: (candidatos: SuggestedImage[]) => SuggestedImage[],
    max: number,
  ): Promise<SuggestedImage[]> {
    const serperKey = this.config.get<string>('SERPER_API_KEY');
    if (serperKey) {
      try {
        const filtradas = filtrar(await this.searchSerper(query, serperKey, businessId));
        if (filtradas.length > 0) {
          this.logger.log(`Serper devolvió ${filtradas.length} fotos para "${query}"`);
          return filtradas.slice(0, max);
        }
      } catch (err) {
        this.logger.warn(`Error en búsqueda Serper, continuando con siguiente proveedor: ${err}`);
        void this.avisarProveedorCaido('Serper', err);
      }
    }

    const tavilyKey = this.config.get<string>('TAVILY_API_KEY');
    if (tavilyKey) {
      try {
        const filtradas = filtrar(await this.searchTavily(query, tavilyKey, businessId));
        if (filtradas.length > 0) {
          this.logger.log(`Tavily devolvió ${filtradas.length} fotos para "${query}"`);
          return filtradas.slice(0, max);
        }
      } catch (err) {
        this.logger.warn(`Error en búsqueda Tavily, continuando con fallback gratuito: ${err}`);
        void this.avisarProveedorCaido('Tavily', err);
      }
    }

    try {
      const filtradas = filtrar(await this.searchDuckDuckGo(query));
      if (filtradas.length > 0) {
        this.logger.log(`DuckDuckGo devolvió ${filtradas.length} fotos para "${query}"`);
        return filtradas.slice(0, max);
      }
    } catch (err) {
      this.logger.warn(`Error en búsqueda DuckDuckGo fallback: ${err}`);
    }

    return [];
  }

  // Nunca tira: un fallo al avisar no puede romper la búsqueda de fotos. El
  // anti-repetición mira email_logs (sobrevive a reinicios y a varias
  // instancias de Cloud Run) además del mapa en memoria, que cubre las
  // búsquedas simultáneas que fallan a la vez.
  private async avisarProveedorCaido(proveedor: 'Serper' | 'Tavily', err: unknown): Promise<void> {
    try {
      if (!this.mail) return;
      const ahora = Date.now();
      const previo = this.ultimoAviso.get(proveedor);
      if (previo && ahora - previo < ProductImageSearchService.AVISO_COOLDOWN_MS) return;
      this.ultimoAviso.set(proveedor, ahora);

      const asunto = `Búsqueda de fotos: ${proveedor} dejó de funcionar`;
      if (this.prisma) {
        const reciente = await this.prisma.emailLog.findFirst({
          where: {
            to: ProductImageSearchService.SOPORTE_EMAIL,
            subject: asunto,
            status: { not: 'FAILED' },
            createdAt: { gte: new Date(ahora - ProductImageSearchService.AVISO_COOLDOWN_MS) },
          },
          select: { id: true },
        });
        if (reciente) return;
      }

      const detalle = escaparHtml(String(err instanceof Error ? err.message : err).slice(0, 400));
      const cuerpo =
        `<p>La búsqueda de fotos de catálogo (alta y edición de productos) falló con <b>${proveedor}</b>. ` +
        `Mientras tanto usa el siguiente proveedor y, si no queda ninguno, DuckDuckGo, que encuentra menos fotos.</p>` +
        `<p>Puede ser que la key venció o es inválida, que se acabaron los créditos o que el servicio esté caído.</p>` +
        `<p><b>Detalle:</b> ${detalle}</p>` +
        `<p>Este aviso se manda como máximo una vez cada 12 horas por proveedor.</p>`;
      await this.mail.sendCustomEmail(ProductImageSearchService.SOPORTE_EMAIL, asunto, cuerpo);
    } catch (e) {
      this.logger.warn(`No se pudo avisar a soporte que ${proveedor} falló: ${e}`);
    }
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
          thumbnailUrl?: string;
          imageWidth?: number;
          imageHeight?: number;
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
          ...(img.thumbnailUrl ? { thumbnailUrl: img.thumbnailUrl } : {}),
          ...(img.imageWidth && img.imageHeight ? { width: img.imageWidth, height: img.imageHeight } : {}),
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

  /**
   * Baja una foto de la web desde el servidor (para el "proxy" del alta y para
   * guardar una sugerida como foto del producto). La URL la elige el panel, así
   * que se cuida que no sirva para llegar a la red interna de Cloud Run (el
   * servidor de metadatos, por ejemplo): se rechazan los hosts locales, la IP a
   * la que resuelve el nombre y cada redirección, que se sigue a mano.
   */
  async descargarImagen(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new BadRequestException('Falta la URL de la imagen');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      let url = imageUrl;
      let res: Response | null = null;
      for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
        await this.validarDestino(url);
        res = await fetch(url, {
          headers: {
            'User-Agent': NAVEGADOR_UA,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
          redirect: 'manual',
          signal: controller.signal,
        });
        const destino = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!destino) break;
        if (salto === MAX_REDIRECCIONES) throw new BadRequestException('La imagen redirige demasiadas veces');
        url = new URL(destino, url).toString();
      }

      if (!res || !res.ok) {
        throw new BadRequestException(`No se pudo descargar la imagen (${res?.status ?? 'sin respuesta'})`);
      }

      const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
      if (contentType !== 'image/*' && !TIPOS_FOTO.has(contentType)) {
        throw new BadRequestException(`El recurso descargado no es una foto válida (${contentType || 'desconocido'})`);
      }
      const declarado = Number(res.headers.get('content-length') || 0);
      if (declarado > MAX_BYTES_FOTO) {
        throw new BadRequestException('La imagen supera el límite permitido de 10MB');
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_BYTES_FOTO) {
        throw new BadRequestException('La imagen supera el límite permitido de 10MB');
      }
      if (buffer.length === 0) throw new BadRequestException('La imagen descargada está vacía');

      const mimeType = contentType === 'image/*' || contentType === 'image/jpg' ? 'image/jpeg' : contentType;
      return { buffer, mimeType };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Error al obtener la imagen externa: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async validarDestino(rawUrl: string): Promise<void> {
    let u: URL;
    try {
      u = new URL(rawUrl);
    } catch {
      throw new BadRequestException('URL inválida');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException('URL inválida, debe comenzar con http:// o https://');
    }
    if (isPrivateIpOrLocal(rawUrl)) {
      throw new BadRequestException('No se permite descargar imágenes de redes privadas o locales');
    }
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const ips = await this.resolverHost(host);
    if (ips.length === 0 || ips.some(esIpPrivada)) {
      throw new BadRequestException('No se permite descargar imágenes de redes privadas o locales');
    }
  }

  // Aparte para que los tests no dependan del DNS.
  protected async resolverHost(host: string): Promise<string[]> {
    if (isIP(host)) return [host];
    try {
      return (await lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new BadRequestException('No se encontró el sitio de la imagen');
    }
  }

  async proxyImage(imageUrl: string): Promise<{
    dataUrl: string;
    mimeType: string;
    size: number;
    originalUrl: string;
  }> {
    const { buffer, mimeType } = await this.descargarImagen(imageUrl);
    return {
      dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      mimeType,
      size: buffer.length,
      originalUrl: imageUrl,
    };
  }
}

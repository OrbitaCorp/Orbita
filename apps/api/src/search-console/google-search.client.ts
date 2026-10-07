import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth, Impersonated } from 'google-auth-library';

// Las dos APIs de Google que usa Órbita para que las tiendas aparezcan en el
// buscador: Site Verification (probar que el dominio es nuestro) y Search
// Console (enviar el sitemap y leer cómo le va a cada tienda en Google).
//
// SIN CLAVES, a propósito: la organización tiene prohibido crear claves de
// cuentas de servicio (política `iam.disableServiceAccountKeyCreation`). La API
// corre en Cloud Run con su propia cuenta y, con ese permiso, SUPLANTA a la
// cuenta `search-console@orbita-api-corp` pidiendo un token con los alcances
// que hacen falta (ver DEPLOYMENT.md). Nada secreto vive en el repo ni en
// Secret Manager. Localmente (y en los tests) `SEARCH_CONSOLE_SERVICE_ACCOUNT`
// no está definida y todo este módulo queda apagado sin romper nada.

const ALCANCES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/siteverification',
];
const TIMEOUT_MS = 12_000;

export class GoogleApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export type FiltroPagina = { dimension: 'page'; operator: 'contains' | 'equals'; expression: string };
export type FilaRendimiento = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type ResultadoInspeccion = {
  veredicto: string | null;
  estado: string | null;
  ultimoRastreo: string | null;
  canonicalGoogle: string | null;
  robots: string | null;
};

@Injectable()
export class GoogleSearchClient {
  private readonly logger = new Logger(GoogleSearchClient.name);
  private suplantada?: Impersonated;

  constructor(private readonly config: ConfigService) {}

  /** La cuenta de servicio a suplantar, o null si esto no está configurado (local, tests). */
  get cuentaDeServicio(): string | null {
    return this.config.get<string>('SEARCH_CONSOLE_SERVICE_ACCOUNT')?.trim() || null;
  }

  habilitado(): boolean {
    return this.cuentaDeServicio !== null;
  }

  private async token(): Promise<string> {
    const cuenta = this.cuentaDeServicio;
    if (!cuenta) throw new Error('SEARCH_CONSOLE_SERVICE_ACCOUNT no está configurada');
    if (!this.suplantada) {
      // Las credenciales por defecto de Cloud Run (su cuenta de servicio), con el
      // alcance mínimo para pedirle a IAM que firme un token de la otra cuenta.
      const origen = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
      this.suplantada = new Impersonated({
        sourceClient: origen,
        targetPrincipal: cuenta,
        delegates: [],
        targetScopes: ALCANCES,
        lifetime: 3600,
      });
    }
    // La librería guarda el token y lo renueva sola poco antes de que venza.
    const { token } = await this.suplantada.getAccessToken();
    if (!token) throw new Error('Google no devolvió un token para la cuenta de servicio');
    return token;
  }

  private async llamar<T>(metodo: 'GET' | 'POST' | 'PUT', url: string, cuerpo?: unknown): Promise<T> {
    const token = await this.token();
    const r = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const texto = await r.text();
    if (!r.ok) {
      let mensaje = texto;
      try {
        mensaje = (JSON.parse(texto) as { error?: { message?: string } }).error?.message ?? texto;
      } catch {
        /* no era JSON */
      }
      throw new GoogleApiError(r.status, mensaje.slice(0, 300));
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  // ── Site Verification ──────────────────────────────────────────────────

  /**
   * El contenido de la etiqueta `<meta name="google-site-verification">` que
   * prueba que somos dueños del sitio. Es siempre el mismo para el mismo sitio y
   * la misma cuenta de servicio, así que se puede volver a pedir sin problema.
   */
  async pedirTokenMeta(sitio: string): Promise<string> {
    const r = await this.llamar<{ token?: string }>('POST', 'https://www.googleapis.com/siteVerification/v1/token', {
      site: { type: 'SITE', identifier: sitio },
      verificationMethod: 'META',
    });
    // Google devuelve la etiqueta entera; en la base y en el HTML solo va el contenido.
    const contenido = /content="([^"]+)"/.exec(r.token ?? '')?.[1];
    if (!contenido || !/^[A-Za-z0-9_-]{20,128}$/.test(contenido)) {
      throw new Error('Google devolvió un token de verificación con un formato inesperado');
    }
    return contenido;
  }

  /** Le pide a Google que mire la etiqueta en la portada. Falla si todavía no está publicada. */
  async verificarPorMeta(sitio: string): Promise<void> {
    await this.llamar('POST', 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=META', {
      site: { type: 'SITE', identifier: sitio },
    });
  }

  // ── Search Console ─────────────────────────────────────────────────────

  async agregarSitio(sitio: string): Promise<void> {
    await this.llamar('PUT', `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}`);
  }

  async enviarSitemap(sitio: string, sitemap: string): Promise<void> {
    await this.llamar(
      'PUT',
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/sitemaps/${encodeURIComponent(sitemap)}`,
    );
  }

  /** Clics, impresiones, CTR y posición. Sin `dimensiones` devuelve una sola fila con el total. */
  async rendimiento(
    sitio: string,
    desde: string,
    hasta: string,
    opciones: { dimensiones?: ('query' | 'page' | 'date')[]; filtro?: FiltroPagina; limite?: number } = {},
  ): Promise<FilaRendimiento[]> {
    const r = await this.llamar<{ rows?: FilaRendimiento[] }>(
      'POST',
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(sitio)}/searchAnalytics/query`,
      {
        startDate: desde,
        endDate: hasta,
        dimensions: opciones.dimensiones ?? [],
        rowLimit: opciones.limite ?? 10,
        ...(opciones.filtro ? { dimensionFilterGroups: [{ filters: [opciones.filtro] }] } : {}),
      },
    );
    return r.rows ?? [];
  }

  /** Lo que Google sabe de una URL: si está en el índice, cuándo la visitó, qué canonical eligió. */
  async inspeccionar(url: string, sitio: string): Promise<ResultadoInspeccion> {
    const r = await this.llamar<{
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          lastCrawlTime?: string;
          googleCanonical?: string;
          robotsTxtState?: string;
        };
      };
    }>('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      inspectionUrl: url,
      siteUrl: sitio,
      languageCode: 'es-419',
    });
    const i = r.inspectionResult?.indexStatusResult;
    return {
      veredicto: i?.verdict ?? null,
      estado: i?.coverageState ?? null,
      ultimoRastreo: i?.lastCrawlTime ?? null,
      canonicalGoogle: i?.googleCanonical ?? null,
      robots: i?.robotsTxtState ?? null,
    };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { describeError } from '../common/utils/describe-error.util';
import { GoogleApiError, GoogleSearchClient, type ResultadoInspeccion } from './google-search.client';

// Que cada tienda aparezca en Google sin que el comerciante haga nada.
//
//   · Tienda en un subdominio (slug.orbita.site): Google ya la cubre con la
//     propiedad de DOMINIO orbita.site (verificada una vez, a mano, y con la
//     cuenta de servicio agregada como usuario). Acá solo hay que enviarle su
//     sitemap.
//   · Tienda con dominio propio (tefaltacalleok.com): es OTRO dominio, así que
//     necesita su propia propiedad. Se verifica sola con una etiqueta <meta> que
//     Órbita sirve en la portada (la devuelve /storefront/:slug/seo, ver
//     StorefrontService#seoDe y SeoHead.tsx), y después se le envía el sitemap.
//
// Todo es "mejor esfuerzo": si Google no responde o la cuenta no tiene permiso,
// se anota el motivo y la tienda sigue funcionando igual. Nada de esto es
// necesario para que Google rastree la tienda por su cuenta; lo que agrega es
// avisarle del sitemap y poder ver cómo le va a cada tienda.

const DOMINIO_RAIZ = 'orbita.site';
const PROPIEDAD_DE_ORBITA = `sc-domain:${DOMINIO_RAIZ}`;
const ESPERA_ENTRE_INTENTOS_MS = 60_000;
const REENVIO_SITEMAP_MS = 7 * 24 * 3_600_000;
const DIAS_DE_DATOS = 28;
const DIAS_DE_RETRASO = 2; // Search Console publica los datos con ~2 días de demora

export type EstadoDominio = 'no_configurado' | 'inactivo' | 'pendiente' | 'verificado';

export type ResumenGoogle = {
  configurado: boolean;
  /** Por qué no hay datos (cuenta sin permiso, dominio sin verificar todavía, etc.). */
  aviso: string | null;
  propiedad: string | null;
  origen: string | null;
  dominioPropio: { domain: string; estado: 'PENDIENTE' | 'VERIFICADO'; error: string | null; sitemapEnviadoAt: Date | null } | null;
  sitemapSubdominioAt: Date | null;
  periodo: { desde: string; hasta: string } | null;
  rendimiento: { clics: number; impresiones: number; ctr: number; posicion: number } | null;
  consultas: { consulta: string; clics: number; impresiones: number; posicion: number }[];
  paginas: { url: string; clics: number; impresiones: number }[];
  inicio: ResultadoInspeccion | null;
  errores: string[];
};

/** Lo que sirve de un error de Google para el superadmin: corto y accionable. */
export function explicarErrorDeGoogle(e: unknown): string {
  if (e instanceof GoogleApiError) {
    if (e.status === 403) return 'Google dice que la cuenta de Órbita no tiene permiso sobre esa propiedad en Search Console.';
    if (e.status === 429) return 'Google pidió esperar (límite de consultas). Se vuelve a intentar más tarde.';
    return `Google respondió ${e.status}: ${e.message}`.slice(0, 280);
  }
  return describeError(e).slice(0, 280);
}

const fechaISO = (d: Date) => d.toISOString().slice(0, 10);

// ── Lo que ve el dueño de la tienda (Inicio del panel → Métricas avanzadas) ──

type Totales = { clics: number; impresiones: number; ctr: number; posicion: number };

/** Lo que el dueño puede ver de Google: solo de su tienda y sin detalles técnicos de nuestra conexión. */
export type ResumenParaDueno =
  | { disponible: false; motivo: 'conectando' | 'no_disponible' }
  | {
      disponible: true;
      periodo: { desde: string; hasta: string };
      rendimiento: Totales | null;
      /** El período anterior de igual largo, para mostrar cuánto subió o bajó. */
      anterior: Totales | null;
      consultas: { consulta: string; clics: number; impresiones: number; posicion: number }[];
      paginas: { ruta: string; clics: number; impresiones: number }[];
      /** ¿La portada está en el índice de Google? null = no se pudo saber. */
      portadaEnGoogle: boolean | null;
    };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;
const MAX_DIAS = 90;
const TTL_DUENO_MS = 10 * 60_000;

/**
 * El período que se le pide a Google: el mismo que el selector del panel, pero sin pasar de
 * hace 2 días (Search Console todavía no publicó nada más reciente) ni de 90 días, y con
 * el período anterior de igual largo pegado atrás para comparar.
 */
export function periodoParaGoogle(from: string | undefined, to: string | undefined, ahora: Date) {
  const dia = (iso: string) => new Date(iso + 'T00:00:00Z');
  const tope = dia(fechaISO(new Date(ahora.getTime() - DIAS_DE_RETRASO * DIA_MS)));
  let hasta = to && ISO.test(to) ? dia(to) : tope;
  if (Number.isNaN(hasta.getTime()) || hasta > tope) hasta = tope;
  let desde = from && ISO.test(from) ? dia(from) : new Date(hasta.getTime() - (DIAS_DE_DATOS - 1) * DIA_MS);
  if (Number.isNaN(desde.getTime()) || desde > hasta) desde = new Date(hasta.getTime() - (DIAS_DE_DATOS - 1) * DIA_MS);
  if (hasta.getTime() - desde.getTime() > (MAX_DIAS - 1) * DIA_MS) desde = new Date(hasta.getTime() - (MAX_DIAS - 1) * DIA_MS);
  const dias = Math.round((hasta.getTime() - desde.getTime()) / DIA_MS) + 1;
  const anteriorHasta = new Date(desde.getTime() - DIA_MS);
  const anteriorDesde = new Date(anteriorHasta.getTime() - (dias - 1) * DIA_MS);
  return {
    desde: fechaISO(desde), hasta: fechaISO(hasta),
    anteriorDesde: fechaISO(anteriorDesde), anteriorHasta: fechaISO(anteriorHasta),
  };
}

@Injectable()
export class SearchConsoleService {
  private readonly logger = new Logger(SearchConsoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleSearchClient,
  ) {}

  habilitado() {
    return this.google.habilitado();
  }

  // ── Dominios propios ───────────────────────────────────────────────────

  /**
   * Deja un dominio propio listo en Search Console: pide el token, espera a que
   * la etiqueta esté publicada, lo verifica, lo agrega y le envía el sitemap.
   * Se puede llamar las veces que haga falta: cada paso se salta si ya está hecho.
   * Nunca tira: un fallo queda en `gscError` y el dominio sigue como estaba.
   */
  async registrarDominio(domainId: string, opciones: { forzar?: boolean; ahora?: Date } = {}): Promise<{ estado: EstadoDominio; mensaje?: string }> {
    if (!this.google.habilitado()) return { estado: 'no_configurado' };
    const ahora = opciones.ahora ?? new Date();
    const d = await this.prisma.customDomain.findUnique({ where: { id: domainId } });
    // Google tiene que poder abrir la portada por HTTPS: solo con el dominio ya activo.
    if (!d || d.status !== 'ACTIVE' || !d.dnsVerified) return { estado: 'inactivo' };

    const alDia = d.gscStatus === 'VERIFICADO' && d.gscSitemapAt && ahora.getTime() - d.gscSitemapAt.getTime() < REENVIO_SITEMAP_MS;
    if (alDia && !opciones.forzar) return { estado: 'verificado' };
    // Mientras el cliente aprieta "verificar" cada pocos segundos, no se le insiste a Google.
    if (!opciones.forzar && d.gscStatus === 'PENDIENTE' && d.gscTriedAt && ahora.getTime() - d.gscTriedAt.getTime() < ESPERA_ENTRE_INTENTOS_MS) {
      return { estado: 'pendiente', mensaje: d.gscError ?? undefined };
    }

    const sitio = `https://${d.domain}/`;
    try {
      let token = d.gscVerificationToken;
      if (!token) {
        token = await this.google.pedirTokenMeta(sitio);
        await this.prisma.customDomain.update({ where: { id: d.id }, data: { gscVerificationToken: token, gscTriedAt: ahora, gscError: null } });
        // La etiqueta recién empieza a servirse con este token (la tienda la lee de la
        // API, que guarda su respuesta un minuto): verificar ahora no puede funcionar.
        return { estado: 'pendiente', mensaje: 'Esperando que la etiqueta de verificación se publique en la portada.' };
      }

      if (d.gscStatus !== 'VERIFICADO') {
        try {
          await this.google.verificarPorMeta(sitio);
        } catch (e) {
          const mensaje = explicarErrorDeGoogle(e);
          await this.prisma.customDomain.update({ where: { id: d.id }, data: { gscTriedAt: ahora, gscError: mensaje } });
          return { estado: 'pendiente', mensaje };
        }
        await this.prisma.customDomain.update({ where: { id: d.id }, data: { gscStatus: 'VERIFICADO', gscError: null, gscTriedAt: ahora } });
      }

      await this.google.agregarSitio(sitio);
      await this.google.enviarSitemap(sitio, `${sitio}sitemap.xml`);
      await this.prisma.customDomain.update({ where: { id: d.id }, data: { gscSitemapAt: ahora, gscError: null, gscTriedAt: ahora } });
      return { estado: 'verificado' };
    } catch (e) {
      const mensaje = explicarErrorDeGoogle(e);
      this.logger.warn(`Search Console: no se pudo registrar ${d.domain} — ${mensaje}`);
      await this.prisma.customDomain.update({ where: { id: d.id }, data: { gscTriedAt: ahora, gscError: mensaje } }).catch(() => undefined);
      return { estado: d.gscStatus === 'VERIFICADO' ? 'verificado' : 'pendiente', mensaje };
    }
  }

  // ── Subdominios ────────────────────────────────────────────────────────

  /** Le envía a Google el sitemap de slug.orbita.site, bajo la propiedad de dominio orbita.site. */
  async enviarSitemapDeSubdominio(businessId: string, subdomain: string, ahora = new Date()): Promise<{ ok: boolean; mensaje?: string }> {
    if (!this.google.habilitado()) return { ok: false, mensaje: 'Search Console no está configurado en este entorno.' };
    try {
      await this.google.enviarSitemap(PROPIEDAD_DE_ORBITA, `https://${subdomain}.${DOMINIO_RAIZ}/sitemap.xml`);
      await this.prisma.business.update({ where: { id: businessId }, data: { gscSitemapAt: ahora } });
      return { ok: true };
    } catch (e) {
      return { ok: false, mensaje: explicarErrorDeGoogle(e) };
    }
  }

  // ── Mantenimiento nocturno ─────────────────────────────────────────────

  /**
   * Cuelga del mantenimiento nocturno (internal-cron): reintenta los dominios que
   * no pudieron verificarse y envía el sitemap de las tiendas que todavía no lo
   * tienen enviado (o hace más de una semana). Acotado por corrida para no
   * agotar la cuota de Google si algún día hay miles de tiendas.
   */
  async mantenimientoNocturno(opciones: { limiteDominios?: number; limiteSubdominios?: number; ahora?: Date } = {}) {
    if (!this.google.habilitado()) return { dominios: 0, subdominios: 0 };
    const ahora = opciones.ahora ?? new Date();
    const hace7dias = new Date(ahora.getTime() - REENVIO_SITEMAP_MS);

    const dominios = await this.prisma.customDomain.findMany({
      where: {
        status: 'ACTIVE',
        dnsVerified: true,
        OR: [{ gscStatus: 'PENDIENTE' }, { gscSitemapAt: null }, { gscSitemapAt: { lt: hace7dias } }],
      },
      select: { id: true },
      orderBy: { gscTriedAt: { sort: 'asc', nulls: 'first' } },
      take: opciones.limiteDominios ?? 20,
    });
    for (const d of dominios) await this.registrarDominio(d.id, { ahora, forzar: true });

    // Tiendas que se indexan bajo su subdominio: publicadas, con algo a la venta y
    // sin dominio propio activo (con uno, el sitemap del subdominio sale vacío).
    const tiendas = await this.prisma.business.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isPaused: false,
        isDemo: false,
        hiddenFromSearch: false,
        OR: [{ gscSitemapAt: null }, { gscSitemapAt: { lt: hace7dias } }],
        customDomains: { none: { status: 'ACTIVE', dnsVerified: true } },
        products: { some: { deletedAt: null, status: { in: ['PUBLISHED', 'OUT_OF_STOCK'] } } },
      },
      select: { id: true, subdomain: true },
      orderBy: { gscSitemapAt: { sort: 'asc', nulls: 'first' } },
      take: opciones.limiteSubdominios ?? 25,
    });
    let enviados = 0;
    for (const t of tiendas) {
      const r = await this.enviarSitemapDeSubdominio(t.id, t.subdomain, ahora);
      if (r.ok) {
        enviados++;
        continue;
      }
      // Sin permiso sobre orbita.site fallarían todas igual: se corta y se avisa una vez.
      this.logger.warn(`Search Console: se corta el envío de sitemaps de subdominios — ${r.mensaje}`);
      break;
    }
    return { dominios: dominios.length, subdominios: enviados };
  }

  // ── Superadmin ─────────────────────────────────────────────────────────

  /** El botón "Enviar a Google" de una tienda: lo mismo que la corrida nocturna, pero ahora y para ella. */
  async sincronizarTienda(businessId: string) {
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, subdomain: true, customDomains: { where: { status: 'ACTIVE', dnsVerified: true }, select: { id: true, domain: true } } },
    });
    if (!b) throw new NotFoundException('Negocio no encontrado');
    const dominios = [];
    for (const d of b.customDomains) dominios.push({ domain: d.domain, ...(await this.registrarDominio(d.id, { forzar: true })) });
    // Con dominio propio activo, el sitemap del subdominio sale vacío: no se envía.
    const subdominio = b.customDomains.length === 0 ? await this.enviarSitemapDeSubdominio(b.id, b.subdomain) : null;
    return { configurado: this.google.habilitado(), dominios, subdominio };
  }

  /**
   * Cómo ve Google a una tienda: clics, impresiones, posición, qué búsquedas la
   * traen y si su portada está en el índice. Cada bloque se pide por separado:
   * si uno falla (por ejemplo, la portada todavía no la visitó Google) los demás
   * se muestran igual.
   */
  async resumenDeTienda(businessId: string, ahora = new Date()): Promise<ResumenGoogle> {
    const vacio: ResumenGoogle = {
      configurado: this.google.habilitado(), aviso: null, propiedad: null, origen: null, dominioPropio: null, sitemapSubdominioAt: null,
      periodo: null, rendimiento: null, consultas: [], paginas: [], inicio: null, errores: [],
    };
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        subdomain: true,
        gscSitemapAt: true,
        customDomains: {
          where: { status: 'ACTIVE', dnsVerified: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { domain: true, gscStatus: true, gscError: true, gscSitemapAt: true },
        },
      },
    });
    if (!b) throw new NotFoundException('Negocio no encontrado');
    const dom = b.customDomains[0] ?? null;
    const base: ResumenGoogle = {
      ...vacio,
      sitemapSubdominioAt: b.gscSitemapAt,
      dominioPropio: dom ? { domain: dom.domain, estado: dom.gscStatus, error: dom.gscError, sitemapEnviadoAt: dom.gscSitemapAt } : null,
    };
    if (!this.google.habilitado()) return { ...base, aviso: 'Search Console no está configurado en este entorno.' };
    if (dom && dom.gscStatus !== 'VERIFICADO') {
      return { ...base, origen: `https://${dom.domain}`, aviso: 'El dominio propio todavía no está verificado en Search Console: hasta entonces Google no devuelve datos.' };
    }

    // Con dominio propio, la propiedad es la suya; si no, la de dominio orbita.site filtrada a este subdominio.
    const origen = dom ? `https://${dom.domain}` : `https://${b.subdomain}.${DOMINIO_RAIZ}`;
    const propiedad = dom ? `${origen}/` : PROPIEDAD_DE_ORBITA;
    const filtro = dom ? undefined : ({ dimension: 'page', operator: 'contains', expression: `${origen}/` } as const);
    const hasta = new Date(ahora.getTime() - DIAS_DE_RETRASO * 86_400_000);
    const desde = new Date(hasta.getTime() - (DIAS_DE_DATOS - 1) * 86_400_000);
    const periodo = { desde: fechaISO(desde), hasta: fechaISO(hasta) };

    const [total, consultas, paginas, inicio] = await Promise.allSettled([
      this.google.rendimiento(propiedad, periodo.desde, periodo.hasta, { filtro }),
      this.google.rendimiento(propiedad, periodo.desde, periodo.hasta, { filtro, dimensiones: ['query'], limite: 8 }),
      this.google.rendimiento(propiedad, periodo.desde, periodo.hasta, { filtro, dimensiones: ['page'], limite: 8 }),
      this.google.inspeccionar(`${origen}/`, propiedad),
    ]);

    const errores: string[] = [];
    const tomar = <T>(r: PromiseSettledResult<T>): T | null => {
      if (r.status === 'fulfilled') return r.value;
      errores.push(explicarErrorDeGoogle(r.reason));
      return null;
    };
    const filaTotal = tomar(total)?.[0];
    const resultado: ResumenGoogle = {
      ...base,
      propiedad,
      origen,
      periodo,
      rendimiento: filaTotal ? { clics: filaTotal.clicks, impresiones: filaTotal.impressions, ctr: filaTotal.ctr, posicion: filaTotal.position } : null,
      consultas: (tomar(consultas) ?? []).map((f) => ({ consulta: f.keys?.[0] ?? '', clics: f.clicks, impresiones: f.impressions, posicion: f.position })),
      paginas: (tomar(paginas) ?? []).map((f) => ({ url: f.keys?.[0] ?? '', clics: f.clicks, impresiones: f.impressions })),
      inicio: tomar(inicio),
      errores: [...new Set(errores)], // si falló todo por lo mismo (sin permiso), se dice una sola vez
    };
    return resultado;
  }

  private readonly cacheDueno = new Map<string, { hasta: number; valor: ResumenParaDueno }>();

  /**
   * Lo mismo que resumenDeTienda pero para el dueño: sin errores técnicos, sin saber de
   * verificaciones ni cuentas de servicio, y nada si la tienda está oculta por moderación
   * (el dueño no tiene por qué enterarse por acá). Se guarda 10 minutos por tienda y período:
   * abrir y cerrar el desplegable no tiene que gastar la cuota diaria de Google.
   */
  async resumenParaDueno(businessId: string, from?: string, to?: string, ahora = new Date()): Promise<ResumenParaDueno> {
    const noDisponible: ResumenParaDueno = { disponible: false, motivo: 'no_disponible' };
    if (!this.google.habilitado()) return noDisponible;
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        subdomain: true,
        hiddenFromSearch: true,
        customDomains: { where: { status: 'ACTIVE', dnsVerified: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { domain: true, gscStatus: true } },
      },
    });
    if (!b || b.hiddenFromSearch) return noDisponible;
    const dom = b.customDomains[0] ?? null;
    if (dom && dom.gscStatus !== 'VERIFICADO') return { disponible: false, motivo: 'conectando' };

    const p = periodoParaGoogle(from, to, ahora);
    const clave = `${businessId}|${p.desde}|${p.hasta}`;
    const guardado = this.cacheDueno.get(clave);
    if (guardado && guardado.hasta > ahora.getTime()) return guardado.valor;

    const origen = dom ? `https://${dom.domain}` : `https://${b.subdomain}.${DOMINIO_RAIZ}`;
    const propiedad = dom ? `${origen}/` : PROPIEDAD_DE_ORBITA;
    const filtro = dom ? undefined : ({ dimension: 'page', operator: 'contains', expression: `${origen}/` } as const);
    const [total, anterior, consultas, paginas, inicio] = await Promise.allSettled([
      this.google.rendimiento(propiedad, p.desde, p.hasta, { filtro }),
      this.google.rendimiento(propiedad, p.anteriorDesde, p.anteriorHasta, { filtro }),
      this.google.rendimiento(propiedad, p.desde, p.hasta, { filtro, dimensiones: ['query'], limite: 8 }),
      this.google.rendimiento(propiedad, p.desde, p.hasta, { filtro, dimensiones: ['page'], limite: 8 }),
      this.google.inspeccionar(`${origen}/`, propiedad),
    ]);

    let valor: ResumenParaDueno;
    if (total.status === 'rejected') {
      // Sin los totales no hay nada que mostrar. Se anota para el equipo y el dueño ve que no está disponible.
      this.logger.warn(`Search Console: no se pudo leer el rendimiento de ${businessId} — ${explicarErrorDeGoogle(total.reason)}`);
      valor = noDisponible;
    } else {
      const aTotales = (f?: { clicks: number; impressions: number; ctr: number; position: number }): Totales | null =>
        f ? { clics: f.clicks, impresiones: f.impressions, ctr: f.ctr, posicion: f.position } : null;
      valor = {
        disponible: true,
        periodo: { desde: p.desde, hasta: p.hasta },
        rendimiento: aTotales(total.value[0]),
        anterior: anterior.status === 'fulfilled' ? aTotales(anterior.value[0]) : null,
        consultas: consultas.status === 'fulfilled'
          ? consultas.value.map((f) => ({ consulta: f.keys?.[0] ?? '', clics: f.clicks, impresiones: f.impressions, posicion: f.position }))
          : [],
        paginas: paginas.status === 'fulfilled'
          ? paginas.value.map((f) => ({ ruta: (f.keys?.[0] ?? '').replace(origen, '') || '/', clics: f.clicks, impresiones: f.impressions }))
          : [],
        portadaEnGoogle: inicio.status === 'fulfilled' && inicio.value.veredicto ? inicio.value.veredicto === 'PASS' : null,
      };
    }
    this.cacheDueno.set(clave, { hasta: ahora.getTime() + TTL_DUENO_MS, valor });
    if (this.cacheDueno.size > 200) this.cacheDueno.delete(this.cacheDueno.keys().next().value as string);
    return valor;
  }
}

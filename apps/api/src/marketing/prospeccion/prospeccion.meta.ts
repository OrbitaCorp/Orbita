import { DatosDeCuenta, Evaluacion, LOCAL, SENIALES, evaluar, tipoDeEnlace } from './prospeccion.criterio';

// Lectura de cuentas de Instagram por la API OFICIAL de Meta: Business Discovery, que devuelve datos públicos
// de cuentas profesionales (empresa o creador) usando la cuenta de Instagram de Órbita conectada a su página
// de Facebook. Las cuentas personales no devuelven nada y figuran como «sin datos».
//
// Necesita un token de USUARIO de Facebook (no el del inicio de sesión de Instagram, que no tiene Business
// Discovery) con instagram_basic, instagram_manage_insights, pages_read_engagement y pages_show_list. Para que
// no venza, se usa el de un usuario del sistema (ver DEPLOYMENT.md).

export const IG_ID_ORBITA = '17841426383909928'; // @orbita.site
export const GRAPH_POR_DEFECTO = 'v23.0';
export const MAX_CUENTAS_POR_LOTE = 20;
export const PAUSA_ENTRE_CONSULTAS_MS = 1200; // para no pasarse del límite de consultas por hora
const TIMEOUT_MS = 30_000;
const USUARIO_VALIDO = /^[A-Za-z0-9._]{1,30}$/;

export interface PublicacionMeta {
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
  media_type?: string;
  media_product_type?: string;
}

export interface CuentaMeta {
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: { data?: PublicacionMeta[] };
}

export interface RespuestaMeta {
  business_discovery?: CuentaMeta;
  error?: { message?: string; code?: number };
}

export interface PublicacionResumida {
  fecha: string | undefined;
  texto: string;
  likes: number | null;
  comentarios: number;
}

/** Lo público de una cuenta, ya resumido: es lo que se guarda en el prospecto y lo que lee Claude. */
export interface DatosProspecto extends DatosDeCuenta {
  nombre: string | null;
  siguiendo: number | null;
  menciones: Record<string, number>;
  hashtagsTop: string[];
  ultimasPublicaciones: PublicacionResumida[];
}

// Postgres (jsonb) rechaza el carácter nulo y los emojis cortados a la mitad (una «sustituta» suelta), y Instagram
// puede traer los dos. Se limpian al entrar, y los recortes se hacen por caracteres completos, no por unidades UTF-16.
const SUSTITUTA_SUELTA = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function limpiarTexto(s: string): string {
  return s.replace(/\u0000/g, '').replace(SUSTITUTA_SUELTA, '�');
}

export function recortarTexto(s: string, max: number): string {
  const caracteres = Array.from(s);
  return caracteres.length > max ? caracteres.slice(0, max).join('') : s;
}

/** Acepta @usuario, usuario o la URL del perfil. Devuelve null si no es un usuario válido de Instagram. */
export function normalizarUsuario(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i) ?? t.match(/^@?([A-Za-z0-9._]{1,30})$/);
  const u = m?.[1]?.toLowerCase().replace(/\/$/, '');
  return u && USUARIO_VALIDO.test(u) ? u : null;
}

export function normalizarUsuarios(lista: unknown[]): string[] {
  return [...new Set(lista.map(normalizarUsuario).filter((u): u is string => !!u))];
}

const CAMPOS = (usuario: string) =>
  `business_discovery.username(${usuario}){username,name,biography,website,followers_count,follows_count,media_count,` +
  `media.limit(25){caption,like_count,comments_count,timestamp,media_type,media_product_type}}`;

export interface ConfigMeta {
  token: string;
  igId?: string;
  version?: string;
}

/** Una consulta a Business Discovery. Nunca tira: los errores vuelven en `error`. */
export async function consultarCuenta(usuario: string, { token, igId = IG_ID_ORBITA, version = GRAPH_POR_DEFECTO }: ConfigMeta, fetchFn: typeof fetch = fetch): Promise<RespuestaMeta> {
  const url = `https://graph.facebook.com/${version}/${igId}?fields=${encodeURIComponent(CAMPOS(usuario))}`;
  try {
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return (await res.json()) as RespuestaMeta;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/** De lo que devuelve Meta a los datos que usa el criterio y lee Claude. */
export function resumirCuenta(usuario: string, bd: CuentaMeta, ahora = Date.now()): { datos: DatosProspecto; evaluacion: Evaluacion } {
  const media = bd.media?.data ?? [];
  const fechas = media.map((m) => new Date(m.timestamp ?? '')).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
  const dias = fechas.length ? Math.floor((ahora - fechas[fechas.length - 1].getTime()) / 86_400_000) : null;
  const span = fechas.length > 1 ? (fechas[fechas.length - 1].getTime() - fechas[0].getTime()) / 86_400_000 : 0;
  const postsPorSemana = span >= 7 ? Math.round((fechas.length / (span / 7)) * 10) / 10 : null;
  const seguidores = bd.followers_count ?? 0;
  const likes = media.map((m) => m.like_count).filter((n): n is number => Number.isInteger(n));
  const comentarios = media.map((m) => m.comments_count ?? 0);
  const engagementPct =
    seguidores && media.length && likes.length
      ? Math.round(((likes.reduce((a, b) => a + b, 0) + comentarios.reduce((a, b) => a + b, 0)) / media.length / seguidores) * 10_000) / 100
      : null;
  const captions = media.map((m) => limpiarTexto(m.caption ?? ''));
  const bio = limpiarTexto(bd.biography ?? '');
  const senales = Object.fromEntries(Object.entries(SENIALES).map(([k, re]) => [k, captions.filter((c) => re.test(c)).length]));
  const menciones: Record<string, number> = {};
  for (const c of [...captions, bio]) {
    for (const h of new Set([...c.matchAll(/@([A-Za-z0-9._]{2,30})/g)].map((x) => x[1].toLowerCase()))) {
      if (h !== usuario) menciones[h] = (menciones[h] ?? 0) + 1;
    }
  }
  const hashtags: Record<string, number> = {};
  for (const c of captions) {
    for (const h of new Set([...c.matchAll(/#([\p{L}\p{N}_]{3,40})/gu)].map((x) => x[1].toLowerCase()))) hashtags[h] = (hashtags[h] ?? 0) + 1;
  }
  const base: DatosDeCuenta = {
    usuario,
    bio,
    web: bd.website ? limpiarTexto(bd.website) : null,
    enlace: tipoDeEnlace(bd.website),
    seguidores,
    publicaciones: bd.media_count ?? 0,
    postsPorSemana,
    diasDesdeUltimo: dias,
    engagementPct,
    senales,
    local: LOCAL.test(`${bio} ${captions.join(' ')}`),
  };
  const datos: DatosProspecto = {
    ...base,
    nombre: bd.name ? limpiarTexto(bd.name) : null,
    siguiendo: bd.follows_count ?? null,
    menciones,
    hashtagsTop: Object.entries(hashtags).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([h]) => h),
    ultimasPublicaciones: media.slice(0, 12).map((m, i) => ({
      fecha: m.timestamp?.slice(0, 10),
      texto: recortarTexto(captions[i], 280),
      likes: m.like_count ?? null,
      comentarios: m.comments_count ?? 0,
    })),
  };
  return { datos, evaluacion: evaluar(base, Object.keys(hashtags).join(' ')) };
}
